import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { newId } from '../lib/id';
import type {
  AudioRole,
  EventAudience,
  EventCeremony,
  EventMode,
  EventTone,
  Segment,
  SegmentKind,
} from '../types';

export const MAX_LINK_PAYLOAD = 8192;

// 자리로 뜻을 정한다. 순서를 바꾸면 옛 링크가 깨지므로 뒤에만 덧붙인다.
const MODES: EventMode[] = ['inPerson', 'broadcast'];
const AUDIENCES: EventAudience[] = ['lower', 'upper', 'all', 'withParents'];
const TONES: EventTone[] = ['formal', 'warm', 'concise'];
const KINDS: SegmentKind[] = ['speech', 'audio', 'timer', 'address'];
const ROLES: AudioRole[] = [
  'pledge', 'anthem', 'silence', 'schoolSong', 'entrance', 'exit', 'award',
];

const FAILURE = '시나리오를 읽을 수 없습니다. 링크가 잘린 것 같습니다.';

type Extra = {
  r?: number | string;
  a?: 1;
  t?: number;
  m?: number;
  f?: number;
  g?: string;
  n?: string;
};

function packSegment(segment: Segment): unknown[] {
  const row: unknown[] = [segment.name, KINDS.indexOf(segment.kind), segment.script];
  const extra: Extra = {};

  if (segment.audioRole !== null) {
    const index = ROLES.indexOf(segment.audioRole);
    extra.r = index === -1 ? segment.audioRole : index;
  }
  if (segment.autoPlay) extra.a = 1;
  if (segment.timerSec !== null) extra.t = segment.timerSec;
  if (segment.manualDurationSec !== null) extra.m = segment.manualDurationSec;
  if (segment.fadeOutSec !== null) extra.f = segment.fadeOutSec;
  if (segment.groupLabel !== null) extra.g = segment.groupLabel;
  if (segment.note !== '') extra.n = segment.note;

  if (Object.keys(extra).length > 0) row.push(extra);
  return row;
}

export function encodeScenario(event: EventCeremony): string {
  const packed: unknown[] = [
    2,
    event.title,
    event.templateId,
    event.date,
    event.place,
    MODES.indexOf(event.mode),
    AUDIENCES.indexOf(event.audience),
    TONES.indexOf(event.tone),
    event.targetMinutes,
    event.segments.map(packSegment),
  ];

  const payload = compressToEncodedURIComponent(JSON.stringify(packed));
  if (payload.length > MAX_LINK_PAYLOAD) {
    throw new Error(
      '시나리오가 너무 길어 링크로 보낼 수 없습니다. 멘트를 줄이거나 순서를 나눠 주세요.',
    );
  }
  return payload;
}

function pickString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function pickFromList<T>(list: T[], value: unknown, fallback: T): T {
  return typeof value === 'number' && value >= 0 && value < list.length ? list[value] : fallback;
}

function pickNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function unpackRole(value: unknown): AudioRole | null {
  if (typeof value === 'string') return value as AudioRole;
  if (typeof value === 'number' && value >= 0 && value < ROLES.length) return ROLES[value];
  return null;
}

function unpackSegment(row: unknown, order: number): Segment | null {
  if (!Array.isArray(row) || typeof row[0] !== 'string') return null;
  const extra = (typeof row[3] === 'object' && row[3] !== null ? row[3] : {}) as Extra;

  return {
    id: newId('seg'),
    order,
    name: row[0],
    groupLabel: typeof extra.g === 'string' ? extra.g : null,
    kind: pickFromList(KINDS, row[1], 'speech'),
    script: pickString(row[2], ''),
    audioRole: unpackRole(extra.r),
    autoPlay: extra.a === 1,
    fadeOutSec: pickNumberOrNull(extra.f),
    timerSec: pickNumberOrNull(extra.t),
    manualDurationSec: pickNumberOrNull(extra.m),
    note: typeof extra.n === 'string' ? extra.n : '',
  };
}

function unpackV2(packed: unknown[]): EventCeremony {
  if (packed.length < 10 || !Array.isArray(packed[9])) throw new Error(FAILURE);

  const segments: Segment[] = [];
  for (const row of packed[9]) {
    const segment = unpackSegment(row, segments.length);
    if (segment !== null) segments.push(segment);
  }

  const now = Date.now();
  return {
    id: newId('event'),
    title: pickString(packed[1], '가져온 행사'),
    templateId: pickString(packed[2], 'custom'),
    date: pickString(packed[3], ''),
    place: pickString(packed[4], ''),
    mode: pickFromList(MODES, packed[5], 'inPerson'),
    audience: pickFromList(AUDIENCES, packed[6], 'all'),
    tone: pickFromList(TONES, packed[7], 'formal'),
    targetMinutes: pickNumberOrNull(packed[8]),
    segments,
    createdAt: now,
    updatedAt: now,
  };
}

// 계획서 2에서 쓰던 형식. 이미 내보낸 링크가 있으므로 계속 읽을 수 있어야 한다.
function looksLikeV1(value: unknown): value is EventCeremony {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.segments)
  );
}

export function decodeScenario(payload: string): EventCeremony {
  const failure = new Error(FAILURE);
  if (payload === '') throw failure;

  const json = decompressFromEncodedURIComponent(payload);
  if (json === null || json === '') throw failure;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw failure;
  }

  if (Array.isArray(parsed) && parsed[0] === 2) return unpackV2(parsed);
  if (looksLikeV1(parsed)) return parsed;
  throw failure;
}

export function buildShareUrl(
  event: EventCeremony,
  origin: string,
  pathname: string,
): string {
  return `${origin}${pathname}#/import?d=${encodeScenario(event)}`;
}
