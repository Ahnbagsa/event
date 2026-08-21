import { describe, it, expect } from 'vitest';
import { createEventFromSeeds } from './index';
import type { SegmentSeed } from './index';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

const seeds: SegmentSeed[] = [
  {
    name: '개식사',
    groupLabel: null,
    kind: 'speech',
    script: '',
    audioRole: null,
    autoPlay: false,
    fadeOutSec: null,
    timerSec: null,
    manualDurationSec: null,
    note: '',
  },
];

describe('createEventFromSeeds', () => {
  it('주어진 순서로 행사를 만든다', () => {
    const event = createEventFromSeeds(seeds, init);
    expect(event.segments).toHaveLength(1);
    expect(event.segments[0].name).toBe('개식사');
    expect(event.segments[0].order).toBe(0);
  });

  it('templateId를 custom으로 표시한다', () => {
    expect(createEventFromSeeds(seeds, init).templateId).toBe('custom');
  });

  it('빈 목록도 허용한다', () => {
    expect(createEventFromSeeds([], init).segments).toEqual([]);
  });
});
