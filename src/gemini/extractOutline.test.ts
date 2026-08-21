import { describe, it, expect, vi } from 'vitest';
import { normalizeOutline, extractOutline } from './extractOutline';
import type { ClientDeps, GenerateInput } from './client';

const fakeDeps = {} as ClientDeps;

// 인자 타입을 명시해야 mock.calls[0][0]이 tsc --noEmit을 통과한다.
const generateTextMock = vi.fn((_input: GenerateInput, _deps: ClientDeps) =>
  Promise.resolve({ text: '{"segments":[]}', modelUsed: 'models/x', modelChanged: false }),
);

// vi.doMock은 이미 정적 import된 모듈에는 먹지 않는다. 호이스팅되는 vi.mock으로 바꾼다.
// 팩토리는 위 const보다 먼저 실행되지만, 화살표 함수 안에서만 참조하므로 호출 시점에는
// 이미 초기화되어 있다.
vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof import('./client')>('./client');
  return {
    ...actual,
    generateText: (input: GenerateInput, deps: ClientDeps) => generateTextMock(input, deps),
  };
});

describe('normalizeOutline', () => {
  it('정상 응답을 그대로 옮긴다', () => {
    const result = normalizeOutline({
      detectedEventType: 'semester-opening',
      title: '2학기 개학식',
      date: '2026-08-18',
      place: '각 교실',
      segments: [
        { name: '개식사', kind: 'speech', note: '' },
        { name: '애국가 제창', kind: 'audio', note: '1절' },
      ],
    });

    expect(result.title).toBe('2학기 개학식');
    expect(result.seeds).toHaveLength(2);
    expect(result.seeds[1].name).toBe('애국가 제창');
    expect(result.seeds[1].note).toBe('1절');
  });

  it('새 순서의 멘트는 비워 둔다', () => {
    const result = normalizeOutline({ segments: [{ name: '개식사', kind: 'speech' }] });
    expect(result.seeds[0].script).toBe('');
  });

  it('모르는 종류는 speech로 본다', () => {
    const result = normalizeOutline({ segments: [{ name: '무언가', kind: '이상한값' }] });
    expect(result.seeds[0].kind).toBe('speech');
  });

  it('이름이 없는 순서는 버린다', () => {
    const result = normalizeOutline({
      segments: [{ kind: 'speech' }, { name: '개식사', kind: 'speech' }],
    });
    expect(result.seeds).toHaveLength(1);
  });

  it('식순을 못 찾으면 빈 목록을 돌려준다', () => {
    const result = normalizeOutline({ detectedEventType: 'semester-opening', segments: [] });
    expect(result.seeds).toEqual([]);
    expect(result.detectedEventType).toBe('semester-opening');
  });

  it('segments가 배열이 아니면 오류를 던진다', () => {
    expect(() => normalizeOutline({ segments: '아님' })).toThrow('AI 응답을 이해할 수 없습니다.');
  });

  it('객체가 아니면 오류를 던진다', () => {
    expect(() => normalizeOutline('문자열')).toThrow('AI 응답을 이해할 수 없습니다.');
  });

  it('묵념은 타이머로 만들고 60초를 기본으로 준다', () => {
    const result = normalizeOutline({
      segments: [{ name: '순국선열에 대한 묵념', kind: 'timer' }],
    });
    expect(result.seeds[0].kind).toBe('timer');
    expect(result.seeds[0].timerSec).toBe(60);
  });

  it('말씀 순서에는 기본 3분을 준다', () => {
    const result = normalizeOutline({ segments: [{ name: '학교장 말씀', kind: 'address' }] });
    expect(result.seeds[0].manualDurationSec).toBe(180);
  });
});

describe('extractOutline', () => {
  it('텍스트와 첨부를 함께 보낸다', async () => {
    generateTextMock.mockClear();
    generateTextMock.mockResolvedValue({
      text: '{"segments":[{"name":"개식사","kind":"speech"}]}',
      modelUsed: 'models/x',
      modelChanged: false,
    });

    const result = await extractOutline(
      { text: '개학식 계획서', files: [{ mimeType: 'application/pdf', base64: 'AAA' }] },
      null,
      fakeDeps,
    );

    expect(result.seeds).toHaveLength(1);
    const sentParts = generateTextMock.mock.calls[0][0].parts;
    expect(sentParts).toContainEqual({ text: '개학식 계획서' });
    expect(sentParts).toContainEqual({
      inlineData: { mimeType: 'application/pdf', data: 'AAA' },
    });
  });

  it('넣은 내용이 없으면 호출하지 않고 안내한다', async () => {
    generateTextMock.mockClear();

    await expect(extractOutline({ text: '   ', files: [] }, null, fakeDeps)).rejects.toThrow(
      '계획서 내용을 먼저 넣어 주세요.',
    );
    expect(generateTextMock).not.toHaveBeenCalled();
  });
});
