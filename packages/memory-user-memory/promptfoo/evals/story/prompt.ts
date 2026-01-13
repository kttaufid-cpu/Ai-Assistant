import { renderPlaceholderTemplate } from '@lobechat/context-engine';
import { userStoryPrompt } from '../../../src/prompts/story';

interface StoryPromptVars {
  existingStory?: string;
  language: string;
  recentEvents?: string;
  retrievedMemories?: string;
  storyNotes?: string;
  userProfile?: string;
  username: string;
}

export default async function generatePrompt({ vars }: { vars: StoryPromptVars }) {
  const system = renderPlaceholderTemplate(userStoryPrompt, {
    language: vars.language,
    topK: 10,
    username: vars.username,
  });

  const userSections = [
    '## Existing Story (baseline)',
    vars.existingStory || 'No existing story provided.',
    '## Retrieved Memories / Signals',
    vars.retrievedMemories || 'N/A',
    '## Recent Events or Highlights',
    vars.recentEvents || 'N/A',
    '## User Provided Notes or Requests',
    vars.storyNotes || 'N/A',
    '## Extra Profile Context',
    vars.userProfile || 'N/A',
  ].join('\n\n');

  return [
    { content: system, role: 'system' },
    { content: userSections, role: 'user' },
  ];
}
