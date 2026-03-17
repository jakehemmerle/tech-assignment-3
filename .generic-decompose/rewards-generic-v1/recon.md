# Reconnaissance Report: rewards-generic-v1

## Source Corpus

| Document | What It Contributes |
|----------|-------------------|
| `docs/challenge-rewards.md` | Primary specification: functional requirements (FR-1 through FR-6), technical requirements, DynamoDB data model, acceptance criteria (must/should/could), API contracts, suggested NestJS module structure |
| `README.md` | Skeleton repo overview, Docker Compose profiles, project structure, architecture diagrams, port reference, troubleshooting |
| `docs/README.md` | Platform architecture context, evaluation criteria (Working Software 30%, Code Quality 25%, Testing 20%, Architecture 15%, Docs 10%), submission requirements |
| `docs/local-development.md` | Detailed local dev guide: rewards profile services, stub API endpoints, seed data script, key file locations |
| `AGENTS.md` | Pointer to the four source docs above |

## Project Summary

**Problem**: Build a loyalty rewards system for Hijack Poker where players earn points from gameplay, progress through tiers (Bronze/Silver/Gold/Platinum), and view their status on a dashboard.

**Goals**:
- Points engine: award points per hand based on table stakes, apply tier multiplier, immutable ledger
- Tier progression: 4 tiers with monthly rolling thresholds, immediate upgrade, monthly reset with floor protection
- Leaderboard: top 100 monthly point earners, self-rank
- Player dashboard: summary card, points history, tier timeline (6 months), leaderboard widget
- Notifications: tier change events, milestone achievements, stored + API-retrievable
- Admin endpoints: player profile, manual point adjustment, leaderboard, tier override
- REST API for Unity client: 5 lean endpoints

**Non-Goals / Out of Scope**:
- Real auth system (stub JWT guard via X-Player-Id header)
- Email/push notification delivery
- Game engine integration
- Unity client implementation
- Payment/real-money
- Backoffice UI
- Production deployment/infra

## Existing Context

### Repo Structure
The skeleton repo (`tech-assignment`) provides a multi-challenge setup. For Rewards (Option A), the relevant code lives in:

```
serverless-v2/services/rewards-api/     # Express-in-Lambda API (serverless-offline)
serverless-v2/services/rewards-frontend/ # Vite + React 18 + MUI + Redux Toolkit
serverless-v2/shared/                   # Shared config (dynamo.js, redis.js, db.js, logger.js)
scripts/                                # init-dynamodb.sh, seed-rewards.js
```

### What Already Exists (Skeleton)
- **rewards-api**: Express app with serverless-http wrapper. Routes: health (working), points (501 stub), player (501 stub). Auth middleware extracts `X-Player-Id` header. DynamoDB service with CRUD helpers (getPlayer, putPlayer, updatePlayer, addTransaction, getTransactions, getAllPlayers). Constants file with tier definitions and point rules.
- **rewards-frontend**: Vite + React 18 + MUI app. Has Login page (stores playerId in localStorage), placeholder Dashboard, Redux store with auth slice, Axios API client with X-Player-Id interceptor.
- **Docker Compose**: `rewards` profile starts DynamoDB Local + rewards-api (:5000) + rewards-frontend (:4000). DynamoDB init container creates tables: rewards-players, rewards-transactions, rewards-leaderboard, rewards-notifications.
- **Seed script**: Creates 50 players across tiers with 5-15 transactions each.

### Key Architecture Decisions Already Made
- Express (not NestJS as suggested in challenge doc) — skeleton uses Express-in-Lambda
- DynamoDB Local via Docker (not real AWS)
- Serverless Framework v3 with serverless-offline plugin
- Auth is X-Player-Id header (stub)
- Frontend uses MUI + Redux Toolkit + Axios

### Discrepancy: NestJS vs Express
The challenge doc suggests NestJS, but the skeleton provides Express. The challenge doc says "may deviate" from suggested architecture. The existing skeleton is Express-based and all helpers/config assume Express. **Decision to make: stick with Express (pragmatic, matches skeleton) or rewrite to NestJS (matches spec).**

### Naming Conventions
- JavaScript (CommonJS `require`), not TypeScript on backend
- Frontend is TypeScript
- File naming: kebab-case for files, camelCase for variables
- Route files export Express Router instances

## Development and Validation Environment

### Running Locally
```bash
cp .env.example .env
docker compose --profile rewards up        # Starts DynamoDB Local, rewards-api, rewards-frontend
```

