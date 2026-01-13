import { renderPlaceholderTemplate } from '@lobechat/context-engine';
import { z } from 'zod';

import { userStoryPrompt } from '../prompts';
import { StoryExtractorOptions, StoryTemplateProps, UserStoryExtractionResult } from '../types';
import { BaseMemoryExtractor } from './base';

const resultSchema = z.object({
  diff: z.string().optional(),
  memoryIds: z.array(z.string()).optional(),
  reasoning: z.string().optional(),
  sourceIds: z.array(z.string()).optional(),
  story: z.string(),
  summary: z.string().optional(),
});

export class UserStoryExtractor extends BaseMemoryExtractor<
  UserStoryExtractionResult,
  StoryTemplateProps,
  StoryExtractorOptions
> {
  getPrompt() {
    return userStoryPrompt;
  }

  getResultSchema() {
    return resultSchema;
  }

  protected getPromptName(): string {
    return 'user-story';
  }

  // Use tool-calling instead of JSON schema for richer arguments parsing.
  protected getSchema(): undefined {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getTools(_options: StoryTemplateProps) {
    return [
      {
        function: {
          description:
            'Persist an updated user story document that summarizes the user, preferences, relationships, and recent events.',
          name: 'commit_user_story',
          parameters: {
            properties: {
              diff: {
                description: 'Bullet list of changes applied this run',
                type: 'string',
              },
              memoryIds: {
                description: 'Related memory IDs used to craft the story',
                items: { type: 'string' },
                type: 'array',
              },
              reasoning: {
                description: 'Why these changes were applied',
                type: 'string',
              },
              sourceIds: {
                description: 'Source IDs (topic ID, document ID, or anything related) tied to this update',
                items: { type: 'string' },
                type: 'array',
              },
              story: { description: 'Complete Markdown story for the user', type: 'string' },
              summary: {
                description: 'Executive summary (2-3 lines)',
                type: 'string',
              },
            },
            required: ['story'],
            type: 'object',
          },
        },
        type: 'function' as const,
      },
    ];
  }

  buildUserPrompt(options: StoryTemplateProps): string {
    const sections = [
      '## Existing Story (baseline)',
      options.existingStory?.trim() || 'No existing story provided.',
      '## Retrieved Memories / Signals',
      options.retrievedMemories?.trim() || 'N/A',
      '## Recent Events or Highlights',
      options.recentEvents?.trim() || 'N/A',
      '## User Provided Notes or Requests',
      options.storyNotes?.trim() || 'N/A',
      '## Extra Profile Context',
      options.userProfile?.trim() || 'N/A',
    ];

    return sections.join('\n\n');
  }

  async toolCall(options?: StoryExtractorOptions): Promise<UserStoryExtractionResult> {
    await this.ensurePromptTemplate();

    const systemPrompt = renderPlaceholderTemplate(
      this.promptTemplate || '',
      this.getTemplateProps(options || {}),
    );
    const userPrompt = this.buildUserPrompt(options || {});

    const messages = [
      { content: systemPrompt, role: 'system' as const },
      ...((options?.additionalMessages || []) as any),
      { content: userPrompt, role: 'user' as const },
    ];

    const result = (await this.runtime.generateObject({
      messages,
      model: this.model,
      tools: this.getTools(options || {}),
    })) as unknown;

    if (Array.isArray(result)) {
      const firstCall = result[0];
      const args =
        typeof firstCall?.arguments === 'string'
          ? JSON.parse(firstCall.arguments || '{}')
          : firstCall?.arguments;

      return resultSchema.parse(args || {});
    }

    return resultSchema.parse(result);
  }

  async structuredCall(options?: StoryExtractorOptions): Promise<UserStoryExtractionResult> {
    return this.toolCall(options);
  }
}
