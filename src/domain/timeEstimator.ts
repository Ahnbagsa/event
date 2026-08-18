import type { AudioRole, Segment } from '../types';

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

export function estimateTotalSeconds(
  segments: Segment[],
  durationsByRole: Map<AudioRole, number>,
): number {
  return segments.reduce((sum, segment) => {
    const duration =
      segment.audioRole === null ? null : durationsByRole.get(segment.audioRole) ?? null;
    return sum + estimateSegmentSeconds(segment, duration);
  }, 0);
}
