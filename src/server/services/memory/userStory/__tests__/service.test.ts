// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@lobechat/database';
import { getTestDB } from '@lobechat/database/test-utils';
import { users } from '@lobechat/database/schemas';
import { UserStoryModel } from '@/database/models/userMemory/story';
import { UserStoryService } from '../service';

vi.mock('@/server/globalConfig/parseMemoryExtractionConfig', () => ({
  parseMemoryExtractionConfig: () => ({
    agentLayerExtractor: {
      apiKey: 'test-key',
      baseURL: 'https://example.com',
      language: 'English',
      layers: { context: 'gpt-mock' },
      model: 'gpt-mock',
      provider: 'openai',
    },
  }),
}));

const structuredResult = {
  diff: '- updated',
  memoryIds: ['mem-1'],
  reasoning: 'reason',
  sourceIds: ['src-1'],
  story: '# Story',
  summary: 'summary',
};

const toolCall = vi.fn().mockResolvedValue(structuredResult);

vi.mock('@lobechat/memory-user-memory', () => ({
  UserStoryExtractor: vi.fn().mockImplementation(() => ({
    toolCall,
  })),
}));

vi.mock('@lobechat/model-runtime', () => ({
  ModelRuntime: {
    initializeWithProvider: vi.fn().mockResolvedValue({}),
  },
}));

let db: LobeChatDatabase;
const userId = 'user-story-service';

beforeEach(async () => {
  toolCall.mockClear();
  db = await getTestDB();

  await db.delete(users);
  await db.insert(users).values({ id: userId });
});

describe('UserStoryService', () => {
  it('composes and persists story via agent', async () => {
    const service = new UserStoryService(db);
    const result = await service.composeStory({
      recentEvents: '- event',
      retrievedMemories: '- mem',
      storyNotes: '- note',
      userId,
      username: 'User',
    });

    expect(toolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'English',
        username: 'User',
      }),
    );
    expect(result.document.story).toBe('# Story');

    const model = new UserStoryModel(db, userId);
    const latest = await model.getLatestStoryDocument();
    expect(latest?.version).toBe(1);
  });

  it('passes existing story baseline on subsequent runs', async () => {
    const service = new UserStoryService(db);
    await service.composeStory({ userId, username: 'User' });

    await service.composeStory({ userId, username: 'User' });

    expect(toolCall).toHaveBeenLastCalledWith(
      expect.objectContaining({
        existingStory: '# Story',
      }),
    );
  });
});
