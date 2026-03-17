# Project Decomposition: rewards-generic-v1

## Overview

A poker loyalty rewards system with three surfaces: Express API (serverless-offline), React dashboard, and Unity-facing REST endpoints. Backend-heavy — the core is a points engine with tier progression, immutable ledger, leaderboard, notifications, and admin tools.

Two milestone tiers:
- **M1 (Minimum/Pass)**: Core points engine, tier progression, basic leaderboard, dashboard with summary + history, notifications on tier change, Unity REST endpoints, admin endpoints, unit tests, Docker Compose works.
- **M2 (Strong)**: Pagination, self-rank on leaderboard, notification dismiss + unread count, monthly reset, tier timeline (6 months), integration tests, API docs, write-through leaderboard.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Express (skeleton) | Skeleton provides Express. Spec says "may deviate." Avoids full rewrite. Document deviation. |
| Language | JavaScript (CommonJS) backend, TypeScript frontend | Matches skeleton conventions. |
| Auth | X-Player-Id header (stub) | Per spec. No real JWT implementation. |
| Leaderboard M1 | On-read: scan players, sort by monthlyPoints | Simple, correct. 50-100 players, scan is fine. |
| Leaderboard M2 | Write-through to rewards-leaderboard table | Upsert leaderboard entry on every point award. |
| Tier history | Deferred to M2 | Only needed for timeline widget (Should Have). Store as snapshots during monthly reset. |
| monthKey GSI | Not needed | Write-through leaderboard eliminates cross-player monthly queries. Per-player queries use PK+timestamp. |
| Validation | class-validator skipped | Express doesn't use it natively. Manual validation sufficient. |
| State management | Redux Toolkit + RTK Query | Matches skeleton. RTK Query gives caching + loading states. |

## Scaffold and Validation Foundation

Before feature work begins:
1. Ensure Docker Compose rewards profile boots cleanly
2. Set up test infrastructure: Jest test helpers, DynamoDB mock/stub pattern, Express test app factory
3. Establish route/service/data-access layering convention
4. Rewrite seed script to match canonical data model
5. Add any missing DynamoDB table definitions to Docker init

## Data Structure Inventory

### DS1: Player Profile — DynamoDB table `rewards-players`

```js
{
  playerId:            String,  // PK — player GUID (e.g. "player-001")
  displayName:         String,  // human-readable name (e.g. "Ace_High")
  currentTier:         Number,  // 1=Bronze, 2=Silver, 3=Gold, 4=Platinum
  monthlyPoints:       Number,  // points earned this calendar month (resets on monthly reset)
  lifetimePoints:      Number,  // all-time cumulative points
  tierFloor:           Number,  // minimum tier from previous month's protection (1-4)
  tierOverride:        Number,  // (optional) admin-set tier override (1-4), null if not overridden
  tierOverrideExpiry:  String,  // (optional) ISO 8601 timestamp when override expires, null if none
  triggeredMilestones: List,    // (optional) list of milestone thresholds already notified, e.g. [100, 500]
  lastTierChangeAt:    String,  // ISO 8601 timestamp of last tier change
  createdAt:           String,  // ISO 8601
  updatedAt:           String,  // ISO 8601
}
```

- **Key schema**: `playerId` (HASH)
- **Constraints**: `currentTier` in {1,2,3,4}. `monthlyPoints >= 0`. `lifetimePoints >= 0`. Auto-created on first point award if not exists (defaults: currentTier=1, monthlyPoints=0, lifetimePoints=0, tierFloor=1).
- **Used by**: M1.0, M1.1, M1.2, M1.3, M1.5, M1.6, M2.1, M2.2, M2.3

### DS2: Points Transaction — DynamoDB table `rewards-transactions`

```js
{
  playerId:     String,  // PK — player GUID
  timestamp:    Number,  // SK — epoch milliseconds (ensures uniqueness + sort order)
  type:         String,  // "gameplay" | "adjustment" | "bonus"
  basePoints:   Number,  // pre-multiplier points (e.g. 5 for $2-$5 stakes)
  multiplier:   Number,  // tier multiplier at time of earn (e.g. 1.5)
  earnedPoints: Number,  // basePoints × multiplier
  tableId:      Number,  // (nullable) game table ID, null for adjustments
  tableStakes:  String,  // (nullable) e.g. "2/5", null for adjustments
  handId:       String,  // (nullable) hand identifier for idempotency
  reason:       String,  // (nullable) free-text reason, required for type="adjustment"
  monthKey:     String,  // "YYYY-MM" for the month this transaction belongs to
  createdAt:    String,  // ISO 8601
}
```

- **Key schema**: `playerId` (HASH), `timestamp` (RANGE)
- **Constraints**: Append-only — never update or delete rows. `earnedPoints` must equal `basePoints * multiplier`.
- **Used by**: M1.1, M1.2, M1.5, M2.1, M2.5

