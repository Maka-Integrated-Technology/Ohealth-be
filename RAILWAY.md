# Railway staging deployment

The repository includes a `railway.toml` that builds the application with the
Dockerfile, runs TypeORM migrations before deployment, starts the compiled
NestJS application, and checks `GET /health`.

## Create the staging environment

1. Create a Railway project from this GitHub repository.
2. Set the deployment branch to `staging`.
3. Add a Railway PostgreSQL service to the project.
4. Add the variables below to the API service.
5. Generate a Railway domain, or attach `api.staging.ohealthltd.com`.

Railway deploys every push to the connected branch. The existing EC2 GitHub
Actions workflow is independent and should be disabled for the `staging`
branch if Railway is replacing the EC2 staging deployment.

## Required variables

Use a Railway reference variable for the database URL:

```env
NODE_ENV=staging
DATABASE_URL=${{Postgres.DATABASE_URL}}
DB_SSL=false

JWT_SECRET=<random 64-character value>
JWT_REFRESH_SECRET=<different random 64-character value>
TOKEN_ACCESS_DURATION=15m
TOKEN_REFRESH_DURATION=7d
HASH_SALT=10

FRONTEND_URL=https://staging.ohealthltd.com
CORS_ORIGINS=https://staging.ohealthltd.com

MAIL_MAILER=resend
RESEND_API_KEY=<resend API key>
MAIL_FROM_ADDRESS=<address on a verified domain>
MAIL_FROM_NAME=OHealth
```

Do not define `PORT`; Railway injects it. `DB_SSL=false` is appropriate for
Railway's private `DATABASE_URL`. Set it to `true` when using a public or
external PostgreSQL connection that requires TLS.

Generate the JWT secrets locally:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

## Feature variables

Add these when the corresponding staging features are enabled:

```env
GOOGLE_CLIENT_ID=

AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_PRIVATE_BUCKET=
AWS_S3_SIGNED_URL_TTL_SECONDS=300

OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-5.4-nano
```

Multiple frontend origins can be supplied as a comma-separated
`CORS_ORIGINS` value, for example:

```env
CORS_ORIGINS=https://staging.ohealthltd.com,http://localhost:5103
```

## Deployment behavior

- Build: the repository `Dockerfile`
- Pre-deploy: `npm run migration:run:prod`
- Start: `npm run start:prod`
- Health check: `/health`
- Restart policy: retry failed processes up to 10 times

Migrations run once in Railway's pre-deploy phase rather than once per replica.
If a migration fails, Railway does not promote the new deployment.
