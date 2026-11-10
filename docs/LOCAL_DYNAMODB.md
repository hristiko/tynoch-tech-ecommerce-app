# Running DynamoDB Local with persistent storage

Tidewell runs Next.js on your computer and uses DynamoDB Local in a Docker container. The database listens on `127.0.0.1:8000`. This setup is for local development; it doesn't publish the store on the internet.

The database uses a named Docker volume, `tidewell-dynamodb-data`. That matters because the default in-memory DynamoDB configuration loses its data when the container stops. A volume keeps account, cart and wishlist records across restarts.

## If you already have a working database

If you followed the migration steps and your existing container is named `tidewell-dynamodb`, start that container:

```powershell
docker start tidewell-dynamodb
docker ps
npm run dev
```

Do **not** run `docker compose up` at the same time. Both containers would compete for port 8000 and could try to use the same writable volume. You don't need to migrate the data again.

## Fresh installation on another computer

Install Node.js 22.12 or newer, npm and Docker Desktop. From the project directory, install dependencies and copy the environment template:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Set the following values in `.env.local`:

```dotenv
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
DYNAMODB_TABLE_NAME=tidewell-store
DYNAMODB_ENDPOINT=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=REPLACE_WITH_A_GENERATED_SECRET
AUTH_TRUST_PROXY=false
```

Generate the secret locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Replace the placeholder with the generated value. Don't commit `.env.local`.

If port 8000 is free and no other DynamoDB container is using the named volume, start the database:

```powershell
docker compose up -d
docker compose ps
```

The Compose file gives the volume the permissions needed by DynamoDB Local's non-root user, then starts DynamoDB in file-backed mode with `-sharedDb -dbPath ./data`.

For a new empty database only, initialize the table and product catalogue:

```powershell
npm run db:create
npm run db:seed
```

Start the app and open `http://localhost:3000`:

```powershell
npm run dev
```

The Compose file starts only DynamoDB. Next.js still runs separately through npm.

## Stopping and keeping your data

`docker compose stop` and `docker compose down` keep the named volume. **Do not run `docker compose down -v` or delete/prune the volume** unless you intend to erase the stored data. A persistent volume is not a backup; make a separate backup before destructive changes.

Never run two containers that write to the same DynamoDB volume at once.

## Checks

With Docker running:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
npm run db:test-cart
npx tsx scripts/check-auth-rate-limit.ts
npm audit
```

With Next.js running too, check the real API:

```powershell
node --env-file=.env.local scripts/check-api-isolation.mjs
```

These scripts use temporary records and account IDs. They do not require rebuilding or reseeding an existing database. The API test refuses to connect to a nonlocal DynamoDB endpoint.