### DS3: Leaderboard Entry — DynamoDB table `rewards-leaderboard`

```js
{
  monthKey:     String,  // PK — "YYYY-MM" (e.g. "2026-03")
  playerId:     String,  // SK — player GUID
  displayName:  String,  // player display name
  tier:         Number,  // current tier (1-4)
  monthlyPoints: Number, // monthly point total (denormalized from DS1)
}
```

- **Key schema**: `monthKey` (HASH), `playerId` (RANGE)
- **Constraints**: M1 computes on-read from DS1 (this table unused in M1). M2 upserts on every point award. Sorted client-side by `monthlyPoints` descending after query.
- **Used by**: M1.3 (on-read from DS1), M2.2 (write-through)

### DS4: Notification — DynamoDB table `rewards-notifications`

```js
{
  playerId:       String,   // PK — player GUID
  notificationId: String,   // SK — UUID v4
  type:           String,   // "tier_upgrade" | "tier_downgrade" | "milestone"
  title:          String,   // display title (e.g. "Congratulations! You've reached Gold tier")
  description:    String,   // display body with details
  dismissed:      Boolean,  // false on creation, true after player dismisses
  createdAt:      String,   // ISO 8601
}
```

- **Key schema**: `playerId` (HASH), `notificationId` (RANGE)
- **Constraints**: `dismissed` defaults to `false`. Dismiss sets `true` (only field that can be updated). `type` must be one of the three enum values.
- **Used by**: M1.2, M1.4, M2.1

### DS5: Tier History — DynamoDB table `rewards-tier-history` (M2 only)

```js
{
  playerId:     String,  // PK — player GUID
  monthKey:     String,  // SK — "YYYY-MM"
  tier:         Number,  // tier at end of month (1-4)
  monthlyPoints: Number, // total points earned that month
}
```

- **Key schema**: `playerId` (HASH), `monthKey` (RANGE)
- **Constraints**: Written during monthly reset (M2.3). New table — must be added to Docker init script before use.
- **Used by**: M2.3, M2.4

## Core Interface Inventory

### Service Layer Functions

#### points.service.js

```js
/**
 * Calculate base points from big blind amount.
 * @param {number} bigBlind — table big blind in dollars
 * @returns {number} base points (1, 2, 5, or 10)
 */
function calculateBasePoints(bigBlind)

/**
 * Award points for a hand played. Creates ledger entry, updates player,
 * checks tier advancement, creates notification if tier changed.
 * @param {{ playerId: string, tableId: number, tableStakes: string, bigBlind: number, handId: string }} params
 * @returns {Promise<{
 *   playerId: string,
 *   basePoints: number,
 *   multiplier: number,
 *   earnedPoints: number,
 *   newMonthlyTotal: number,
 *   newLifetimeTotal: number,
 *   currentTier: number,
 *   tierName: string,
 *   tierChanged: boolean
 * }>}
 */
async function awardPoints({ playerId, tableId, tableStakes, bigBlind, handId })
```

#### tier.service.js

```js
/**
 * Map tier number to tier definition.
 * @param {number} tierNum — 1-4
 * @returns {{ name: string, minPoints: number, multiplier: number }}
 */
function getTierDef(tierNum)

/**
 * Determine which tier a player should be at based on monthly points.
 * @param {number} monthlyPoints
 * @returns {number} tier number (1-4)
 */
function getTierForPoints(monthlyPoints)

/**
 * Get the next tier above the given tier, or null if at Platinum.
 * @param {number} currentTier — 1-4
 * @returns {{ name: string, minPoints: number, multiplier: number } | null}
 */
function getNextTier(currentTier)

/**
 * Check if points update triggers a tier advancement.
 * @param {number} oldTier — tier before points update (1-4)
 * @param {number} newMonthlyPoints — monthly points after update
 * @returns {{ newTier: number, changed: boolean }}
 */
function checkTierAdvancement(oldTier, newMonthlyPoints)

/**
 * Apply floor protection for monthly reset.
 * Max 1 tier drop: Platinum→Gold, Gold→Silver, Silver→Bronze, Bronze→Bronze.
 * @param {number} previousTier — tier from previous month (1-4)
 * @returns {number} floor tier (1-4)
 */
function calculateTierFloor(previousTier)
```

#### notification.service.js

```js
/**
 * Create a notification record in DynamoDB.
 * @param {string} playerId
 * @param {"tier_upgrade"|"tier_downgrade"|"milestone"} type
 * @param {string} title
 * @param {string} description
 * @returns {Promise<{ playerId: string, notificationId: string, type: string, title: string, description: string, dismissed: boolean, createdAt: string }>}
 */
async function createNotification(playerId, type, title, description)

/**
 * Get notifications for a player.
 * @param {string} playerId
 * @param {{ unreadOnly?: boolean }} options
 * @returns {Promise<{ notifications: DS4[], unreadCount: number }>}
 */
async function getNotifications(playerId, { unreadOnly } = {})

/**
 * Dismiss a notification (set dismissed=true).
 * @param {string} playerId
 * @param {string} notificationId
 * @returns {Promise<void>}
 */
async function dismissNotification(playerId, notificationId)
```

