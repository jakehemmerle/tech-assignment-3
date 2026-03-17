# Bead Manifest: rewards-generic-v1

## Totals
- **15 beads** total (2 milestone epics + 13 feature epics)
- **M1**: 8 epics (M1.0–M1.7) + 1 milestone epic
- **M2**: 5 epics (M2.1–M2.5) + 1 milestone epic

## Milestone Epics

| ID | Title |
|----|-------|
| p3-pl1 | M1: Minimum / Pass |
| p3-drf | M2: Strong |

## Feature Epics

### M1 (Minimum / Pass)

| ID | Title | Depends On | Parallelizable With |
|----|-------|------------|---------------------|
| p3-p3m | M1.0: Scaffold and Test Infrastructure | (none) | — |
| p3-m75 | M1.1: Points Engine — Calculation and Ledger | p3-p3m | — |
| p3-r5n | M1.2: Tier Progression | p3-m75 | — |
| p3-dyj | M1.3: Leaderboard (On-Read) | p3-m75 | M1.2 |
| p3-jjs | M1.4: Notifications — Create and List | p3-r5n | M1.3 |
| p3-v5u | M1.5: Player Dashboard — Summary and History | p3-m75, p3-r5n | M1.3, M1.4, M1.6 |
| p3-q1c | M1.6: Admin Endpoints | p3-m75, p3-r5n | M1.5 |
| p3-24i | M1.7: Unity REST API Verification | p3-m75, p3-r5n, p3-dyj, p3-jjs | M1.5, M1.6 |

### M2 (Strong)

| ID | Title | Depends On | Parallelizable With |
|----|-------|------------|---------------------|
| p3-fob | M2.1: Notification Management — Dismiss, Unread, Milestones | p3-jjs | M2.2, M2.3 |
| p3-842 | M2.2: Leaderboard — Self-Rank and Write-Through | p3-dyj | M2.1, M2.3 |
| p3-n71 | M2.3: Monthly Tier Reset | p3-r5n, p3-q1c | M2.1, M2.2 |
| p3-8tp | M2.4: Dashboard — Tier Timeline and Leaderboard Widget | p3-842, p3-n71 | — |
| p3-9zh | M2.5: Integration Tests and API Documentation | p3-pl1 | M2.1, M2.2, M2.3 |

## Ready to Start

| ID | Title |
|----|-------|
| p3-p3m | M1.0: Scaffold and Test Infrastructure |

## Dependency Spine

```
p3-p3m (M1.0 Scaffold)
 └─→ p3-m75 (M1.1 Points Engine)
      ├─→ p3-r5n (M1.2 Tier Progression)
      │    ├─→ p3-jjs (M1.4 Notifications)
      │    │    └─→ p3-fob (M2.1 Notification Mgmt)
      │    ├─→ p3-v5u (M1.5 Dashboard)
      │    ├─→ p3-q1c (M1.6 Admin)
      │    │    └─→ p3-n71 (M2.3 Monthly Reset) ──┐
      │    └─→ p3-24i (M1.7 Unity Verify)          │
      └─→ p3-dyj (M1.3 Leaderboard)                │
           └─→ p3-842 (M2.2 Leaderboard Write) ──┐ │
                                                    │ │
               p3-8tp (M2.4 Dashboard Timeline) ←──┘─┘
               p3-9zh (M2.5 Tests + Docs) ←── p3-pl1 (M1 complete)
```
