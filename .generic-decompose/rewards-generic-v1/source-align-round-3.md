# Source Alignment Round 3: Edge Cases, Scope, Failure Modes

## Edge Cases and Failure Modes

### Points Engine
- COVERED: New player (no record) → M1.1 task 4 says "Get or create player record"
- COVERED: Zero base points (invalid BB range) → M1.1 task 5 "input validation rejects missing/invalid fields"
- PARTIAL: Negative bigBlind → Not explicitly tested. **should-fix**: add to unit tests as edge case. Reject bigBlind <= 0.
- PARTIAL: Concurrent point awards for same player → DynamoDB doesn't have transactions by default. Risk of race on monthlyPoints update. **should-fix**: Use DynamoDB conditional updates or atomic ADD operations in UpdateCommand. Note in M1.1.
- COVERED: Multiplier at boundary (exact tier threshold) → M1.2 tests cover threshold edge cases

### Tier Progression
- COVERED: Exact threshold crossing → M1.2 task 1 "edge cases at thresholds"
- COVERED: Already at Platinum, more points → No upgrade, stays Platinum
- PARTIAL: Tier override expiry → M1.6 task 4 sets tierOverrideExpiry but no task checks/expires it. **should-fix**: Add logic to check tierOverride expiry when reading player tier. Can be a simple check in the tier determination flow.
- COVERED: Multiple tier jumps in one award (e.g., 0 → 10000 points, Bronze → Platinum) → Tier determination picks highest qualifying tier

### Leaderboard
- COVERED: Empty leaderboard → M1.3 acceptance criteria says "empty returns empty array"
- COVERED: Player not in top N → M2.2 handles self-rank computation
- PARTIAL: Tie-breaking → Not addressed. **should-fix**: Define tie-breaking rule (e.g., alphabetical by displayName or first to reach the score). Low priority.

### Notifications
- PARTIAL: Duplicate milestone notifications → M2.1 task 4 says "not duplicated on repeated awards" but no mechanism described. **must-fix**: Need to track which milestones have been triggered. Options: (a) check notification table for existing milestone notification, (b) store triggered milestones on player record. Add to M2.1 tasks.
- COVERED: Notification for player who doesn't exist → Auth middleware requires X-Player-Id; if player has notifications, player exists.

### Monthly Reset
- COVERED: Floor protection at each tier → M2.3 task 1 explicitly tests all combinations
- PARTIAL: Reset when no players exist → Should handle gracefully (scan returns empty). **should-fix**: Add edge case to M2.3 tests.
- PARTIAL: Reset run multiple times in same month → Should be idempotent or guarded. **should-fix**: Add a check (e.g., last reset timestamp on a config record) or document that double-reset would double-downgrade. Low risk since it's admin-triggered.

### Dashboard
- COVERED: Loading/error states → M1.5 acceptance criteria mentions this
- COVERED: No data (new player) → RTK Query handles empty responses; components should show "no data" state
- PARTIAL: Long transaction history → M1.5 shows basic list, M2.1 adds pagination. Could show too many rows in M1. **should-fix**: M1.5 can use a default limit (e.g., 20 most recent).

## Scope Discipline

### M1 Epics
- CLEAN: M1.0 (Scaffold) — necessary foundation
- CLEAN: M1.1 (Points Engine) — core requirement
- CLEAN: M1.2 (Tier Progression) — core requirement
- CLEAN: M1.3 (Leaderboard On-Read) — core requirement, simple implementation
- CLEAN: M1.4 (Notifications Create/List) — core requirement
- CLEAN: M1.5 (Dashboard Summary/History) — core requirement
- CLEAN: M1.6 (Admin Endpoints) — core requirement
- CLEAN: M1.7 (Unity API Verification) — core requirement, low effort (just verification)

### M2 Epics
- CLEAN: M2.1 (Notification Management) — Should Have per spec
- CLEAN: M2.2 (Leaderboard Self-Rank + Write-Through) — Should Have per spec
- CLEAN: M2.3 (Monthly Reset) — Should Have per spec
- CLEAN: M2.4 (Dashboard Timeline + Leaderboard Widget) — Should Have per spec
- CLEAN: M2.5 (Integration Tests + API Docs) — Should Have per spec

### Scope Check
- No scope creep detected. All M1 work maps to Must Have criteria. All M2 work maps to Should Have criteria.
- Bonus items (Redis caching, WebSocket, rate limiting, idempotency, CI, scheduled Lambda) are correctly excluded from both tiers.

## Changes Applied to Decomposition

1. **must-fix**: Added milestone dedup mechanism to M2.1 — need to check for existing milestone notifications before creating duplicates. Will store triggered milestones as a Set on the player record (simple, avoids extra queries).

2. **should-fix**: Note on M1.1 — use DynamoDB atomic ADD for monthlyPoints/lifetimePoints to handle concurrency safely.

3. **should-fix**: M1.5 default limit of 20 for transaction history in basic view.