#### leaderboard.service.js

```js
/**
 * Get the monthly leaderboard by scanning players and sorting (M1 on-read).
 * @param {{ limit?: number, requestingPlayerId?: string }} options
 * @returns {Promise<{
 *   leaderboard: Array<{ rank: number, playerId: string, displayName: string, tier: number, monthlyPoints: number }>,
 *   playerRank: { rank: number, playerId: string, displayName: string, tier: number, monthlyPoints: number } | null
 * }>}
 */
async function getLeaderboard({ limit, requestingPlayerId } = {})

/**
 * Upsert a leaderboard entry in the leaderboard table (M2 write-through).
 * @param {string} monthKey — "YYYY-MM"
 * @param {{ playerId: string, displayName: string, tier: number, monthlyPoints: number }} entry
 * @returns {Promise<void>}
 */
async function upsertLeaderboardEntry(monthKey, entry)
```

#### tier-reset.service.js (M2)

```js
/**
 * Execute monthly tier reset for all players.
 * Snapshots tier history, applies floor protection, resets monthlyPoints,
 * creates downgrade notifications.
 * @returns {Promise<{
 *   playersProcessed: number,
 *   tierChanges: Array<{ playerId: string, oldTier: number, newTier: number }>
 * }>}
 */
async function executeMonthlyReset()
```

### Data Access Layer (dynamo.service.js extensions)

```js
// --- Existing (rewards-players, rewards-transactions) ---
async function getPlayer(playerId)                          // → DS1 | null
async function putPlayer(player)                            // → void
async function updatePlayer(playerId, updates)              // → void
async function addTransaction(playerId, transaction)        // → void
async function getTransactions(playerId, limit)             // → DS2[]
async function getAllPlayers()                               // → DS1[]

// --- New: notifications (rewards-notifications) ---
async function putNotification(notification)                // → void (PutCommand on DS4)
async function queryNotifications(playerId, { unreadOnly }) // → DS4[] (QueryCommand, optional FilterExpression on dismissed)
async function updateNotificationDismissed(playerId, notificationId) // → void (UpdateCommand: SET dismissed = true)

// --- New: leaderboard (rewards-leaderboard) ---
async function putLeaderboardEntry(entry)                   // → void (PutCommand on DS3)
async function queryLeaderboard(monthKey)                   // → DS3[] (QueryCommand by monthKey)

// --- New: tier history (rewards-tier-history, M2) ---
async function putTierHistory(entry)                        // → void (PutCommand on DS5)
async function queryTierHistory(playerId, limit)            // → DS5[] (QueryCommand, ScanIndexForward=false, limit)
```

### REST API Endpoints

#### IF1: POST /api/v1/points/award
```
Request:
  Headers: X-Player-Id: string (required)
  Body: {
    playerId:   string,  // player GUID
    tableId:    number,  // game table ID
    tableStakes: string, // e.g. "2/5"
    bigBlind:   number,  // big blind in dollars (e.g. 5.00)
    handId:     string   // hand identifier
  }

Response 200:
  {
    playerId:         string,
    basePoints:       number,
    multiplier:       number,
    earnedPoints:     number,
    newMonthlyTotal:  number,
    newLifetimeTotal: number,
    currentTier:      number,
    tierName:         string,
    tierChanged:      boolean
  }

Response 400: { error: "Bad Request", message: "..." }
Response 401: { error: "Unauthorized", message: "X-Player-Id header is required" }
```

#### IF2: GET /api/v1/player/rewards
```
Request:
  Headers: X-Player-Id: string (required)

Response 200:
  {
    playerId:         string,
    currentTier:      number,   // 1-4
    tierName:         string,   // "Bronze"|"Silver"|"Gold"|"Platinum"
    monthlyPoints:    number,
    lifetimePoints:   number,
    multiplier:       number,   // current tier multiplier
    pointsToNextTier: number,   // points needed to reach next tier (0 if Platinum)
    nextTierName:     string | null,  // null if at Platinum
    nextTierThreshold: number | null, // null if at Platinum
    progressPercent:  number    // 0-100, percentage toward next tier
  }
```

#### IF3: GET /api/v1/player/rewards/history
```
Request:
  Headers: X-Player-Id: string (required)
  Query: limit=number (default 20), offset=number (default 0)

Response 200:
  {
    transactions: [
      {
        timestamp:    number,  // epoch ms
        type:         string,  // "gameplay"|"adjustment"|"bonus"
        basePoints:   number,
        multiplier:   number,
        earnedPoints: number,
        tableId:      number | null,
        tableStakes:  string | null,
        reason:       string | null,
        createdAt:    string   // ISO 8601
      }
    ],
    total:   number,
    hasMore: boolean
  }
```

