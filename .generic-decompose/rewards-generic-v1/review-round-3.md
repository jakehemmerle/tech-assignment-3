# Plan Review Round 3: Testability and Coherence

## Testability Review

### M1.0 (Scaffold)
- Validation mode: manual + unit — ADEQUATE
- Checkpoint: Docker Compose boots, npm test runs — CLEAR
- No missing test artifacts

### M1.1 (Points Engine)
- Validation mode: unit + integration — ADEQUATE
- Tasks start with "Write unit tests" (TDD) — GOOD
- Checkpoint: curl POST /points/award returns correct earnedPoints — CLEAR
- Acceptance criteria are specific and testable — GOOD

### M1.2 (Tier Progression)
- Validation mode: unit + integration — ADEQUATE
- Tests for threshold edge cases — GOOD
- Checkpoint: Award enough points to cross threshold → verify — CLEAR
- Acceptance criteria: "499 is Bronze, 500 is Silver" — SPECIFIC AND TESTABLE

### M1.3 (Leaderboard On-Read)
- Validation mode: unit + integration — ADEQUATE
- Checkpoint: seed data → GET /leaderboard → verify sort — CLEAR

### M1.4 (Notifications Create/List)
- Validation mode: unit + integration — ADEQUATE
- Checkpoint: trigger tier upgrade → GET /notifications — CLEAR

### M1.5 (Dashboard)
- Validation mode: component tests + manual — ADEQUATE
- Checkpoint: open localhost:4000, login, see data — CLEAR
- VAGUE-CRITERIA: "Loading and error states render correctly" — what does "correctly" mean?
  Suggested rewrite: "Loading spinner shown while API call pending; error message shown on API failure"
  Severity: should-fix

### M1.6 (Admin)
- Validation mode: unit + integration — ADEQUATE
- All 4 endpoints have specific curl-verifiable criteria — GOOD

### M1.7 (Unity API Verification)
- Validation mode: integration — ADEQUATE
- Checkpoint: curl all endpoints → response shapes match — CLEAR

### M2.1-M2.5
- All have explicit validation modes and acceptance criteria — ADEQUATE
- M2.5 integration tests are the comprehensive validation pass — GOOD

## Coherence Review

### Naming consistency check
- "monthlyPoints" used consistently in DS1, DS3, IF2, IF4 — CONSISTENT
- "currentTier" as number (1-4) internally, "tierName" as string externally — CONSISTENT
- "earnedPoints" in DS2, "earned = base × multiplier" in spec — CONSISTENT
- "displayName" in DS1, DS3 — CONSISTENT (but note: skeleton seed uses "username" — the rewrite in M1.0 task 4 will rename to displayName)

### Tracer bullet integrity
- M1 spine: M1.0 → M1.1 → M1.2 → M1.5 — INTACT
  This proves: scaffold → points work → tiers work → dashboard shows it
- Each step produces something human-verifiable before the next begins — GOOD

### Integration glue
- handler.js route registration (M1.0 task 7) → all subsequent route implementations — CONNECTED
- dynamo.service.js extension (M1.0 task 2) → all service layer code — CONNECTED
- RTK Query setup (M1.5 task 2) → store.ts modification → all frontend components — CONNECTED
- Seed script rewrite (M1.0 task 4) → M1.3 leaderboard test, M1.5 dashboard test — CONNECTED

### Can an agent pick up any epic and start?
- M1.0: YES — clear tasks, no dependencies
- M1.1: YES — depends on M1.0 which is well-defined
- M1.2: YES — depends on M1.1 which defines clear output
- M1.3: YES — depends on M1.1, independent of M1.2
- M1.4: YES — depends on M1.2 which defines notification creation
- M1.5: MOSTLY — depends on M1.1+M1.2 APIs; frontend tasks can start with mocks
- M1.6: YES — depends on M1.1+M1.2 services
- M1.7: YES — just verification against existing endpoints
- M2.x: All YES — dependencies clearly stated

### No contradictions found between decomposition and normalized brief.
### No broken references between epics.

## Changes Applied

1. should-fix: Clarified M1.5 loading/error acceptance criteria in decomposition.
