// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import {
  NewUserStoryDiff,
  userStoryDiffs,
  userStoryDocuments,
  users,
} from '../../../schemas';
import { LobeChatDatabase } from '../../../type';
import { getTestDB } from '../../../core/getTestDB';
import { UserStoryModel } from '../story';

const userId = 'story-user';
const otherUserId = 'story-user-2';

let storyModel: UserStoryModel;
const serverDB: LobeChatDatabase = await getTestDB();

beforeEach(async () => {
  await serverDB.delete(userStoryDiffs);
  await serverDB.delete(userStoryDocuments);
  await serverDB.delete(users);

  await serverDB.insert(users).values([{ id: userId }, { id: otherUserId }]);

  storyModel = new UserStoryModel(serverDB, userId);
});

describe('UserStoryModel', () => {
  it('creates a new story document with optional diff', async () => {
    const { document, diff } = await storyModel.upsertStory({
      diff: '- added intro',
      memoryIds: ['mem-1'],
      reasoning: 'First draft',
      snapshot: '# Story',
      sourceIds: ['src-1'],
      story: '# Story',
      summary: 'Initial summary',
      title: 'User Story',
    });

    expect(document.userId).toBe(userId);
    expect(document.version).toBe(1);
    expect(document.story).toBe('# Story');
    expect(diff?.previousVersion ?? undefined).toBeUndefined();
    expect(diff?.nextVersion).toBe(1);
    expect(diff?.memoryIds).toEqual(['mem-1']);
    expect(diff?.sourceIds).toEqual(['src-1']);
  });

  it('increments version and records diff on update', async () => {
    await storyModel.upsertStory({
      story: '# v1',
      summary: 'first',
      title: 'User Story',
    });

    const { document, diff } = await storyModel.upsertStory({
      diff: '- updated section',
      memoryIds: ['mem-2'],
      snapshot: '# v2',
      sourceIds: ['src-2'],
      story: '# v2',
      summary: 'second',
      title: 'User Story',
    });

    expect(document.version).toBe(2);
    expect(diff?.previousVersion).toBe(1);
    expect(diff?.nextVersion).toBe(2);
    expect(diff?.storyId).toBe(document.id);

    const persisted = await serverDB.query.userStoryDiffs.findMany({
      where: (t, { eq }) => eq(t.userId, userId),
    });
    expect(persisted).toHaveLength(1);
  });

  it('skips diff insert when no diff content supplied', async () => {
    const { diff } = await storyModel.upsertStory({
      story: '# only story',
      summary: 'summary',
      title: 'User Story',
    });

    expect(diff).toBeUndefined();
    const persisted = await serverDB.query.userStoryDiffs.findMany({
      where: (t, { eq }) => eq(t.userId, userId),
    });
    expect(persisted).toHaveLength(0);
  });

  it('returns latest document for user', async () => {
    await storyModel.upsertStory({ story: '# v1', title: 'User Story' });
    await storyModel.upsertStory({ story: '# v2', title: 'User Story' });

    const latest = await storyModel.getLatestStoryDocument();
    expect(latest?.story).toBe('# v2');
    expect(latest?.version).toBe(2);
  });

  it('lists diffs ordered by createdAt desc', async () => {
    await storyModel.upsertStory({
      diff: '- change',
      memoryIds: ['mem-1'],
      sourceIds: ['src-1'],
      story: '# v1',
      summary: 'summary',
      title: 'User Story',
    });

    await storyModel.upsertStory({
      diff: '- change 2',
      memoryIds: ['mem-2'],
      sourceIds: ['src-2'],
      story: '# v2',
      summary: 'new',
      title: 'User Story',
    });

    const diffs = await storyModel.listDiffs();
    expect(diffs).toHaveLength(2);
    expect(diffs[0].summary).toBe('new');
  });
});
