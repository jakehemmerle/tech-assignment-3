# Plan Review Round 2: Risk and Scope-Creep

## Risk Review

### RISK: DynamoDB Local scan for leaderboard in M1
Impact: LOW
Likelihood: LOW
With ~50 seeded players, scan+sort is fine. Only becomes a problem at thousands of players, which won't happen in dev/test.
Mitigation: Already planned — M2.2 switches to write-through leaderboard table.

### RISK: Serverless-offline PATCH support
Impact: MEDIUM
Likelihood: LOW
Most versions of serverless-offline support PATCH. If it doesn't work, can use POST as fallback for dismiss.
Mitigation: Test in M1.0 during route setup verification. Fallback is trivial.

### RISK: DynamoDB atomic operations (ADD) for concurrency
Impact: MEDIUM
Likelihood: LOW
DynamoDB Local should support UpdateExpression ADD. If it doesn't behave like production DynamoDB, tests might not catch concurrency issues. But concurrency is unlikely in a challenge evaluation context.
Mitigation: Already noted in decomposition. Use ADD in UpdateCommand. Acceptable risk for dev-only system.

### RISK: RTK Query learning curve
Impact: LOW
Likelihood: MEDIUM
If RTK Query setup is complex, can fall back to plain Axios + useEffect + Redux state. The skeleton already has Axios client configured.
Mitigation: Already noted in risk register. RTK Query is well-documented. Fallback is zero-cost since Axios is already set up.

### RISK: Tier override expiry not checked in read path
Impact: LOW
Likelihood: MEDIUM
If admin overrides a tier with an expiry, nothing currently checks whether the expiry has passed. The player would stay at the overridden tier indefinitely.
Mitigation: should-fix — add expiry check when reading player tier. Simple: if tierOverrideExpiry exists and is past now, clear the override. Can be added to tier.service.js in M1.2 or M1.6.

## Scope-Creep Review

### CLEAN: M1.0 (Scaffold) — no extra work beyond what's needed
### CLEAN: M1.1 (Points Engine) — tightly scoped to calculation + ledger
### CLEAN: M1.2 (Tier Progression) — only tier logic + notification creation
### CLEAN: M1.3 (Leaderboard On-Read) — simple scan+sort, no optimization
### CLEAN: M1.4 (Notifications Create/List) — just CRUD, no delivery
### CLEAN: M1.5 (Dashboard) — summary + history, no fancy charts
### CLEAN: M1.6 (Admin) — 4 endpoints, no UI
### CLEAN: M1.7 (Unity API Verification) — verification only, no new code

### SIMPLIFY: M2.4 tier timeline visualization (should-fix)
The tier timeline could be over-designed. A simple list/table showing "Month | Tier" is sufficient. Don't build a complex chart library integration.
Suggested: Use a simple MUI table or basic bar chart. Avoid recharts/d3 unless trivial to add.

### SIMPLIFY: M2.5 API documentation (should-fix)
"OpenAPI or TypeDoc" could be over-scoped. A well-structured markdown file with endpoint tables is sufficient and matches the challenge doc's own suggestion.
Suggested: Markdown API docs, not auto-generated OpenAPI.

## No items to CUT or DEFER.

## Changes Applied

1. Note on tier override expiry check — add to M1.6 or M1.2 tier determination flow.
2. M2.4 simplification note: simple table/basic visual, not complex charting.
3. M2.5 simplification note: markdown API docs, not OpenAPI generation.
