param(
    [Parameter(Mandatory=$true)]
    [string]$Phase,

    [int]$MaxIterations = 25,
    [int]$SleepSeconds = 3,
    [switch]$EnableQA,          # Enable QA story generation at end of phase
    [int]$MaxQABatches = 3,     # Max QA batches before stopping (default: 3)
    [int]$CoverageTarget = 85,  # Target coverage percentage (default: 85)
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
    Write-Host "  RALPH - Autonomous Coding Agent (Transio Backend)" -ForegroundColor $Theme.Primary
    Write-Host "  --------------------------------------------------" -ForegroundColor $Theme.Muted
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

        # Start Claude as a job so we can stop it if compaction is detected
        $job = Start-Job -ScriptBlock {
            param($promptContent)
            & claude --dangerously-skip-permissions -p --verbose --output-format stream-json $promptContent 2>&1
        } -ArgumentList (Get-Content $promptFile -Raw)

        # Process output line by line
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
    param($phasePrd, $phaseProgress, $doubtsLog, $testRequirements, $observabilitySection, $Phase)

    $qualityChecks = "8. Run quality checks (fast, per-task gates):
   - npm run lint (check for complexity warnings in files you touched)
   - npm run spec:lint (validates OpenAPI spec — only if you touched spec files)
   - If you touched/created an API endpoint: verify the Zod schema matches the OpenAPI spec for that endpoint (field names, types, maxLength, min/max, required vs optional)
   - If you touched the OpenAPI spec: verify ALL string fields have maxLength, ALL numbers have min/max, ALL arrays have minItems/maxItems, ALL enums are exhaustive
   - If your changes introduce new complexity warnings (max-lines, max-lines-per-function, complexity, max-depth), refactor before marking complete
9. OpenAPI contract check (per-task, if you touched routes):
   - Read the OpenAPI spec for the endpoint you implemented
   - Verify request body Zod schema field-by-field matches spec (names, types, constraints, required)
   - Verify response shape matches spec (envelope format, field names, nested objects)
   - Verify error responses follow RFC 9457 (type, title, status, detail, code)
   - Verify ownership checks exist for all mutation endpoints (BOLA/IDOR prevention)
10. Diff review - before marking task complete:
   - Run git diff and review your own changes
   - Check for: unintended file modifications, missing error handling, hardcoded values, console.log, 'as any', missing .describe() on Zod fields
   NOTE: Slow project-wide scans (npm audit, gitleaks, license checks, full api:validate) run at phase validation, NOT per task."

    $apiContractSection = '## API Contract Requirements (RFC 9457 + OpenAPI Spec-First)

When implementing or modifying API endpoints:

1. **OpenAPI spec is the source of truth**: The spec at `spec/openapi.yaml` defines the contract. Implementation MUST match the spec.
2. **Every Zod field MUST have `.describe()`**: Field descriptions should match the OpenAPI spec field descriptions.
3. **Route `schema` property required**: Every route must declare `schema: { tags, description, body/querystring/params, response }` with Zod schemas.
4. **Response schemas**: Both request AND response Zod schemas go in `src/api/{domain}/schemas.ts`. Use `dataResponse()` / `paginatedResponse()` wrappers from `src/shared/schemas.ts`.
5. **Error Format**: Use RFC 9457 Problem Details — required: type, title, status; recommended: detail, code, errors
6. **Error Codes**: Use consistent codes from `src/domain/errors/error-codes.ts`
7. **Forbidden**: Do not use `{error, message}` or `{success: false}` patterns
8. **Responses must match spec**: All response shapes must conform to the OpenAPI spec schemas
9. **Limits everywhere**: Every string in Zod MUST have `.max(N)`, every number MUST have `.min(N).max(N)`, every array MUST have `.max(N)`. These limits MUST match the OpenAPI spec maxLength/minimum/maximum/maxItems.
10. **Strict parsing**: All Zod schemas MUST use `.strict()` to reject unknown fields (mass assignment prevention).
11. **Ownership enforcement**: Every mutation endpoint for PROVIDER resources MUST verify `resource.providerId === request.user.providerId`. Every PASSENGER resource MUST verify `resource.userId === request.user.id`. Return 404 (not 403) on ownership failure to prevent resource enumeration.

'

    $prompt = "You are Ralph, an autonomous coding agent. Do exactly ONE task per iteration.

## CRITICAL: You are FULLY AUTONOMOUS
- NEVER ask questions, ask for confirmation, or say 'Shall I proceed?'
- NEVER wait for user input - just execute
- Use --force flags on destructive dev commands (prisma migrate reset --force, etc.) - the database is a local dev Docker container with no real data
- If something fails, fix it yourself or log it in progress and move on
- You MUST complete the task fully: implement, test, lint, mark done, commit, push

## Current Context
- Phase: $Phase (Backend)
- Phase PRD: $phasePrd
- Progress File: $phaseProgress
- Doubts Log: $doubtsLog
- Project Root: The current working directory is the monorepo root
- Backend directory: apps/api/
- OpenAPI Spec: spec/openapi.yaml (source of truth for API contract)

** Do NOT modify task files for other phases.**

## Steps

1. **Check for spec gaps first**: Read SPEC_GAPS.md at monorepo root (if it exists). If there are blocking gaps documented by the FE team, fix those BEFORE your regular task. For each gap: update spec/openapi.yaml, update the corresponding Zod schema in apps/api/, run spec:lint, commit with message 'fix(spec): [gap description]', then remove the resolved entry from SPEC_GAPS.md. After fixing all blocking gaps, continue to step 2.
2. Read the phase PRD and find the first task NOT complete (marked [ ]).
3. Read progress.txt - check Learnings from previous iterations.
4. If you need to research something (APIs, libraries, best practices), use the Task tool with subagent_type=Explore or subagent_type=general-purpose. Do NOT guess.
5. Implement that ONE task only. Work in apps/api/ for backend code, spec/ for OpenAPI spec.
6. Add JSDoc documentation: (a) all exported functions/classes you create, (b) any undocumented exports in files you touch.
7. Write tests for your implementation (see Test Requirements below).
8. Run tests/typecheck to verify it works (from apps/api/).
$qualityChecks

## Test Requirements

$testRequirements

If test framework not set up yet, set it up first and document succinctly in CLAUDE.md.
$observabilitySection
$apiContractSection
## Coding Standards
- **No Hardcoding**: Never hardcode provider names, feature flags, rate limits, or configuration values. Use database-driven or env-driven configuration.
- **Constants OK**: Technical constants (timeouts, retry limits, validation bounds) that would break the system if changed arbitrarily can stay in code.
- **Zero `any`**: Never use `any` in production code. Use `unknown` + type guards.
- **API-First**: When implementing an endpoint, read the OpenAPI spec first to understand the expected request/response shapes.

## Critical: Only Complete If Tests AND Quality Checks Pass

- If tests PASS and quality checks PASS:
  - Update PRD to mark task complete ([ ] to [x])
  - If ALL acceptance criteria in a TASK are now [x], COMPACT it: replace the full task with a single line under '## Completed Tasks' section: '**TASK-XXX: Title** - Brief summary of what was implemented.'
  - Commit with message: feat(phase-${Phase}): [task description]
  - Push to current branch: git push
  - Append what worked to $phaseProgress

- If tests FAIL or quality REGRESSES:
  - Do NOT mark complete
  - Do NOT commit broken code
  - Fix the issue first (security vuln, complexity warning, contract error)
  - If you added a function >100 lines or file >500 lines, refactor it
  - Append what went wrong to $phaseProgress (so next iteration can learn)

## Progress Notes Format

**IMPORTANT: Write ONLY to $phaseProgress - do NOT modify other phase progress files.**

Append to ${phaseProgress}:

## Iteration [N] - [Task Name]
- What was implemented
- Learnings for future iterations (patterns discovered, gotchas encountered, useful context)
- Do NOT list files changed (wastes tokens)
---

## Environment Variables

When adding code that uses process.env.* variables:
1. Add the variable to .env.example with a descriptive comment
2. Update the Environment Variables table in CLAUDE.md if commonly used

## Document Doubts

When uncertain about implementation choices, document in ${doubtsLog}: what the doubt was, options considered, decision made and why (prefer common sense, conventional approaches).

## End Condition

After completing your task, check the phase PRD:
- If ALL tasks are [x]:
  - Check progress.txt for any '## Validation Rejected - Fixes Needed' entries
  - If rejection entries exist: fix ALL listed issues, commit, push, then END your response (do NOT output phase-complete — let the next iteration verify the fixes are clean)
  - If no rejection entries: output exactly: <phase-complete>DONE</phase-complete>
- If tasks remain [ ], just end your response (next iteration will continue)"

    return $prompt
}

