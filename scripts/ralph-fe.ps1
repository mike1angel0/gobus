param(
    [Parameter(Mandatory=$true)]
    [string]$Phase,

    [int]$MaxIterations = 25,
    [int]$SleepSeconds = 3,
    [switch]$EnableQA,          # Enable QA story generation at end of phase
    [int]$MaxQABatches = 3,     # Max QA batches before stopping (default: 3)
    [int]$CoverageTarget = 90,  # Target coverage percentage (default: 90 for FE)
    [switch]$Compact,           # Run only progress file compaction, then exit
    [switch]$QAOnly,            # Run only QA analysis (skip main iterations)
    [int]$CompactEvery = 12,    # Run compaction every N iterations (0 to disable, default: 12)
    [int]$MaxOutput = 0,        # Max characters of text output to display (0 = unlimited)
    [switch]$IgnoreCompaction   # Don't stop/restart iteration on context compaction
)

$ErrorActionPreference = 'Stop'

# ============================================================================
# STYLING & UI HELPERS
# ============================================================================

$script:Theme = @{
    Primary    = 'Cyan'
    Secondary  = 'DarkCyan'
    Success    = 'Green'
    Warning    = 'Yellow'
    Error      = 'Red'
    Muted      = 'DarkGray'
    Text       = 'White'
    Tool       = 'Magenta'
    Result     = 'Blue'
}

$script:Icons = @{
    Robot      = "[R]"
    Check      = "[+]"
    Cross      = "[X]"
    Arrow      = ">>>"
    Gear       = "[*]"
    Clock      = "[T]"
    Money      = "[$]"
    File       = "[F]"
    Folder     = "[D]"
    Lightning  = "[!]"
    Star       = "[*]"
    Wave       = "[~]"
    Warning    = "[!]"
}

$script:Stats = @{
    StartTime      = Get-Date
    TotalCost      = 0.0
    TotalDuration  = 0
    ToolCalls      = 0
    Iterations     = 0
    TasksCompleted = 0
}

$script:IgnoreCompaction = $IgnoreCompaction.IsPresent

function Write-Banner {
    Write-Host ""
    Write-Host "  RALPH - Autonomous Coding Agent (Transio Frontend)" -ForegroundColor $Theme.Primary
    Write-Host "  ---------------------------------------------------" -ForegroundColor $Theme.Muted
    Write-Host ""
}

function Write-Box {
    param(
        [string]$Title,
        [string]$Subtitle = "",
        [string]$Color = $Theme.Primary
    )
    $width = 50
    $line = "-" * $width
    Write-Host ""
    Write-Host "  +$line+" -ForegroundColor $Color
    Write-Host "  |" -ForegroundColor $Color -NoNewline
    $paddedTitle = $Title.PadRight($width)
    Write-Host $paddedTitle -ForegroundColor $Theme.Text -NoNewline
    Write-Host "|" -ForegroundColor $Color
    if ($Subtitle) {
        Write-Host "  |" -ForegroundColor $Color -NoNewline
        $paddedSubtitle = $Subtitle.PadRight($width)
        Write-Host $paddedSubtitle -ForegroundColor $Theme.Muted -NoNewline
        Write-Host "|" -ForegroundColor $Color
    }
    Write-Host "  +$line+" -ForegroundColor $Color
    Write-Host ""
}

function Write-Iteration {
    param([int]$Current, [int]$Total)
    Write-Host "  Iteration " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host "$Current" -NoNewline -ForegroundColor $Theme.Primary
    Write-Host " of " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host "$Total" -ForegroundColor $Theme.Muted
}

function Write-Status {
    param([string]$Icon, [string]$Label, [string]$Message, [string]$Color = $Theme.Text)
    Write-Host "  $Icon " -NoNewline -ForegroundColor $Color
    Write-Host "$Label " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host $Message -ForegroundColor $Color
}

function Write-SessionStats {
    $elapsed = (Get-Date) - $script:Stats.StartTime
    $elapsedStr = "{0:hh\:mm\:ss}" -f $elapsed
    Write-Host ""
    Write-Host "  ----------------------------------------" -ForegroundColor $Theme.Muted
    Write-Host "  $($Icons.Clock) " -NoNewline -ForegroundColor $Theme.Primary
    Write-Host "Elapsed: " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host $elapsedStr -NoNewline -ForegroundColor $Theme.Text
    Write-Host "  |  " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host "$($Icons.Money) " -NoNewline -ForegroundColor $Theme.Success
    Write-Host "Cost: " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host ('$' + [math]::Round($script:Stats.TotalCost, 4)) -NoNewline -ForegroundColor $Theme.Success
    Write-Host "  |  " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host "$($Icons.Gear) " -NoNewline -ForegroundColor $Theme.Tool
    Write-Host "Tools: " -NoNewline -ForegroundColor $Theme.Muted
    Write-Host $script:Stats.ToolCalls -ForegroundColor $Theme.Tool
}