#### IF4: GET /api/v1/leaderboard
```
Request:
  Headers: X-Player-Id: string (optional, for self-rank)
  Query: limit=number (default 100)

Response 200:
  {
    leaderboard: [
      {
        rank:          number,  // 1-based
        displayName:   string,
        tier:          number,  // 1-4
        monthlyPoints: number
      }
    ],
    playerRank: {             // null if X-Player-Id not provided or player has no points
      rank:          number,
      displayName:   string,
      tier:          number,
      monthlyPoints: number
    } | null
  }
```

#### IF5: GET /api/v1/player/notifications
```
Request:
  Headers: X-Player-Id: string (required)
  Query: unread=boolean (default false; if true, only dismissed=false)

Response 200:
  {
    notifications: [
      {
        notificationId: string,
        type:           string,  // "tier_upgrade"|"tier_downgrade"|"milestone"
        title:          string,
        description:    string,
        dismissed:      boolean,
        createdAt:      string   // ISO 8601
      }
    ],
    unreadCount: number  // total count of dismissed=false for this player
  }
```

#### IF6: PATCH /api/v1/player/notifications/:notificationId/dismiss
```
Request:
  Headers: X-Player-Id: string (required)
  Params: notificationId: string

Response 200: { success: true }
Response 404: { error: "Not Found", message: "Notification not found" }
```

#### IF7: GET /admin/players/:playerId/rewards
```
Request:
  Params: playerId: string

Response 200:
  {
    playerId:           string,
    displayName:        string,
    currentTier:        number,
    tierName:           string,
    monthlyPoints:      number,
    lifetimePoints:     number,
    tierFloor:          number,
    tierOverride:       number | null,
    tierOverrideExpiry: string | null,
    multiplier:         number,
    lastTierChangeAt:   string,
    createdAt:          string,
    updatedAt:          string
  }

Response 404: { error: "Not Found", message: "Player not found" }
```

#### IF8: POST /admin/points/adjust
```
Request:
  Body: {
    playerId: string,   // required
    points:   number,   // positive = credit, negative = debit
    reason:   string    // required, free-text explanation
  }

Response 200:
  {
    playerId:    string,
    adjustment:  number,
    newMonthlyTotal:  number,
    newLifetimeTotal: number,
    transaction: {
      timestamp:    number,
      type:         "adjustment",
      basePoints:   number,
      multiplier:   1,
      earnedPoints: number,
      reason:       string
    }
  }

Response 400: { error: "Bad Request", message: "..." }
Response 404: { error: "Not Found", message: "Player not found" }
```

#### IF9: GET /admin/leaderboard
```
Request:
  Query: limit=number (default 100)

Response 200:
  {
    leaderboard: [
      {
        rank:          number,
        playerId:      string,   // included for admin (not in player leaderboard)
        displayName:   string,
        tier:          number,
        monthlyPoints: number
      }
    ]
  }
```

#### IF10: POST /admin/tier/override
```
Request:
  Body: {
    playerId:  string,  // required
    tier:      number,  // 1-4, required
    expiresAt: string   // ISO 8601 timestamp, required
  }

Response 200: { success: true, playerId: string, newTier: number, expiresAt: string }
Response 400: { error: "Bad Request", message: "..." }
Response 404: { error: "Not Found", message: "Player not found" }
```

#### IF11: POST /admin/tier/reset (M2)
```
Request:
  Body: (none)

Response 200:
  {
    playersProcessed: number,
    tierChanges: [
      {
        playerId: string,
        oldTier:  number,
        newTier:  number
      }
    ]
  }
```

## Milestone Summary

| Milestone | Epics | Est. Tasks | What It Proves |
|-----------|-------|------------|----------------|
| M1 (Minimum / Pass) | 7 | ~35 | Core rewards system works end-to-end: points engine, tiers, leaderboard, dashboard, notifications, admin, Unity API. Tests pass, Docker boots. |
| M2 (Strong) | 5 | ~20 | Production-quality: pagination, self-rank, notification management, monthly reset, tier timeline, integration tests, API docs, write-through leaderboard. |

## M1: Minimum / Pass

### Epic M1.0: Scaffold and Test Infrastructure
**Tracer bullet:** Docker Compose boots, test suite runs, data access layer works
**Depends on:** None
**Parallelizable with:** Nothing (foundation)
**Data structures:** DS1, DS2, DS3, DS4
**Interfaces:** None
**Validation mode:** manual + unit
**Human checkpoint:** `docker compose --profile rewards up` boots; `npm test` runs (even if only health test)

