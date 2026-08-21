import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { EventCeremony } from '../types';

export const MAX_LINK_PAYLOAD = 8192;

export function encodeScenario(event: EventCeremony): string {
  const payload = compressToEncodedURIComponent(JSON.stringify(event));
  if (payload.length > MAX_LINK_PAYLOAD) {
    throw new Error(
      '시나리오가 너무 길어 링크로 보낼 수 없습니다. 멘트를 줄이거나 순서를 나눠 주세요.',
    );
  }
  return payload;
}

function looksLikeEvent(value: unknown): value is EventCeremony {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.segments)
  );
}

export function decodeScenario(payload: string): EventCeremony {
  const failure = new Error('시나리오를 읽을 수 없습니다. 링크가 잘린 것 같습니다.');
  if (payload === '') throw failure;

  const json = decompressFromEncodedURIComponent(payload);
  if (json === null || json === '') throw failure;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw failure;
  }

  if (!looksLikeEvent(parsed)) throw failure;
  return parsed;
}

export function buildShareUrl(
  event: EventCeremony,
  origin: string,
  pathname: string,
): string {
  return `${origin}${pathname}#/import?d=${encodeScenario(event)}`;
}
