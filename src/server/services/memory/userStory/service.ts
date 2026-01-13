import { ModelRuntime } from '@lobechat/model-runtime';
import { desc, eq } from 'drizzle-orm';

import type { UserStoryDiff, UserStoryDocument } from '@lobechat/database/schemas';
import { userMemories } from '@lobechat/database/schemas';
import { LobeChatDatabase } from '@/database/type';
import {
  RetrievalUserMemoryContextProvider,
  RetrievalUserMemoryIdentitiesProvider,
  UserStoryExtractor,
  type UserStoryExtractionResult,
} from '@lobechat/memory-user-memory';

import { UserStoryModel } from '@/database/models/userMemory/story';
import { MemoryAgentConfig, parseMemoryExtractionConfig } from '@/server/globalConfig/parseMemoryExtractionConfig';
import { UserMemoryModel } from '@/database/models/userMemory';
import { LayersEnum } from '@/types/userMemory';

interface UserStoryAgentPayload {
  existingStory?: string | null;
  language?: string;
  memoryIds?: string[];
  metadata?: Record<string, unknown>;
  recentEvents?: string;
  retrievedMemories?: string;
  sourceIds?: string[];
  storyNotes?: string;
  userId: string;
  userProfile?: string;
  username?: string;
}

interface UserStoryAgentResult {
  agentResult: UserStoryExtractionResult;
  diff?: UserStoryDiff;
  document: UserStoryDocument;
}

export class UserStoryService {
  private readonly preferredLanguage?: string;
  private readonly db: LobeChatDatabase;
  private readonly runtime: ModelRuntime;
  private readonly agentConfig: MemoryAgentConfig;

  constructor(db: LobeChatDatabase) {
    const { agentStory } = parseMemoryExtractionConfig();

    this.db = db;
    this.preferredLanguage = agentStory.language;
    this.agentConfig = agentStory;
    this.runtime = ModelRuntime.initializeWithProvider(agentStory.provider || 'openai', {
      apiKey: agentStory.apiKey,
      baseURL: agentStory.baseURL,
    });
  }

  async composeStory(payload: UserStoryAgentPayload): Promise<UserStoryAgentResult> {
    const extractor = new UserStoryExtractor({
      agent: 'user-story',
      model: this.agentConfig.model,
      modelRuntime: this.runtime
    });

    const agentResult = await extractor.toolCall({
      existingStory: payload.existingStory || undefined,
      language: payload.language || this.preferredLanguage,
      recentEvents: payload.recentEvents,
      retrievedMemories: payload.retrievedMemories,
      storyNotes: payload.storyNotes,
      userProfile: payload.userProfile,
      username: payload.username,
    });

    const storyModel = new UserStoryModel(this.db, payload.userId);
    const persisted = await storyModel.upsertStory({
      capturedAt: new Date(),
      diff: agentResult.diff,
      memoryIds: payload.memoryIds ?? agentResult.memoryIds ?? undefined,
      metadata: payload.metadata ?? undefined,
      reasoning: agentResult.reasoning ?? undefined,
      snapshot: agentResult.story,
      sourceIds: payload.sourceIds ?? agentResult.sourceIds ?? undefined,
      story: agentResult.story,
      summary: agentResult.summary ?? undefined,
      title: `User Story for ${payload.username || 'User'}`,
    });

    return { agentResult, ...persisted };
  }
}

export const buildUserStoryJobInput = async (db: LobeChatDatabase, userId: string) => {
  const storyModel = new UserStoryModel(db, userId);
  const latestStory = await storyModel.getLatestStoryDocument();

  const userMemoryModel = new UserMemoryModel(db, userId);

  const [identities, contexts, preferences, memories] = await Promise.all([
    userMemoryModel.getAllIdentitiesWithMemory(),
    userMemoryModel.listMemories({ layer: LayersEnum.Context, pageSize: 3 }),
    userMemoryModel.listMemories({ layer: LayersEnum.Preference, pageSize: 10 }),
    db.query.userMemories.findMany({
      limit: 20,
      orderBy: [desc(userMemories.capturedAt)],
      where: eq(userMemories.userId, userId),
    }),
  ]);

  const recentMemoryLines = memories
    .map((m) => {
      const date = m.capturedAt?.toISOString?.() ?? '';
      const title = m.title || 'Untitled memory';
      const summary = m.summary || m.details || '';
      return `- [${date}] ${title} — ${summary}`.trim();
    })
    .join('\n');

  const contextProvider = new RetrievalUserMemoryContextProvider({
    retrievedMemories: {
      contexts: contexts.map((c) => c.context),
      experiences: [],
      preferences: preferences.map((p) => p.preference),
    },
  });

  const identityProvider = new RetrievalUserMemoryIdentitiesProvider({
    retrievedIdentities: identities.map((i) => ({
      ...i,
      layer: LayersEnum.Identity,
    })),
  });

  const [contextXml, identityXml] = await Promise.all([
    contextProvider.buildContext(userId, 'user-story-memories'),
    identityProvider.buildContext(userId, 'user-story-memories-identities'),
  ]);

  const assembledContext =
    [recentMemoryLines && `## Recent Memories\n${recentMemoryLines}`, contextXml.context, identityXml.context]
      .filter(Boolean)
      .join('\n\n') || undefined;

  return {
    existingStory: latestStory?.story || undefined,
    memoryIds: memories.map((m) => m.id),
    retrievedMemories: assembledContext,
  };
};
