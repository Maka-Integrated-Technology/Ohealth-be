# NestJS Boilerplate

A production-ready NestJS backend boilerplate focused on clean structure, strong defaults, and practical integrations. Use it as a starter for your own API by swapping out or removing the example domain modules.

## Highlights

- Modular NestJS architecture
- TypeScript + TypeORM
- PostgreSQL support
- JWT authentication + guards
- Config-driven environment setup
- Swagger API docs
- Winston logging + request logging
- File uploads (Cloudinary integration)
- Email templates (Nunjucks)
- Migrations and seed-ready structure
- Jest unit tests

## Project Structure

```
src/
  config/          → Centralized config loader
  database/        → TypeORM data source & migrations
  middleware/      → Logging and request middleware
  modules/         → Feature modules (auth, users, etc.)
  templates/       → Email templates (Nunjucks)
```

> Note: This boilerplate includes example domain modules (students, classes, payments, etc.) to show structure. Feel free to delete or refactor them to fit your product.

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Copy the example env file and update values:

```bash
cp .env.example .env
```

### 3) Run migrations (optional)

```bash
npm run migration:run
```

### 4) Start the app

```bash
npm run start:dev
```

API will be available at `http://localhost:3000` and Swagger at `http://localhost:3000/docs`.

## Scripts

```bash
npm run start        # start server
npm run start:dev    # watch mode
npm run build        # build
npm run start:prod   # production
npm run test         # unit tests
```

## Contributing

See `CONTRIBUTING.md`.

## Support

Open an issue in this repository for bugs or feature requests.