function Format-ToolInput {
    param([string]$InputStr, [int]$MaxLength = 50)
    if ($InputStr.Length -gt $MaxLength) {
        return $InputStr.Substring(0, $MaxLength) + "..."
    }
    return $InputStr
}

# ============================================================================
# CLAUDE STREAMING FUNCTION
# ============================================================================

function Invoke-ClaudeStreaming {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Prompt,
        [string]$Label = "Claude"
    )

    $textOutput = ""
    $iterationCost = 0
    $iterationDuration = 0
    $iterationTools = 0
    $script:ContextCompacted = $false
    $outputCharsWritten = 0
    $outputTruncated = $false

    $promptFile = [System.IO.Path]::GetTempFileName()

    try {
        $Prompt | Out-File -FilePath $promptFile -Encoding utf8 -NoNewline

        $job = Start-Job -ScriptBlock {
            param($promptContent)
            & claude --dangerously-skip-permissions -p --verbose --output-format stream-json $promptContent 2>&1
        } -ArgumentList (Get-Content $promptFile -Raw)

        while ($job.State -eq 'Running' -or $job.HasMoreData) {
            $lines = Receive-Job -Job $job -ErrorAction SilentlyContinue

            foreach ($line in $lines) {
                if (-not $line) { continue }

                try {
                    $json = $line | ConvertFrom-Json -ErrorAction Stop

                    switch ($json.type) {
                        "system" {
                            $timestamp = Get-Date -Format "HH:mm:ss"

                            if ($json.subtype -eq "compact_boundary") {
                                $trigger = if ($json.compactMetadata.trigger) { $json.compactMetadata.trigger } else { "unknown" }
                                $preTokens = if ($json.compactMetadata.preTokens) { $json.compactMetadata.preTokens } else { "?" }
                                if ($script:IgnoreCompaction) {
                                    Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                    Write-Host "$($Icons.Warning) Context compaction ($trigger) - was $preTokens tokens - CONTINUING (--IgnoreCompaction)" -ForegroundColor $Theme.Warning
                                } else {
                                    $script:ContextCompacted = $true
                                    Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                    Write-Host "$($Icons.Warning) Context compaction ($trigger) - was $preTokens tokens - STOPPING" -ForegroundColor $Theme.Warning
                                    Stop-Job -Job $job -ErrorAction SilentlyContinue
                                    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
                                    return $textOutput
                                }
                            } else {
                                Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                Write-Host "$($Icons.Lightning) Session initialized" -ForegroundColor $Theme.Secondary
                            }
                        }
                        "assistant" {
                            if ($json.message.content) {
                                foreach ($block in $json.message.content) {
                                    if ($block.type -eq "text") {
                                        $timestamp = Get-Date -Format "HH:mm:ss"
                                        $lines = $block.text -split "`n"
                                        foreach ($textLine in $lines) {
                                            if ($textLine.Trim()) {
                                                if ($MaxOutput -gt 0 -and -not $outputTruncated) {
                                                    $remaining = $MaxOutput - $outputCharsWritten
                                                    if ($remaining -le 0) {
                                                        $outputTruncated = $true
                                                        Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                                        Write-Host "$($Icons.Warning) Output truncated at $MaxOutput characters" -ForegroundColor $Theme.Warning
                                                    } elseif ($textLine.Length -gt $remaining) {
                                                        Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                                        Write-Host "$($Icons.Arrow) " -NoNewline -ForegroundColor $Theme.Success
                                                        Write-Host $textLine.Substring(0, $remaining) -ForegroundColor $Theme.Text
                                                        $outputCharsWritten = $MaxOutput
                                                        $outputTruncated = $true
                                                        Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                                        Write-Host "$($Icons.Warning) Output truncated at $MaxOutput characters" -ForegroundColor $Theme.Warning
                                                    } else {
                                                        $outputCharsWritten += $textLine.Length
                                                        Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                                        Write-Host "$($Icons.Arrow) " -NoNewline -ForegroundColor $Theme.Success
                                                        Write-Host $textLine -ForegroundColor $Theme.Text
                                                    }
                                                } elseif (-not $outputTruncated) {
                                                    Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                                    Write-Host "$($Icons.Arrow) " -NoNewline -ForegroundColor $Theme.Success
                                                    Write-Host $textLine -ForegroundColor $Theme.Text
                                                }
                                            }
                                        }
                                        $textOutput += $block.text + "`n"
                                    }
                                    elseif ($block.type -eq "tool_use") {
                                        $iterationTools++
                                        $script:Stats.ToolCalls++
                                        $timestamp = Get-Date -Format "HH:mm:ss"
                                        Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                        Write-Host "$($Icons.Gear) " -NoNewline -ForegroundColor $Theme.Tool
                                        Write-Host "$($block.name)" -NoNewline -ForegroundColor $Theme.Tool
                                        $inputStr = ($block.input | ConvertTo-Json -Compress)
                                        $inputStr = Format-ToolInput -InputStr $inputStr -MaxLength 150
                                        Write-Host " $inputStr" -ForegroundColor $Theme.Muted
                                    }
                                }
                            }
                        }
                        "user" {
                            if ($json.message.content) {
                                foreach ($block in $json.message.content) {
                                    if ($block.type -eq "tool_result") {
                                        $timestamp = Get-Date -Format "HH:mm:ss"
                                        Write-Host "  [$timestamp] " -NoNewline -ForegroundColor $Theme.Muted
                                        Write-Host "$($Icons.Check) " -NoNewline -ForegroundColor $Theme.Result
                                        Write-Host "Result received" -ForegroundColor $Theme.Result
                                    }
                                }
                            }
                        }
                        "result" {
                            $iterationCost = $json.total_cost_usd
                            $iterationDuration = $json.duration_ms
                            $script:Stats.TotalCost += $iterationCost
                            $script:Stats.TotalDuration += $iterationDuration

                            Write-Host ""
                            Write-Host "  +------------------------------------------+" -ForegroundColor $Theme.Success
                            Write-Host "  | " -NoNewline -ForegroundColor $Theme.Success
                            Write-Host "$($Icons.Check) Completed" -NoNewline -ForegroundColor $Theme.Success
                            $durationSec = [math]::Round($iterationDuration / 1000, 1)
                            Write-Host " | ${durationSec}s" -NoNewline -ForegroundColor $Theme.Muted
                            Write-Host " | " -NoNewline -ForegroundColor $Theme.Success
                            Write-Host ('$' + [math]::Round($iterationCost, 4)) -NoNewline -ForegroundColor $Theme.Success
                            Write-Host " | $iterationTools tools" -NoNewline -ForegroundColor $Theme.Tool
                            Write-Host " |" -ForegroundColor $Theme.Success
                            Write-Host "  +------------------------------------------+" -ForegroundColor $Theme.Success

                            if ($json.result) {
                                $textOutput += $json.result
                            }
                        }
                    }
                }
                catch {
                    if ($line -and $line.ToString().Trim()) {
                        Write-Host "  $line" -ForegroundColor $Theme.Muted
                    }
                }
            }

            Start-Sleep -Milliseconds 100
        }

        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }
    catch {
        Write-Host "  $($Icons.Cross) ERROR: $($_.Exception.Message)" -ForegroundColor $Theme.Error
    }
    finally {
        Remove-Item $promptFile -Force -ErrorAction SilentlyContinue
    }

    return $textOutput
}

