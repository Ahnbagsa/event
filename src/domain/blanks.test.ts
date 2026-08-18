import { describe, it, expect } from 'vitest';
import {
  findBlanks,
  findBlanksInEvent,
  countBlanks,
  hasMalformedMarker,
  findMalformedInEvent,
} from './blanks';
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

describe('hasMalformedMarker', () => {
  it('온전한 마커만 있으면 망가진 것으로 보지 않는다', () => {
    expect(hasMalformedMarker('{{교장 성함}} 말씀')).toBe(false);
  });

  it('닫는 중괄호가 하나면 잡아낸다', () => {
    expect(hasMalformedMarker('{{교장 성함}')).toBe(true);
  });

  it('여는 중괄호가 하나여도 잡아낸다', () => {
    expect(hasMalformedMarker('{교장 성함}}')).toBe(true);
  });

  it('전각 괄호도 잡아낸다', () => {
    expect(hasMalformedMarker('｛｛교장 성함｝｝')).toBe(true);
  });

  it('중괄호가 없으면 통과한다', () => {
    expect(hasMalformedMarker('평범한 문장입니다.')).toBe(false);
  });
});

describe('findMalformedInEvent', () => {
  it('망가진 마커가 있는 순서만 순서명과 함께 돌려준다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}} 개학식을 시작하겠습니다.';
    event.segments[1].script = '{{교장 성함} 선생님을 모십니다.';

    const hits = findMalformedInEvent(event);
    expect(hits).toHaveLength(1);
    expect(hits[0].segmentName).toBe('국기에 대한 경례');
  });

  it('망가진 곳이 없으면 빈 배열이다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}} 개학식을 시작하겠습니다.';
    expect(findMalformedInEvent(event)).toEqual([]);
  });
});
