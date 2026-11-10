# Local DynamoDB setup (persistent storage)

This project runs the **Next.js application on the host** (for example, with
`npm run dev`) and **DynamoDB Local in Docker**. The database is available at
`http://127.0.0.1:8000`. This is development-only; it is not a public deployment.

## If Tidewell is already working on this computer

The existing `tidewell-dynamodb` container is already connected to a persistent
named Docker volume called `tidewell-dynamodb-data`. **Do not run `docker compose
up` alongside it**: both database containers would try to publish port 8000 and
use the same volume. No migration is needed.

Use:

```powershell
docker start tidewell-dynamodb
docker ps
npm run dev
```

If Docker reports that the container is already running, continue normally.

## Fresh setup on a new computer

These instructions are for **new installations**, where port 8000 is not
already used by another database container.

1. Install Node.js 22.12 or newer, npm, Docker Desktop, and Docker Compose.
2. Clone the repository and open a PowerShell terminal in its root directory.
3. Install the exact recorded dependency versions:

   ```powershell
   npm ci
   Copy-Item .env.example .env.local
   ```

4. In `.env.local`, set your local database and authentication configuration:

   ```dotenv
   AWS_REGION=eu-central-1
   AWS_ACCESS_KEY_ID=local
   AWS_SECRET_ACCESS_KEY=local
   DYNAMODB_TABLE_NAME=tidewell-store
   DYNAMODB_ENDPOINT=http://localhost:8000
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=REPLACE_WITH_GENERATED_SECRET
   ```

   Generate a secret locally using:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   Replace the `NEXTAUTH_SECRET` placeholder with its output. Do not commit
   `.env.local` to Git.

5. Start the persistent DynamoDB container:

   ```powershell
   docker compose up -d
   docker compose ps
   ```

   The Compose file initializes the volume permissions for DynamoDB Local's
   non-root user, then starts the database with `-sharedDb -dbPath ./data`.
   It binds port 8000 to the local computer only.

6. For a **fresh, empty database only**, create the table and seed sample products:

   ```powershell
   npm run db:create
   npm run db:seed
   ```

7. Start the storefront:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000`.

## Persistence and safety

DynamoDB Local stores its SQLite data in the named volume
`tidewell-dynamodb-data`.

- `docker compose stop` or `docker compose down` stops/removes containers but
  keeps the named volume.
- **Do not use** `docker compose down -v`, `docker volume rm`, or indiscriminate
  volume-pruning commands: those can delete the database.
- The volume is **not a backup**. Back it up separately before destructive
  changes or migration.
- Do not run two DynamoDB containers using the same writable volume.
- Never run production credentials or public production traffic through this
  local development setup.

## Tests

With the database and app running, validate:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
npm run db:test-cart
npx tsx scripts/check-auth-rate-limit.ts
node --env-file=.env.local scripts/check-api-isolation.mjs
npm audit
```

The API isolation script uses temporary local test accounts and cleans up
records it creates. For an existing test database, do not recreate the table
or reseed it just to run these checks.
