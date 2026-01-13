import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getServerDB } from '@/database/server';
import { parseMemoryExtractionConfig } from '@/server/globalConfig/parseMemoryExtractionConfig';
import { buildUserStoryJobInput, UserStoryService } from '@/server/services/memory/userStory/service';

const userStoryWebhookSchema = z.object({
  userId: z.string().optional(),
  userIds: z.array(z.string()).optional(),
});

export const POST = async (req: Request) => {
  const { webhookHeaders } = parseMemoryExtractionConfig();

  if (webhookHeaders && Object.keys(webhookHeaders).length > 0) {
    for (const [key, value] of Object.entries(webhookHeaders)) {
      const headerValue = req.headers.get(key);
      if (headerValue !== value) {
        return NextResponse.json(
          { error: `Unauthorized: Missing or invalid header '${key}'` },
          { status: 403 },
        );
      }
    }
  }

  try {
    const json = await req.json();
    const payload = userStoryWebhookSchema.parse(json);
    const db = await getServerDB();
    const userIds = Array.from(
      new Set([...(payload.userIds || []), ...(payload.userId ? [payload.userId] : [])]),
    ).filter(Boolean);

    if (userIds.length === 0) {
      return NextResponse.json({ error: 'userId or userIds is required' }, { status: 400 });
    }

    const service = new UserStoryService(db);
    const results = [];

    for (const userId of userIds) {
      const context = await buildUserStoryJobInput(db, userId);
      const result = await service.composeStory({ ...context, userId });
      results.push({ userId, ...result });
    }

    return NextResponse.json(
      { message: 'User story generated via webhook.', results },
      { status: 200 },
    );
  } catch (error) {
    console.error('[user-story] failed', error);

    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
};
