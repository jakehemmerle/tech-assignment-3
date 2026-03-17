# Plan Review Round 1: Completeness and Sequencing

## Completeness Review

### FINDING: Missing .env file setup in M1.0
Severity: should-fix
The skeleton provides `.env.example` but M1.0 doesn't mention copying it to `.env`. Docker Compose uses env vars from it.
Suggested addition: Add to M1.0 task 1 — "Verify .env exists (copy from .env.example if needed)."

### FINDING: Missing CORS/OPTIONS for PATCH method
Severity: should-fix
handler.js CORS allows GET, POST, PUT, DELETE, OPTIONS but not PATCH. The dismiss endpoint (M2.1) uses PATCH.
Suggested addition: Add PATCH to CORS allowed methods in handler.js. Can be done in M1.0 as part of route setup.

### FINDING: M1.5 missing RTK Query setup detail
Severity: should-fix
Task 2 says "Set up RTK Query API slice" but doesn't mention the store integration (adding the API middleware and reducer to store.ts).
Suggested addition: Clarify that RTK Query API slice setup includes store.ts modification.

### FINDING: M1.0 missing leaderboard route file
Severity: should-fix
M1.0 task 6 says "add admin.js, notifications.js, leaderboard.js route files" — but M1.3 implements the leaderboard via a GET /api/v1/leaderboard route. Need to decide: is leaderboard its own route file or part of points.js?
Suggested addition: Keep leaderboard as separate route file. Already mentioned in M1.0 task 6. M1.3 implements the handler in that file. No change needed — already complete.

## Sequencing Review

### FINDING: M1.5 frontend depends on M1.1+M1.2 API but could start earlier
Severity: should-fix
M1.5 frontend work (components, RTK Query) can begin with mock data before M1.1/M1.2 APIs are done. The dependency is only at integration time.
Suggested reorder: M1.5 frontend component work can be parallelized with M1.1/M1.2 if mocking API responses. Current sequencing is conservative but correct. No must-fix needed.

### FINDING: M1.7 depends on all prior M1 epics but is just verification
Severity: should-fix
M1.7 is verification-only — no new implementation. It naturally comes last and blocks nothing. Its dependency list is correct. Just noting the bottleneck is intentional (you can't verify what doesn't exist).

### FINDING: M2.4 waits for both M2.2 and M2.3 — tight coupling
Severity: should-fix
The leaderboard widget (M2.4) needs M2.2's self-rank. The tier timeline (M2.4) needs M2.3's tier history data. These are genuinely different features that happen to be in the same epic.
Suggested reorder: Could split M2.4 into two sub-tasks where the leaderboard widget can start after M2.2 completes without waiting for M2.3. Current structure is acceptable since M2.4 tasks are independent internally.

### No circular dependencies detected.
### No hidden dependencies detected.
### Checkpoint convergence verified — M1 exit requires all M1 epics complete.

## Changes Applied

1. Added note: ensure PATCH in CORS allowed methods (handler.js) during M1.0 route setup.
2. No structural sequencing changes — current ordering is correct and conservative.