# ============================================================================
# PROMPT BUILDERS
# ============================================================================

function Build-MainPrompt {
    param($phasePrd, $phaseProgress, $doubtsLog, $testRequirements, $Phase)

    $qualityChecks = "8. Run quality checks (fast, per-task gates):
   - npm run lint (check for complexity, a11y, JSDoc warnings in files you touched)
   - If your changes introduce new complexity warnings (max-lines, max-lines-per-function, complexity, max-depth), refactor before marking complete
9. OpenAPI conformance check (per-task, if you touched API calls):
   - Read the OpenAPI spec for the endpoints your component/hook calls
   - Verify your typed API call matches the spec path, method, and query params
   - Verify you handle ALL error codes defined in the spec for that endpoint (400, 401, 403, 404, 409, 423, 429)
   - If the spec defines constraints (maxLength, min/max) on request fields, verify your Zod form schema enforces the SAME constraints client-side
   - If you find a spec gap (missing field, wrong type, undocumented error code), document it in SPEC_GAPS.md at monorepo root
10. Diff review - before marking task complete:
   - Run git diff and review your own changes
   - Check for: unintended file modifications, hardcoded API URLs, console.log statements, any types, missing accessibility attributes, dangerouslySetInnerHTML, raw fetch() calls, tokens in localStorage"

    $prompt = "You are Ralph, an autonomous coding agent. Do exactly ONE task per iteration.

## CRITICAL: You are FULLY AUTONOMOUS
- NEVER ask questions, ask for confirmation, or say 'Shall I proceed?'
- NEVER wait for user input - just execute
- If something fails, fix it yourself or log it in progress and move on
- You MUST complete the task fully: implement, test, lint, mark done, commit, push

## Current Context
- Phase: $Phase (Frontend)
- Phase PRD: $phasePrd
- Progress File: $phaseProgress
- Doubts Log: $doubtsLog
- Project Root: The current working directory is the monorepo root
- Frontend directory: apps/web/
- OpenAPI Spec: spec/openapi.yaml (source of truth for API types)
- Generated types: apps/web/src/api/generated/types.ts

** Do NOT modify task files for other phases.**

## Steps

1. Read the phase PRD and find the first task NOT complete (marked [ ]).
2. Read progress.txt - check Learnings from previous iterations.
3. If you need to research something, use the Task tool with subagent_type=Explore. Do NOT guess.
4. Implement that ONE task only. Work in apps/web/ for frontend code.
5. Add JSDoc documentation: (a) all exported functions/components/hooks you create, (b) any undocumented exports in files you touch.
6. Write tests for your implementation (see Test Requirements below).
7. Run tests/typecheck to verify it works.
$qualityChecks

## Test Requirements

$testRequirements

If test framework not set up yet, set it up first and document in CLAUDE.md.

## Frontend Patterns

### API Client (API-First)
- Types are auto-generated from the OpenAPI spec via 'openapi-typescript'
- Use 'openapi-fetch' typed client — never raw fetch()
- Run 'npm run api:sync' after spec changes to regenerate types

### React Query
- Use query key factories from src/api/keys.ts
- Mutations must invalidateQueries on success
- Use staleTime per query type (search: 30s, lists: 60s, tracking: 5s)

### Components
- Skeleton loaders (not spinners) for loading states
- Error state + retry button
- Empty state + CTA
- Toast for mutation feedback
- Compose from src/components/ui/ (shadcn) — never create new base UI components

### Accessibility (WCAG 2.1 AA)
- Semantic HTML (headings hierarchy, landmarks)
- All interactive elements: aria-label or visible label
- Keyboard navigable (tab order, focus management)
- Color contrast >= 4.5:1
- Form errors: aria-describedby linking errors to fields

### Forms
- Zod schema -> z.infer<typeof schema> -> zodResolver
- Map API RFC 9457 errors[] to setError(field, { message })
- Client-side Zod limits MUST match OpenAPI spec limits (maxLength, min, max, pattern)

### Security
- NEVER use dangerouslySetInnerHTML
- NEVER store access tokens in localStorage/sessionStorage (memory only)
- NEVER put sensitive data in URL query params
- Use sanitizeUrl() for all user-provided URLs (reject javascript:, data: schemes)
- Handle all auth error codes: 401 (expired) → refresh, 403 (suspended) → logout+message, 423 (locked) → message

## Coding Standards
- **Zero 'any'**: Never use 'any'. Use 'unknown' + type guards or proper types from generated API types.
- **No hardcoded URLs**: API base URL from VITE_API_URL env var.
- **No console.log**: Use proper error handling.
- **No raw fetch**: Always use the typed API client.
- **JSDoc on all exports**: Components, hooks, utility functions.

## Spec Gap Detection (Cross-Project Automation)

When implementing a feature and you discover that the OpenAPI spec is:
- Missing an endpoint you need
- Missing a field in a request/response schema
- Missing an error code for a scenario you're handling
- Has wrong types, constraints, or enum values
- Doesn't document a query parameter you need

DO NOT work around it. Instead:
1. Document the gap in SPEC_GAPS.md at the monorepo root with format:
   ```
   ## [endpoint or schema name]
   - **Issue**: [what's missing or wrong]
   - **Found by**: FE Phase [N], TASK-[NNN]
   - **Suggested fix**: [what the spec should say]
   - **Blocking**: [yes/no - can FE proceed without this?]
   ```
2. If the gap is non-blocking, implement the FE assuming the spec WILL be fixed, and note the assumption.
3. If the gap IS blocking (e.g., entire endpoint missing), skip the task and note it in progress file.
4. The BE ralph script will pick up SPEC_GAPS.md and fix spec issues before continuing.

## Critical: Only Complete If Tests AND Quality Checks Pass

- If tests PASS and quality checks PASS:
  - Update PRD to mark task complete ([ ] to [x])
  - If ALL acceptance criteria in a TASK are now [x], COMPACT it: replace with single line under '## Completed Tasks'
  - Commit: feat(phase-${Phase}): [task description]
  - Push: git push
  - Append what worked to $phaseProgress

- If tests FAIL or quality REGRESSES:
  - Do NOT mark complete or commit broken code
  - Fix the issue first
  - Append what went wrong to $phaseProgress

## Progress Notes Format

Append to ${phaseProgress}:

## Iteration [N] - [Task Name]
- What was implemented
- Learnings for future iterations
- Do NOT list files changed
---

## Document Doubts

When uncertain, document in ${doubtsLog}: doubt, options, decision, reasoning.

## End Condition

After completing your task, check the phase PRD:
- If ALL tasks are [x]: output exactly: <phase-complete>DONE</phase-complete>
- If tasks remain [ ], just end your response"

    return $prompt
}

