import { describe, it, expect } from 'vitest';
import { requiredAudioRoles, checkReadiness } from './preflight';
import { createEventFromTemplate } from './templates';
import type { AudioRole } from '../types';

const init = {
  title: '개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

const allRoles = new Set<AudioRole>(['pledge', 'anthem', 'silence', 'schoolSong']);

describe('requiredAudioRoles', () => {
  it('시나리오가 쓰는 역할을 중복 없이 모은다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(requiredAudioRoles(event)).toEqual(['pledge', 'anthem', 'silence', 'schoolSong']);
  });

  it('음원을 쓰지 않는 행사는 빈 배열이다', () => {
    expect(requiredAudioRoles(createEventFromTemplate('blank', init))).toEqual([]);
  });
});

describe('checkReadiness', () => {
  it('빈칸도 없고 음원도 다 있으면 통과다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(checkReadiness(event, allRoles).ok).toBe(true);
  });

  it('빈칸이 있으면 통과하지 못한다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}} 개학식';

    const result = checkReadiness(event, allRoles);
    expect(result.ok).toBe(false);
    expect(result.blanks[0].segmentName).toBe('개식사');
  });

  it('음원이 빠지면 통과하지 못하고 빠진 역할을 알려준다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    const partial = new Set<AudioRole>(['pledge', 'anthem', 'silence']);

    const result = checkReadiness(event, partial);
    expect(result.ok).toBe(false);
    expect(result.missingAudioRoles).toEqual(['schoolSong']);
  });

  it('둘 다 문제면 둘 다 보고한다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}}';

    const result = checkReadiness(event, new Set());
    expect(result.blanks).toHaveLength(1);
    expect(result.missingAudioRoles).toHaveLength(4);
  });
});
