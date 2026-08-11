# Santa Pack

Santa Pack is a playful family gift-exchange planner for organizing households, gift rounds, secret presents, guesses, and the final reveal.

The runnable application lives in [`christmas-present-app`](./christmas-present-app).

## Quick start

```sh
cd christmas-present-app
cp .env.example .env
npm install
npm run dev
```

Add your Supabase project URL and anon key to `.env`, then open [http://localhost:8080](http://localhost:8080).

## Quality checks

```sh
cd christmas-present-app
npm test
npm run test:e2e
```

The unit/integration suite covers request validation, authentication boundaries, server health, and static delivery. The Playwright suite checks keyboard use and responsive layout in desktop and mobile Chromium.

## Docker

```sh
cp christmas-present-app/.env.example christmas-present-app/.env
docker compose up --build
```

See [`christmas-present-app/README.md`](./christmas-present-app/README.md) for architecture, sample data, scripts, and deployment notes.