function Build-CompactPrompt {
    param($phaseProgress, $Phase, [switch]$CommitPush)

    $gitInstructions = if ($CommitPush) {
        "
## After Compaction

After writing the compacted file:
1. Stage the changes: git add $phaseProgress
2. Commit with message: docs(phase-${Phase}): Update progress file
3. Push to current branch: git push"
    } else { "" }

    return "You are a documentation compactor. Read the progress file at $phaseProgress and create a COMPACTED version.

## Rules
1. Keep the '# Progress Log' header and '## Learnings' section
2. MERGE all older iteration details into a single '## Compacted History' section with: Key patterns discovered (deduplicated), Important gotchas (deduplicated), Useful commands (deduplicated)
3. The '## Compacted History' section should be under 300 lines (this limit does NOT apply to recent iterations)
4. Keep the LAST 3 iterations in FULL detail (no summarization)
5. Write the compacted content back to $phaseProgress

DO NOT lose critical learnings - just deduplicate and summarize older iterations while preserving recent ones in full.$gitInstructions"
}

function Build-QAPrompt {
    param($phasePrd, $CoverageTarget, $MaxQABatches, $Phase)

    return "You are a quality analysis agent. Analyze Phase $Phase (Transio Backend) for test coverage gaps AND API contract consistency.

## Context
- Phase PRD: $phasePrd
- Project directory: apps/api/ (run commands from there)
- OpenAPI Spec: spec/openapi.yaml (source of truth)
- Coverage target: ${CoverageTarget}%
- Max QA batches allowed: $MaxQABatches

## Steps

1. Run coverage: cd apps/api && npm run test:coverage
   Parse the output to get overall coverage percentage.

2. Validate API conformance:
   - Check ALL implemented endpoints return shapes matching the OpenAPI spec
   - Check ALL error responses follow RFC 9457 format: { type, title, status, detail?, code?, errors? }
   - Flag any non-compliant formats like: { error, message } or { success: false, error: ... }

3. Run additional quality checks:
   - Security: cd apps/api && npm audit --audit-level=high
   - Type safety: search for ': any' and 'as any' in apps/api/src/ excluding tests (should be 0)
   - Architecture: check domain/ for imports from api/, infrastructure/, or application/ (should be none)
   - Complexity: npm run lint and check for complexity warnings
   - JSDoc: check all exported functions have JSDoc

4. Read the PRD and check if a '### Quality Assurance (Auto-Generated)' section exists.

5-7. Generate QA stories as needed (same logic as standard QA flow).

## User Story Generation Rules

Each story must be completable in ONE context window (~10 min of AI work).

### Coverage Stories
Generate ONE user story per: Each untested public method (happy path), Each untested error/edge case, Each uncovered branch in critical code.

### API Contract Stories
If responses don't match OpenAPI spec schemas:
- Story: 'Fix API response: [endpoint] to match OpenAPI spec'

### Type Safety Stories
If 'any' found in production code:
- Story: 'Remove any type from [filename]'

### Architecture Stories
If domain layer imports from outer layers:
- Story: 'Fix architecture violation: [file] imports from [layer]'

### Complexity Stories
- Files >500 lines: 'Refactor [filename]: split into smaller modules'
- Functions >100 lines: 'Refactor [function] in [file]: extract helper functions'

### JSDoc Stories
- Exported functions without JSDoc: 'Add JSDoc to [file]'

### OpenAPI Spec Parity Stories
For each Zod schema that doesn't match the OpenAPI spec:
- Missing maxLength: 'Add maxLength to [field] in [schema] to match spec'
- Missing min/max: 'Add bounds to [field] in [schema] to match spec'
- Missing .strict(): 'Add .strict() to [schema] for mass assignment prevention'
- Missing .describe(): 'Add .describe() to [field] in [schema] for OpenAPI docs'

### Security / Pentest Stories
For each mutation endpoint without ownership check:
- Story: 'Add ownership enforcement to [endpoint]'
For each route schema without .strict():
- Story: 'Add .strict() to [schema] for mass assignment prevention'
For each unbounded field in a route schema:
- Story: 'Add bounds to [field] in [schema]'
For SPEC_GAPS.md entries (if file exists):
- Story: 'Fix spec gap: [gap description] (reported by FE)'

Story ID: US-QA-NNN | Title | Max 2 ACs each.

## CRITICAL: Write Stories to PRD
Append to PRD file ($phasePrd) using Edit tool. Commit and push after writing.

## Important
- Only generate stories for files changed/created in THIS phase
- Prioritize: (1) API contract compliance, (2) Security, (3) Type safety, (4) Coverage gaps, (5) Architecture, (6) JSDoc
- Max 50 QA stories per batch"
}

