import { describe, it, expect } from 'vitest';
import {
  libSourceId,
  uploadSourceId,
  defaultAssetForRole,
  assetForSegment,
  usedSourceIds,
  sourceIdOf,
  pickedSourceId,
} from './audioSource';
import type { AudioAsset, AudioRole, EventCeremony, Segment } from '../types';

function asset(over: Partial<AudioAsset> & { id: string; role: AudioRole }): AudioAsset {
  return {
    label: over.id,
    data: new ArrayBuffer(8),
    mimeType: 'audio/mpeg',
    durationSec: 60,
    fileName: over.id + '.mp3',
    addedAt: 1,
    ...over,
  };
}

function segment(over: Partial<Segment> = {}): Segment {
  return {
    id: 'seg1',
    order: 0,
    name: '애국가 제창',
    groupLabel: null,
    kind: 'audio',
    script: '',
    audioRole: 'anthem',
    audioSourceId: null,
    autoPlay: false,
    fadeOutSec: null,
    timerSec: null,
    manualDurationSec: null,
    note: '',
    ...over,
  };
}

describe('이름표', () => {
  it('공용 목록에서 온 것과 직접 올린 것을 구별한다', () => {
    expect(libSourceId('17-2-anthem-verse1')).toBe('lib:17-2-anthem-verse1');
    expect(uploadSourceId('audio_abc')).toBe('up:audio_abc');
  });

  it('서로 겹치지 않는다', () => {
    expect(libSourceId('x')).not.toBe(uploadSourceId('x'));
  });
});

describe('defaultAssetForRole', () => {
  it('기본으로 표시된 것을 고른다', () => {
    const assets = [
      asset({ id: 'a', role: 'anthem', addedAt: 9 }),
      asset({ id: 'b', role: 'anthem', addedAt: 1, isDefault: true }),
    ];
    expect(defaultAssetForRole(assets, 'anthem')?.id).toBe('b');
  });

  // 예전에 저장해 둔 자료에는 isDefault 칸이 아예 없다. 마이그레이션 없이 열려야 한다.
  it('표시가 하나도 없으면 가장 최근에 넣은 것을 쓴다', () => {
    const assets = [
      asset({ id: 'old', role: 'anthem', addedAt: 1 }),
      asset({ id: 'new', role: 'anthem', addedAt: 9 }),
    ];
    expect(defaultAssetForRole(assets, 'anthem')?.id).toBe('new');
  });

  it('그 역할의 음원이 없으면 없다고 한다', () => {
    expect(defaultAssetForRole([asset({ id: 'a', role: 'pledge' })], 'anthem')).toBeNull();
  });

  it('다른 역할의 기본을 잘못 집어오지 않는다', () => {
    const assets = [asset({ id: 'p', role: 'pledge', isDefault: true })];
    expect(defaultAssetForRole(assets, 'anthem')).toBeNull();
  });
});

describe('assetForSegment', () => {
  const verse1 = asset({ id: 'a1', role: 'anthem', sourceId: 'lib:17-2-anthem-verse1' });
  const verse14 = asset({ id: 'a2', role: 'anthem', sourceId: 'lib:17-2-anthem-verse1-4' });
  const assets = [verse1, { ...verse14, isDefault: true }];

  it('음원이 붙지 않은 순서는 없다고 한다', () => {
    expect(assetForSegment(assets, segment({ audioRole: null }))).toBeNull();
  });

  it('가리키는 것이 없으면 역할의 기본 음원을 쓴다', () => {
    expect(assetForSegment(assets, segment({ audioSourceId: null }))?.id).toBe('a2');
  });

  it('가리키는 것이 있으면 그것을 쓴다', () => {
    const picked = segment({ audioSourceId: 'lib:17-2-anthem-verse1' });
    expect(assetForSegment(assets, picked)?.id).toBe('a1');
  });

  // 공유 링크로 휴대폰에 옮기면 그 음원이 그쪽 기기에 없을 수 있다.
  // 여기서 없다고 해 버리면 행사 당일 아무 소리도 안 난다.
  it('가리키는 음원이 이 기기에 없으면 기본 음원으로 되돌아간다', () => {
    const picked = segment({ audioSourceId: 'lib:없는음원' });
    expect(assetForSegment(assets, picked)?.id).toBe('a2');
  });

  it('되돌아갈 기본 음원조차 없으면 없다고 한다', () => {
    const picked = segment({ audioSourceId: 'lib:없는음원' });
    expect(assetForSegment([], picked)).toBeNull();
  });

  // 이름표는 같아도 역할이 다르면 남의 음원이다.
  it('역할이 다른 음원은 이름표가 맞아도 쓰지 않는다', () => {
    const wrongRole = [asset({ id: 'p', role: 'pledge', sourceId: 'lib:같은이름표' })];
    const picked = segment({ audioRole: 'anthem', audioSourceId: 'lib:같은이름표' });
    expect(assetForSegment(wrongRole, picked)).toBeNull();
  });

  it('직접 올린 음원도 가리킬 수 있다', () => {
    const own = asset({ id: 'u1', role: 'entrance', sourceId: 'up:audio_x' });
    const other = asset({ id: 'u2', role: 'entrance', sourceId: 'up:audio_y', isDefault: true });
    const picked = segment({ audioRole: 'entrance', audioSourceId: 'up:audio_x' });
    expect(assetForSegment([own, other], picked)?.id).toBe('u1');
  });
});