**Tasks:**
1. [ ] Verify Docker Compose rewards profile boots cleanly with existing skeleton
2. [ ] Extend dynamo.service.js with notification and leaderboard table CRUD helpers
3. [ ] Create test helpers: Express test app factory, DynamoDB mock/stub utilities
4. [ ] Rewrite seed-rewards.js to match canonical data model (DS1, DS2 shapes)
5. [ ] Add constants for BB brackets (base points per stake range) to constants.js
6. [ ] Establish route file structure: add admin.js, notifications.js, leaderboard.js route files
7. [ ] Register new routes in handler.js; add PATCH to CORS allowed methods

**Acceptance criteria:**
- Docker Compose rewards profile starts without errors
- Test suite runs (`npm test`)
- Seed script writes data matching DS1/DS2 schema
- All route files exist and return 501 stubs

---

### Epic M1.1: Points Engine — Calculation and Ledger
**Tracer bullet:** POST /points/award → correct points calculated → ledger entry written → player totals updated
**Depends on:** M1.0
**Parallelizable with:** Nothing (core engine, everything depends on it)
**Data structures:** DS1, DS2
**Interfaces:** IF1
**Validation mode:** unit + integration
**Human checkpoint:** `curl POST /points/award` returns correct earnedPoints; DynamoDB shows ledger entry

**Tasks:**
1. [ ] Write unit tests for points calculation: BB bracket → base points, multiplier application
2. [ ] Implement points calculation service: `calculateBasePoints(bigBlind)`, `calculateEarnedPoints(base, multiplier)`
3. [ ] Write unit tests for player upsert logic (create if not exists, update totals)
4. [ ] Implement points.service.js: `awardPoints({ playerId, tableId, tableStakes, bigBlind, handId })`
   - Get or create player record
   - Calculate base points from BB bracket
   - Apply tier multiplier
   - Write transaction to ledger (DS2)
   - Update player monthlyPoints and lifetimePoints (DS1) — use DynamoDB atomic ADD for concurrency safety
   - Return result
5. [ ] Implement POST /api/v1/points/award route handler with input validation
6. [ ] Write integration test: award points → verify ledger entry + player update

**Acceptance criteria:**
- Base points correctly mapped from BB ranges: 0.10-0.25→1, 0.50-1.00→2, 2.00-5.00→5, 10.00+→10
- Multiplier applied: earned = base × tier multiplier
- Ledger entry written with all fields (immutable, append-only)
- Player monthlyPoints and lifetimePoints updated atomically
- New player auto-created at Bronze tier on first award
- Input validation rejects missing/invalid fields

---

### Epic M1.2: Tier Progression
**Tracer bullet:** Points awarded → tier threshold reached → player tier upgrades immediately → notification created
**Depends on:** M1.1
**Parallelizable with:** Nothing (tier logic modifies the award flow)
**Data structures:** DS1, DS4
**Interfaces:** IF1 (extended), IF2
**Validation mode:** unit + integration
**Human checkpoint:** Award enough points to cross Silver threshold → player tier changes to Silver → notification exists

**Tasks:**
1. [ ] Write unit tests for tier determination: points → tier mapping, including edge cases at thresholds
2. [ ] Write unit tests for tier advancement detection: old tier vs new tier after points update
3. [ ] Implement tier.service.js: `checkTierAdvancement(playerId, newMonthlyPoints)` — returns { newTier, changed, notification? }
4. [ ] Integrate tier check into points.service.js awardPoints flow: after updating totals, check tier, update if changed
5. [ ] Write notification creation helper: `createTierChangeNotification(playerId, oldTier, newTier)`
6. [ ] Implement GET /api/v1/player/rewards (IF2): return current tier, points, progress to next tier, multiplier
7. [ ] Write unit test for player rewards endpoint

**Acceptance criteria:**
- Player at 499 monthly points is Bronze; at 500 becomes Silver
- Tier upgrade is immediate (same request that crosses threshold)
- Tier multiplier updates for subsequent awards
- GET /player/rewards returns correct tier, pointsToNextTier, progressPercent
- Notification created on tier upgrade

---

### Epic M1.3: Leaderboard (On-Read)
**Tracer bullet:** Multiple players with points → GET /leaderboard returns sorted list
**Depends on:** M1.1
**Parallelizable with:** M1.2 (independent feature, same dependency)
**Data structures:** DS1
**Interfaces:** IF4
**Validation mode:** unit + integration
**Human checkpoint:** Seed data → GET /leaderboard returns top 10 sorted by monthlyPoints

**Tasks:**
1. [ ] Write unit test for leaderboard sorting and ranking logic
2. [ ] Implement leaderboard.service.js: scan rewards-players, sort by monthlyPoints desc, take top N, compute ranks
3. [ ] Implement GET /api/v1/leaderboard route handler with ?limit param
4. [ ] Write integration test: seed players → query leaderboard → verify sort order and rank numbers