function Build-ValidatePrompt {
    param($phasePrd, $Phase)

    return "You are a validation agent. Verify Phase $Phase (Transio Backend) is correctly implemented.

1. Read $phasePrd - check each [x] criteria is actually done (including QA section if present)

## Fast gates (code correctness) - run from apps/api/
2. npm run typecheck (TypeScript strict mode)
3. npm run lint (ESLint with complexity rules + JSDoc)
4. npm run build (production build)
5. npm run test (all unit tests)
6. npm run test:integration (all integration tests)

## Contract gates (OpenAPI conformance)
7. npm run spec:lint (from monorepo root - validates OpenAPI spec)
8. Verify API Contract Consistency (RFC 9457):
   - Error responses use AppError with required fields: type, title, status
   - Error codes are consistent with domain/errors/ patterns
   - No legacy formats like { error, message } or { success: false }
9. Verify implemented endpoints match OpenAPI spec response shapes
10. OpenAPI spec completeness check:
   - Every string field has maxLength defined
   - Every number field has minimum and maximum
   - Every array field has minItems and maxItems
   - Every enum is exhaustive (no open-ended strings)
   - Password fields have minLength + pattern
   - Email fields have format: email + maxLength
11. Zod-to-spec parity check (sample 5 endpoints):
   - Read the Zod schema for 5 random endpoints
   - Compare field-by-field against the OpenAPI spec
   - REJECT if any field is missing maxLength/min/max in Zod but present in spec
   - REJECT if any field name or type mismatches

## Security gates
12. npm audit --audit-level=high - REJECT if high/critical vulnerabilities found
13. npm run security:secrets (gitleaks) - REJECT if secrets found (if script exists)
14. Ownership enforcement spot-check:
   - Grep for 'prisma.*.delete' and 'prisma.*.update' in src/api/ routes
   - Verify each has an ownership condition (providerId or userId in where clause)
   - REJECT if any mutation lacks ownership enforcement
15. Mass assignment check:
   - Grep for Zod schemas used in routes
   - Verify they use .strict() (no unknown field passthrough)
   - REJECT if any route schema allows unknown properties
16. Input limits check:
   - Grep for z.string() without .max() in src/api/ schemas
   - Grep for z.number() without .min()/.max() in src/api/ schemas
   - Grep for z.array() without .max() in src/api/ schemas
   - REJECT if unbounded fields found in route schemas

## Project-wide quality gates
17. Check for 'any' in production code (apps/api/src/ excluding test/) - REJECT if found
18. Check all exported functions have JSDoc - WARN if missing

## Observability check
19. Check that services have structured logging (createLogger) - WARN

Output <validation>APPROVED</validation> only if ALL hard gates pass:
- Typecheck passes
- Lint passes (zero errors)
- Build succeeds
- All tests pass
- API spec validates with all fields having limits
- Zod schemas match spec (field parity, limits)
- RFC 9457 compliance verified
- No high/critical npm audit vulnerabilities
- No leaked secrets
- Ownership enforcement on all mutations
- All Zod schemas use .strict()
- All string/number/array fields have bounds
- Zero 'any' in production code
- All exported functions have JSDoc

Output <validation>REJECTED</validation><reasons>specific issues</reasons> if any hard gate fails.
Warnings (observability, missing indexes) should be documented but do NOT cause rejection."
}

