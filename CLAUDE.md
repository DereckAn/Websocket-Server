# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Runtime is **Bun** (>= 1.0). There is no separate build step for running.

```bash
bun install                        # install deps
bun run dev                        # dev server with --watch hot reload (port 3000)
bun run start                      # run without watch
bun run type-check                 # tsc --noEmit (build does NOT type-check)
bun test                           # all tests
bun test tests/unit/AIService.test.ts   # single test file
bun test -t "pattern"              # single test by name
bun run test:unit                  # tests/unit/ only
bun run test:integration           # tests/integration/ only
```

Docker: `docker-compose up gomoku-server` (production) — see docker-compose.yml for the dev profile.

## What this server actually is

Despite the `gomoku-game-server` package name, this is **two unrelated apps sharing one Bun process and one port**:

1. **Gomoku** — a real-time multiplayer + AI board game (routes under `/api/gomoku/*`, WebSocket `/ws/gomoku/:roomId`).
2. **Square POS integration** — receives Square order webhooks and pushes live order updates to a restaurant admin dashboard, plus accepts online orders. This is the business-critical half (see README.md); it exists to replace a flaky Vercel SSE setup that hit 504/429 errors.

They only intersect in [src/index.ts](src/index.ts) and [src/routes/index.ts](src/routes/index.ts). When editing one, you almost never need to touch the other.

## Architecture

Strict MVC-ish layering, enforced by convention (there are no framework guardrails):

```
Bun.serve (index.ts)  →  Routes (routes/)  →  Controllers  →  Services  →  Models
                                                                  ↓
                                              Views (ResponseView / GameView) format all HTTP output
```

- **index.ts** is the single `Bun.serve`. Its `fetch` delegates every HTTP request to `Routes.handleRequest`, and every `upgrade: websocket` request to `Routes.handleWebSocketUpgrade`. The `websocket` handlers (`open`/`message`/`close`) branch on `ws.data.wsType` (`"admin"` → `SquareController`, else `GomokuController`) — this discriminant is set during the upgrade in the route modules.
- **routes/index.ts** is a hand-rolled path-prefix dispatcher (no router lib). It tries each sub-router in order by pathname prefix, falls through to 404, then applies response middleware (CORS, rate-limit headers, request ID) to everything except OPTIONS. Sub-routers: `gomokuRoutes` (`/api/gomoku/`), `adminRoutes` (`/api/admin/`), `squareRoutes` (`/webhooks/square`, `/orders/`, `/square/`, `/test`), `onlineOrderRoutes` (`/api/orders/`).
- **Services are static-class singletons** holding **in-memory state via `static` Maps** — e.g. `GameService.activeRooms`, `WebSocketService.connections`, `AdminWebSocketService.connections`. There is no shared datastore for game/connection state; **restarting the process drops all live games and connections**. Square/online-order data is the exception — it persists to Supabase and Square.
- **Views**: `ResponseView` builds every JSON HTTP response (success/error/404/500 helpers + security headers + request ID). Don't hand-build `Response` objects in controllers; go through `ResponseView`.

### External clients (config/)
- `square-client.ts` and `supabase-client.ts` are singletons that **initialize to `undefined` (not throw) when their env vars are missing**, so the server always boots. Downstream code must tolerate an absent client. Both use `console.*` instead of `logger` on purpose — see circular-dependency note below.

### Circular-dependency constraint (important)
`config/env.ts` and the two `config/*-client.ts` files **must not import `utils/logger`** — the logger imports `env`, so importing it back creates a cycle at module-init time. These files use `console.log`/`console.warn` directly. Keep it that way when editing config.

### Gomoku AI
`AIService` (~1600 lines) is the heavy piece: iterative-deepening minimax with alpha-beta pruning, a transposition table, threat detection, and pattern recognition, tuned for "unbeatable expert" play. `OpeningBook` supplies early-game moves. `AI_MAX_TIME_PER_MOVE` (env, default 10s) bounds per-move search time.

## Configuration

All config funnels through [src/config/env.ts](src/config/env.ts) → exported `env` singleton (validated at load; throws on bad `NODE_ENV`/`LOG_LEVEL`). Import `env`, `isProduction()`, `isDevelopment()` from there — don't read `process.env` directly except in the `config/` clients.

- **CORS origins**: `ALLOWED_ORIGINS` (comma-separated), falls back to `CORS_ORIGIN`, then localhost defaults. Warns (doesn't fail) if localhost is used in production. `GET /api/cors-check` is a live diagnostic endpoint.
- **Square** (`SQUARE_ACCESS_TOKEN`, `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_ENVIRONMENT`) and **Supabase** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are optional at boot but required for their respective features to work.
- See `.env.example` for the full list and Gomoku tuning knobs.

## Deployment

Targets **Railway** (also Render/Fly). The multi-stage Dockerfile binds `0.0.0.0` and reads `$PORT` from the platform — do **not** hardcode the port or re-add a `HEALTHCHECK` with a fixed port (both broke Railway before; see git history and Dockerfile comments). Railway probes `/health`.
