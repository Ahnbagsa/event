import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyScripts, generateScripts, regenerateOne } from './generateScripts';
import { createEventFromTemplate } from '../domain/templates';
import type { ClientDeps, GenerateInput } from './client';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

// 인자 타입을 명시해야 mock.calls[0][0]이 tsc --noEmit을 통과한다.
const generateTextMock = vi.fn((_input: GenerateInput, _deps: ClientDeps) =>
  Promise.resolve({ text: '{"segments":[]}', modelUsed: 'models/x', modelChanged: false }),
);

// vi.doMock은 이미 정적 import된 모듈에 먹지 않으므로 호이스팅되는 vi.mock을 쓴다.
vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof import('./client')>('./client');
  return {
    ...actual,
    generateText: (input: GenerateInput, deps: ClientDeps) => generateTextMock(input, deps),
  };
});

beforeEach(() => {
  generateTextMock.mockClear();
});

describe('applyScripts', () => {
  it('id로 짝지어 멘트를 채운다', () => {
    const { segments } = createEventFromTemplate('semester-opening', init);
    const updated = applyScripts(segments, {
      segments: [
        { id: segments[0].id, script: '개학식을 시작하겠습니다.' },
        { id: segments[6].id, script: '이상으로 마치겠습니다.' },
      ],
    });

    expect(updated[0].script).toBe('개학식을 시작하겠습니다.');
    expect(updated[6].script).toBe('이상으로 마치겠습니다.');
  });

  it('응답에 없는 순서는 원래 멘트를 지킨다', () => {
    const { segments } = createEventFromTemplate('semester-opening', init);
    segments[1].script = '기존 멘트';

    const updated = applyScripts(segments, {
      segments: [{ id: segments[0].id, script: '새 멘트' }],
    });

    expect(updated[1].script).toBe('기존 멘트');
  });

  it('모르는 id는 무시한다', () => {
    const { segments } = createEventFromTemplate('semester-opening', init);
    const updated = applyScripts(segments, {
      segments: [{ id: '없는id', script: '엉뚱한 멘트' }],
    });
    expect(updated.every((segment) => segment.script === '')).toBe(true);
  });

  it('순서 개수와 순서 자체는 바뀌지 않는다', () => {
    const { segments } = createEventFromTemplate('semester-opening', init);
    const updated = applyScripts(segments, { segments: [] });
    expect(updated.map((s) => s.id)).toEqual(segments.map((s) => s.id));
  });

  it('script가 문자열이 아니면 건너뛴다', () => {
    const { segments } = createEventFromTemplate('semester-opening', init);
    const updated = applyScripts(segments, {
      segments: [{ id: segments[0].id, script: 123 }],
    });
    expect(updated[0].script).toBe('');
  });

  it('응답 모양이 틀리면 오류를 던진다', () => {
    const { segments } = createEventFromTemplate('semester-opening', init);
    expect(() => applyScripts(segments, { 아무거나: true })).toThrow(
      'AI 응답을 이해할 수 없습니다.',
    );
  });
});

describe('generateScripts', () => {
  it('진행 방식을 지시문에 담아 보낸다', async () => {
    const event = createEventFromTemplate('semester-opening', init);
    await generateScripts(event, null, {} as ClientDeps);

    const instruction = String(generateTextMock.mock.calls[0][0].systemInstruction);
    expect(instruction).toContain('각 교실');
  });
});

describe('regenerateOne', () => {
  it('대상 순서와 앞뒤 한 개씩만 보낸다', async () => {
    const event = createEventFromTemplate('semester-opening', init);
    await regenerateOne(event, event.segments[3].id, null, {} as ClientDeps);

    const sent = String((generateTextMock.mock.calls[0][0].parts as { text: string }[])[0].text);
    expect(sent).toContain(event.segments[2].name);
    expect(sent).toContain(event.segments[3].name);
    expect(sent).toContain(event.segments[4].name);
    expect(sent).not.toContain(event.segments[6].name);
  });

  it('없는 순서를 지정하면 오류를 던진다', async () => {
    const event = createEventFromTemplate('semester-opening', init);
    await expect(regenerateOne(event, '없는id', null, {} as ClientDeps)).rejects.toThrow(
      '순서를 찾을 수 없습니다.',
    );
  });
});