function Build-CompactPrompt {
    param($phaseProgress, $Phase, [switch]$CommitPush)

    $gitInstructions = if ($CommitPush) {
        "
## After Compaction
1. Stage: git add $phaseProgress
2. Commit: docs(phase-${Phase}): Update progress file
3. Push: git push"
    } else { "" }

    return "You are a documentation compactor. Read $phaseProgress and create a COMPACTED version.

## Rules
1. Keep '# Progress Log' header and '## Learnings' section
2. MERGE older iterations into '## Compacted History' (deduplicated patterns, gotchas, commands)
3. Keep under 300 lines for compacted section
4. Keep LAST 3 iterations in FULL detail
5. Write back to $phaseProgress

DO NOT lose critical learnings.$gitInstructions"
}

function Build-QAPrompt {
    param($phasePrd, $CoverageTarget, $MaxQABatches, $Phase)

    return "You are a quality analysis agent. Analyze Phase $Phase (Transio Frontend) for coverage gaps and quality issues.

## Context
- Phase PRD: $phasePrd
- Project: apps/web/ (run commands from there)
- Coverage target: ${CoverageTarget}%
- Max QA batches: $MaxQABatches

## Steps

1. Run coverage: cd apps/web && npm run test:coverage
2. Run quality checks:
   - Type safety: search for ': any' and 'as any' in apps/web/src/ excluding tests
   - Accessibility: check all components have aria-labels, semantic HTML
   - JSDoc: check all exported functions/components/hooks have JSDoc
   - Complexity: npm run lint warnings
3-7. Generate QA stories as needed.

## Story Types

### Coverage: One story per untested component/hook/utility (happy + error paths)
### Type Safety: 'Remove any type from [file]' for each any in production code
### Accessibility: 'Fix a11y: [component] missing [issue]' for a11y violations
### JSDoc: 'Add JSDoc to [file]' for undocumented exports
### Complexity: 'Refactor [file]' for files >500 lines or functions >250 lines

Story ID: US-QA-NNN | Max 2 ACs each | Write to PRD, commit, push.

## Important
- Only files from THIS phase
- Prioritize: (1) Type safety, (2) A11y, (3) Coverage, (4) JSDoc, (5) Complexity
- Max 50 stories per batch"
}

