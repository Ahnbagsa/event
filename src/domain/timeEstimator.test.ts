import { describe, it, expect } from 'vitest';
import {
  SPEAK_CHARS_PER_SEC,
  estimateScriptSeconds,
  estimateSegmentSeconds,
  estimateTotalSeconds,
} from './timeEstimator';
import type { AudioRole, Segment } from '../types';

function seg(partial: Partial<Segment>): Segment {
  return {
    id: 's1',
    order: 0,
    name: '순서',
    groupLabel: null,
    kind: 'speech',
    script: '',
    audioRole: null,
    autoPlay: false,
    fadeOutSec: null,
    timerSec: null,
    manualDurationSec: null,
    note: '',
    ...partial,
  };
}

describe('estimateScriptSeconds', () => {
  it('초당 4자로 계산한다', () => {
    expect(SPEAK_CHARS_PER_SEC).toBe(4);
    expect(estimateScriptSeconds('가나다라마사')).toBe(2);
  });

  it('공백은 글자 수에서 뺀다', () => {
    expect(estimateScriptSeconds('가 나 다 라')).toBe(1);
  });

  it('빈 멘트는 0초다', () => {
    expect(estimateScriptSeconds('')).toBe(0);
  });

  it('나머지가 있으면 올림한다', () => {
    expect(estimateScriptSeconds('가나다라마')).toBe(2);
  });
});

describe('estimateSegmentSeconds', () => {
  it('멘트만 있는 순서는 낭독 시간만 센다', () => {
    expect(estimateSegmentSeconds(seg({ script: '가나다라' }), null)).toBe(1);
  });

  it('음원 순서는 멘트 + 음원 길이다', () => {
    const segment = seg({ kind: 'audio', script: '가나다라', audioRole: 'anthem' });
    expect(estimateSegmentSeconds(segment, 200)).toBe(201);
  });

  it('음원이 등록되지 않았으면 음원 시간을 0으로 본다', () => {
    const segment = seg({ kind: 'audio', script: '가나다라', audioRole: 'anthem' });
    expect(estimateSegmentSeconds(segment, null)).toBe(1);
  });

  it('타이머 순서는 멘트 + 타이머 시간이다', () => {
    const segment = seg({ kind: 'timer', script: '가나다라', timerSec: 60 });
    expect(estimateSegmentSeconds(segment, null)).toBe(61);
  });

  it('타이머 시간이 없으면 60초로 본다', () => {
    expect(estimateSegmentSeconds(seg({ kind: 'timer' }), null)).toBe(60);
  });

  it('말씀 순서는 멘트 + 지정한 시간이다', () => {
    const segment = seg({ kind: 'address', script: '가나다라', manualDurationSec: 180 });
    expect(estimateSegmentSeconds(segment, null)).toBe(181);
  });

  it('말씀 시간이 없으면 180초로 본다', () => {
    expect(estimateSegmentSeconds(seg({ kind: 'address' }), null)).toBe(180);
  });
});

describe('estimateTotalSeconds', () => {
  it('음원 길이를 역할로 찾아 합산한다', () => {
    const segments = [
      seg({ id: 's1', kind: 'audio', audioRole: 'anthem' }),
      seg({ id: 's2', kind: 'address', manualDurationSec: 120 }),
    ];
    const durations = new Map<AudioRole, number>([['anthem', 200]]);
    expect(estimateTotalSeconds(segments, durations)).toBe(320);
  });

  it('순서가 없으면 0초다', () => {
    expect(estimateTotalSeconds([], new Map())).toBe(0);
  });
});
