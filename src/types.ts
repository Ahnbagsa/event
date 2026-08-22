export type SchoolProfile = {
  id: 'singleton';
  schoolName: string;
  principal: { title: string; name: string };
  vicePrincipal: { title: string; name: string } | null;
  foundedDate: string | null;
  updatedAt: number;
};

export type AudioRole =
  | 'pledge'
  | 'anthem'
  | 'silence'
  | 'schoolSong'
  | 'entrance'
  | 'exit'
  | 'award'
  | `custom:${string}`;

export type AudioAsset = {
  id: string;
  role: AudioRole;
  label: string;
  data: ArrayBuffer;
  mimeType: string;
  durationSec: number;
  fileName: string;
  addedAt: number;
  /** 기기가 바뀌어도 같은 이름표(lib:… 또는 up:…). 예전 자료에는 없다. */
  sourceId?: string;
  /** 이 역할의 기본 음원인가. 예전 자료에는 없어 읽을 때 판정한다. */
  isDefault?: boolean;
};

export type SegmentKind = 'speech' | 'audio' | 'timer' | 'address';

export type Segment = {
  id: string;
  order: number;
  name: string;
  groupLabel: string | null;
  kind: SegmentKind;
  script: string;
  audioRole: AudioRole | null;
  /** 이 순서만 다른 음원을 쓸 때의 이름표. null이면 역할의 기본 음원. */
  audioSourceId: string | null;
  autoPlay: boolean;
  fadeOutSec: number | null;
  timerSec: number | null;
  manualDurationSec: number | null;
  note: string;
};

export type EventMode = 'inPerson' | 'broadcast';
export type EventAudience = 'lower' | 'upper' | 'all' | 'withParents';
export type EventTone = 'formal' | 'warm' | 'concise';

export type EventCeremony = {
  id: string;
  title: string;
  templateId: string;
  date: string;
  place: string;
  mode: EventMode;
  audience: EventAudience;
  tone: EventTone;
  targetMinutes: number | null;
  segments: Segment[];
  createdAt: number;
  updatedAt: number;
};

export type DiscoveredModel = {
  name: string;
  displayName: string;
  score: number;
  inputTokenLimit: number;
  outputTokenLimit: number;
};

export type AppSettings = {
  id: 'singleton';
  geminiApiKey: string;
  apiVersion: 'v1beta' | 'v1';
  selectedModel: string | null;
  modelPinnedByUser: boolean;
  discoveredModels: DiscoveredModel[];
  discoveredAt: number | null;
  fontScale: number;
  theme: 'dark' | 'light';
  /** 첫 실행 안내를 사용자가 닫았는지. 예전에 저장된 설정에는 이 칸이 없어 undefined다. */
  onboardingDismissed?: boolean;
};

export type RunState = {
  id: 'singleton';
  eventId: string;
  currentIndex: number;
  startedAt: number;
  updatedAt: number;
};
