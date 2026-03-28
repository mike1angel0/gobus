# GoBus Web Frontend

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript 5.9 (strict) |
| Build | Vite 8 |
| Styling | Tailwind CSS 3.4 + shadcn/ui (Radix primitives, dark glass-morphism theme) |
| Routing | React Router 6 (lazy-loaded routes, auth/role guards) |
| State | TanStack React Query 5 (server state), React Context (auth) |
| Forms | React Hook Form 7 + Zod 3 + @hookform/resolvers |
| API Client | openapi-fetch (typed from OpenAPI spec) |
| Icons | lucide-react |
| Testing | Vitest 4 + React Testing Library + jsdom |
| Linting | ESLint 9 (flat config) + Prettier |

## Quick Start

```bash
# From monorepo root
npm install

# Regenerate API types from OpenAPI spec
npm run spec:bundle && npm -w @gobus/web run api:sync

# Start dev server
npm -w @gobus/web run dev

# Run all quality gates
npm -w @gobus/web run typecheck
npm -w @gobus/web run lint
npm -w @gobus/web run format:check
npm -w @gobus/web run test
npm -w @gobus/web run test:coverage   # 90% threshold
npm -w @gobus/web run build
```

## Project Structure

```
src/
├── api/
│   ├── generated/types.ts   # Auto-generated from OpenAPI spec (DO NOT EDIT)
│   ├── client.ts            # openapi-fetch client + auth middleware
│   ├── errors.ts            # ApiError class, RFC 9457 parsing
│   ├── hooks.ts             # useApiClient hook
│   └── keys.ts              # React Query key factories
├── components/
│   ├── guards/              # AuthGuard, RoleGuard
│   ├── layout/              # AppLayout, Navbar, RootLayout
│   └── ui/                  # shadcn/ui primitives (DO NOT EDIT)
├── contexts/
│   ├── auth-context.tsx     # AuthProvider (login, register, refresh, etc.)
│   └── auth-types.ts        # Auth types (User, AuthState)
├── hooks/
│   ├── useAuth.ts           # useAuth() hook
│   └── use-toast.ts         # shadcn toast hook (DO NOT EDIT)
├── lib/
│   └── utils.ts             # cn() classname helper
├── pages/
│   ├── auth/                # Login, Register, Forgot/Reset/Change Password
│   ├── home.tsx             # Home page with search
│   └── placeholder.tsx      # Placeholder for unimplemented routes
├── providers/
│   └── query-provider.tsx   # QueryClientProvider wrapper
├── test/
│   ├── helpers.tsx          # renderWithProviders() test utility
│   └── setup.ts             # Vitest setup (jest-dom matchers)
├── router.tsx               # Route definitions (lazy-loaded)
├── main.tsx                 # Entry point
└── index.css                # Tailwind directives + global styles
```

## API-First Workflow

The OpenAPI spec (`spec/openapi.yaml`) is the single source of truth.

```
spec/openapi.yaml → spec:bundle → openapi.json → api:sync → src/api/generated/types.ts
```

1. **Spec changes**: Edit `spec/openapi.yaml`
2. **Bundle**: `npm run spec:bundle` (produces `spec/dist/openapi.json`)
3. **Sync types**: `npm -w @gobus/web run api:sync` (regenerates `src/api/generated/types.ts`)
4. **Use in code**: Import types from generated file, use `openapi-fetch` typed client

The typed client (`src/api/client.ts`) auto-attaches Bearer tokens and handles 401 refresh. Never use raw `fetch()`.

### Generated Files
- `src/api/generated/types.ts` — Auto-generated from OpenAPI spec. **Do not edit manually.**

## Patterns

### React Query Hooks

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/keys';
import { useApiClient } from '@/api/hooks';
import { ApiError } from '@/api/errors';

// Query with key factory
const { data } = useQuery({
  queryKey: queryKeys.route.lists(),
  queryFn: async () => {
    const client = getClient();
    const { data, error } = await client.GET('/routes');
    if (error) throw new ApiError(error);
    return data;
  },
  staleTime: 60_000,
});

// Mutation with cache invalidation
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: async (body) => { /* ... */ },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.route.all }),
});
```

Key factories follow `.all` / `.lists()` / `.detail(id)` pattern (see `src/api/keys.ts`).

Recommended staleTime per query type: search 30s, lists 60s, tracking 5s.

### Forms (React Hook Form + Zod)

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '@/api/errors';

const schema = z.object({
  email: z.string().email().max(255),  // Match OpenAPI maxLength
  password: z.string().min(8).max(128),
});

type FormData = z.infer<typeof schema>;

function MyForm() {
  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      // API call...
    } catch (err) {
      if (err instanceof ApiError) {
        // Map RFC 9457 field errors to form fields
        err.fieldErrors?.forEach(e => setError(e.field, { message: e.detail }));
      }
    }
  };
}
```

