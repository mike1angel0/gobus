# Transio — Bus Transport Platform

## Monorepo Structure

```
transio/
├── spec/                  # OpenAPI 3.1 spec (source of truth for API contract)
│   └── openapi.yaml       # Main spec file
├── apps/
│   ├── api/               # Fastify 5 backend (Node.js + TypeScript)
│   └── web/               # React frontend (placeholder)
├── tasks/                 # Phase PRDs and progress tracking
├── scripts/               # Ralph automation scripts
├── _legacy/               # Previous Next.js code (reference only)
└── package.json           # Root workspaces config
```

## API-First Workflow

1. **Spec first**: Define endpoints in `spec/openapi.yaml` before implementing
2. **Implement**: Build routes/services in `apps/api/` matching the spec exactly
3. **Validate**: Run `npm run spec:lint` to ensure spec validity

The OpenAPI spec at `spec/openapi.yaml` is the single source of truth for the API contract shared between backend and frontend.

## Quick Commands

| Command | Description |
|---------|-------------|
| `npm run spec:lint` | Validate OpenAPI spec |
| `npm run spec:bundle` | Bundle spec into `spec/dist/openapi.json` |
| `npm run spec:preview` | Serve interactive Redoc docs |

## Conventions

- **Error format**: RFC 9457 Problem Details (`type`, `title`, `status`, `detail`, `code`, `errors[]`)
- **Response envelope**: `{ data: T }` for single items, `{ data: T[], meta: PaginationMeta }` for lists
- **Naming**: camelCase for JSON fields, kebab-case for URLs
- **Auth**: Bearer JWT (access token 15min, refresh token 7d)