# ============================================================================
# TEST REQUIREMENTS & OBSERVABILITY (Backend-specific)
# ============================================================================

$testRequirements = "| Layer | Test Type | Tools | Notes |
|-------|-----------|-------|-------|
| domain/** | Unit | Vitest | Pure logic, no mocks needed |
| shared/** | Unit | Vitest | Validation schemas, utilities |
| application/** | Unit | Vitest | Services with mocked Prisma |
| api/** | Integration | Vitest + Supertest | Routes with real Fastify app |

Test file naming: foo.ts -> foo.test.ts (unit), foo.integration.test.ts (integration)

**Assertion Quality**: Assert exact values, not existence. Avoid 'toBeDefined()', 'toBeTruthy()'. Use 'toBe(exactValue)', 'toEqual(exactObject)', 'toThrow(SpecificError)'.

**JSDoc**: All exported functions/classes/methods MUST have JSDoc. Start with active-voice verb."

$observabilitySection = "

## Observability Requirements

- Use `createLogger(name)` for structured logging in all services
- Log levels: info for business events, debug for technical details, warn for recoverable issues, error for failures
- No console.log in production code (use logger)
"

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
    Write-Box -Title "$($Icons.Star) Phase $PhaseNum - Transio Backend" -Subtitle "Max: $MaxIter | $compactInfo | QA: $(if($EnableQA){'On'}else{'Off'})"

    Write-Status -Icon $Icons.File -Label "PRD:" -Message $PhasePrd -Color $Theme.Secondary
    Write-Status -Icon $Icons.Folder -Label "Progress:" -Message $PhaseProgress -Color $Theme.Secondary
    Write-Host ""

    # PRE-LOOP: Compact progress if >1000 lines
    $iterationOffset = 0

    if ((Test-Path $PhaseProgress) -and ((Get-Content $PhaseProgress | Measure-Object -Line).Lines -gt 1000)) {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupFile = Join-Path $tasksDir "be/phase-${PhaseNum}-progress.backup.$timestamp.txt"
        Copy-Item $PhaseProgress $backupFile

        Write-Box -Title "$($Icons.Folder) Compacting Progress File (>1000 lines)" -Color $Theme.Warning
        Write-Status -Icon $Icons.File -Label "Backup:" -Message $backupFile -Color $Theme.Muted

        & git add $backupFile 2>&1 | Out-Null

        $compactPrompt = Build-CompactPrompt -phaseProgress $PhaseProgress -Phase $PhaseNum -CommitPush
        $result = Invoke-ClaudeStreaming -Prompt $compactPrompt -Label "Compactor"

        $iterationOffset = 1
        Start-Sleep -Seconds $SleepSeconds
    }

    # MAIN LOOP
    for ($i = 1; $i -le ($MaxIter - $iterationOffset); $i++) {
        $displayIteration = $i + $iterationOffset
        $script:Stats.Iterations++

        Write-Host ""
        Write-Host "  ========================================" -ForegroundColor $Theme.Primary
        Write-Iteration -Current $displayIteration -Total $MaxIter
        Write-Host "  Phase $PhaseNum | $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor $Theme.Muted
        Write-Host "  ========================================" -ForegroundColor $Theme.Primary

        $prompt = Build-MainPrompt -phasePrd $PhasePrd -phaseProgress $PhaseProgress -doubtsLog $DoubtsLog -testRequirements $testRequirements -observabilitySection $observabilitySection -Phase $PhaseNum

        $result = Invoke-ClaudeStreaming -Prompt $prompt -Label "Ralph"
        Write-SessionStats

        # If context compaction occurred, restart iteration with fresh context
        if ($script:ContextCompacted) {
            Write-Host ""
            Write-Status -Icon $Icons.Wave -Label "Restart:" -Message "Context was compacted - restarting iteration with fresh context" -Color $Theme.Warning
            Start-Sleep -Seconds $SleepSeconds
            continue
        }

        # Push any unpushed commits
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
                    Write-Status -Icon $Icons.Warning -Label "Git:" -Message "Push failed, retrying in ${retryDelay}s... ($retry/$maxRetries)" -Color $Theme.Warning
                    Start-Sleep -Seconds $retryDelay
                    $retryDelay = $retryDelay * 2
                }
            }

            if ($pushSuccess) {
                Write-Status -Icon $Icons.Check -Label "Git:" -Message "Pushed successfully" -Color $Theme.Success
            } else {
                Write-Status -Icon $Icons.Warning -Label "Git:" -Message "Push failed after $maxRetries attempts (will retry next iteration)" -Color $Theme.Warning
            }
        }

        # Periodic compaction
        if ($CompactEvery -gt 0 -and $displayIteration -gt 0 -and ($displayIteration % $CompactEvery) -eq 0) {
            if ((Test-Path $PhaseProgress) -and ((Get-Content $PhaseProgress | Measure-Object -Line).Lines -gt 100)) {
                $lineCount = (Get-Content $PhaseProgress | Measure-Object -Line).Lines
                $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
                $backupFile = Join-Path $tasksDir "be/phase-${PhaseNum}-progress.backup.$timestamp.txt"
                Copy-Item $PhaseProgress $backupFile

                Write-Box -Title "$($Icons.Folder) Periodic Compaction (iteration $displayIteration)" -Color $Theme.Warning
                Write-Status -Icon $Icons.File -Label "Lines:" -Message "$lineCount lines - compacting..." -Color $Theme.Muted

                & git add $backupFile 2>&1 | Out-Null

                $compactPrompt = Build-CompactPrompt -phaseProgress $PhaseProgress -Phase $PhaseNum -CommitPush
                $compactResult = Invoke-ClaudeStreaming -Prompt $compactPrompt -Label "Compactor"

                $newLineCount = (Get-Content $PhaseProgress | Measure-Object -Line).Lines
                Write-Status -Icon $Icons.Check -Label "Compacted:" -Message "$lineCount -> $newLineCount lines" -Color $Theme.Success
            }
        }

        # Check if phase is complete
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
                    if ($qaResult -match "<batch>(\d+)</batch>") {
                        Write-Status -Icon $Icons.Arrow -Label "QA:" -Message "Batch $($matches[1]) added - continuing iterations" -Color $Theme.Primary
                    }
                    Start-Sleep -Seconds $SleepSeconds
                    continue
                }

                if ($qaResult -match "<qa-status>PENDING</qa-status>") {
                    Write-Status -Icon $Icons.Arrow -Label "QA:" -Message "Stories pending - continuing iterations" -Color $Theme.Warning
                    Start-Sleep -Seconds $SleepSeconds
                    continue
                }

                if ($qaResult -match "<warning>") {
                    Write-Status -Icon $Icons.Cross -Label "WARNING:" -Message "Max QA batches reached, coverage target not met" -Color $Theme.Warning
                } else {
                    Write-Status -Icon $Icons.Check -Label "QA:" -Message "Coverage target reached!" -Color $Theme.Success
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
                Write-Host "  |                                                  |" -ForegroundColor $Theme.Success
                Write-Host "  |  $($Icons.Star) PHASE $PhaseNum COMPLETE & APPROVED! $($Icons.Star)              |" -ForegroundColor $Theme.Success
                Write-Host "  |                                                  |" -ForegroundColor $Theme.Success
                Write-Host "  +==================================================+" -ForegroundColor $Theme.Success
                Write-Host ""
                return $true
            } else {
                Write-Status -Icon $Icons.Cross -Label "Validation:" -Message "Rejected - continuing iterations to fix" -Color $Theme.Warning

                $reasons = ""
                if ($validation -match "<reasons>([\s\S]*?)</reasons>") {
                    $reasons = $matches[1].Trim()
                }
                if ($reasons) {
                    $fixNote = "`n## Validation Rejected - Fixes Needed`n$reasons`n---`n"
                    Add-Content -Path $PhaseProgress -Value $fixNote
                    Write-Status -Icon $Icons.Arrow -Label "Logged:" -Message "Rejection reasons written to progress file" -Color $Theme.Muted
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

# Determine which phases to run
$isAllPhases = $Phase -eq 'all'
if ($isAllPhases) {
    $allPhaseFiles = Get-ChildItem -Path (Join-Path $tasksDir "be") -Filter "phase-*-*.md" -File |
        Where-Object { $_.Name -match '^phase-(\d+)-' } |
        Sort-Object { [int]($_.Name -replace '^phase-(\d+)-.*', '$1') }
    $phaseNumbers = $allPhaseFiles | ForEach-Object { [int]($_.Name -replace '^phase-(\d+)-.*', '$1') }

    if ($phaseNumbers.Count -eq 0) {
        Write-Host "  $($Icons.Cross) No phase task files found in $tasksDir/be" -ForegroundColor $Theme.Error
        exit 1
    }

    Write-Box -Title "$($Icons.Star) ALL PHASES MODE (1-$($phaseNumbers[-1]))" -Subtitle "Will run phases sequentially until done or failure" -Color $Theme.Primary
} else {
    $phaseNumbers = @([int]$Phase)
}

# ============================================================================
# COMPACT-ONLY MODE
# ============================================================================

if ($Compact) {
    if ($isAllPhases) {
        Write-Host "  $($Icons.Cross) -Compact only works with a specific phase number, not 'all'" -ForegroundColor $Theme.Error
        exit 1
    }

    $phaseProgress = Join-Path $tasksDir "be/phase-${Phase}-progress.txt"

    if (-not (Test-Path $phaseProgress)) {
        Write-Host "  $($Icons.Cross) Progress file not found: $phaseProgress" -ForegroundColor $Theme.Error
        exit 1
    }

    $lineCount = (Get-Content $phaseProgress | Measure-Object -Line).Lines
    Write-Status -Icon $Icons.File -Label "Lines:" -Message "$lineCount lines in progress file" -Color $Theme.Muted

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = Join-Path $tasksDir "be/phase-${Phase}-progress.backup.$timestamp.txt"
    Copy-Item $phaseProgress $backupFile

    Write-Box -Title "$($Icons.Folder) Manual Compaction" -Color $Theme.Warning
    Write-Status -Icon $Icons.File -Label "Backup:" -Message $backupFile -Color $Theme.Muted

    & git add $backupFile 2>&1 | Out-Null

    $compactPrompt = Build-CompactPrompt -phaseProgress $phaseProgress -Phase $Phase -CommitPush
    $result = Invoke-ClaudeStreaming -Prompt $compactPrompt -Label "Compactor"

    $newLineCount = (Get-Content $phaseProgress | Measure-Object -Line).Lines
    Write-Host ""
    Write-Status -Icon $Icons.Check -Label "Result:" -Message "Compacted from $lineCount to $newLineCount lines" -Color $Theme.Success
    exit 0
}

# ============================================================================
# QA-ONLY MODE
# ============================================================================

if ($QAOnly) {
    if ($isAllPhases) {
        Write-Host "  $($Icons.Cross) -QAOnly only works with a specific phase number, not 'all'" -ForegroundColor $Theme.Error
        exit 1
    }

    $taskFiles = Get-ChildItem -Path (Join-Path $tasksDir "be") -Filter "phase-${Phase}-*.md" -File
    $phasePrd = $taskFiles[0].FullName

    Write-Box -Title "$($Icons.Gear) QA-Only Mode" -Subtitle "Target coverage: $CoverageTarget%" -Color $Theme.Primary

    $qaPrompt = Build-QAPrompt -phasePrd $phasePrd -CoverageTarget $CoverageTarget -MaxQABatches $MaxQABatches -Phase $Phase
    $qaResult = Invoke-ClaudeStreaming -Prompt $qaPrompt -Label "QA Agent"
    Write-SessionStats

    if ($qaResult -match "<coverage>(\d+)%</coverage>") {
        $currentCoverage = $matches[1]
        $coverageColor = if ([int]$currentCoverage -ge $CoverageTarget) { $Theme.Success } else { $Theme.Warning }
        Write-Status -Icon $Icons.Check -Label "Coverage:" -Message "$currentCoverage%" -Color $coverageColor
    }

    exit 0
}

# ============================================================================
# PHASE LOOP
# ============================================================================

$completedPhases = @()
$failedPhase = $null

foreach ($phaseNum in $phaseNumbers) {
    $taskFiles = Get-ChildItem -Path (Join-Path $tasksDir "be") -Filter "phase-${phaseNum}-*.md" -File
    if ($taskFiles.Count -eq 0) {
        Write-Host "  $($Icons.Cross) No task file found for phase $phaseNum in $tasksDir/be" -ForegroundColor $Theme.Error
        if ($isAllPhases) { $failedPhase = $phaseNum; break }
        exit 1
    }

    $phasePrd = $taskFiles[0].FullName
    $phaseProgress = Join-Path $tasksDir "be/phase-${phaseNum}-progress.txt"

    if (-not (Test-Path $phasePrd)) {
        Write-Host "  $($Icons.Cross) Phase $phaseNum PRD not found at $phasePrd" -ForegroundColor $Theme.Error
        if ($isAllPhases) { $failedPhase = $phaseNum; break }
        exit 1
    }

    # Skip phases that are already fully complete
    if (-not ((Get-Content $phasePrd -Raw) -match '\[ \]')) {
        Write-Status -Icon $Icons.Check -Label "Phase ${phaseNum}:" -Message "Already complete - skipping" -Color $Theme.Success
        $completedPhases += $phaseNum
        continue
    }

    $phaseResult = Invoke-Phase -PhaseNum $phaseNum -PhasePrd $phasePrd -PhaseProgress $phaseProgress -DoubtsLog $doubtsLog -MaxIter $MaxIterations

    if ($phaseResult) {
        $completedPhases += $phaseNum
        if ($isAllPhases) {
            Write-Host ""
            Write-Status -Icon $Icons.Arrow -Label "Next:" -Message "Advancing to phase $($phaseNum + 1)..." -Color $Theme.Primary
            Write-Host ""
        }
    } else {
        $failedPhase = $phaseNum
        break
    }
}

# ============================================================================
# FINAL SUMMARY
# ============================================================================

$elapsed = (Get-Date) - $script:Stats.StartTime
$elapsedStr = "{0:hh\:mm\:ss}" -f $elapsed

Write-Host ""

if ($failedPhase) {
    Write-Host "  +==================================================+" -ForegroundColor $Theme.Warning
    Write-Host "  |  $($Icons.Cross) STOPPED at Phase $failedPhase (max iterations)        |" -ForegroundColor $Theme.Warning
    if ($completedPhases.Count -gt 0) {
        $completedStr = ($completedPhases -join ', ').PadRight(37)
        Write-Host "  |  Completed: $completedStr|" -ForegroundColor $Theme.Warning
    }
    Write-Host "  |  Iterations: $($script:Stats.Iterations.ToString().PadRight(36))|" -ForegroundColor $Theme.Warning
    Write-Host "  |  Total Cost: $('$' + [math]::Round($script:Stats.TotalCost, 4).ToString().PadRight(35))|" -ForegroundColor $Theme.Warning
    Write-Host "  |  Total Time: $($elapsedStr.PadRight(36))|" -ForegroundColor $Theme.Warning
    Write-Host "  |  Tool Calls: $($script:Stats.ToolCalls.ToString().PadRight(36))|" -ForegroundColor $Theme.Warning
    Write-Host "  +==================================================+" -ForegroundColor $Theme.Warning
    Write-Host ""
    exit 1
} else {
    $phasesStr = if ($isAllPhases) { "ALL PHASES ($(($completedPhases -join ', ')))" } else { "Phase $($completedPhases[0])" }
    Write-Host "  +==================================================+" -ForegroundColor $Theme.Success
    Write-Host "  |                                                  |" -ForegroundColor $Theme.Success
    Write-Host "  |  $($Icons.Star) $($phasesStr.PadRight(43))|" -ForegroundColor $Theme.Success
    Write-Host "  |     COMPLETE!                                    |" -ForegroundColor $Theme.Success
    Write-Host "  |                                                  |" -ForegroundColor $Theme.Success
    Write-Host "  +==================================================+" -ForegroundColor $Theme.Success
    Write-Host "  |  Iterations: $($script:Stats.Iterations.ToString().PadRight(36))|" -ForegroundColor $Theme.Success
    Write-Host "  |  Total Cost: $('$' + [math]::Round($script:Stats.TotalCost, 4).ToString().PadRight(35))|" -ForegroundColor $Theme.Success
    Write-Host "  |  Total Time: $($elapsedStr.PadRight(36))|" -ForegroundColor $Theme.Success
    Write-Host "  |  Tool Calls: $($script:Stats.ToolCalls.ToString().PadRight(36))|" -ForegroundColor $Theme.Success
    Write-Host "  +==================================================+" -ForegroundColor $Theme.Success
    Write-Host ""
    exit 0
}
