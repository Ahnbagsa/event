import {
  findBlanksInEvent,
  findMalformedInEvent,
  type BlankHit,
  type MalformedHit,
} from './blanks';
import type { AudioRole, EventCeremony } from '../types';

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

export function checkReadiness(
  event: EventCeremony,
  availableRoles: Set<AudioRole>,
): PreflightResult {
  const blanks = findBlanksInEvent(event);
  const malformed = findMalformedInEvent(event);
  const missingAudioRoles = requiredAudioRoles(event).filter(
    (role) => !availableRoles.has(role),
  );
  return {
    blanks,
    malformed,
    missingAudioRoles,
    ok: blanks.length === 0 && malformed.length === 0 && missingAudioRoles.length === 0,
  };
}
