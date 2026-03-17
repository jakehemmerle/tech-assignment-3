# Source Alignment Round 2: Constraints, Architecture, Data, Interfaces

## Constraints and Architecture Guardrails

- RESPECTED: Node.js 22 runtime → Docker Compose uses node:22-alpine
- RESPECTED: Express framework → Skeleton and decomposition both use Express
- RESPECTED: DynamoDB via AWS SDK v3 → Shared config uses @aws-sdk/client-dynamodb + lib-dynamodb
- RESPECTED: JavaScript CommonJS backend → All .js files use require/module.exports
- RESPECTED: TypeScript frontend → All .tsx files, tsconfig.json present
- RESPECTED: React 18+ / MUI / Redux Toolkit → package.json confirms versions
- RESPECTED: Jest for backend testing → package.json has jest 29, test command configured
- RESPECTED: Docker Compose must work → M1.0 task 1 explicitly verifies this
- RESPECTED: Immutable ledger → DS2 is append-only, no update/delete operations planned
- RESPECTED: Auth via X-Player-Id → Existing middleware preserved, used throughout
- RESPECTED: API versioning under /api/v1/ → All endpoints follow this
- RESPECTED: Table names via env vars → Existing pattern in dynamo.service.js
- RESPECTED: Shared config via serverless-v2/shared/ → All services use shared/config/dynamo.js
- RESPECTED: Serverless-offline compatibility → All endpoints route through handler.js → serverless-http

### UNADDRESSED: CORS configuration (should-fix)
handler.js already has CORS middleware allowing all origins. The decomposition doesn't mention CORS but it's already handled by the skeleton. No fix needed — just noting it's inherited.

### UNADDRESSED: Error response shape (should-fix)
Architecture guardrail says `{ error, message }` but no epic explicitly defines a centralized error handler. The skeleton already has a 404 handler in this shape. Individual route implementations should follow this pattern.

**Fix:** Add a note to M1.0 that error response shape `{ error, message }` is the convention. No new task needed — it's implicit in route implementation.

## Data Structure Alignment

- ALIGNED: DS1 (Player Profile) → Defined in inventory, used by M1.0 seed, M1.1-M1.6
- ALIGNED: DS2 (Points Transaction) → Defined, append-only enforced, used by M1.1
- ALIGNED: DS3 (Leaderboard Entry) → Defined, M1 computes on-read, M2.2 adds write-through
- ALIGNED: DS4 (Notification) → Defined, created by M1.2/M1.4, managed by M2.1
- ALIGNED: DS5 (Tier History) → Defined as M2-only, created during M2.3 reset

### PARTIAL: DynamoDB table creation gap (must-fix)
DS5 (rewards-tier-history) needs a new table in Docker init, but this is only addressed in M2.3 task 3. The Docker Compose init container creates tables at startup. If M2.3 adds a table, it needs to be in the init script before M2.3 runs.

**Fix:** M2.3 task 3 already says "Add rewards-tier-history table to Docker init script." This is correctly sequenced (add before use). No change needed — the task order within M2.3 handles it.

### PARTIAL: Existing dynamo.service.js coverage (should-fix)
The existing dynamo.service.js only covers rewards-players and rewards-transactions. M1.0 task 2 says "Extend dynamo.service.js with notification and leaderboard table CRUD helpers." This is correct but should also cover the leaderboard table explicitly.

**Fix:** Already covered by M1.0 task 2. No change needed.

## Interface Alignment

- ALIGNED: IF1 (POST /points/award) → Input/output shapes match challenge spec
- ALIGNED: IF2 (GET /player/rewards) → Returns tier, points, progress
- ALIGNED: IF3 (GET /player/rewards/history) → Paginated transactions
- ALIGNED: IF4 (GET /leaderboard) → Sorted with limit param
- ALIGNED: IF5 (GET /notifications) → With unread filter
- ALIGNED: IF6 (PATCH /notifications/:id/dismiss) → M2, simple update
- ALIGNED: IF7-IF10 (Admin endpoints) → All 4 defined and tasked
- ALIGNED: IF11 (POST /admin/tier/reset) → M2.3

### PARTIAL: IF1 input shape mismatch with skeleton (should-fix)
The skeleton's points route stub expects `{ playerId, points, reason }` but the challenge spec says `{ playerId, tableId, tableStakes, bigBlind, handId }`. The decomposition correctly uses the challenge spec shape (IF1). The skeleton stub is just a hint — implementation replaces it.

**Fix:** No change needed. Implementation will use the challenge spec shape.

### PARTIAL: Notifications endpoint missing from handler.js registration (should-fix)
The skeleton handler.js only mounts health, points, and player routes. M1.0 task 6 says "add admin.js, notifications.js, leaderboard.js route files" and task 7 says "Register new routes in handler.js." This is correct.

**Fix:** Already covered. No change needed.

## Changes Applied

1. No structural changes to decomposition.
2. All constraints respected. All data structures and interfaces properly sequenced.
3. Minor notes: error response convention, CORS inherited from skeleton, IF1 input shape uses spec (not skeleton stub).