function Build-ValidatePrompt {
    param($phasePrd, $Phase)

    return "You are a validation agent. Verify Phase $Phase (Transio Frontend).

1. Read $phasePrd - check each [x] criteria

## Fast gates (code correctness) - from apps/web/
2. npm run typecheck (strict, zero errors)
3. npm run lint (zero errors; complexity, a11y, JSDoc rules)
4. npm run build (production build succeeds)
5. npm run test (all tests pass)
6. npm run test:coverage (>= ${CoverageTarget}%)

## API contract gates
7. npm run api:check (if script exists) - all API calls match spec, types up-to-date
8. Verify generated types match current spec (check if api:sync needed)
9. Spot-check 3 form Zod schemas: verify client-side limits match OpenAPI spec constraints
   (e.g., if spec says name maxLength: 100, form Zod must have .max(100))
10. Check SPEC_GAPS.md — if blocking gaps exist, WARN but do not reject

## Security gates
11. Zero 'any' in production code - REJECT if found
12. Zero 'dangerouslySetInnerHTML' in codebase - REJECT if found
13. Grep for 'localStorage.*token' or 'sessionStorage.*token' - REJECT if access tokens stored in storage
14. Grep for 'fetch(' in src/ (excluding test/) - REJECT if raw fetch found (must use typed client)
15. Verify sanitizeUrl() exists and is used for user-provided URLs (avatarUrl, logo) - WARN
16. No console.log in production code - REJECT if found
17. No hardcoded API URLs (grep for 'localhost', 'http://', 'https://api') - REJECT if found

## UX gates
18. All exported functions/components/hooks have JSDoc - WARN if missing
19. All interactive elements accessible (spot-check 3 components for aria-labels, keyboard nav) - WARN
20. Error boundaries exist at route level - WARN if missing

Output <validation>APPROVED</validation> only if ALL hard + security gates pass:
- Typecheck, lint, build, tests all pass
- Coverage >= ${CoverageTarget}%
- Zero any, zero dangerouslySetInnerHTML
- No access tokens in localStorage
- No raw fetch
- No console.log
- No hardcoded URLs
- Form Zod schemas match spec limits

Output <validation>REJECTED</validation><reasons>specifics</reasons> if any hard gate fails.
Warnings (JSDoc, a11y spot-check, error boundaries, spec gaps) documented but do NOT cause rejection."
}

# ============================================================================
# TEST REQUIREMENTS (Frontend-specific)
# ============================================================================

$testRequirements = "| What | Test Type | Tools | Notes |
|------|-----------|-------|-------|
| Components | Component | Vitest + RTL | Render, interact, assert |
| Hooks | Unit | Vitest + renderHook | Mock API client |
| Utils/lib | Unit | Vitest | Pure functions |
| Pages | Integration | Vitest + RTL | Full page with providers |

Test file naming: foo.tsx -> foo.test.tsx
Use renderWithProviders() helper for components needing context.

**Assertion Quality**: Assert exact values. Avoid 'toBeDefined()'. Use 'toBeInTheDocument()', 'toHaveTextContent(exact)', 'toHaveAttribute(name, value)'.

**Accessibility**: Every component test should include basic a11y check (no missing labels, proper roles).

**JSDoc**: All exported functions/components/hooks MUST have JSDoc."

# ============================================================================
# RUN SINGLE PHASE
# ============================================================================

