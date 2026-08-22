import { assetForSegment } from '../audio/audioSource';
import type { AudioAsset, Segment } from '../types';

export const SPEAK_CHARS_PER_SEC = 4;
export const DEFAULT_TIMER_SEC = 60;
export const DEFAULT_ADDRESS_SEC = 180;

export function estimateScriptSeconds(script: string): number {
  const chars = script.replace(/\s/g, '').length;
  return Math.ceil(chars / SPEAK_CHARS_PER_SEC);
}

export function estimateSegmentSeconds(
  segment: Segment,
  audioDurationSec: number | null,
): number {
  const speaking = estimateScriptSeconds(segment.script);

  switch (segment.kind) {
    case 'address':
      return speaking + (segment.manualDurationSec ?? DEFAULT_ADDRESS_SEC);
    case 'timer':
      return speaking + (segment.timerSec ?? DEFAULT_TIMER_SEC);
    case 'audio':
      return speaking + (audioDurationSec ?? 0);
    case 'speech':
      return speaking;
  }
}

/**
 * 순서마다 실제로 쓸 음원의 길이로 더한다.
 *
 * 역할별 길이 하나로 계산하면 안 된다. 애국가 1절은 1분 9초, 1~4절은 3분 59초라
 * 어느 판본을 고르느냐에 따라 행사 시간이 3분 가까이 달라진다.
 */
export function estimateTotalSeconds(segments: Segment[], assets: AudioAsset[]): number {
  return segments.reduce((sum, segment) => {
    const asset = assetForSegment(assets, segment);
    return sum + estimateSegmentSeconds(segment, asset?.durationSec ?? null);
  }, 0);
}
