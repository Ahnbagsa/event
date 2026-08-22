import {
  findBlanksInEvent,
  findMalformedInEvent,
  type BlankHit,
  type MalformedHit,
} from './blanks';
import { assetForSegment } from '../audio/audioSource';
import type { AudioAsset, AudioRole, EventCeremony } from '../types';

export function requiredAudioRoles(event: EventCeremony): AudioRole[] {
  const roles: AudioRole[] = [];
  for (const segment of event.segments) {
    if (segment.audioRole !== null && !roles.includes(segment.audioRole)) {
      roles.push(segment.audioRole);
    }
  }
  return roles;
}

export type PreflightResult = {
  blanks: BlankHit[];
  malformed: MalformedHit[];
  missingAudioRoles: AudioRole[];
  ok: boolean;
};

/**
 * 행사를 시작해도 되는지 본다.
 *
 * 음원은 **순서 단위**로 본다. 순서마다 다른 음원을 쓸 수 있게 되었으므로,
 * "그 역할의 음원이 기기에 있는가"만으로는 부족하다. 다만 순서가 콕 집어 가리킨
 * 음원이 없어도 역할의 기본 음원으로 되돌아가 재생되므로, 되돌아갈 곳까지
 * 없을 때만 모자란 것으로 센다.
 */
export function checkReadiness(
  event: EventCeremony,
  assets: AudioAsset[],
): PreflightResult {
  const blanks = findBlanksInEvent(event);
  const malformed = findMalformedInEvent(event);

  const missingAudioRoles: AudioRole[] = [];
  for (const segment of event.segments) {
    if (segment.audioRole === null) continue;
    if (missingAudioRoles.includes(segment.audioRole)) continue;
    if (assetForSegment(assets, segment) === null) missingAudioRoles.push(segment.audioRole);
  }

  return {
    blanks,
    malformed,
    missingAudioRoles,
    ok: blanks.length === 0 && malformed.length === 0 && missingAudioRoles.length === 0,
  };
}
