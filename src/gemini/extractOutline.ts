import { generateText, type ClientDeps, type Part } from './client';
import { extractJson } from './jsonParser';
import { buildOutlineInstruction } from './prompts';
import type { SegmentSeed } from '../domain/templates';
import type { SchoolProfile, SegmentKind } from '../types';

export const OUTLINE_SCHEMA = {
  type: 'object',
  properties: {
    detectedEventType: { type: 'string' },
    title: { type: 'string' },
    date: { type: 'string' },
    place: { type: 'string' },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kind: { type: 'string', enum: ['speech', 'audio', 'timer', 'address'] },
          note: { type: 'string' },
        },
        required: ['name', 'kind'],
      },
    },
  },
  required: ['segments'],
};

export type OutlineResult = {
  detectedEventType: string | null;
  title: string | null;
  date: string | null;
  place: string | null;
  seeds: SegmentSeed[];
};

const PARSE_FAILURE = 'AI 응답을 이해할 수 없습니다. 다시 시도해 주세요.';

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function toKind(value: unknown): SegmentKind {
  return value === 'audio' || value === 'timer' || value === 'address' ? value : 'speech';
}

export function normalizeOutline(raw: unknown): OutlineResult {
  if (typeof raw !== 'object' || raw === null) throw new Error(PARSE_FAILURE);
  const source = raw as Record<string, unknown>;
  if (!Array.isArray(source.segments)) throw new Error(PARSE_FAILURE);

  const seeds: SegmentSeed[] = [];
  for (const entry of source.segments) {
    if (typeof entry !== 'object' || entry === null) continue;
    const item = entry as Record<string, unknown>;
    const name = readString(item, 'name');
    if (name === null) continue;

    const kind = toKind(item.kind);
    seeds.push({
      name,
      groupLabel: null,
      kind,
      script: '',
      audioRole: null,
      autoPlay: false,
      fadeOutSec: null,
      timerSec: kind === 'timer' ? 60 : null,
      manualDurationSec: kind === 'address' ? 180 : null,
      note: readString(item, 'note') ?? '',
    });
  }

  return {
    detectedEventType: readString(source, 'detectedEventType'),
    title: readString(source, 'title'),
    date: readString(source, 'date'),
    place: readString(source, 'place'),
    seeds,
  };
}

export async function extractOutline(
  input: { text: string; files: { mimeType: string; base64: string }[] },
  profile: SchoolProfile | null,
  deps: ClientDeps,
): Promise<OutlineResult> {
  const parts: Part[] = [];
  if (input.text.trim() !== '') parts.push({ text: input.text });
  for (const file of input.files) {
    parts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } });
  }
  if (parts.length === 0) {
    throw new Error('계획서 내용을 먼저 넣어 주세요.');
  }

  const result = await generateText(
    {
      systemInstruction: buildOutlineInstruction(profile),
      parts,
      responseSchema: OUTLINE_SCHEMA,
      temperature: 0.2,
    },
    deps,
  );

  return normalizeOutline(extractJson(result.text));
}
