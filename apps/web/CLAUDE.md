# Transio Web Frontend

## Tech Stack
- **Framework**: React 19 + TypeScript 5.9 (strict)
- **Build**: Vite 8
- **Styling**: Tailwind CSS 3.4 + shadcn/ui (dark glass-morphism theme)
- **State**: React Query (TanStack Query v5)
- **Forms**: React Hook Form + Zod + @hookform/resolvers
- **Routing**: React Router v6
- **Testing**: Vitest + React Testing Library + @testing-library/user-event

## Quick Start
```bash
npm run dev          # Start dev server
npm run build        # Typecheck + build
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run format:check # Prettier check
npm run test         # Run tests
npm run test:coverage # Coverage (≥90% threshold)
npm run api:sync     # Regenerate API types from OpenAPI spec
```

## API-First Workflow

The OpenAPI spec at `spec/openapi.yaml` (monorepo root) is the single source of truth.

### Type Generation Pipeline
1. Edit `spec/openapi.yaml` (or referenced files)
2. Bundle: `npm run spec:bundle` (from monorepo root) → produces `spec/dist/openapi.json`
3. Generate: `npm run api:sync` (from apps/web/) → produces `src/api/generated/types.ts`
4. Use generated types in `src/api/client.ts` with `openapi-fetch`

### Generated Files
- `src/api/generated/types.ts` — Auto-generated from OpenAPI spec. **Do not edit manually.**
- Regenerate after any spec change with `npm run api:sync`

## Project Structure
```
src/
├── api/
│   └── generated/
│       └── types.ts      # Auto-generated OpenAPI types
├── assets/
├── components/
│   └── ui/               # shadcn/ui components (do not edit)
├── hooks/
├── lib/
│   └── utils.ts          # cn() helper
├── test/
│   ├── setup.ts          # Vitest setup (jest-dom matchers)
│   └── helpers.tsx        # renderWithProviders() test helper
├── App.tsx
├── main.tsx
└── index.css
```

## Conventions
- **Zero `any`**: Use `unknown` + type guards or generated API types
- **camelCase** for JSON fields, **kebab-case** for URLs
- **JSDoc** on all exported functions, components, and hooks
- **Accessibility**: WCAG 2.1 AA — semantic HTML, aria-labels, keyboard navigation
- **Error format**: RFC 9457 Problem Details from API
- **Imports**: Use `@/` path alias for `src/`
