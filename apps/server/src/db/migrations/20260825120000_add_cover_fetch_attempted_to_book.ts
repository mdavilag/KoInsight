import type { Knex } from 'knex';

/**
 * Records when the automatic Open Library cover lookup last ran for a book.
 *
 * Every sync re-sends the whole `book` table, so without this marker the backfill would
 * re-query Open Library for every coverless book on every sync — including the many books
 * it is simply never going to find. A non-null value means "already tried", regardless of
 * whether a cover was found. Clearing it re-arms the lookup.
 *
 * Epoch milliseconds, to match `Date.now()`.
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('book', (table) => {
    table.bigInteger('cover_fetch_attempted_at').nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('book', (table) => {
    table.dropColumn('cover_fetch_attempted_at');
  });
}
