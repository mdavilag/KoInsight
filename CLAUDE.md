# CLAUDE.md

Guidance for working in this repository. Read this before making changes.

KoInsight is a self-hosted dashboard for KOReader reading statistics. A KOReader plugin (or a
manual upload) pushes the contents of KOReader's `statistics.sqlite3` to this server, which
normalises it into its own schema and serves a React dashboard on top.

Related: [`docs/data-fields.md`](docs/data-fields.md) documents every statistic shown in the UI
and exactly how it is calculated. Read it before touching anything that produces a number.

---

## 1. Repository layout

npm workspaces + Turborepo monorepo.

```
apps/
  server/         Express + Knex + SQLite API, also serves the built web app
  web/            React 18 + Vite + Mantine dashboard
packages/
  common/         Shared TypeScript types and pure utils
plugins/
  koinsight.koplugin/   Lua plugin that runs inside KOReader
bruno/            API collection (Bruno client)
data/             Local dev data: dev.sqlite3, covers/  (gitignored)
```

`turbo.json` drives `build`, `dev`, `test:coverage`. The root `package.json` has no `test`
script — run tests inside `apps/server`.

### `packages/common` is consumed as build output, not source

`packages/common/package.json` points `main`/`exports` at `./dist/...`. Both the server and the
web app import from `@koinsight/common/types`, `@koinsight/common/types/<file>`, and
`@koinsight/common/utils/<file>`, all of which resolve to `packages/common/dist`.

**Consequence:** after changing anything in `packages/common`, run `npm run build` in that
package. Type-only changes may appear to work (TS can resolve the stale `.d.ts` in some setups)
while any _runtime value_ — an exported `const`, an array, an enum — silently becomes
`undefined` at runtime. This has already caused a real bug: an exported
`READING_STATUSES` array was `undefined` inside the server, turning a validation branch into a 500. Prefer keeping `packages/common` types-only and declaring runtime constants next to their
consumer.

---

## 2. Data model

SQLite via Knex. Migrations in `apps/server/src/db/migrations/`, applied automatically on boot
(see §6). `book.md5` is the join key across the whole schema — it is KOReader's _partial MD5_
of the document file, not a hash of the contents.

| Table                 | Key columns                                                                                                           | Notes                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `book`                | `id`, `md5` (unique), `title`, `authors`, `series`, `language`, `soft_deleted`, `reference_pages`, `status_override`  | One row per document. `reference_pages` is a user-set "real" page count; `status_override` is a manual reading/read flag (`null` = derive it).        |
| `book_device`         | `book_md5` + `device_id` (unique), `last_open`, `notes`, `highlights`, `pages`, `total_read_time`, `total_read_pages` | Per-device view of a book. `pages` is KOReader's page count _for that device's font settings_, so it varies between devices.                          |
| `page_stat`           | `book_md5` + `device_id` + `page` + `start_time` (unique), `duration`, `total_pages`                                  | One row per page-visit that KOReader considered long enough to record. The rawest signal in the system.                                               |
| `device`              | `id`, `model`                                                                                                         | Registered by the plugin. `UNKNOWN_DEVICE_ID` is used for manual uploads.                                                                             |
| `annotation`          | `book_md5`, `device_id`, `annotation_type`, text/note/colour, `pageno`, `page_ref`, `total_pages`, soft-delete flag   | Highlights, notes and bookmarks, read from KOReader's `.sdr` sidecar files.                                                                           |
| `genre`, `book_genre` |                                                                                                                       | Free-form genres, added manually or by the AI endpoint.                                                                                               |
| `user`                |                                                                                                                       | KOSync accounts (device-facing), **separate** from dashboard login.                                                                                   |
| `progress`            | `user_id` + `document` + `device_id` (unique), `progress`, `percentage`, `device`                                     | KOSync progress. `document` is the same partial MD5 as `book.md5`. Currently **only** surfaced on `/syncs` — it is not wired into any book statistic. |

### The central modelling problem

`page_stat` only receives a row when you _dwell_ on a page long enough. Blank pages, pages
flipped through quickly, and everything read before the first sync never produce a row. Any
metric derived by _counting distinct pages_ therefore under-reports. This is a limitation of
KOReader's data, not a bug here, and lowering KOReader's page-turn threshold does not fix it.

Progress is therefore derived from **position** (the page of the most recent `page_stat` row),
never from coverage. See `docs/data-fields.md` §2 for the full reasoning and the three
different "pages read" definitions that coexist.

### Unit traps