**Acceptance criteria:**
- Returns players sorted by monthlyPoints descending
- Each entry has rank, displayName, tier, monthlyPoints
- Limit parameter works (default 100)
- Empty leaderboard returns empty array (not error)

---

### Epic M1.4: Notifications — Create and List
**Tracer bullet:** Tier change → notification stored → GET /notifications returns it
**Depends on:** M1.2 (tier change creates notifications)
**Parallelizable with:** M1.3
**Data structures:** DS4
**Interfaces:** IF5
**Validation mode:** unit + integration
**Human checkpoint:** Trigger tier upgrade → GET /notifications shows tier_upgrade notification

**Tasks:**
1. [ ] Write unit test for notification creation and listing
2. [ ] Implement notification.service.js: `createNotification(playerId, type, title, description)`, `getNotifications(playerId, unreadOnly)`
3. [ ] Implement GET /api/v1/player/notifications route handler with ?unread filter
4. [ ] Write integration test: create notification → list → verify fields

**Acceptance criteria:**
- Notifications created on tier upgrade with correct type/title/description
- GET /notifications returns all notifications for player
- ?unread=true filters to dismissed=false only
- unreadCount included in response

---

### Epic M1.5: Player Dashboard — Summary and History
**Tracer bullet:** Login → dashboard shows tier card + points history from API
**Depends on:** M1.1, M1.2 (API endpoints must work)
**Parallelizable with:** M1.3, M1.4 (frontend work independent of leaderboard/notification backend)
**Data structures:** DS1, DS2
**Interfaces:** IF2, IF3
**Validation mode:** component tests + manual
**Human checkpoint:** Open localhost:4000, login with player ID, see tier card with correct data + history table

**Tasks:**
1. [ ] Implement GET /api/v1/player/rewards/history route (IF3): query transactions, return with basic pagination
2. [ ] Set up RTK Query API slice for rewards endpoints (player/rewards, player/rewards/history)
3. [ ] Build summary card component: tier badge, tier name, monthly points, points to next tier, progress bar
4. [ ] Build points history table component: date, table, stakes, base points, multiplier, earned
5. [ ] Wire Dashboard page to RTK Query: fetch on mount, loading/error states
6. [ ] Write React Testing Library tests for summary card and history table (with mock data)

**Acceptance criteria:**
- Dashboard loads and displays current tier with visual badge
- Progress bar shows percentage to next tier
- Points history table shows recent transactions
- Loading spinner shown while API call pending; error message shown on API failure
- Login flow works (store playerId, redirect to dashboard)

---

### Epic M1.6: Admin Endpoints
**Tracer bullet:** Admin can view player profile, adjust points, view leaderboard
**Depends on:** M1.1, M1.2 (points and tier logic must exist)
**Parallelizable with:** M1.5
**Data structures:** DS1, DS2
**Interfaces:** IF7, IF8, IF9, IF10
**Validation mode:** unit + integration
**Human checkpoint:** curl admin endpoints → correct responses

**Tasks:**
1. [ ] Implement GET /admin/players/:playerId/rewards — return full player profile from DS1
2. [ ] Implement POST /admin/points/adjust — create adjustment transaction, update player totals, check tier
3. [ ] Implement GET /admin/leaderboard — same as player leaderboard but with playerId field
4. [ ] Implement POST /admin/tier/override — set currentTier and tierOverrideExpiry on player record
5. [ ] Register admin routes in handler.js (no auth guard for admin per spec)
6. [ ] Write unit tests for admin point adjustment (verify ledger entry type=adjustment with reason)

**Acceptance criteria:**
- GET /admin/players/:id/rewards returns complete player profile
- POST /admin/points/adjust writes adjustment transaction with reason, updates totals
- GET /admin/leaderboard includes playerId in each entry
- POST /admin/tier/override sets tier and expiry on player record
- Negative point adjustments work (debit)

---

### Epic M1.7: Unity REST API Verification
**Tracer bullet:** All 5 Unity-facing endpoints return documented response shapes
**Depends on:** M1.1, M1.2, M1.3, M1.4 (all endpoints must be implemented)
**Parallelizable with:** M1.5, M1.6
**Data structures:** All
**Interfaces:** IF1-IF6
**Validation mode:** integration
**Human checkpoint:** curl all 5 Unity endpoints → responses match documented schemas

**Tasks:**
1. [ ] Verify all Unity endpoints exist and return correct shapes (they overlap with player/dashboard endpoints)
2. [ ] Ensure response payloads are lean (no unnecessary fields for mobile)
3. [ ] Write or verify integration tests for all 5 Unity endpoints
4. [ ] Document request/response schemas in markdown

