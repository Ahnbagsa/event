import type { EventCeremony } from '../types';

const BLANK_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function findBlanks(text: string): string[] {
  return Array.from(text.matchAll(BLANK_PATTERN), (match) => match[1]);
}

export type BlankHit = {
  segmentId: string;
  segmentName: string;
  labels: string[];
};

export function findBlanksInEvent(event: EventCeremony): BlankHit[] {
  return event.segments
    .map((segment) => ({
      segmentId: segment.id,
      segmentName: segment.name,
      labels: findBlanks(segment.script),
    }))
    .filter((hit) => hit.labels.length > 0);
}

export function countBlanks(event: EventCeremony): number {
  return findBlanksInEvent(event).reduce((sum, hit) => sum + hit.labels.length, 0);
}
