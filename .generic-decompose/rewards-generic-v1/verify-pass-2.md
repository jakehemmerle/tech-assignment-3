# Verify Pass 2: Implicit Work Check

Looking for implicit work missed in pass 1: config, migrations, fixtures, integration glue, docs, harness/test updates, validation environment setup.

## Config and Exports

- ✓ .env.example exists — no new env vars needed (all DynamoDB config already in docker-compose.yml)
- ✓ Constants file exists — M1.0 task 5 adds BB bracket constants
- ✓ handler.js route registration — M1.0 task 7 covers this
- ✓ CORS PATCH method — M1.0 task 7 covers this

## Migrations and Fixtures

- ✓ DynamoDB tables created by docker-compose.yml init container — existing tables cover DS1-DS4
- ✓ DS5 (rewards-tier-history) table creation — M2.3 task 2 adds to Docker init
- ✓ Seed script rewrite — M1.0 task 4
- NOTE: init-dynamodb.sh script also needs DS5 table for local dev without Docker. M2.3 task 2 should update both docker-compose.yml and init-dynamodb.sh. Already implied but worth noting.

## Integration Glue

- ✓ dynamo.service.js extensions — M1.0 task 2 adds notification + leaderboard helpers
- ✓ Shared config (dynamo.js) — already exists, no changes needed
- ✓ Symlink to shared/ — already exists in skeleton
- ✓ Frontend API client — already configured (Axios with X-Player-Id interceptor)
- ✓ RTK Query setup — M1.5 task 2 explicitly covers store.ts integration

## Docs and Contracts

- ✓ API documentation — M2.5 task 4 (docs/api-reference.md)
- ✓ Response schemas documented — M1.7 task 4
- NOTE: These overlap. M1.7 creates initial API docs, M2.5 completes them. The bead descriptions are clear enough that implementers won't duplicate effort.

## Harness and Test Updates

- ✓ Test helpers created — M1.0 task 3 (Express test app factory, DynamoDB mock/stub)
- ✓ package.json test config — already configured for Jest
- NOTE: Frontend testing may need @testing-library/react added to devDependencies. Not in rewards-frontend/package.json currently. Should be part of M1.5 setup.

## Validation Environment

- ✓ Docker Compose verification — M1.0 task 1
- ✓ DynamoDB Local health check — already in docker-compose.yml
- ✓ No new infra services needed (no Redis usage in rewards, no MySQL usage in rewards)

## Gaps Found

### GAP: Missing @testing-library/react in frontend devDependencies (should-fix)
M1.5 task 6 writes React Testing Library tests but the package isn't in rewards-frontend/package.json devDependencies. The implementer will need to `npm install --save-dev @testing-library/react @testing-library/jest-dom` as part of M1.5 setup.

**Resolution**: Add a note to M1.5 bead description about installing RTL. Not worth a separate bead — it's implicit in "write RTL tests." The implementer will handle it.

### GAP: Missing uuid package for notification IDs (should-fix)
notification.service.js needs to generate UUID v4 for notificationId. The rewards-api package.json doesn't include uuid. Implementer needs to `npm install uuid`.

**Resolution**: Implicit in M1.4 implementation. Standard dependency management — not a bead-level concern.

## No structural changes needed. Both gaps are standard dependency installation during implementation.
