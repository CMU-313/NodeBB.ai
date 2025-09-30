## Quick orientation

This repository is a NodeBB-based forum application with a split architecture:

- Server-side Node.js application under `src/` (core app logic, routes, middleware, database adapters).
- Client-side/browser assets under `public/src/` (many legacy ES5-style modules used by the frontend/admin UI).
- Build & packaging under top-level files: `Gruntfile.js`, `webpack.*.js`, and `build/` for compiled artifacts.

If you need to change runtime behavior, start in `src/`. If you need to change UI or admin pages, look in `public/src/`.

## What to know before editing

- The server startup entry points are `app.js` and `loader.js` (loader attaches worker events, see `loader.js`).
- Configuration is in `config.json` and `install/` contains installation helpers (e.g. `install/databases.js`).
- Database adapters and queries live under `src/database/` and tests in `test/database/`.
- Many frontend modules are large single-file modules (legacy pattern) and are flagged for complexity by static tools. Examples: `public/src/admin/*`, `public/src/client/*`.

## Coding conventions & patterns (project-specific)

- Mixed server and client JS. Server code in `src/` uses modern Node/CommonJS patterns. Client code in `public/src/` is largely legacy ES5 with global/module patterns — be careful when importing or refactoring.
- Plugins and admin extensions follow NodeBB plugin conventions found in `src/plugins/` and `public/src/admin/extend/`.
- i18n files live under `public/language/` and use README-driven locales; see `public/language/README.md` for expected formats.
- Frontend code often manipulates the DOM directly and relies on global `socket` and `ajax` helpers (search `public/src/socket.io/` and `public/src/ajaxify.js`).

## Build, run, test workflows

- Development server (NodeBB-style) — common steps:

  - Install dependencies: `npm ci` (or `npm install` if you need to add packages).
  - Build client assets (if you change `public/src/`): `npm run build` (uses webpack/Grunt depending on env). See `package.json` scripts.
  - Run the app: `npm start` or `node app.js` in development. The loader and prestart logic are executed from `start.js` and `prestart.js`.

- Tests: run `npm test`. The `test/` directory has many targeted unit tests for server and controller-level behavior.

- Linting/formatting: repo contains ESLint config (`eslint.config.mjs`) and uses Prettier/ESLint in CI. Run `npm run lint`.

## Notable complexity hotspots (from static analysis)

The codebase includes many high-complexity frontend functions (large admin and client modules). When editing these files, prefer minimal scoped changes and add unit tests when possible. Examples flagged by scans:

- `public/src/admin/dashboard.js` and `public/src/admin/modules/dashboard-line-graph.js`
- `public/src/admin/manage/categories.js` and many `public/src/admin/manage/*` files
- `public/src/client/topic/posts.js`, `public/src/client/post-queue.js`, `public/src/client/chats.js`

If you need to refactor, split functionality into smaller helper modules and update tests. Avoid changing global side-effects without thorough testing.

## Integration points and external dependencies

- Redis and PostgreSQL are common in NodeBB deployments; compose files provided: `docker-compose.yml`, `docker-compose-pgsql.yml`, and `docker-compose-redis.yml`.
- Background workers: `loader.js` registers worker events. Message passing and pubsub happen via `src/pubsub.js` and `src/socket.io/`.
- Emailer logic: `src/emailer.js` — changing notification formatting may affect templates in `public/templates/`.

## Tests and quick verification after edits

- After server-side changes, run `npm test` and run a dev server (`npm start`) and smoke-test a few UI flows.
- After frontend changes, run `npm run build` and open the app; many UI modules rely on runtime globals and require manual UI checks.

## Examples of helpful, actionable prompts for an AI coding agent

- "Fix complexity in `public/src/admin/appearance/themes.js` by extracting a small helper that validates theme settings; keep behavior identical and add one unit test in `test/appearance.js`."
- "Update database config parsing in `install/databases.js` to support a new environment variable `DB_SSL=1`; modify `install/databases.js` and add tests in `test/install.js`."

## Files & directories to inspect first (quick links)

- `src/` — server core and controllers
- `public/src/` — frontend and admin UI
- `Gruntfile.js`, `webpack.*.js`, `package.json` — build scripts and npm scripts
- `loader.js`, `app.js`, `start.js`, `prestart.js` — runtime boot sequence
- `install/` — installation helpers
- `test/` — unit tests (use these as templates for adding tests)

## Safety and testing constraints

- Don't change DB credentials or secrets in `config.json`. Use environment variables or `config.json.example` if present.
- Avoid mass refactors of frontend files without adding tests and manual smoke-testing — those files are fragile and tied to global runtime behavior.

If any section is unclear or you want more examples (e.g., a template prompt for CRUD changes), tell me which area to expand and I will iterate.
