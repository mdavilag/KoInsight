import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('book', (table) => {
    table.string('status_override').defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('book', (table) => {
    table.dropColumn('status_override');
  });
}