- `book_device.last_open` and `page_stat.start_time` are stored in **seconds**.
- `StatsRepository` multiplies `start_time` by 1000 on the way out, so every `PageStat` the
  API returns has **milliseconds**. `last_open` is _not_ converted — the UI multiplies it by
  1000 at the point of use (`books-table.tsx`, `book-card.tsx`).
- KOSync `progress.percentage` is a float `0..1`. `BookWithData.read_percentage` is `0..100`.

---

## 3. Server

`apps/server/src/`, layered as `router → service → repository`.

- **Repositories** own Knex queries. `BooksRepository.getAllWithData` builds the list response
  with JSON aggregates plus a per-book follow-up query.
- **Services** hold pure calculation logic and are the units under test.
- **Routers** validate input and map to HTTP.

`BookWithData` (`packages/common/types/books-api.ts`) is the shared response shape and is
produced by **two independent code paths that must be kept in step**:

- `BooksService.withData` — `GET /api/books/:id`
- `BooksRepository.getAllWithData` — `GET /api/books`

Adding a field to `BookWithData` means editing both. Forgetting one is the exact class of bug
that made the list and detail pages disagree.

### Routes

Mounted in `app.ts`. Auth model is deliberately mixed:

| Mount                               | Auth                                          | Purpose                                                                                                  |
| ----------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/` (`kosyncRouter`)                | KOSync credentials                            | Must be at root to match the KOSync API. `PUT/GET /syncs/progress`, `/users/create`, `/users/auth`.      |
| `/api/plugin`                       | none, but exact plugin version                | `POST /device`, `POST /import`, `GET /health`, `GET /download` (this one _does_ require dashboard auth). |
| `/api/auth`                         | —                                             | `POST /login`, `POST /logout`, `GET /me`.                                                                |
| `/api/books`                        | public read, `requireAuth` per mutation route | List, detail, cover, delete, hide, genres, `reference_pages`, `status`.                                  |
| `/api/stats`                        | public read                                   | `GET /` (aggregate), `GET /:book_md5`.                                                                   |
| `/api/devices`, `/api/open-library` | public read                                   |                                                                                                          |
| `/api/upload`, `/api/ai`            | `requireAuth` on the whole router             | Manual DB upload; OpenAI book insights.                                                                  |
| `*`                                 | —                                             | Falls through to the built React app (`appConfig.webBuildPath`).                                         |

Device-facing endpoints are intentionally unauthenticated: the KOReader plugin and KOSync
cannot send dashboard credentials.

### Plugin version gate

`koplugin-router.ts` rejects any request whose `version` is not **exactly**
`REQUIRED_PLUGIN_VERSION`. Bumping the plugin means bumping this constant, and every device
still on the old version stops syncing until its plugin is updated. Treat it as a coordinated
deploy.

---

## 4. The KOReader plugin

`plugins/koinsight.koplugin/`, Lua, runs inside KOReader. Syncs on a menu action, a registered
gesture, and on suspend / power-off / reboot.

What it sends — this is the complete list:

- `POST /api/plugin/device` → `{ id, model, version }`.
- `POST /api/plugin/import` → `{ books, stats, annotations, version }`
  - `books` — `SELECT * FROM book` of `statistics.sqlite3`: `id, title, authors, notes,
