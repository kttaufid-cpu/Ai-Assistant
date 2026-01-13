import { renderPlaceholderTemplate } from '@lobechat/context-engine';
import type { ModelRuntime } from '@lobechat/model-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { userStoryPrompt } from '../prompts';
import { StoryTemplateProps } from '../types';
import { UserStoryExtractor } from './story';

const runtimeMock = { generateObject: vi.fn() } as unknown as ModelRuntime;
const extractorConfig = {
  agent: 'user-story' as const,
  model: 'gpt-mock',
  modelRuntime: runtimeMock,
};

const templateOptions: StoryTemplateProps = {
  existingStory: '# Existing',
  language: 'English',
  recentEvents: '- Event 1',
  retrievedMemories: '- mem',
  storyNotes: '- note',
  userProfile: '- profile',
  username: 'User',
};

describe('UserStoryExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes function tool for committing stories', async () => {
    const extractor = new UserStoryExtractor(extractorConfig);
    const tools = (extractor as any).getTools();

    expect(tools).toHaveLength(1);
    expect(tools?.[0].function?.name).toBe('commit_user_story');
    expect((extractor as any).getSchema()).toBeUndefined();
  });

  it('renders user prompt with provided sections', async () => {
    const extractor = new UserStoryExtractor(extractorConfig);
    await extractor.ensurePromptTemplate();

    const prompt = extractor.buildUserPrompt(templateOptions);
    expect(prompt).toContain('## Existing Story');
    expect(prompt).toContain('# Existing');
    expect(prompt).toContain('Recent Events');
  });

  it('calls runtime with structured payload', async () => {
    const extractor = new UserStoryExtractor(extractorConfig);
    await extractor.ensurePromptTemplate();

    runtimeMock.generateObject = vi.fn().mockResolvedValue([
      {
        arguments: JSON.stringify({
          diff: '- updated',
          memoryIds: ['mem-1'],
          reasoning: 'why',
          sourceIds: ['src-1'],
          story: '# Story',
          summary: 'summary',
        }),
        name: 'commit_user_story',
      },
    ]);

    const result = await extractor.toolCall(templateOptions);

    expect(result.story).toBe('# Story');
    expect(runtimeMock.generateObject).toHaveBeenCalledTimes(1);

    const call = (runtimeMock.generateObject as any).mock.calls[0][0];
    expect(call.model).toBe('gpt-mock');
    expect(call.messages[0].content).toBe(
      renderPlaceholderTemplate(userStoryPrompt, {
        language: 'English',
        topK: 10,
        username: 'User',
      }),
    );
  });
});
