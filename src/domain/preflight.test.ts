import { describe, it, expect } from 'vitest';
import { requiredAudioRoles, checkReadiness } from './preflight';
import { createEventFromTemplate } from './templates';
import type { AudioAsset, AudioRole } from '../types';

const init = {
  title: '개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

// 이제 checkReadiness는 역할 목록이 아니라 음원 자체를 받는다.
// 순서마다 다른 음원을 쓸 수 있어 역할만으로는 판단할 수 없기 때문이다.
function assetsFor(roles: AudioRole[]): AudioAsset[] {
  return roles.map((role) => ({
    id: 'a-' + role,
    role,
    label: role,
    data: new ArrayBuffer(8),
    mimeType: 'audio/mpeg',
    durationSec: 60,
    fileName: role + '.mp3',
    addedAt: 1,
    isDefault: true,
  }));
}

const allAudio = assetsFor(['pledge', 'anthem', 'silence', 'schoolSong']);

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
    expect(checkReadiness(event, allAudio).ok).toBe(true);
  });

  it('빈칸이 있으면 통과하지 못한다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}} 개학식';

    const result = checkReadiness(event, allAudio);
    expect(result.ok).toBe(false);
    expect(result.blanks[0].segmentName).toBe('개식사');
  });

  it('음원이 빠지면 통과하지 못하고 빠진 역할을 알려준다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    const partial = assetsFor(['pledge', 'anthem', 'silence']);

    const result = checkReadiness(event, partial);
    expect(result.ok).toBe(false);
    expect(result.missingAudioRoles).toEqual(['schoolSong']);
  });

  it('둘 다 문제면 둘 다 보고한다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}}';

    const result = checkReadiness(event, []);
    expect(result.blanks).toHaveLength(1);
    expect(result.missingAudioRoles).toHaveLength(4);
  });
});

// 순서마다 다른 음원을 쓸 수 있게 되면서 생긴 규칙들.
describe('순서마다 다른 음원을 쓸 때', () => {
  function anthemAsset(sourceId: string, isDefault = false): AudioAsset {
    return {
      id: sourceId, role: 'anthem', label: sourceId, data: new ArrayBuffer(8),
      mimeType: 'audio/mpeg', durationSec: 60, fileName: 'a.mp3', addedAt: 1,
      sourceId, isDefault,
    };
  }

  function eventPickingAnthem(sourceId: string | null) {
    const event = createEventFromTemplate('semester-opening', init);
    for (const segment of event.segments) {
      if (segment.audioRole === 'anthem') segment.audioSourceId = sourceId;
    }
    return event;
  }

  it('콕 집은 음원이 있으면 통과한다', () => {
    const event = eventPickingAnthem('lib:verse1-4');
    const assets = [
      ...assetsFor(['pledge', 'silence', 'schoolSong']),
      anthemAsset('lib:verse1-4'),
    ];
    expect(checkReadiness(event, assets).missingAudioRoles).toEqual([]);
  });

  // 휴대폰에는 그 음원이 없을 수 있다. 기본 음원으로 재생되므로 막지 않는다.
  it('콕 집은 음원이 없어도 기본 음원이 있으면 통과한다', () => {
    const event = eventPickingAnthem('lib:이기기에없음');
    const assets = [
      ...assetsFor(['pledge', 'silence', 'schoolSong']),
      anthemAsset('lib:다른것', true),
    ];
    expect(checkReadiness(event, assets).missingAudioRoles).toEqual([]);
  });

  it('되돌아갈 기본 음원조차 없으면 막는다', () => {
    const event = eventPickingAnthem('lib:이기기에없음');
    const assets = assetsFor(['pledge', 'silence', 'schoolSong']);
    expect(checkReadiness(event, assets).missingAudioRoles).toEqual(['anthem']);
  });
});
