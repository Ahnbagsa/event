import { newId } from '../../lib/id';
import { semesterOpeningSeeds, standardExtraSeeds, type SegmentSeed } from './semesterOpening';
import type {
  EventAudience,
  EventCeremony,
  EventMode,
  EventTone,
} from '../../types';

export type { SegmentSeed };

export type CeremonyTemplate = {
  id: string;
  label: string;
  seeds: SegmentSeed[];
};

export type EventInit = {
  title: string;
  date: string;
  place: string;
  mode: EventMode;
  audience: EventAudience;
  tone: EventTone;
  targetMinutes: number | null;
};

export const TEMPLATES: CeremonyTemplate[] = [
  { id: 'semester-opening', label: '개학식 · 방학식', seeds: semesterOpeningSeeds },
  { id: 'blank', label: '빈 행사 (직접 구성)', seeds: [] },
];

export const STANDARD_EXTRA_SEEDS = standardExtraSeeds;
export { blankSeed } from './semesterOpening';

export function getTemplate(id: string): CeremonyTemplate | null {
  return TEMPLATES.find((template) => template.id === id) ?? null;
}

export function createEventFromSeeds(seeds: SegmentSeed[], init: EventInit): EventCeremony {
  const now = Date.now();
  return {
    id: newId('event'),
    title: init.title,
    templateId: 'custom',
    date: init.date,
    place: init.place,
    mode: init.mode,
    audience: init.audience,
    tone: init.tone,
    targetMinutes: init.targetMinutes,
    segments: seeds.map((seedValue, index) => ({
      ...seedValue,
      id: newId('seg'),
      order: index,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

export function createEventFromTemplate(templateId: string, init: EventInit): EventCeremony {
  const template = getTemplate(templateId);
  if (template === null) throw new Error('알 수 없는 행사 템플릿입니다.');
  return { ...createEventFromSeeds(template.seeds, init), templateId };
}
