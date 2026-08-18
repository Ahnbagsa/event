import { describe, it, expect, beforeEach } from 'vitest';
import { clearDb } from './testUtils';
import { listEvents, getEvent, putEvent, deleteEvent } from './eventRepo';
import { createEventFromTemplate } from '../domain/templates';

const init = {
  title: '개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

describe('eventRepo', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('저장한 행사를 id로 읽는다', async () => {
    const event = createEventFromTemplate('semester-opening', init);
    await putEvent(event);
    expect((await getEvent(event.id))?.title).toBe('개학식');
  });

  it('없는 id는 null이다', async () => {
    expect(await getEvent('없음')).toBeNull();
  });

  it('최근에 수정한 행사가 앞에 온다', async () => {
    const older = { ...createEventFromTemplate('blank', init), title: '오래된', updatedAt: 100 };
    const newer = { ...createEventFromTemplate('blank', init), title: '최신', updatedAt: 200 };
    await putEvent(older);
    await putEvent(newer);
    expect((await listEvents()).map((e) => e.title)).toEqual(['최신', '오래된']);
  });

  it('삭제하면 목록에서 사라진다', async () => {
    const event = createEventFromTemplate('blank', init);
    await putEvent(event);
    await deleteEvent(event.id);
    expect(await listEvents()).toHaveLength(0);
  });
});