function Invoke-Phase {
    param(
        [string]$PhaseNum,
        [string]$PhasePrd,
        [string]$PhaseProgress,
        [string]$DoubtsLog,
        [int]$MaxIter
    )

    $compactInfo = if ($CompactEvery -gt 0) { "Compact: every $CompactEvery" } else { "Compact: disabled" }
    Write-Box -Title "$($Icons.Star) Phase $PhaseNum - Transio Frontend" -Subtitle "Max: $MaxIter | $compactInfo | QA: $(if($EnableQA){'On'}else{'Off'})"

    Write-Status -Icon $Icons.File -Label "PRD:" -Message $PhasePrd -Color $Theme.Secondary
    Write-Status -Icon $Icons.Folder -Label "Progress:" -Message $PhaseProgress -Color $Theme.Secondary
    Write-Host ""

    $iterationOffset = 0

    if ((Test-Path $PhaseProgress) -and ((Get-Content $PhaseProgress | Measure-Object -Line).Lines -gt 1000)) {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupFile = Join-Path $tasksDir "fe/phase-${PhaseNum}-progress.backup.$timestamp.txt"
        Copy-Item $PhaseProgress $backupFile

        Write-Box -Title "$($Icons.Folder) Compacting Progress File (>1000 lines)" -Color $Theme.Warning

        & git add $backupFile 2>&1 | Out-Null

        $compactPrompt = Build-CompactPrompt -phaseProgress $PhaseProgress -Phase $PhaseNum -CommitPush
        $result = Invoke-ClaudeStreaming -Prompt $compactPrompt -Label "Compactor"

        $iterationOffset = 1
        Start-Sleep -Seconds $SleepSeconds
    }

    for ($i = 1; $i -le ($MaxIter - $iterationOffset); $i++) {
        $displayIteration = $i + $iterationOffset
        $script:Stats.Iterations++

        Write-Host ""
        Write-Host "  ========================================" -ForegroundColor $Theme.Primary
        Write-Iteration -Current $displayIteration -Total $MaxIter
        Write-Host "  Phase $PhaseNum | $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor $Theme.Muted
        Write-Host "  ========================================" -ForegroundColor $Theme.Primary

        $prompt = Build-MainPrompt -phasePrd $PhasePrd -phaseProgress $PhaseProgress -doubtsLog $DoubtsLog -testRequirements $testRequirements -Phase $PhaseNum

        $result = Invoke-ClaudeStreaming -Prompt $prompt -Label "Ralph"
        Write-SessionStats

        if ($script:ContextCompacted) {
            Write-Host ""
            Write-Status -Icon $Icons.Wave -Label "Restart:" -Message "Context compacted - restarting with fresh context" -Color $Theme.Warning
            Start-Sleep -Seconds $SleepSeconds
            continue
        }

        # Push unpushed commits
        $unpushed = & git log '@{u}..HEAD' --oneline 2>$null
        if ($unpushed) {
            Write-Host ""
            Write-Status -Icon $Icons.Arrow -Label "Git:" -Message "Pushing commits..." -Color $Theme.Muted

            $maxRetries = 3
            $retryDelay = 2
            $pushSuccess = $false

            for ($retry = 1; $retry -le $maxRetries; $retry++) {
                $pushOutput = & git push 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $pushSuccess = $true
                    break
                }
                if ($retry -lt $maxRetries) {
                    Write-Status -Icon $Icons.Warning -Label "Git:" -Message "Push failed, retrying in ${retryDelay}s..." -Color $Theme.Warning
                    Start-Sleep -Seconds $retryDelay
                    $retryDelay = $retryDelay * 2
                }
            }

            if ($pushSuccess) {
                Write-Status -Icon $Icons.Check -Label "Git:" -Message "Pushed successfully" -Color $Theme.Success
            } else {
                Write-Status -Icon $Icons.Warning -Label "Git:" -Message "Push failed (will retry next iteration)" -Color $Theme.Warning
            }
        }

        # Periodic compaction
        if ($CompactEvery -gt 0 -and $displayIteration -gt 0 -and ($displayIteration % $CompactEvery) -eq 0) {
            if ((Test-Path $PhaseProgress) -and ((Get-Content $PhaseProgress | Measure-Object -Line).Lines -gt 100)) {
                $lineCount = (Get-Content $PhaseProgress | Measure-Object -Line).Lines
                $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
                $backupFile = Join-Path $tasksDir "fe/phase-${PhaseNum}-progress.backup.$timestamp.txt"
                Copy-Item $PhaseProgress $backupFile

                Write-Box -Title "$($Icons.Folder) Periodic Compaction (iteration $displayIteration)" -Color $Theme.Warning

                & git add $backupFile 2>&1 | Out-Null

                $compactPrompt = Build-CompactPrompt -phaseProgress $PhaseProgress -Phase $PhaseNum -CommitPush
                Invoke-ClaudeStreaming -Prompt $compactPrompt -Label "Compactor" | Out-Null

                $newLineCount = (Get-Content $PhaseProgress | Measure-Object -Line).Lines
                Write-Status -Icon $Icons.Check -Label "Compacted:" -Message "$lineCount -> $newLineCount lines" -Color $Theme.Success
            }
        }

        if ($result -match "<phase-complete>DONE</phase-complete>") {
            Write-Box -Title "$($Icons.Star) Phase $PhaseNum Implementation Complete!" -Color $Theme.Success

            if ($EnableQA) {
                Write-Box -Title "$($Icons.Gear) Quality Analysis" -Subtitle "Target coverage: $CoverageTarget%" -Color $Theme.Primary

                $qaPrompt = Build-QAPrompt -phasePrd $PhasePrd -CoverageTarget $CoverageTarget -MaxQABatches $MaxQABatches -Phase $PhaseNum
                $qaResult = Invoke-ClaudeStreaming -Prompt $qaPrompt -Label "QA Agent"
                Write-SessionStats

                if ($qaResult -match "<coverage>(\d+)%</coverage>") {
                    $currentCoverage = $matches[1]
                    $coverageColor = if ([int]$currentCoverage -ge $CoverageTarget) { $Theme.Success } else { $Theme.Warning }
                    Write-Status -Icon $Icons.Check -Label "Coverage:" -Message "$currentCoverage%" -Color $coverageColor
                }

                if ($qaResult -match "<qa-status>ADDED</qa-status>") {
                    Start-Sleep -Seconds $SleepSeconds
                    continue
                }
                if ($qaResult -match "<qa-status>PENDING</qa-status>") {
                    Start-Sleep -Seconds $SleepSeconds
                    continue
                }
            }

            # Final validation
            Write-Box -Title "$($Icons.Check) Final Validation - Phase $PhaseNum" -Color $Theme.Primary

            $validatePrompt = Build-ValidatePrompt -phasePrd $PhasePrd -Phase $PhaseNum
            $validation = Invoke-ClaudeStreaming -Prompt $validatePrompt -Label "Validator"
            Write-SessionStats

            if ($validation -match "<validation>APPROVED</validation>") {
                Write-Host ""
                Write-Host "  +==================================================+" -ForegroundColor $Theme.Success
                Write-Host "  |  $($Icons.Star) PHASE $PhaseNum COMPLETE & APPROVED! $($Icons.Star)              |" -ForegroundColor $Theme.Success
                Write-Host "  +==================================================+" -ForegroundColor $Theme.Success
                Write-Host ""
                return $true
            } else {
                Write-Status -Icon $Icons.Cross -Label "Validation:" -Message "Rejected - fixing" -Color $Theme.Warning
                $reasons = ""
                if ($validation -match "<reasons>([\s\S]*?)</reasons>") {
                    $reasons = $matches[1].Trim()
                }
                if ($reasons) {
                    Add-Content -Path $PhaseProgress -Value "`n## Validation Rejected`n$reasons`n---`n"
                }
            }
        }

        Start-Sleep -Seconds $SleepSeconds
    }

    Write-Host ""
    Write-Host "  +==================================================+" -ForegroundColor $Theme.Warning
    Write-Host "  |  $($Icons.Cross) MAX ITERATIONS ($MaxIter) for Phase $PhaseNum          |" -ForegroundColor $Theme.Warning
    Write-Host "  +==================================================+" -ForegroundColor $Theme.Warning
    Write-Host ""
    return $false
}