**Acceptance criteria:**
- GET /api/v1/player/rewards returns correct shape
- GET /api/v1/player/rewards/history returns paginated transactions
- GET /api/v1/leaderboard returns sorted leaderboard
- GET /api/v1/player/notifications returns notifications with unread count
- PATCH /api/v1/player/notifications/:id/dismiss is M2 (Should Have) — stub 501 acceptable in M1
- Response schemas documented

---

## M2: Strong

### Epic M2.1: Notification Management — Dismiss, Unread Count, Milestones
**Tracer bullet:** Dismiss notification → unread count decreases; milestone notifications auto-created at thresholds
**Depends on:** M1.4
**Parallelizable with:** M2.2
**Data structures:** DS4
**Interfaces:** IF5, IF6
**Validation mode:** unit + integration
**Human checkpoint:** Dismiss a notification → GET shows updated unread count; hit milestone → notification appears

**Tasks:**
1. [ ] Implement PATCH /api/v1/player/notifications/:id/dismiss — set dismissed=true
2. [ ] Add milestone definitions (100, 500, 1000, 5000, 10000 lifetime points) to constants
3. [ ] Add milestone check to points award flow: after updating lifetimePoints, check if any milestone crossed
4. [ ] Create milestone notification when threshold crossed (dedup: store triggered milestones as Set on player record to prevent duplicates)
5. [ ] Write tests for dismiss flow and milestone triggering (including dedup — re-awarding past a milestone doesn't re-notify)

**Acceptance criteria:**
- PATCH dismiss sets dismissed=true
- GET /notifications with unread=true excludes dismissed
- unreadCount is accurate
- Milestone notifications created at defined thresholds (not duplicated on repeated awards)

---

### Epic M2.2: Leaderboard — Self-Rank and Write-Through
**Tracer bullet:** Player awards points → leaderboard table updated → GET /leaderboard includes playerRank
**Depends on:** M1.3
**Parallelizable with:** M2.1
**Data structures:** DS1, DS3
**Interfaces:** IF4
**Validation mode:** unit + integration
**Human checkpoint:** Award points → GET /leaderboard shows self-rank for requesting player

**Tasks:**
1. [ ] Add write-through to leaderboard table in points.service.js awardPoints: upsert DS3 entry for current monthKey
2. [ ] Modify GET /leaderboard to compute self-rank: find requesting player in sorted results, include as `playerRank`
3. [ ] Switch leaderboard query from scan (DS1) to query (DS3) by monthKey
4. [ ] Write tests for write-through and self-rank computation

**Acceptance criteria:**
- Leaderboard table updated on every point award
- GET /leaderboard response includes `playerRank` with requesting player's rank
- Self-rank works even if player is outside top N
- Query by monthKey works correctly

---

### Epic M2.3: Monthly Tier Reset
**Tracer bullet:** POST /admin/tier/reset → all players' tiers recalculated with floor protection → monthly points reset
**Depends on:** M1.2, M1.6
**Parallelizable with:** M2.1, M2.2
**Data structures:** DS1, DS4, DS5
**Interfaces:** IF11
**Validation mode:** unit + integration
**Human checkpoint:** Seed players at various tiers → trigger reset → verify floor protection and notifications

**Tasks:**
1. [ ] Write unit tests for floor protection logic: Platinum→Gold min, Gold→Silver min, Silver→Bronze min, Bronze→Bronze
2. [ ] Implement tier-reset.service.js: scan all players, for each: snapshot tier history (DS5), apply floor, reset monthlyPoints, create notification if downgraded
3. [ ] Add rewards-tier-history table to Docker init script
4. [ ] Implement POST /admin/tier/reset route handler
5. [ ] Write integration test: set up players at tiers → reset → verify new tiers and notifications

**Acceptance criteria:**
- Floor protection: max 1 tier drop (Platinum→Gold, Gold→Silver, Silver→Bronze, Bronze→Bronze)
- monthlyPoints reset to 0 for all players
- tier_downgrade notifications created for affected players
- Tier history snapshots written (DS5)

---

### Epic M2.4: Dashboard — Tier Timeline and Leaderboard Widget
**Tracer bullet:** Dashboard shows 6-month tier history visual + leaderboard top 10 with self-rank
**Depends on:** M2.2, M2.3 (leaderboard self-rank + tier history data)
**Parallelizable with:** Nothing (needs both M2.2 and M2.3 data)
**Data structures:** DS3, DS5
**Interfaces:** IF4 (with self-rank)
**Validation mode:** component tests + manual
**Human checkpoint:** Dashboard shows tier timeline chart + leaderboard widget with user's rank highlighted

**Tasks:**
1. [ ] Create API endpoint or extend player/rewards to return tier history (last 6 months from DS5)
2. [ ] Build tier timeline component: visual chart showing tier per month (last 6 months)
3. [ ] Build leaderboard widget: top 10 + highlighted self-rank
4. [ ] Add RTK Query hooks for tier-history and leaderboard endpoints
5. [ ] Write component tests for timeline and leaderboard widget

**Acceptance criteria:**
- Tier timeline shows last 6 months of tier progression
- Leaderboard widget shows top 10 with self-rank
- Player's own rank highlighted
- Components handle empty data gracefully

---

### Epic M2.5: Integration Tests and API Documentation
**Tracer bullet:** Full end-to-end test coverage + documented API
**Depends on:** M1 complete
**Parallelizable with:** M2.1, M2.2, M2.3
**Data structures:** All
**Interfaces:** All
**Validation mode:** integration
**Human checkpoint:** `npm test` passes with full coverage; API docs readable and accurate

**Tasks:**
1. [ ] Write integration tests for points award → tier change → notification → leaderboard update full flow
2. [ ] Write integration tests for admin endpoints (adjust, override, reset)
3. [ ] Write integration tests for pagination on history endpoint
4. [ ] Write API documentation: endpoint definitions, request/response shapes, error codes (markdown or OpenAPI)
5. [ ] Verify all acceptance criteria from challenge spec

**Acceptance criteria:**
- Integration tests cover points award flow end-to-end
- Integration tests cover admin flows
- All endpoints documented with request/response shapes
- `npm test` passes cleanly

---

## Dependency Graph

```
M1.0 (Scaffold)
 ├── M1.1 (Points Engine) ──────────────────────────────────────┐
 │    ├── M1.2 (Tier Progression) ──────────────────┐           │
 │    │    ├── M1.4 (Notifications: Create/List) ─── M1.7 (Unity API Verification)
 │    │    │    └── M2.1 (Notification Mgmt)         │
 │    │    ├── M1.5 (Dashboard: Summary/History) ────┘
 │    │    ├── M1.6 (Admin Endpoints) ──────────────┐
 │    │    │    └── M2.3 (Monthly Reset) ───────────┤
 │    │    └── M2.2 (Leaderboard Self-Rank) ────────┤
 │    ├── M1.3 (Leaderboard On-Read) ──────────────┤
 │    │    └── M2.2 (Leaderboard Write-Through) ───┤
 │    └────────────────────────────────────────────┤
 │                                                  │
 │    M2.4 (Dashboard: Timeline + Leaderboard) ←── M2.2 + M2.3
 │    M2.5 (Integration Tests + API Docs) ←──────── M1 complete
 └──────────────────────────────────────────────────┘
```

**M1 Spine:** M1.0 → M1.1 → M1.2 → M1.5 (tracer bullet: scaffold → points → tiers → dashboard)

**M1 Parallel branches after M1.1:** M1.3 (leaderboard), M1.4 (notifications), M1.5 (dashboard), M1.6 (admin), M1.7 (Unity verification) — all converge at M1 exit gate.

**M2 Parallel branches:** M2.1, M2.2, M2.3 can proceed in parallel after their M1 dependencies. M2.4 waits for M2.2+M2.3. M2.5 can start as soon as M1 is complete.

## Validation Map

| Test Type | Validates |
|-----------|-----------|
| Unit: points calculation | M1.1 — BB bracket mapping, multiplier |
| Unit: tier determination | M1.2 — threshold logic, advancement detection |
| Unit: floor protection | M2.3 — monthly reset tier floor |
| Integration: award flow | M1.1 + M1.2 — end-to-end points → tier → notification |
| Integration: leaderboard | M1.3 — sort order, ranking |
| Integration: admin adjust | M1.6 — adjustment transaction, balance update |
| Integration: full flow | M2.5 — award → tier → notify → leaderboard → reset |
| Component: summary card | M1.5 — renders tier, points, progress |
| Component: history table | M1.5 — renders transactions |
| Component: leaderboard widget | M2.4 — renders top 10 + self-rank |
| Component: tier timeline | M2.4 — renders 6-month chart |
| Manual: Docker Compose | M1.0 — `docker compose --profile rewards up` boots |
| Manual: curl endpoints | M1.7 — Unity REST API shape verification |

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| DynamoDB Local behavior differs from real DynamoDB | Medium | Use official AWS SDK; avoid DynamoDB-Local-specific features; test with real DynamoDB if available |
| Serverless-offline doesn't hot-reload | Low | Document restart workflow; use `docker compose restart rewards-api` |
| Scan-based leaderboard won't scale | Low (dev only) | M1 uses scan for ~50 players; M2 switches to write-through leaderboard table |
| Seed script produces stale data after schema changes | Medium | Rewrite seed in M1.0; validate seed output in tests |
| RTK Query setup complexity | Low | RTK Query is well-documented; fallback to plain Axios + useEffect if needed |
| Missing PATCH method support in serverless-offline | Low | Test early in M1.0; fall back to POST if needed |

## Open Questions for Human Review

None — all questions resolved during normalization. Planning assumptions documented in architecture decisions and normalized brief.
