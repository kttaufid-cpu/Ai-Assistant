/* eslint-disable sort-keys-fix/sort-keys-fix  */
import { index, integer, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { createNanoId } from '../../utils/idGenerator';
import { timestamps, timestamptz, varchar255 } from '../_helpers';
import { users } from '../user';

export const userStoryDocuments = pgTable(
  'user_memory_story_documents',
  {
    id: varchar255('id')
      .$defaultFn(() => createNanoId(18)())
      .primaryKey(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),

    title: varchar255('title'),
    summary: text('summary'),
    story: text('story'),
    reasoning: text('reasoning'),

    memoryIds: jsonb('memory_ids').$type<string[]>(),
    sourceIds: jsonb('source_ids').$type<string[]>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    version: integer('version').notNull().default(1),
    capturedAt: timestamptz('captured_at').notNull().defaultNow(),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('user_story_documents_user_id_unique').on(table.userId),
    index('user_story_documents_user_id_index').on(table.userId),
  ],
);

export const userStoryDiffs = pgTable(
  'user_memory_story_diffs',
  {
    id: varchar255('id')
      .$defaultFn(() => createNanoId(18)())
      .primaryKey(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    storyId: varchar255('story_id').references(() => userStoryDocuments.id, { onDelete: 'cascade' }),

    diff: text('diff'),
    snapshot: text('snapshot'),
    summary: text('summary'),
    reasoning: text('reasoning'),

    memoryIds: jsonb('memory_ids').$type<string[]>(),
    sourceIds: jsonb('source_ids').$type<string[]>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    previousVersion: integer('previous_version'),
    nextVersion: integer('next_version'),

    capturedAt: timestamptz('captured_at').notNull().defaultNow(),

    ...timestamps,
  },
  (table) => [
    index('user_story_diffs_story_id_index').on(table.storyId),
    index('user_story_diffs_user_id_index').on(table.userId),
  ],
);

export type UserStoryDocument = typeof userStoryDocuments.$inferSelect;
export type NewUserStoryDocument = typeof userStoryDocuments.$inferInsert;

export type UserStoryDiff = typeof userStoryDiffs.$inferSelect;
export type NewUserStoryDiff = typeof userStoryDiffs.$inferInsert;
