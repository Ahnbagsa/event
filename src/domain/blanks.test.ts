import { describe, it, expect } from 'vitest';
import { findBlanks, findBlanksInEvent, countBlanks } from './blanks';
import { createEventFromTemplate } from './templates';

const init = {
  title: '개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

describe('findBlanks', () => {
  it('이중 중괄호 안의 이름을 뽑는다', () => {
    expect(findBlanks('{{교장 성함}} 선생님의 말씀')).toEqual(['교장 성함']);
  });

  it('여러 개를 순서대로 뽑는다', () => {
    expect(findBlanks('{{학교명}} {{교장 성함}}')).toEqual(['학교명', '교장 성함']);
  });

  it('앞뒤 공백을 없앤다', () => {
    expect(findBlanks('{{  교장 성함  }}')).toEqual(['교장 성함']);
  });

  it('빈칸이 없으면 빈 배열이다', () => {
    expect(findBlanks('평범한 문장입니다.')).toEqual([]);
  });

  it('중괄호 하나짜리는 빈칸이 아니다', () => {
    expect(findBlanks('{교장 성함}')).toEqual([]);
  });
});

describe('findBlanksInEvent', () => {
  it('빈칸이 있는 순서만 돌려준다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}} 개학식을 시작하겠습니다.';
    event.segments[1].script = '국기에 대하여 경례.';

    const hits = findBlanksInEvent(event);
    expect(hits).toHaveLength(1);
    expect(hits[0].segmentName).toBe('개식사');
    expect(hits[0].labels).toEqual(['학교명']);
  });

  it('빈칸 총 개수를 센다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}} {{교장 성함}}';
    event.segments[4].script = '{{교장 성함}}';
    expect(countBlanks(event)).toBe(3);
  });

  it('빈칸이 하나도 없으면 0이다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(countBlanks(event)).toBe(0);
  });
});
