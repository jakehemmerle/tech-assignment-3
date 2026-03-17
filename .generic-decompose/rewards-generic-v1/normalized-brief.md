# Normalized Brief: rewards-generic-v1

## Problem Summary

Build a poker loyalty rewards system for Hijack Poker. Players earn points from cash game hands, progress through 4 tiers with multipliers, and view their status on a web dashboard. The system has three surfaces: a backend API (Express-in-Lambda), a React web dashboard, and REST endpoints for a Unity mobile client (no Unity implementation needed).

This is a **backend-heavy** project. The core complexity is the points engine, tier progression logic, and data modeling. The frontend is a visualization layer over API data.

## Goals

1. **Points Engine**: Award points per hand played, scaled by table stakes bracket and tier multiplier. Immutable ledger.
2. **Tier System**: 4-tier progression (Bronze → Silver → Gold → Platinum) based on monthly points. Immediate upgrade on threshold. Monthly reset with floor protection.
3. **Leaderboard**: Monthly top-100 by points. Players see own rank even if outside top 100.
4. **Player Dashboard**: React web app with summary card, points history, tier timeline (6 months), leaderboard widget.
5. **Notifications**: Store-and-retrieve notifications for tier changes and milestones. No push delivery.
6. **Admin Endpoints**: Backend-only CRUD for player rewards profiles, manual point adjustments, leaderboard, tier overrides.
7. **Unity REST API**: 5 lean endpoints for mobile client consumption with documented schemas.

## Non-Goals

- Real authentication system (use X-Player-Id header stub)
- Email, push, or any notification delivery mechanism
- Game engine or processor integration (just expose the award endpoint)
- Unity client implementation
- Payment or real-money transactions
- Backoffice admin UI
- Production deployment, IaC, or AWS provisioning

## Constraints

### Hard Constraints (must satisfy)
- **Runtime**: Node.js 22, Express framework (skeleton provides Express, not NestJS)
- **Database**: DynamoDB via AWS SDK v3, DynamoDB Local for development
- **Backend language**: JavaScript (CommonJS) — matching skeleton conventions
- **Frontend**: React 18+ with TypeScript, Redux Toolkit (RTK Query preferred), MUI
- **Testing**: Jest for backend, React Testing Library for frontend
- **Docker Compose**: `docker compose --profile rewards up` must boot the full system
- **Immutable ledger**: Points transactions are append-only, no updates or deletes
- **Existing DynamoDB tables**: rewards-players (PK: playerId), rewards-transactions (PK: playerId, SK: timestamp), rewards-leaderboard (PK: monthKey, SK: playerId), rewards-notifications (PK: playerId, SK: notificationId)