# ============================================================================
# MAIN SCRIPT
# ============================================================================

$rootDir = Split-Path -Parent $PSScriptRoot
if (-not $rootDir) { $rootDir = Get-Location }

Set-Location $rootDir

$tasksDir = Join-Path $rootDir "tasks"
$doubtsLog = Join-Path $rootDir "DOUBTS_AND_DECISIONS.md"

Write-Banner

$isAllPhases = $Phase -eq 'all'
if ($isAllPhases) {
    $allPhaseFiles = Get-ChildItem -Path (Join-Path $tasksDir "fe") -Filter "phase-*-*.md" -File |
        Where-Object { $_.Name -match '^phase-(\d+)-' } |
        Sort-Object { [int]($_.Name -replace '^phase-(\d+)-.*', '$1') }
    $phaseNumbers = $allPhaseFiles | ForEach-Object { [int]($_.Name -replace '^phase-(\d+)-.*', '$1') }

    if ($phaseNumbers.Count -eq 0) {
        Write-Host "  $($Icons.Cross) No phase task files found in $tasksDir/fe" -ForegroundColor $Theme.Error
        exit 1
    }

    Write-Box -Title "$($Icons.Star) ALL PHASES MODE (1-$($phaseNumbers[-1]))" -Subtitle "Sequential until done or failure" -Color $Theme.Primary
} else {
    $phaseNumbers = @([int]$Phase)
}

# COMPACT-ONLY
if ($Compact) {
    $phaseProgress = Join-Path $tasksDir "fe/phase-${Phase}-progress.txt"
    if (-not (Test-Path $phaseProgress)) { Write-Host "  $($Icons.Cross) Not found: $phaseProgress" -ForegroundColor $Theme.Error; exit 1 }
    $lineCount = (Get-Content $phaseProgress | Measure-Object -Line).Lines
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = Join-Path $tasksDir "fe/phase-${Phase}-progress.backup.$timestamp.txt"
    Copy-Item $phaseProgress $backupFile
    & git add $backupFile 2>&1 | Out-Null
    $compactPrompt = Build-CompactPrompt -phaseProgress $phaseProgress -Phase $Phase -CommitPush
    Invoke-ClaudeStreaming -Prompt $compactPrompt -Label "Compactor" | Out-Null
    $newLineCount = (Get-Content $phaseProgress | Measure-Object -Line).Lines
    Write-Status -Icon $Icons.Check -Label "Result:" -Message "Compacted $lineCount -> $newLineCount lines" -Color $Theme.Success
    exit 0
}

