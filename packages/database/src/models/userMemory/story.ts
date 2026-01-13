import { and, desc, eq } from 'drizzle-orm';

import {
  NewUserStoryDiff,
  NewUserStoryDocument,
  UserStoryDiff,
  UserStoryDocument,
  userStoryDiffs,
  userStoryDocuments,
} from '../../schemas';
import { LobeChatDatabase } from '../../type';

export interface UpsertUserStoryParams {
  capturedAt?: Date;
  diff?: string | null;
  memoryIds?: string[] | null;
  metadata?: Record<string, unknown> | null;
  reasoning?: string | null;
  snapshot?: string | null;
  sourceIds?: string[] | null;
  story: string;
  summary?: string | null;
  title?: string | null;
}

export class UserStoryModel {
  private readonly db: LobeChatDatabase;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  getLatestStoryDocument = async () => {
    return this.db.query.userStoryDocuments.findFirst({
      orderBy: [desc(userStoryDocuments.version), desc(userStoryDocuments.updatedAt)],
      where: eq(userStoryDocuments.userId, this.userId),
    });
  };

  // Alias for consistency with other models
  getLatestDocument = async () => this.getLatestStoryDocument();

  listDiffs = async (limit = 50) => {
    return this.db.query.userStoryDiffs.findMany({
      limit,
      orderBy: [desc(userStoryDiffs.createdAt)],
      where: eq(userStoryDiffs.userId, this.userId),
    });
  };

  appendDiff = async (
    params: Omit<NewUserStoryDiff, 'id' | 'userId'> & { storyId: string },
  ): Promise<UserStoryDiff> => {
    const [result] = await this.db
      .insert(userStoryDiffs)
      .values({ ...params, userId: this.userId })
      .returning();

    return result;
  };

  upsertStory = async (
    params: UpsertUserStoryParams,
  ): Promise<{ diff?: UserStoryDiff; document: UserStoryDocument }> => {
    return this.db.transaction(async (tx) => {
      const existing = await tx.query.userStoryDocuments.findFirst({
        where: eq(userStoryDocuments.userId, this.userId),
      });
      const nextVersion = (existing?.version ?? 0) + 1;

      const baseDocument: Omit<NewUserStoryDocument, 'id' | 'userId'> = {
        capturedAt: params.capturedAt,
        memoryIds: params.memoryIds ?? undefined,
        metadata: params.metadata ?? undefined,
        reasoning: params.reasoning ?? undefined,
        sourceIds: params.sourceIds ?? undefined,
        story: params.story,
        summary: params.summary ?? undefined,
        title: params.title ?? undefined,
        version: nextVersion,
      };

      let document: UserStoryDocument;

      if (existing) {
        [document] = await tx
          .update(userStoryDocuments)
          .set({ ...baseDocument, updatedAt: new Date() })
          .where(and(eq(userStoryDocuments.id, existing.id), eq(userStoryDocuments.userId, this.userId)))
          .returning();
      } else {
        [document] = await tx
          .insert(userStoryDocuments)
          .values({ ...baseDocument, userId: this.userId })
          .returning();
      }

      let diff: UserStoryDiff | undefined;
      const hasDiff =
        params.diff ||
        params.snapshot ||
        params.reasoning ||
        (params.memoryIds && params.memoryIds.length > 0) ||
        (params.sourceIds && params.sourceIds.length > 0);

      if (hasDiff) {
        [diff] = await tx
          .insert(userStoryDiffs)
          .values({
            capturedAt: params.capturedAt,
            diff: params.diff ?? undefined,
            memoryIds: params.memoryIds ?? undefined,
            metadata: params.metadata ?? undefined,
            nextVersion: document.version,
            previousVersion: existing?.version,
            reasoning: params.reasoning ?? undefined,
            snapshot: params.snapshot ?? params.story,
            sourceIds: params.sourceIds ?? undefined,
            storyId: document.id,
            summary: params.summary ?? undefined,
            userId: this.userId,
          })
          .returning();
      }

      return { diff, document };
    });
  };
}