### Service URLs
| Service | URL |
|---------|-----|
| Rewards API health | http://localhost:5000/api/v1/health |
| Rewards Frontend | http://localhost:4000 |
| DynamoDB Local | http://localhost:8000 |

### Testing
```bash
cd serverless-v2/services/rewards-api && npm install && npm test
```
Currently 1 test (health endpoint). Jest with node test environment.

### Seeding
```bash
cd scripts && npm install && node seed-rewards.js
```

### Code Changes
Volume-mounted but no hot-reload. Restart: `docker compose restart rewards-api`

## Key Constraints

### Technical
- **Runtime**: Node.js 22
- **Database**: DynamoDB (via AWS SDK v3, DynamoDB Local for dev)
- **Backend lang**: JavaScript (CommonJS) — skeleton is JS, not TS
- **Frontend**: React 18 + TypeScript + MUI + Redux Toolkit
- **Testing**: Jest (backend), React Testing Library (frontend)
- **Validation**: class-validator mentioned in spec but skeleton uses plain Express
- **Docker Compose must work**: `docker compose --profile rewards up` → everything boots

### Product
- Points ledger must be immutable (append-only)
- Tier upgrades are immediate, downgrades only on monthly reset
- Monthly reset has floor protection (max 1 tier drop)
- Tier multiplier applied at time of earn (not retroactively)
- Leaderboard is monthly-scoped

### DynamoDB Table Schema (Already Created)
| Table | PK | SK | Notes |
|-------|----|----|-------|
| rewards-players | playerId (S) | — | Player profile + tier + points |
| rewards-transactions | playerId (S) | timestamp (N) | Immutable point ledger |
| rewards-leaderboard | monthKey (S) | playerId (S) | Monthly leaderboard entries |
| rewards-notifications | playerId (S) | notificationId (S) | Notification records |

**Note**: The challenge doc specifies a `monthKey` GSI on rewards-transactions, but the init script does NOT create this GSI. We need to either add it or query differently.

## Likely Validation Surfaces

### Unit Tests
- Points calculation: base points from stakes bracket, multiplier application
- Tier progression: threshold checks, upgrade trigger, floor protection on reset
- getTierForPoints / getNextTier helper functions

### Integration Tests
- POST /api/v1/points/award: full flow — create player if needed, calculate points, write ledger, check tier advancement, create notification if tier changed
- GET /api/v1/player/rewards: returns correct tier, points, progress
- GET /api/v1/points/leaderboard: sorted correctly, includes self-rank
- Monthly reset logic (even if manually triggered)

### Frontend Tests (React Testing Library)
- Dashboard renders tier card, points, progress bar
- Points history table renders transaction rows
- Leaderboard widget shows top 10 + self rank

### Manual Checkpoints
- `docker compose --profile rewards up` boots successfully
- `npm test` passes
- Seed script populates data visible in dashboard
- Point award → tier upgrade → notification created (end-to-end)

## Unknowns and Risks

### Architecture Decisions Needed
1. **NestJS vs Express**: Spec says NestJS, skeleton is Express. Recommend Express (pragmatic — skeleton works, helpers exist, less rewrite risk). Document the deviation.
2. **Monthly reset trigger**: Spec says "even if triggered manually, not via cron". Need an admin endpoint or script to trigger reset. Could be a POST /admin/tier/reset endpoint.
3. **Leaderboard strategy**: The rewards-leaderboard table exists but the seed script doesn't populate it. Need to decide: write to leaderboard table on every point award, or compute on-read from rewards-players.
4. **Missing monthKey GSI on transactions**: The challenge spec shows monthKey as a GSI on rewards-transactions, but the Docker init doesn't create it. Need to add it for monthly queries, or use alternative query patterns.

### Risks
- **DynamoDB query patterns**: Without the monthKey GSI, querying monthly transactions requires scanning or restructuring. Need to decide early.
- **Skeleton data model drift**: The seed script's player schema (points, tier, totalEarned, handsPlayed, tournamentsPlayed, username) differs from the challenge doc's schema (currentTier as number, monthlyPoints, lifetimePoints, tierFloor, lastTierChangeAt). Need to reconcile.
- **Frontend scope**: Dashboard has 4 widgets (summary, history, timeline, leaderboard). The tier timeline (6-month history) needs monthly tier snapshots that don't exist in current schema.
- **No notifications table helpers**: dynamo.service.js only covers players and transactions tables. Need to add notification and leaderboard CRUD.
- **Testing depth**: Currently 1 test. Need substantial test coverage for pass criteria.