# QA-ONLY
if ($QAOnly) {
    $taskFiles = Get-ChildItem -Path (Join-Path $tasksDir "fe") -Filter "phase-${Phase}-*.md" -File
    $phasePrd = $taskFiles[0].FullName
    Write-Box -Title "$($Icons.Gear) QA-Only Mode" -Subtitle "Target: $CoverageTarget%" -Color $Theme.Primary
    $qaPrompt = Build-QAPrompt -phasePrd $phasePrd -CoverageTarget $CoverageTarget -MaxQABatches $MaxQABatches -Phase $Phase
    Invoke-ClaudeStreaming -Prompt $qaPrompt -Label "QA Agent" | Out-Null
    Write-SessionStats
    exit 0
}

# PHASE LOOP
$completedPhases = @()
$failedPhase = $null

foreach ($phaseNum in $phaseNumbers) {
    $taskFiles = Get-ChildItem -Path (Join-Path $tasksDir "fe") -Filter "phase-${phaseNum}-*.md" -File
    if ($taskFiles.Count -eq 0) {
        Write-Host "  $($Icons.Cross) No task file for phase $phaseNum in $tasksDir/fe" -ForegroundColor $Theme.Error
        if ($isAllPhases) { $failedPhase = $phaseNum; break }
        exit 1
    }

    $phasePrd = $taskFiles[0].FullName
    $phaseProgress = Join-Path $tasksDir "fe/phase-${phaseNum}-progress.txt"

    if (-not ((Get-Content $phasePrd -Raw) -match '\[ \]')) {
        Write-Status -Icon $Icons.Check -Label "Phase ${phaseNum}:" -Message "Already complete - skipping" -Color $Theme.Success
        $completedPhases += $phaseNum
        continue
    }

    $phaseResult = Invoke-Phase -PhaseNum $phaseNum -PhasePrd $phasePrd -PhaseProgress $phaseProgress -DoubtsLog $doubtsLog -MaxIter $MaxIterations

    if ($phaseResult) {
        $completedPhases += $phaseNum
        if ($isAllPhases) {
            Write-Status -Icon $Icons.Arrow -Label "Next:" -Message "Advancing to phase $($phaseNum + 1)..." -Color $Theme.Primary
        }
    } else {
        $failedPhase = $phaseNum
        break
    }
}

# FINAL SUMMARY
$elapsed = (Get-Date) - $script:Stats.StartTime
$elapsedStr = "{0:hh\:mm\:ss}" -f $elapsed

Write-Host ""
if ($failedPhase) {
    Write-Host "  +==================================================+" -ForegroundColor $Theme.Warning
    Write-Host "  |  $($Icons.Cross) STOPPED at Phase $failedPhase (max iterations)        |" -ForegroundColor $Theme.Warning
    Write-Host "  |  Iterations: $($script:Stats.Iterations.ToString().PadRight(36))|" -ForegroundColor $Theme.Warning
    Write-Host "  |  Total Cost: $('$' + [math]::Round($script:Stats.TotalCost, 4).ToString().PadRight(35))|" -ForegroundColor $Theme.Warning
    Write-Host "  |  Total Time: $($elapsedStr.PadRight(36))|" -ForegroundColor $Theme.Warning
    Write-Host "  |  Tool Calls: $($script:Stats.ToolCalls.ToString().PadRight(36))|" -ForegroundColor $Theme.Warning
    Write-Host "  +==================================================+" -ForegroundColor $Theme.Warning
    exit 1
} else {
    $phasesStr = if ($isAllPhases) { "ALL PHASES ($(($completedPhases -join ', ')))" } else { "Phase $($completedPhases[0])" }
    Write-Host "  +==================================================+" -ForegroundColor $Theme.Success
    Write-Host "  |  $($Icons.Star) $($phasesStr.PadRight(43))|" -ForegroundColor $Theme.Success
    Write-Host "  |     COMPLETE!                                    |" -ForegroundColor $Theme.Success
    Write-Host "  |  Iterations: $($script:Stats.Iterations.ToString().PadRight(36))|" -ForegroundColor $Theme.Success
    Write-Host "  |  Total Cost: $('$' + [math]::Round($script:Stats.TotalCost, 4).ToString().PadRight(35))|" -ForegroundColor $Theme.Success
    Write-Host "  |  Total Time: $($elapsedStr.PadRight(36))|" -ForegroundColor $Theme.Success
    Write-Host "  |  Tool Calls: $($script:Stats.ToolCalls.ToString().PadRight(36))|" -ForegroundColor $Theme.Success
    Write-Host "  +==================================================+" -ForegroundColor $Theme.Success
    exit 0
}
