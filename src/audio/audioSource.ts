import type { AudioAsset, AudioRole, EventCeremony, Segment } from '../types';

/**
 * 음원에 붙이는 이름표. 기기가 바뀌어도 같은 값이어야 한다.
 *
 * 순서가 기기 안의 음원 번호를 가리키면, 공유 링크로 휴대폰에 옮겼을 때
 * 그 번호가 그쪽 기기에 없다. 공용 목록에서 온 음원은 어느 기기에서나
 * 같은 이름표를 갖도록 목록의 id를 쓴다.
 */
export function libSourceId(trackId: string): string {
  return `lib:${trackId}`;
}

/** 직접 올린 파일은 이 기기 안에서만 통한다. 다른 기기에서는 기본 음원으로 되돌아간다. */
export function uploadSourceId(assetId: string): string {
  return `up:${assetId}`;
}

/**
 * 이 음원의 이름표. 예전에 저장해 둔 자료에는 sourceId 칸이 아예 없으므로
 * 그때는 기기 안 번호로 하나 만들어 준다. 그래야 예전 음원도 순서에서 고를 수 있다.
 */
export function sourceIdOf(asset: AudioAsset): string {
  return asset.sourceId ?? uploadSourceId(asset.id);
}

/**
 * 그 역할의 기본 음원. 설정에서 마지막으로 고른 것이다.
 *
 * 예전에 저장해 둔 자료에는 isDefault 칸이 아예 없다. 그때는 가장 최근에
 * 넣은 것을 기본으로 본다. 마이그레이션 없이 예전 자료가 그대로 열려야 하기 때문이다.
 */
export function defaultAssetForRole(assets: AudioAsset[], role: AudioRole): AudioAsset | null {
  const ofRole = assets.filter((asset) => asset.role === role);
  if (ofRole.length === 0) return null;

  const marked = ofRole.find((asset) => asset.isDefault === true);
  if (marked !== undefined) return marked;

  return ofRole.reduce((latest, asset) => (asset.addedAt > latest.addedAt ? asset : latest));
}

/**
 * 이 순서에 실제로 쓸 음원.
 *
 * 순서가 특정 음원을 가리키면 그것을 쓰되, **못 찾으면 반드시 역할의 기본 음원으로
 * 되돌아간다.** 휴대폰에는 그 음원이 없을 수 있는데, 여기서 없다고 해 버리면
 * 행사 당일 아무 소리도 나지 않는다.
 */
export function assetForSegment(assets: AudioAsset[], segment: Segment): AudioAsset | null {
  if (segment.audioRole === null) return null;

  if (segment.audioSourceId !== null) {
    const picked = assets.find(
      (asset) => sourceIdOf(asset) === segment.audioSourceId && asset.role === segment.audioRole,
    );
    if (picked !== undefined) return picked;
  }

  return defaultAssetForRole(assets, segment.audioRole);
}

/** 어떤 행사가 콕 집어 가리키고 있는 이름표들. 서랍에서 안 쓰는 음원을 알려주는 데 쓴다. */
export function usedSourceIds(events: EventCeremony[]): Set<string> {
  const used = new Set<string>();
  for (const event of events) {
    for (const segment of event.segments) {
      if (segment.audioRole === null || segment.audioSourceId === null) continue;
      used.add(segment.audioSourceId);
    }
  }
  return used;
}
