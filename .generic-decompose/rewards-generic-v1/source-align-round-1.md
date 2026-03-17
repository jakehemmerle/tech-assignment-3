# Source Alignment Round 1: Requirement and Tier Coverage

## Requirements Coverage

### Capabilities (C1-C9 from normalized brief)

- COVERED: C1 (Points Calculation) → M1.1 tasks 1-2
- COVERED: C2 (Tier Progression) → M1.2 tasks 1-4
- COVERED: C3 (Leaderboard) → M1.3 + M2.2
- COVERED: C4 (Notifications) → M1.4 + M2.1
- COVERED: C5 (Admin Endpoints) → M1.6 tasks 1-5
- COVERED: C6 (Unity REST API) → M1.7 (verification) + endpoints spread across M1.1-M1.4
- COVERED: C7 (Player Dashboard) → M1.5 + M2.4
- COVERED: C8 (Monthly Reset) → M2.3
- COVERED: C9 (Seed Script) → M1.0 task 4

### Functional Requirements (FR-1 through FR-6 from challenge doc)

- COVERED: FR-1 (Tier System) → M1.2 (progression), M2.3 (monthly reset)
- COVERED: FR-2 (Points Engine) → M1.1
- COVERED: FR-3 (Leaderboard) → M1.3, M2.2
- COVERED: FR-4 (Player Dashboard) → M1.5 (summary + history), M2.4 (timeline + leaderboard widget)
- COVERED: FR-5 (Notifications) → M1.4 (create + list), M2.1 (dismiss + milestones)
- COVERED: FR-6 (Admin Endpoints) → M1.6

### Interfaces (IF1-IF11 from normalized brief)

- COVERED: IF1 (POST /points/award) → M1.1 task 5
- COVERED: IF2 (GET /player/rewards) → M1.2 task 6
- COVERED: IF3 (GET /player/rewards/history) → M1.5 task 1
- COVERED: IF4 (GET /leaderboard) → M1.3 task 3
- COVERED: IF5 (GET /player/notifications) → M1.4 task 3
- COVERED: IF6 (PATCH /notifications/:id/dismiss) → M2.1 task 1
- COVERED: IF7 (GET /admin/players/:id/rewards) → M1.6 task 1
- COVERED: IF8 (POST /admin/points/adjust) → M1.6 task 2
- COVERED: IF9 (GET /admin/leaderboard) → M1.6 task 3
- COVERED: IF10 (POST /admin/tier/override) → M1.6 task 4
- COVERED: IF11 (POST /admin/tier/reset) → M2.3 task 4

## Tier Mapping

### M1 Acceptance Criteria (from normalized brief)

- ALIGNED: Points awarded correctly → M1.1
- ALIGNED: Tier progression works → M1.2
- ALIGNED: Points ledger immutable → M1.1 (DS2 is append-only)
- ALIGNED: Leaderboard sorted → M1.3
- ALIGNED: Dashboard: tier + points + progress → M1.5
- ALIGNED: Dashboard: points history → M1.5
- ALIGNED: Notification on tier change → M1.2 + M1.4
- ALIGNED: Unity REST endpoints correct shapes → M1.7
- ALIGNED: Admin: view player profile → M1.6
- ALIGNED: Admin: adjust points → M1.6
- ALIGNED: Unit tests → M1.1, M1.2
- ALIGNED: Docker Compose + npm test → M1.0

### M2 Acceptance Criteria (from normalized brief)

- ALIGNED: Points history pagination → M2.1 (actually in M1.5 task 1 for basic, M2.1 for full)
- ALIGNED: Leaderboard self-rank → M2.2
- ALIGNED: Notification dismiss + unread count → M2.1
- ALIGNED: Monthly tier reset → M2.3
- ALIGNED: Dashboard tier timeline → M2.4
- ALIGNED: Integration tests → M2.5
- ALIGNED: API docs → M2.5

## Findings

### PARTIAL: Points history pagination (should-fix)
M1.5 task 1 says "basic pagination" but M1 acceptance criteria says "Dashboard displays points transaction history" (no pagination requirement). The normalized brief lists "Points history pagination works correctly" as M2. The decomposition correctly treats basic history as M1 and full pagination as M2, but this could be more explicit.

**Fix:** Clarify M1.5 task 1 outputs basic list (no offset support needed), M2 adds proper offset-based pagination. No structural change needed.

### PARTIAL: PATCH /notifications/:id/dismiss in M1.7 (should-fix)
M1.7 lists "PATCH dismiss works" as an acceptance criterion, but the implementation is in M2.1. This creates a dependency gap in M1.7.

**Fix:** Move the dismiss endpoint implementation to M1.4 or M1.7 (it's a simple update, low cost), OR remove it from M1.7 acceptance criteria and note it's M2. Per the challenge doc, notification dismiss is "Should Have" (M2), so removing it from M1.7 is correct.

## Changes Applied

1. No structural changes needed — coverage is complete.
2. Noted: M1.7 should NOT list dismiss as M1 acceptance criterion. It's M2 per spec.
3. Noted: M1.5 pagination is basic (no offset); full pagination is M2.