Zod constraints MUST match OpenAPI spec constraints (maxLength, min, max, pattern).

### Components

- **Loading**: Skeleton loaders (not spinners)
- **Error**: Error state + retry button
- **Empty**: Empty state + CTA
- **Feedback**: Toast for mutation success/failure (`useToast` from `@/hooks/use-toast`)
- **UI primitives**: Use `src/components/ui/` (shadcn). Never create new base UI components.

### Error Handling

```tsx
import { ApiError } from '@/api/errors';

// ApiError wraps RFC 9457 Problem Details
try {
  // API call...
} catch (err) {
  if (err instanceof ApiError) {
    err.status;      // HTTP status
    err.code;        // e.g. 'EMAIL_ALREADY_EXISTS'
    err.detail;      // Human-readable message
    err.fieldErrors; // Array of { field, detail }
  }
}
```

Auth error handling: 401 → auto-refresh token; 403 (suspended) → logout + message; 423 (locked) → message.

## Conventions

### Naming
- **Files**: kebab-case (`auth-guard.tsx`, `query-provider.tsx`)
- **Components**: PascalCase (`AuthGuard`, `QueryProvider`)
- **Hooks**: camelCase with `use` prefix (`useAuth`, `useApiClient`)
- **Test files**: Same name + `.test` suffix (`auth-guard.test.tsx`)
- **JSON fields**: camelCase
- **URLs**: kebab-case
- **Imports**: Use `@/` path alias for `src/`

### Code Quality Rules
- **Zero `any`**: Use `unknown` + type guards or generated API types
- **No raw fetch**: Always use the typed openapi-fetch client
- **No console.log**: Use proper error handling
- **No hardcoded URLs**: API base from `VITE_API_URL` env var
- **JSDoc on all exports**: Components, hooks, utility functions
- **No tokens in localStorage**: Access token in memory only (refresh token is the exception)
- **No `dangerouslySetInnerHTML`**

### ESLint Complexity Gates

| Rule | Limit |
|------|-------|
| `max-lines` | 500 per file |
| `max-lines-per-function` | 250 |
| `complexity` | 15 |
| `max-depth` | 4 |

If a component exceeds limits, extract sub-components into separate files.

### Accessibility (WCAG 2.1 AA)
- Semantic HTML (proper heading hierarchy, landmarks)
- All interactive elements need `aria-label` or visible label
- Keyboard navigable (tab order, focus management)
- Color contrast >= 4.5:1
- Form errors linked via `aria-describedby`
- `CardTitle` renders as `<div>` — use `<h1>`/`<h2>` directly for headings

### Testing
- Use `renderWithProviders()` from `src/test/helpers.tsx` for components needing context
- Assert exact values (avoid `toBeDefined()`, prefer `toBeInTheDocument()`, `toHaveTextContent()`)
- Every component test should verify basic a11y (labels, roles)
- Test files are exempt from `max-lines` and `max-lines-per-function`
- Coverage threshold: 90% (statements, branches, functions, lines)
- shadcn/ui components and `use-toast.ts` excluded from coverage

## Quality Gate Commands

```bash
npm -w @gobus/web run typecheck       # TypeScript strict check
npm -w @gobus/web run lint            # ESLint (complexity, a11y, JSDoc)
npm -w @gobus/web run format:check    # Prettier formatting
npm -w @gobus/web run test            # Run all tests
npm -w @gobus/web run test:coverage   # Tests + 90% coverage check
npm -w @gobus/web run build           # Production build
```

## Known Gotchas

- **react-refresh/only-export-components**: Don't mix component + non-component exports. Split schemas/constants into `.ts` files.
- **shadcn CLI**: Broken on this project — manually create components.
- **openapi-fetch middleware**: Must `response.clone().json()` (body stream is single-consume).
- **jsdom localStorage**: Mock with `Object.defineProperty(globalThis, 'localStorage', {...})`.
- **Complex forms**: Extract field groups into sub-components to stay under ESLint limits.
- **Run tests from apps/web**: Path aliases don't resolve when running vitest from monorepo root.
- **tailwindcss-animate**: Regular dep, not devDep (imported at build time).
