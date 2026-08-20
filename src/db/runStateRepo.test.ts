import { describe, it, expect, beforeEach } from 'vitest';
import { clearDb } from './testUtils';
import { getRunState, saveRunState, clearRunState } from './runStateRepo';

const sample = {
  id: 'singleton' as const,
  eventId: 'event-1',
  currentIndex: 3,
  startedAt: 100,
  updatedAt: 200,
};

describe('runStateRepo', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('저장한 진행 위치를 읽는다', async () => {
    await saveRunState(sample);
    expect((await getRunState())?.currentIndex).toBe(3);
  });

  it('저장한 적 없으면 null이다', async () => {
    expect(await getRunState()).toBeNull();
  });

  it('지우면 null이 된다', async () => {
    await saveRunState(sample);
    await clearRunState();
    expect(await getRunState()).toBeNull();
  });
});