describe('usedSourceIds', () => {
  function event(segments: Segment[]): EventCeremony {
    return {
      id: 'e1', title: '개학식', templateId: 't', date: '2026-08-22', place: '강당',
      mode: 'inPerson', audience: 'all', tone: 'formal', targetMinutes: null,
      segments, createdAt: 1, updatedAt: 1,
    };
  }

  it('행사들이 가리키는 이름표를 모은다', () => {
    const events = [
      event([segment({ audioSourceId: 'lib:a' }), segment({ audioSourceId: null })]),
      event([segment({ audioSourceId: 'lib:b' })]),
    ];
    expect(usedSourceIds(events)).toEqual(new Set(['lib:a', 'lib:b']));
  });

  it('아무 행사도 없으면 빈 집합이다', () => {
    expect(usedSourceIds([])).toEqual(new Set());
  });

  // 음원이 떨어진 순서가 남긴 이름표는 세지 않는다.
  it('음원이 붙지 않은 순서의 이름표는 세지 않는다', () => {
    const events = [event([segment({ audioRole: null, audioSourceId: 'lib:a' })])];
    expect(usedSourceIds(events)).toEqual(new Set());
  });
});

// 예전에 저장해 둔 음원에는 sourceId 칸이 아예 없다. 마이그레이션 없이
// 그것들도 순서에서 고를 수 있어야 한다.
describe('이름표가 없는 예전 음원', () => {
  it('기기 안 번호로 이름표를 만들어 준다', () => {
    expect(sourceIdOf(asset({ id: 'audio_old', role: 'anthem' }))).toBe('up:audio_old');
  });

  it('sourceId가 있으면 그것을 그대로 쓴다', () => {
    const a = asset({ id: 'x', role: 'anthem', sourceId: 'lib:17-2-anthem-verse1' });
    expect(sourceIdOf(a)).toBe('lib:17-2-anthem-verse1');
  });

  it('만들어 준 이름표로도 순서에서 고를 수 있다', () => {
    const old = asset({ id: 'audio_old', role: 'anthem' });
    const other = asset({ id: 'other', role: 'anthem', isDefault: true });
    const picked = segment({ audioSourceId: 'up:audio_old' });
    expect(assetForSegment([old, other], picked)?.id).toBe('audio_old');
  });
});

// 실제로 겪은 일이다. 예전에 저장해 둔 순서에는 audioSourceId 칸이 아예 없어
// undefined다. 타입은 string | null 이지만 저장된 옛 자료는 그 약속을 지키지 않는다.
// !== null 로만 거르면 undefined가 "골랐다"로 통과해, 고른 적도 없는데
// "고르신 음원이 이 기기에 없습니다" 경고가 떴다.
describe('audioSourceId 칸이 없는 예전 순서', () => {
  function legacySegment(): Segment {
    const s = segment();
    delete (s as { audioSourceId?: unknown }).audioSourceId;
    return s;
  }

  it('고른 것이 없는 것으로 본다', () => {
    expect(pickedSourceId(legacySegment())).toBeNull();
  });

  it('역할의 기본 음원을 그대로 쓴다', () => {
    const assets = [
      asset({ id: 'a1', role: 'anthem', sourceId: 'lib:v1' }),
      asset({ id: 'a2', role: 'anthem', sourceId: 'lib:v1-4', isDefault: true }),
    ];
    expect(assetForSegment(assets, legacySegment())?.id).toBe('a2');
  });

  it('안 쓰는 음원 계산에서도 세지 않는다', () => {
    const event: EventCeremony = {
      id: 'e1', title: '개학식', templateId: 't', date: '2026-08-22', place: '강당',
      mode: 'inPerson', audience: 'all', tone: 'formal', targetMinutes: null,
      segments: [legacySegment()], createdAt: 1, updatedAt: 1,
    };
    expect(usedSourceIds([event])).toEqual(new Set());
  });
});

// 실제로 겪은 일이다. 예전 자료에는 isDefault 칸이 없어서 "표시가 없으면 가장 최근 것"
// 규칙을 쓰는데, 한 행사에서만 쓰려고 새로 받은 음원이 가장 최근이 되어 버린다.
// 그러면 기본을 건드리지 않겠다는 약속이 예전 자료 앞에서 깨진다.
describe('기본이 아니라고 못 박은 음원', () => {
  it('가장 최근이어도 기본을 빼앗지 않는다', () => {
    const assets = [
      asset({ id: '예전것', role: 'anthem', addedAt: 1 }),
      asset({ id: '방금받음', role: 'anthem', addedAt: 99, isDefault: false }),
    ];
    expect(defaultAssetForRole(assets, 'anthem')?.id).toBe('예전것');
  });

  it('기본으로 표시된 것이 있으면 그것이 이긴다', () => {
    const assets = [
      asset({ id: '예전것', role: 'anthem', addedAt: 1 }),
      asset({ id: '정한것', role: 'anthem', addedAt: 5, isDefault: true }),
      asset({ id: '방금받음', role: 'anthem', addedAt: 99, isDefault: false }),
    ];
    expect(defaultAssetForRole(assets, 'anthem')?.id).toBe('정한것');
  });

  // 전부 아니라고 표시되어 있어도 재생할 것은 있어야 한다.
  it('전부 아니라고 표시되어 있으면 그중 최근 것을 쓴다', () => {
    const assets = [
      asset({ id: 'a', role: 'anthem', addedAt: 1, isDefault: false }),
      asset({ id: 'b', role: 'anthem', addedAt: 9, isDefault: false }),
    ];
    expect(defaultAssetForRole(assets, 'anthem')?.id).toBe('b');
  });
});
