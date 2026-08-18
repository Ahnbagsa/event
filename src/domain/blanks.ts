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

// 온전한 {{빈칸}}을 걷어낸 뒤에도 중괄호가 남아 있으면 마커가 망가진 것이다.
// 예: AI 응답이 잘려 "{{교장 성함}"으로 끝났거나, 편집 중 중괄호 하나를 지웠거나,
// 모바일 자판이 전각 괄호(｛｝)를 넣은 경우. 이런 조각은 findBlanks가 못 잡으므로
// 점검을 그대로 통과해 행사 대본에 그대로 찍힌다.
const BRACE_LIKE = /[{}｛｝]/;

export function hasMalformedMarker(text: string): boolean {
  return BRACE_LIKE.test(text.replace(BLANK_PATTERN, ''));
}

export type MalformedHit = {
  segmentId: string;
  segmentName: string;
};

export function findMalformedInEvent(event: EventCeremony): MalformedHit[] {
  return event.segments
    .filter((segment) => hasMalformedMarker(segment.script))
    .map((segment) => ({ segmentId: segment.id, segmentName: segment.name }));
}
