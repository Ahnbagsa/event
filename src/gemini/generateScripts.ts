import { generateText, type ClientDeps } from './client';
import { extractJson } from './jsonParser';
import { buildScriptInstruction } from './prompts';
import type { EventCeremony, SchoolProfile, Segment } from '../types';

export const SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          script: { type: 'string' },
        },
        required: ['id', 'script'],
      },
    },
  },
  required: ['segments'],
};

const PARSE_FAILURE = 'AI 응답을 이해할 수 없습니다. 다시 시도해 주세요.';

export function applyScripts(segments: Segment[], raw: unknown): Segment[] {
  if (typeof raw !== 'object' || raw === null) throw new Error(PARSE_FAILURE);
  const list = (raw as Record<string, unknown>).segments;
  if (!Array.isArray(list)) throw new Error(PARSE_FAILURE);

  const byId = new Map<string, string>();
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.id === 'string' && typeof item.script === 'string') {
      byId.set(item.id, item.script);
    }
  }

  return segments.map((segment) => {
    const script = byId.get(segment.id);
    return script === undefined ? segment : { ...segment, script };
  });
}

function describeSegments(segments: Segment[]): string {
  return segments
    .map((segment, index) => {
      const parts = [`${index + 1}. id=${segment.id} / 순서명=${segment.name} / kind=${segment.kind}`];
      if (segment.note !== '') parts.push(`   메모: ${segment.note}`);
      if (segment.script !== '') parts.push(`   현재 멘트: ${segment.script}`);
      return parts.join('\n');
    })
    .join('\n');
}

export async function generateScripts(
  event: EventCeremony,
  profile: SchoolProfile | null,
  deps: ClientDeps,
): Promise<Segment[]> {
  const result = await generateText(
    {
      systemInstruction: buildScriptInstruction(event, profile),
      parts: [
        {
          text: [
            '아래 식순의 각 순서에 대한 사회자 멘트를 써 주세요.',
            '응답의 id는 아래에 적힌 id를 그대로 돌려주세요.',
            '',
            describeSegments(event.segments),
          ].join('\n'),
        },
      ],
      responseSchema: SCRIPT_SCHEMA,
      temperature: 0.7,
    },
    deps,
  );

  return applyScripts(event.segments, extractJson(result.text));
}

export async function regenerateOne(
  event: EventCeremony,
  segmentId: string,
  profile: SchoolProfile | null,
  deps: ClientDeps,
): Promise<Segment[]> {
  const index = event.segments.findIndex((segment) => segment.id === segmentId);
  if (index === -1) throw new Error('순서를 찾을 수 없습니다.');

  const window = event.segments.slice(Math.max(index - 1, 0), index + 2);

  const result = await generateText(
    {
      systemInstruction: buildScriptInstruction(event, profile),
      parts: [
        {
          text: [
            `아래는 행사 중 연속된 순서입니다. 이 가운데 id=${segmentId} 순서의 멘트만 새로 써 주세요.`,
            '나머지 순서는 앞뒤 흐름을 맞추기 위한 참고 자료입니다. 응답에 포함하지 마세요.',
            '',
            describeSegments(window),
          ].join('\n'),
        },
      ],
      responseSchema: SCRIPT_SCHEMA,
      temperature: 0.9,
    },
    deps,
  );

  return applyScripts(event.segments, extractJson(result.text));
}