last_open, highlights, pages, series, language, md5, total_read_time, total_read_pages`.
    `pages` is overridden with the live `ui.document:getPageCount()` when that book is open.
  - `stats` — `SELECT * FROM page_stat_data`: `page, start_time, duration, total_pages`, plus
    `book_md5` and `device_id`. `ui.statistics:insertDB()` is called first to flush pending rows.
  - `annotations` — from the `.sdr` sidecar, not the DB. Current book only on
    `syncCurrentBook`; `syncAllBooks` walks `ReadHistory`.

**It does not send a current page or a reading status.** KOReader's own `percent_finished`
and `summary.status` live in the sidecar and would be authoritative, but the plugin does not
transmit them (`annotation_reader.lua` reads `percent_finished` into a local and discards it).
Everything about progress is inferred server-side from `page_stat`.

Ingestion for both the plugin and the manual upload goes through
`UploadService.uploadStatisticData`, which upserts `book`, `book_device` and `page_stat`, and
drops stat rows with `duration <= 0` or `total_pages <= 0`.

---

## 5. Web app

`apps/web/src/`, React 18 + Vite + Mantine v8, SWR for data fetching, `react-router` routes in
`routes.ts` (`/books`, `/books/:id`, `/calendar`, `/stats`, `/syncs`, `/login`).

- `useBooks()` → `GET /api/books`, SWR key `['books', showHidden]`. **Note the array key**: a
  plain `mutate('books')` does not match it. `book-hide.tsx` has this bug; `book-status.tsx`
  uses a key-filter predicate instead.
- `useBookWithData(id)` → `GET /api/books/:id`, SWR key `` `books/${id}` ``.
- `usePageStats()` → `GET /api/stats`.

**Numbers should come from the API, not be recomputed in components.** The list and detail
pages diverged precisely because each derived progress locally. Anything a screen displays as a
statistic should be a field on `BookWithData` or the stats response.

The dashboard is publicly readable by design; mutations are gated by `RequireAuth` on the
client and `requireAuth` on the matching route.

---

## 6. Running, building, deploying

### Local development (Windows)

`npm run dev` at the root starts **only Vite** — the server's dev script is
`NODE_ENV=development PORT=3001 nodemon src/app.ts`, and the `VAR=value cmd` prefix is not
valid in `cmd.exe`. Start the API yourself, from **Git Bash**:

```bash
cd apps/server
NODE_ENV=development PORT=3001 npx tsx src/app.ts
```

```bash
cd apps/web
npx vite            # port 3000, proxies /api and /syncs to 3001
```

`tsx` has no watch mode here: **restart the API after editing server code**, or you will test
stale behaviour. Killing it needs a real kill — `pkill -f "tsx src/app.ts"` does not reliably
match on Windows; use `Get-CimInstance Win32_Process` and `Stop-Process`.

Seed the dev database with `npm run seed` from the root.

### Migrations

`app.ts` runs `db.migrate.latest()` before the server starts, in every environment including
the Docker image. **There is no manual migration step in deployment** — rebuild and restart.
`tsc` compiles migrations to `apps/server/dist/db/migrations/`, which is the directory `app.ts`
points at.

Tests use a separate compiled copy: `npm test` runs `build:migrations`
(`tsconfig.migrations.json`) into `apps/server/test/dist/migrations/` first.

### Docker

`docker build -t <tag> .` runs `npm install` + `npm run build` **inside** the image, so it
builds from the working tree, committed or not. `compose.yaml` mounts `./.docker-data:/app/data`
and `./.env:/app/.env`. The image sets no `TZ`, so the container runs **UTC** — never compute a
calendar boundary (start of week, start of day) server-side and expect it to match what the
user's browser shows.

Back up the SQLite file in the data volume before deploying a migration.

### Configuration

`apps/server/src/config.ts`, all optional: `HOSTNAME`, `PORT`, `DATA_PATH`,
`MAX_FILE_SIZE_MB`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_SECRET`, `AUTH_COOKIE_SECURE`,
`OPENAI_API_KEY`. Dashboard auth is a single fixed credential producing an opaque session
cookie (`koinsight_session`).

---

## 7. Testing

Vitest, in `apps/server` only — the web app has no test suite.

```bash
cd apps/server && npm test              # build:migrations + vitest run
cd apps/server && npx vitest run src/books
```

The test DB is `:memory:`; `test/setup/test-setup.ts` migrates once and truncates every table
before each test. Factories live in `src/db/factories/`.

Known state of the suite:

- **`koplugin-router.test.ts > GET /koplugin/download > returns a zip file` fails at HEAD**
  (expects 200, gets 401 — the route gained `requireAuth`). Pre-existing; do not treat it as a
  regression you caused.
- `fakePageStat` assigns a **random** `start_time` via `faker.date.past()`. Any assertion that
  depends on ordering or day-grouping must pass an explicit `start_time`, or it will pass and
  fail at random. `stats-router.test.ts` was silently non-deterministic for this reason.

`npx prettier --check` is **not clean at baseline** — roughly 60 files fail. Format only the
files you touched; a repo-wide failure is not a regression.

`tsc --noEmit` in `apps/web` reports **4 pre-existing errors** (`__APP_VERSION__`,
`calendar.tsx`, `book-page-annotations/index.ts`, `syncs-page.tsx`). The server compiles clean.
Use those four as your baseline.

---

## 8. Conventions

- Repository → service → router on the server; calculation logic goes in the service so it can
  be unit-tested without HTTP.
- Shared types in `packages/common/types`, re-exported from `index.ts`.
- Mantine components and theme tokens (`koinsight` is the primary colour); no ad-hoc CSS
  colours. CSS modules for layout.
- Comments explain _why_, especially where a formula encodes a decision about KOReader's data.
  Do not comment what the code already says.
- When adding a statistic: add it to the service, wire it into **both** `BookWithData`
  producers if it is per-book, expose it as a field, consume it in the UI, and document it in
  `docs/data-fields.md`.
