import { serve } from '@upstash/workflow/nextjs';
import { z } from 'zod';

import { getServerDB } from '@/database/server';
import { buildUserStoryJobInput, UserStoryService } from '@/server/services/memory/userStory/service';

const workflowPayloadSchema = z.object({
  userId: z.string().optional(),
  userIds: z.array(z.string()).optional(),
});

export const { POST } = serve(async (context) => {
  const payload = workflowPayloadSchema.parse(context.requestPayload || {});
  const db = await getServerDB();

  const userIds = Array.from(
    new Set([...(payload.userIds || []), ...(payload.userId ? [payload.userId] : [])]),
  ).filter(Boolean);

  if (userIds.length === 0) {
    return { message: 'userId or userIds is required', processedUsers: 0 };
  }

  const service = new UserStoryService(db);
  const results = [];

  for (const userId of userIds) {
    const context = await buildUserStoryJobInput(db, userId);
    const result = await service.composeStory({ ...context, userId });
    results.push({
      diffId: result.diff?.id,
      documentId: result.document.id,
      userId,
      version: result.document.version,
    });
  }

  return {
    message: 'User story processed via workflow.',
    processedUsers: userIds.length,
    results,
  };
});