### Preferences (recommended but flexible)
- NestJS suggested in spec, but Express skeleton exists and works — **planning assumption: use Express** (document deviation)
- class-validator / class-transformer for DTOs — **planning assumption: skip, use manual validation** (Express doesn't use these natively)
- Suggested module structure from spec is NestJS-flavored — **planning assumption: adapt to Express route/service pattern**

## Required Capabilities

### C1: Points Calculation
Calculate base points from big blind bracket:
| BB Range | Base Points |
|----------|-------------|
| $0.10–$0.25 | 1 |
| $0.50–$1.00 | 2 |
| $2.00–$5.00 | 5 |
| $10.00+ | 10 |

Apply tier multiplier: `earned = base × multiplier`

### C2: Tier Progression
| Tier | Monthly Threshold | Multiplier |
|------|-------------------|------------|
| Bronze | 0 | 1.0x |
| Silver | 500 | 1.25x |
| Gold | 2,000 | 1.5x |
| Platinum | 10,000 | 2.0x |

Rules:
- Start at Bronze
- Upgrade immediately when threshold reached
- Reset on 1st of each month at 00:00 UTC
- Floor protection: max 1 tier drop (Platinum → Gold minimum, Gold → Silver minimum, etc.)
- Tier changes trigger a notification

### C3: Leaderboard
- Monthly top 100 by monthlyPoints
- Each entry: rank, displayName, tier, monthlyPoints
- Player self-rank even if outside top 100
- Refreshes on read (no caching required, optional bonus)

### C4: Notifications
- Types: tier_upgrade, tier_downgrade, milestone
- Milestones: define 3-5 (e.g., 100, 500, 1000, 5000, 10000 lifetime points)
- Fields: playerId, notificationId, type, title, description, dismissed, createdAt
- API: list (with unread filter), dismiss

### C5: Admin Endpoints (no UI)
- GET /admin/players/:playerId/rewards — full profile
- POST /admin/points/adjust — credit/debit with reason
- GET /admin/leaderboard — extended with playerId, email
- POST /admin/tier/override — set tier with expiry

### C6: Unity REST API
- GET /api/v1/player/rewards — current tier, points, progress
- GET /api/v1/player/rewards/history?limit=20&offset=0 — paginated transactions
- GET /api/v1/leaderboard?limit=10 — leaderboard
- GET /api/v1/player/notifications?unread=true — notifications
- PATCH /api/v1/player/notifications/:id/dismiss — dismiss

### C7: Player Dashboard (React)
- Summary card: tier badge, monthly points, points to next tier, progress bar
- Points history: table with date, table, stakes, base points, multiplier, earned
- Tier timeline: visual of tier progression across last 6 months
- Leaderboard widget: top 10 + own rank

### C8: Monthly Reset
- Trigger: admin endpoint or script (not cron in scope)
- Logic: evaluate each player's previous month tier, apply floor protection, reset monthlyPoints to 0
- Create tier_downgrade notifications where applicable

### C9: Seed Script
- Generate sample point transactions for testing
- Existing script creates 50 players — extend to match new schema

## Acceptance Criteria by Tier

### M1 (Minimum / Pass)
- [ ] Points awarded correctly based on table stakes and tier multiplier
- [ ] Tier progression works — player upgrades when threshold reached
- [ ] Points ledger is immutable (append-only)
- [ ] Leaderboard returns top players sorted by monthly points
- [ ] Dashboard displays current tier, points, progress to next tier
- [ ] Dashboard displays points transaction history
- [ ] Notification created on tier change
- [ ] REST endpoints for Unity client return correct data shapes
- [ ] Admin can view a player's rewards profile
- [ ] Admin can manually adjust points
- [ ] Unit tests cover points calculation and tier progression logic
- [ ] Docker Compose starts all dependencies, `npm test` passes

### M2 (Strong)
- [ ] Points history pagination works correctly
- [ ] Leaderboard shows player's own rank
- [ ] Notification dismiss works, unread count is correct
- [ ] Monthly tier reset logic implemented (triggered manually)
- [ ] Dashboard has tier timeline showing last 6 months
- [ ] Integration tests on at least the points award flow
- [ ] API response shapes documented (OpenAPI, TypeDoc, or markdown spec)

### Bonus (only if time permits)
- [ ] Leaderboard caching (Redis or DynamoDB TTL)
- [ ] Real-time tier upgrade notification via WebSocket or SSE
- [ ] Rate limiting on points award endpoint
- [ ] Idempotency on points award (dedup by handId)
- [ ] GitHub Actions CI pipeline
- [ ] Monthly reset as a scheduled Lambda

## Architecture Guardrails

1. **Express route/service pattern**: Routes delegate to service modules. Services handle business logic. DynamoDB access through a data access layer.
2. **Serverless-offline compatibility**: All endpoints must work through serverless-offline's Lambda emulation.
3. **Shared config**: Use `serverless-v2/shared/config/dynamo.js` for DynamoDB client. Don't create duplicate clients.
4. **Frontend state**: Redux Toolkit for global state. RTK Query preferred for API calls (caching, loading states for free).
5. **API versioning**: All endpoints under `/api/v1/` prefix (already established).
6. **Auth pattern**: X-Player-Id header via existing authMiddleware. Admin endpoints use a separate guard or no auth (spec doesn't require admin auth).
7. **Error handling**: Consistent JSON error responses with `{ error: string, message: string }` shape.
8. **Table naming**: Use environment variables for table names (REWARDS_PLAYERS_TABLE, etc.) — already established pattern.

## Data Structures to Define

### DS1: Player Profile (rewards-players)
- Purpose: Track player's current rewards state
- Fields: playerId (PK), displayName, currentTier (1-4), monthlyPoints, lifetimePoints, tierFloor, tierOverride (optional, with expiry), lastTierChangeAt, createdAt, updatedAt
- Constraints: currentTier must be 1-4. monthlyPoints >= 0. tierFloor derived from previous month.
- **Note**: Existing seed script uses different field names (points, tier as string). Must reconcile — use spec's numeric tier internally, expose string name in API.

### DS2: Points Transaction (rewards-transactions)
- Purpose: Immutable ledger of all point changes
- Fields: playerId (PK), timestamp (SK, epoch ms), type (gameplay|adjustment|bonus), basePoints, multiplier, earnedPoints, tableId (nullable), tableStakes, monthKey (YYYY-MM), handId (for idempotency), reason (for adjustments), createdAt
- Constraints: Append-only. No updates or deletes.
- **Note**: Need monthKey GSI for monthly queries. Not in current init script — must add.

### DS3: Leaderboard Entry (rewards-leaderboard)
- Purpose: Denormalized monthly rankings
- Fields: monthKey (PK, YYYY-MM), playerId (SK), displayName, tier, monthlyPoints
- Constraints: **Write-through on every point award**. When points are awarded, also upsert the leaderboard entry for the current month. On-read computation (scan+sort from players table) acceptable for M1; write-through is the target for M2.
- Query pattern: Query by monthKey, sort results client-side by monthlyPoints descending, take top N.

### DS4: Notification (rewards-notifications)
- Purpose: Store player notifications for retrieval
- Fields: playerId (PK), notificationId (SK, ULID/UUID), type (tier_upgrade|tier_downgrade|milestone), title, description, dismissed (boolean), createdAt
- Constraints: Dismissing sets dismissed=true. Unread filter = dismissed === false.

### DS5: Tier History (M2 — for timeline widget)
- Purpose: Track monthly tier snapshots for the 6-month timeline visualization (FR-4, "Should Have")
- Fields: playerId (PK), monthKey (SK, YYYY-MM), tier, monthlyPoints
- Constraints: Written during monthly reset. Only needed for M2 tier timeline widget.
- **Note**: Deferred to M2. Can be stored as a list on the player record or a separate table. Decide during M2 implementation.

## Core Interfaces / Contracts to Define

### IF1: POST /api/v1/points/award
- Type: API (game processor → rewards API)
- Input: `{ playerId, tableId, tableStakes, bigBlind, handId }`
- Output: `{ playerId, earnedPoints, basePoints, multiplier, newMonthlyTotal, newLifetimeTotal, currentTier, tierChanged }`
- Constraints: Must calculate base points from bigBlind bracket, apply current tier multiplier, write ledger entry, update player totals, check tier advancement, create notification if tier changed.

### IF2: GET /api/v1/player/rewards
- Type: API (Unity client + web dashboard)
- Input: X-Player-Id header
- Output: `{ playerId, currentTier, tierName, monthlyPoints, lifetimePoints, pointsToNextTier, nextTierName, nextTierThreshold, progressPercent, multiplier }`
- Constraints: Must return current state, not stale data.

### IF3: GET /api/v1/player/rewards/history
- Type: API (Unity client + web dashboard)
- Input: X-Player-Id header, query params `?limit=20&offset=0`
- Output: `{ transactions: [...], total, hasMore }`
- Constraints: Sorted by timestamp descending. Pagination via offset.

### IF4: GET /api/v1/leaderboard
- Type: API (Unity client + web dashboard)
- Input: query params `?limit=10`, X-Player-Id header (for self-rank)
- Output: `{ leaderboard: [{ rank, displayName, tier, monthlyPoints }], playerRank: { rank, ... } }`
- Constraints: Current month only. Player's own rank included even if outside top N.

### IF5: GET /api/v1/player/notifications
- Type: API (Unity client + web dashboard)
- Input: X-Player-Id header, query params `?unread=true`
- Output: `{ notifications: [...], unreadCount }`

### IF6: PATCH /api/v1/player/notifications/:id/dismiss
- Type: API (Unity client + web dashboard)
- Input: X-Player-Id header, notification ID in path
- Output: `{ success: true }`

### IF7: Admin Endpoints (4 endpoints)
- Type: API (backoffice, no UI)
- See C5 for full spec
- Constraints: No auth required per spec, but separate route prefix `/admin/`

### IF8: Monthly Reset
- Type: Internal service / admin trigger
- Input: POST /admin/tier/reset (or similar)
- Output: `{ playersProcessed, tierChanges: [...] }`
- Constraints: Evaluate all players, apply floor protection, reset monthly points, create notifications, snapshot tier history.

### IF9: Frontend → API Contract
- Type: UI contract
- The React dashboard consumes IF2-IF6 via the Axios client at /api/v1/*
- Auth: X-Player-Id from localStorage
- Loading/error states via RTK Query

## Validation Strategy

1. **Unit tests first**: Points calculation (base points from BB, multiplier application), tier determination (getTierForPoints), tier floor protection logic, notification generation logic.
2. **Integration tests**: Full award flow (POST /points/award with DynamoDB Local), leaderboard query, notification lifecycle (create on tier change → list → dismiss).
3. **Frontend component tests**: Dashboard renders with mock data, history table pagination, leaderboard widget.
4. **End-to-end manual validation**: Docker Compose up → seed → dashboard loads → award points → see tier change → notification appears.
5. **Quality gate**: `npm test` passes in CI and locally. `docker compose --profile rewards up` boots cleanly.

## Open Questions

None remaining — all resolved in human clarification.

## Clarifications from Human Review

**Q: Where is the 6-month tier timeline in requirements?**
A: FR-4 and "Should Have" acceptance criteria. It's M2, not M1. Deferred accordingly.

**Q: Leaderboard computation strategy?**
A: Write-through to leaderboard table on every point award. On-read (scan+sort from players) is acceptable for M1.

**Q: Is monthKey GSI required?**
A: No. The monthKey GSI on rewards-transactions was suggested in the spec's data model to allow cross-player monthly queries. Since we're doing write-through to the leaderboard table, we don't need it. Player-specific monthly queries use the existing PK (playerId) with timestamp range filtering. Dropped from plan.

**Q: Seed script — not enough or too much?**
A: Schema mismatch. Existing seed uses `{points, tier: "Gold"}`, but implementation needs `{currentTier: 3, monthlyPoints, lifetimePoints, tierFloor}`. Rewrite to match canonical model.
