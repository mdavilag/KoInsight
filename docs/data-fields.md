# Data fields — what every number means

Every statistic KoInsight displays, where the underlying data comes from, and exactly how it is
calculated. Written to be read in three passes:

1. **[§1 Raw data](#1-raw-data)** — what KOReader actually gives us.
2. **[§2 Derived calculations](#2-derived-calculations)** — the catalogue of formulas, each with
   its semantics and its failure mode.
3. **[§3 Screen by screen](#3-screen-by-screen)** — for each visible number, which calculation
   produces it.

---

## 1. Raw data

### 1.1 What KOReader records

KOReader's `statistics.sqlite3` has two tables that matter:

| Source           | Fields                                                                                                              | Meaning                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `book`           | `id, title, authors, notes, last_open, highlights, pages, series, language, md5, total_read_time, total_read_pages` | One row per document.                                              |
| `page_stat_data` | `page, start_time, duration, total_pages`                                                                           | **One row per page-visit that lasted long enough to be recorded.** |

Annotations come from a different place entirely: the per-book `.sdr` sidecar files, not the
database.

### 1.2 The single most important fact

`page_stat_data` is **not** a complete record of the pages you read. KOReader only writes a row
once you have stayed on a page past its page-turn threshold. Pages that are blank, flipped
through quickly, or read before you first installed KoInsight produce **no row at all**.

This means:

- Anything that **counts distinct pages** systematically under-reports. A finished book can
  look like 80%.
- Anything that reads **position** — which page a row is _on_ — is reliable, because the row
  that exists is genuinely a page you were on.

Lowering KOReader's page-turn duration does not fix this; it adds noise without filling the
gaps. KoInsight therefore derives progress from position, never from coverage.

The plugin sends no current page and no reading status (see `CLAUDE.md` §4), so position has to
be inferred from the timestamps on these rows.

### 1.3 KoInsight's own columns

| Column                                          | Where         | Meaning                                                                                                                                                |
| ----------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `book.reference_pages`                          | user-set      | The "real" page count of the physical edition. KOReader's page count changes with font size, so this is the stable denominator. `null` = not set.      |
| `book.status_override`                          | user-set      | `'reading'` / `'read'` forces the status; `null` derives it.                                                                                           |
| `book_device.pages`                             | from KOReader | Page count **for that device's settings**. Two devices disagree for the same book.                                                                     |
| `book_device.total_read_pages`                  | from KOReader | KOReader's cumulative **page-turn counter**. Grows on re-reads. Not a position.                                                                        |
| `book_device.last_open`, `page_stat.start_time` | from KOReader | **Seconds.** `StatsRepository` converts `start_time` to milliseconds on the way out; `last_open` is not converted and is multiplied by 1000 in the UI. |
| `progress.percentage`                           | KOSync        | A true `0..1` reading position, pushed by KOReader on every page turn. **Only shown on `/syncs`** — not used by any book statistic.                    |

### 1.4 Reference-page scaling

Whenever a page number crosses a device boundary it is rescaled from the device's page count to
the book's reference pages:

```
referencePage = round(page * reference_pages / stat.total_pages)
```

If `reference_pages` is unset, or `stat.total_pages` is 0, the raw page is used. This appears in
`BooksService.toReferencePage` and, in interval form, in `getUniqueReadPages` and
`getReferencePageRanges`.

---

## 2. Derived calculations

### 2.1 The three different "pages read"

These coexist and mean different things. Confusing them is the single largest source of
mismatched numbers in this project.

| #   | Name                                | Formula                                                              | Semantics                               | Failure mode                                                                 |
| --- | ----------------------------------- | -------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | **Position** — `current_page`       | page of the `page_stat` row with the greatest `start_time`, rescaled | Where the book is _now_                 | Wrong until the next sync if you close the book inside a glossary at the end |
| 2   | **Coverage** — `unique_read_pages`  | merged length of every `[page-1, page]` interval                     | How many distinct pages have a stat row | Under-reports; a finished book reads as ~80%                                 |
| 3   | **Page turns** — `total_read_pages` | count of stat rows (scaled)                                          | How many page-views happened            | Inflates: re-reads and back-navigation count again                           |

**KoInsight displays #1 everywhere it shows progress** — the book list, the book page, and the
`/stats` total all use it, which is what makes them agree.

#2 is still computed and returned by the API but has no consumer at all.

#3 needs care: the **field** `total_read_pages` is no longer displayed anywhere, but the
**formula** — counting stat rows, scaled — is still what produces "Most pages in a day" on
`/stats` and "Pages read" on the weekly card. Those two numbers therefore do not reconcile with
the book list. See §4.1.

### 2.2 Per-book calculations

All in `apps/server/src/books/books-service.ts`. Exposed on `BookWithData` and produced by both
`BooksService.withData` and `BooksRepository.getAllWithData`.

| Field                                                                 | Function                | Formula                                                                        | Notes                                                                                                                                                 |
| --------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `total_pages`                                                         | `getTotalPages`         | `reference_pages \|\| max(book_device.pages)`                                  | Falls back to 0 when the book has no device rows.                                                                                                     |
| `current_page`                                                        | `getCurrentPage`        | page of the stat with max `start_time` (ties broken by higher page), rescaled  | **The** progress number. Deliberately not the maximum page ever reached, so a dictionary or glossary at the end of a book does not pin it at 100%.    |
| `max_read_page`                                                       | `getMaxReadPage`        | `max` of every stat's rescaled page                                            | Feeds the status only. Never displayed as progress.                                                                                                   |
| `read_percentage`                                                     | `getReadPercentage`     | `round(current_page / total_pages * 100)`, clamped to 100                      | 0 when `total_pages` is 0.                                                                                                                            |
| `status`                                                              | `getStatus`             | `status_override` ?? (`max_read_page >= total_pages - 1` ? `read` : `reading`) | One page of slack, because `reference_pages` and `page_stat.total_pages` can disagree — the plugin overrides the device page count with the live one. |
| `total_read_time`                                                     | `getTotalReadTime`      | sum of `book_device.total_read_time`                                           | Seconds.                                                                                                                                              |
| `last_open`                                                           | `getLastOpen`           | max of `book_device.last_open`                                                 | Seconds; ×1000 at display.                                                                                                                            |
| `started_reading`                                                     | `getStartedReading`     | min `start_time` across stats                                                  |                                                                                                                                                       |
| `read_per_day`                                                        | `getReadPerDay`         | `{ startOfDay(start_time) → Σ duration }`                                      | Pure time. Immune to the missing-rows problem.                                                                                                        |
| `unique_read_pages`                                                   | `getUniqueReadPages`    | merged interval length (definition #2)                                         | **Currently unused by the UI.**                                                                                                                       |
| `total_read_pages`                                                    | `getTotalReadPages`     | Σ `reference_pages / total_pages` per stat (definition #3)                     | **Currently unused by the UI.**                                                                                                                       |
| `notes`, `highlights`                                                 | inline                  | sum over `book_device`                                                         | KOReader's counters.                                                                                                                                  |
| `highlights_count`, `notes_count`, `bookmarks_count`, `deleted_count` | `AnnotationsRepository` | counts of imported annotation rows by type                                     | Different source from `notes`/`highlights` above, and they can disagree.                                                                              |

### 2.3 Global calculations

`apps/server/src/stats/stats-service.ts`, over **all** page stats of non-hidden books.

| Field               | Formula                                                   | Notes                                                                                                      |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `totalReadingTime`  | Σ `duration`                                              |                                                                                                            |
| `totalPagesRead`    | Σ `book.current_page` over all books                      | Uses definition #1, so it agrees with the book list.                                                       |
| `longestDay`        | max over `{ startOfDay → Σ duration }`                    |                                                                                                            |
| `last7DaysReadTime` | Σ `duration` where `start_time > subDays(now, 7)`         | A **rolling 168-hour window**, not the calendar week. Computed server-side, i.e. in **UTC** inside Docker. |
| `perMonth`          | Σ `duration` grouped by `format(start_time, 'MMMM yyyy')` |                                                                                                            |
| `perDayOfTheWeek`   | Σ `duration` grouped by weekday name                      | Aggregates every week ever.                                                                                |
| `mostPagesInADay`   | max of per-day Σ `reference_pages / total_pages`          | Uses definition **#3** — counts page turns, so re-reading a page counts twice.                             |

### 2.4 Page-range calculations (calendar)

`apps/web/src/utils/book-progress.ts`.

`getReferencePageRanges` turns each stat into a **half-open** interval
`[(page-1) * scale, page * scale]` and merges overlaps, so summing lengths gives a page count.
It mirrors the server's `getUniqueReadPages`; the two must stay in step.

`describeReferencePageRange` converts one interval into the numbers a reader recognises:

```
from  = floor(start) + 1
to    = ceil(end)
count = max(1, round(end - start))
```

Reading pages 10–20 yields the interval `[9, 20]`, displayed as "10 – 20 (11 pages)". Both
calendar components use this helper, so the labelled range and the count always agree.

### 2.5 Week boundaries

`week-stats.tsx` uses `startOfWeek(..., { weekStartsOn: 1 })` — **Monday to Sunday**, clipped so
the current week never extends past the end of today. It is computed **in the browser**, in the
user's timezone.

`last7DaysReadTime` is a different window on purpose (§2.3) and is labelled "in the last 7 days"
rather than "this week" so the two are not mistaken for each other.

---

## 3. Screen by screen

### 3.1 `/books` — list

Both the table and the card view read the same fields; nothing is computed in the component.

| Shown                             | Source                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Progress bar                      | `book.read_percentage`                                                                |
| "N / M pages read", `Read` column | `book.current_page` / `book.total_pages`                                              |
| `Pages` column                    | `book.total_pages`                                                                    |
| Reading / Read badge              | `book.status`                                                                         |
| `Total read time`                 | `book.total_read_time` via `shortDuration`                                            |
| `Last open`                       | `book.last_open * 1000`, relative format                                              |
| Annotation count                  | `book.annotations.length`                                                             |
| Sort options                      | `id`, `title`, `authors`, `total_read_time`, `last_open`, `read_percentage`, `status` |
| Status filter                     | `book.status`, in advanced filters                                                    |

### 3.2 `/books/{id}` — book page

**Reading progress card** (`StatsCard` in `book-page.tsx`) — identical fields to the list, which
is what guarantees the two screens agree:

| Shown                    | Source                                                                            |
| ------------------------ | --------------------------------------------------------------------------------- |
| Ring percentage and fill | `book.read_percentage`                                                            |
| "N / M pages read"       | `book.current_page` / `book.total_pages`                                          |
| Reading / Read badge     | `book.status`                                                                     |
| Total read time          | `book.total_read_time`                                                            |
| Days reading             | `Object.keys(book.read_per_day).length` — days with **any** recorded reading      |
| Average per day          | `book.total_read_time / daysReading` — averaged over days read, not days elapsed  |
| Avg time per page        | `Σ book.stats[].duration / book.stats.length` — seconds per _recorded_ page visit |

**Book card** (left):

| Shown              | Source                                                                            |
| ------------------ | --------------------------------------------------------------------------------- |
| Last opened        | `book.last_open * 1000`                                                           |
| Highlights / Notes | sum over `book.device_data[]` — KOReader's counters, not the imported annotations |

**Manage tab:** `reference_pages` (`PUT /api/books/:id/reference_pages`) and reading status
(`PUT /api/books/:id/status`, `'reading' | 'read' | null`). The status control shows the derived
value and `max_read_page` / `total_pages` so it is clear what the automatic mode is reacting to.

**Calendar tab:** per day, `Σ duration` plus the page range from §2.4.

### 3.3 `/stats` — reading statistics

| Shown                               | Source                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| "You read for X in the last 7 days" | `last7DaysReadTime` — rolling 168 hours, **not** the calendar week                                                              |
| Total read time                     | `totalReadingTime`                                                                                                              |
| Total pages read                    | `totalPagesRead` (definition #1, agrees with `/books`)                                                                          |
| Longest time reading in a day       | `longestDay`                                                                                                                    |
| Most pages in a day                 | `mostPagesInADay` (definition #3 — counts page turns)                                                                           |
| Reading history dots                | per-day `Σ duration`, scaled as `floor(time / maxTime * 100)` — **relative** intensity, so the darkest dot is your own best day |
| Per day of the week                 | `perDayOfTheWeek`                                                                                                               |
| Monthly reading time                | `perMonth`                                                                                                                      |

**Weekly stats card** — Monday-based calendar week (§2.5), navigable via the date picker:

| Shown                 | Source                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Read time             | `Σ duration` within the week                                                                                 |
| Pages read            | `Σ reference_pages / total_pages` over the week's stats (definition #3)                                      |
| Average pages per day | that sum divided by the number of **days that have stats**                                                   |
| Average time per day  | `Σ duration / weekDaysPassed` — divided by calendar days elapsed, so it dilutes across days you did not read |
| Area chart            | `Σ duration` per day                                                                                         |

Note the two averages use different denominators. That is existing behaviour, not a typo.

### 3.4 `/calendar`

Per day, per book: `Σ duration` and the page range from §2.4. Mobile day dots are normalised
against the busiest day in the whole range.

### 3.5 `/syncs`

The only screen backed by the `progress` table:

| Shown      | Source                                                                           |
| ---------- | -------------------------------------------------------------------------------- |
| Percentage | `progress.percentage * 100` — KOReader's own position, accurate to the page turn |
| Position   | `progress.progress` — a page number or an xpointer                               |
| Book       | `progress.document` matched against `book.md5`                                   |

---

## 4. Known inconsistencies

Deliberate or accepted, listed so they are not rediscovered as bugs:

1. **"Most pages in a day" and the weekly "Pages read" use definition #3** while everything else
   uses #1. They answer "how many pages went past my eyes", which is defensible, but they do not
   reconcile with the book list.
2. **`unique_read_pages` has no consumer.** It is still computed on every `GET /api/books` — a
   per-book interval merge — for a value nobody reads.
3. **`GET /api/books` returns every `page_stat` of every book**, which dominates the response —
   about 515 KB total on the 10-book seed database. The list screens no longer read `stats` at
   all, so it could be dropped from this endpoint, but other `useBooks` consumers would need
   auditing first.
4. **`notes`/`highlights` (KOReader counters) can disagree with `notes_count`/`highlights_count`
   (imported annotations).** Different sources, different sync paths.
5. **The KOSync `progress` table is the most accurate position data available** and is unused
   outside `/syncs`. Wiring it in would require the user to point KOReader's progress sync at
   this server with the binary (partial MD5) checksum method.
6. **Two averages on the weekly card use different denominators** (§3.3).
