# 행사박사 코어 구현 계획 (계획서 1/3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 없이도 초등학교 개학식 대본을 만들고 당일 진행까지 마칠 수 있는 웹앱을 완성한다.

**Architecture:** 서버 없는 React 정적 웹앱. 학교 프로필·음원(Blob)·행사 시나리오를 전부 브라우저 IndexedDB에 저장한다. 시간 계산·빈칸 검출·점검·진행 상태 전이는 UI와 분리된 순수 함수로 만들어 단위 테스트로 덮는다.

**Tech Stack:** React 19 · TypeScript(strict) · Vite · Tailwind CSS v4 · react-router-dom(HashRouter) · idb · Vitest + Testing Library + fake-indexeddb

**Spec:** `docs/superpowers/specs/2026-08-18-haengsa-baksa-design.md`

## Global Constraints

- 프로젝트 루트는 저장소 루트다. `src/`, `index.html`, `package.json`을 루트에 둔다.
- 개발 환경: Node v24.19.0, npm 11.17.0 (확인 완료). 추가 설치 불필요.
- TypeScript `strict: true`. `any` 금지.
- **화면에 보이는 모든 문구는 한국어.** 코드 식별자는 영어.
- Vite `base: './'` — GitHub Pages 프로젝트 페이지에서 경로 문제가 없도록 상대 경로로 빌드한다.
- 라우팅은 **HashRouter**만 사용한다. GitHub Pages는 SPA 폴백을 지원하지 않는다.
- 순서 재정렬은 드래그가 아니라 **▲▼ 버튼**으로 구현한다 (스펙의 "드래그"에서 의도적으로 변경 — 터치 기기에서 훨씬 안정적이고 테스트 가능).
- 음원 역할 상수: `pledge` `anthem` `silence` `schoolSong` `entrance` `exit` `award` (+ `custom:` 접두사).
- 낭독 속도 상수는 `SPEAK_CHARS_PER_SEC = 4` 하나만 쓴다. 다른 곳에 숫자를 중복 정의하지 않는다.
- **음원은 `Blob`이 아니라 `ArrayBuffer`로 저장한다** (스펙 5절에서 의도적으로 변경). IndexedDB의 `Blob` 저장은 브라우저·테스트 환경별 지원 차가 있어 신뢰하기 어렵다. 재생 직전에 `new Blob([data], { type: mimeType })`로 되살린다.
- 커밋 메시지는 한국어 한 줄 요약 + `feat:`/`test:`/`chore:` 접두사.
- **테스트가 통과하지 않은 상태로 커밋하지 않는다.**

## File Structure

| 경로 | 책임 |
|---|---|
| `src/types.ts` | 모든 도메인 타입 (스펙 5절) |
| `src/lib/id.ts` | 고유 ID 생성 |
| `src/lib/format.ts` | 초 → "3분 20초" 표시 변환 |
| `src/db/schema.ts` | IndexedDB 열기·스토어 정의 |
| `src/db/testUtils.ts` | 테스트용 DB 초기화 |
| `src/db/profileRepo.ts` | 학교 프로필 읽기/쓰기 |
| `src/db/settingsRepo.ts` | 설정 읽기/쓰기 + 기본값 |
| `src/db/audioRepo.ts` | 음원 저장·역할별 조회 |
| `src/db/eventRepo.ts` | 행사 저장·목록·삭제 |
| `src/db/runStateRepo.ts` | 진행 위치 저장·복구 |
| `src/domain/timeEstimator.ts` | 예상 시간 계산 |
| `src/domain/blanks.ts` | `{{빈칸}}` 검출 |
| `src/domain/preflight.ts` | 점검 통과 여부 판정 |
| `src/domain/runMachine.ts` | 진행 모드 상태 전이 |
| `src/domain/templates/semesterOpening.ts` | 개학식 표준 식순 |
| `src/domain/templates/index.ts` | 템플릿 목록 + 행사 생성 |
| `src/audio/readAudioDuration.ts` | 음원 길이 실측 |
| `src/audio/usePlayer.ts` | 재생·일시정지·페이드아웃 훅 |
| `src/ui/App.tsx` | 라우트 정의 |
| `src/ui/Home.tsx` | 행사 목록 |
| `src/ui/settings/SettingsPage.tsx` | 설정 허브 |
| `src/ui/settings/ProfileForm.tsx` | 학교 프로필 입력 |
| `src/ui/settings/AudioDrawer.tsx` | 음원 서랍 |
| `src/ui/editor/EditorPage.tsx` | 시나리오 편집기 |
| `src/ui/editor/SegmentCard.tsx` | 순서 카드 |
| `src/ui/editor/ScriptField.tsx` | 멘트 입력 + 빈칸 강조 |
| `src/ui/preflight/PreflightPage.tsx` | 행사 전 점검 |
| `src/ui/run/RunPage.tsx` | 진행 모드 |
| `src/ui/run/useWakeLock.ts` | 화면 꺼짐 방지 |

---

## Task 1: 프로젝트 셋업과 도메인 타입

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `vitest.setup.ts`, `.gitignore`
- Create: `src/main.tsx`, `src/index.css`, `src/ui/App.tsx`
- Create: `src/types.ts`, `src/lib/id.ts`, `src/lib/format.ts`
- Test: `src/lib/id.test.ts`, `src/lib/format.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 작업)
- Produces:
  - `src/types.ts` — `SchoolProfile`, `AudioRole`, `AudioAsset`, `SegmentKind`, `Segment`, `EventCeremony`, `DiscoveredModel`, `AppSettings`, `RunState`
  - `newId(prefix: string): string`
  - `formatDuration(seconds: number): string`

- [ ] **Step 1: 패키지 초기화와 의존성 설치**

```bash
npm init -y
npm install react react-dom react-router-dom idb
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom \
  tailwindcss @tailwindcss/vite vitest jsdom fake-indexeddb \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: `package.json`의 `scripts`와 `type`을 교체**

`name`, `version`, `private`, `type`, `scripts`만 아래로 맞춘다. `dependencies`/`devDependencies`는 Step 1이 써넣은 값을 그대로 둔다.

```json
{
  "name": "haengsa-baksa",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: 설정 파일 작성**

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vitest.setup.ts", "vite.config.ts"]
}
```

`"types"`를 명시하면 TypeScript의 기본 타입 자동 포함이 꺼진다. `"vite/client"`가 첫 항목으로 반드시 있어야 `import './index.css'` 같은 부수효과 import가 타입 검사를 통과한다. 빼면 `npm run build`가 TS2882로 실패한다.

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

`.gitignore`:

```
node_modules
dist
.DS_Store
*.local
.superpowers/
```

`index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>행사박사</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: 앱 진입점 작성**

`src/index.css`:

```css
@import "tailwindcss";

html, body, #root { height: 100%; }
body {
  margin: 0;
  font-family: system-ui, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  word-break: keep-all;
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './ui/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
```

`src/ui/App.tsx`:

```tsx
import { Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<main className="p-8 text-2xl">행사박사</main>} />
    </Routes>
  );
}
```

- [ ] **Step 5: 도메인 타입 작성**

`src/types.ts` — 스펙 5절을 그대로 옮긴다.

```ts
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
};

export type RunState = {
  id: 'singleton';
  eventId: string;
  currentIndex: number;
  startedAt: number;
  updatedAt: number;
};
```

- [ ] **Step 6: 실패하는 테스트 작성**

`src/lib/id.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { newId } from './id';

describe('newId', () => {
  it('접두사로 시작한다', () => {
    expect(newId('seg')).toMatch(/^seg-/);
  });

  it('연속 호출해도 값이 겹치지 않는다', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId('x')));
    expect(ids.size).toBe(500);
  });
});
```

`src/lib/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatDuration } from './format';

describe('formatDuration', () => {
  it('1분 미만은 초만 표시한다', () => {
    expect(formatDuration(45)).toBe('45초');
  });

  it('분과 초를 함께 표시한다', () => {
    expect(formatDuration(200)).toBe('3분 20초');
  });

  it('초가 0이면 분만 표시한다', () => {
    expect(formatDuration(180)).toBe('3분');
  });

  it('0초는 "0초"다', () => {
    expect(formatDuration(0)).toBe('0초');
  });

  it('소수점은 올림한다', () => {
    expect(formatDuration(44.2)).toBe('45초');
  });

  it('올림한 값이 60초가 되면 1분으로 표시한다', () => {
    expect(formatDuration(59.2)).toBe('1분');
  });
});
```

- [ ] **Step 7: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./id"` / `"./format"`

- [ ] **Step 8: 최소 구현**

`src/lib/id.ts`:

```ts
export function newId(prefix: string): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${time}-${rand}`;
}
```

`src/lib/format.ts`:

```ts
export function formatDuration(seconds: number): string {
  const total = Math.ceil(seconds);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (min === 0) return `${sec}초`;
  if (sec === 0) return `${min}분`;
  return `${min}분 ${sec}초`;
}
```

- [ ] **Step 9: 테스트 통과 확인 + 빌드 확인**

Run: `npm test`
Expected: PASS (8 tests)

Run: `npm run build`
Expected: 오류 없이 `dist/` 생성

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "chore: Vite + React + TypeScript 프로젝트 셋업과 도메인 타입 정의"
```

---

## Task 2: IndexedDB 저장 계층

**Files:**
- Create: `src/db/schema.ts`, `src/db/testUtils.ts`, `src/db/profileRepo.ts`, `src/db/settingsRepo.ts`
- Test: `src/db/profileRepo.test.ts`, `src/db/settingsRepo.test.ts`

**Interfaces:**
- Consumes: `src/types.ts` (Task 1)
- Produces:
  - `openHbDb(): Promise<IDBPDatabase<HbSchema>>`, `DB_NAME`, `DB_VERSION`, `resetDbHandleForTests(): void`
  - `clearDb(): Promise<void>` (테스트 전용)
  - `getProfile(): Promise<SchoolProfile | null>`, `saveProfile(p: SchoolProfile): Promise<void>`
  - `getSettings(): Promise<AppSettings>`, `saveSettings(s: AppSettings): Promise<void>`, `DEFAULT_SETTINGS: AppSettings`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/db/profileRepo.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { clearDb } from './testUtils';
import { getProfile, saveProfile } from './profileRepo';
import type { SchoolProfile } from '../types';

const sample: SchoolProfile = {
  id: 'singleton',
  schoolName: '한빛초등학교',
  principal: { title: '교장', name: '김철수' },
  vicePrincipal: null,
  foundedDate: null,
  updatedAt: 1,
};

describe('profileRepo', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('저장 전에는 null을 돌려준다', async () => {
    expect(await getProfile()).toBeNull();
  });

  it('저장한 프로필을 그대로 읽는다', async () => {
    await saveProfile(sample);
    expect(await getProfile()).toEqual(sample);
  });

  it('다시 저장하면 덮어쓴다', async () => {
    await saveProfile(sample);
    await saveProfile({ ...sample, schoolName: '새빛초등학교', updatedAt: 2 });
    const got = await getProfile();
    expect(got?.schoolName).toBe('새빛초등학교');
  });
});
```

`src/db/settingsRepo.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { clearDb } from './testUtils';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from './settingsRepo';

describe('settingsRepo', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('저장된 값이 없으면 기본값을 돌려준다', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('기본 테마는 어두운 화면이다', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('dark');
  });

  it('저장한 값을 읽는다', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, geminiApiKey: 'AIza-테스트' });
    expect((await getSettings()).geminiApiKey).toBe('AIza-테스트');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/db`
Expected: FAIL — `Failed to resolve import "./testUtils"`

- [ ] **Step 3: 스키마와 테스트 헬퍼 구현**

`src/db/schema.ts`:

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, AudioAsset, EventCeremony, RunState, SchoolProfile } from '../types';

export const DB_NAME = 'haengsa-baksa';
export const DB_VERSION = 1;

export interface HbSchema extends DBSchema {
  profile: { key: string; value: SchoolProfile };
  audio: { key: string; value: AudioAsset; indexes: { role: string } };
  events: { key: string; value: EventCeremony; indexes: { updatedAt: number } };
  settings: { key: string; value: AppSettings };
  runState: { key: string; value: RunState };
}

let dbPromise: Promise<IDBPDatabase<HbSchema>> | null = null;

export function openHbDb(): Promise<IDBPDatabase<HbSchema>> {
  if (dbPromise === null) {
    dbPromise = openDB<HbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('audio')) {
          const store = db.createObjectStore('audio', { keyPath: 'id' });
          store.createIndex('role', 'role');
        }
        if (!db.objectStoreNames.contains('events')) {
          const store = db.createObjectStore('events', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('runState')) {
          db.createObjectStore('runState', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export function resetDbHandleForTests(): void {
  dbPromise = null;
}
```

`src/db/testUtils.ts`:

```ts
import { DB_NAME, openHbDb, resetDbHandleForTests } from './schema';

export async function clearDb(): Promise<void> {
  const db = await openHbDb().catch(() => null);
  db?.close();
  resetDbHandleForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
```

- [ ] **Step 4: 리포지토리 구현**

`src/db/profileRepo.ts`:

```ts
import { openHbDb } from './schema';
import type { SchoolProfile } from '../types';

export async function getProfile(): Promise<SchoolProfile | null> {
  const db = await openHbDb();
  return (await db.get('profile', 'singleton')) ?? null;
}

export async function saveProfile(profile: SchoolProfile): Promise<void> {
  const db = await openHbDb();
  await db.put('profile', profile);
}
```

`src/db/settingsRepo.ts`:

```ts
import { openHbDb } from './schema';
import type { AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'singleton',
  geminiApiKey: '',
  apiVersion: 'v1beta',
  selectedModel: null,
  modelPinnedByUser: false,
  discoveredModels: [],
  discoveredAt: null,
  fontScale: 1,
  theme: 'dark',
};

export async function getSettings(): Promise<AppSettings> {
  const db = await openHbDb();
  const stored = await db.get('settings', 'singleton');
  if (stored !== undefined) return stored;
  // DEFAULT_SETTINGS는 모듈 상수다. 그대로 돌려주면 호출자가 손댈 때 상수가 오염되고
  // 그 뒤의 모든 호출이 오염된 값을 받는다. 배열까지 새로 만들어 복사본을 준다.
  return { ...DEFAULT_SETTINGS, discoveredModels: [] };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await openHbDb();
  await db.put('settings', settings);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- src/db`
Expected: PASS (6 tests)

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: IndexedDB 저장 계층과 프로필·설정 리포지토리"
```

---

## Task 3: 학교 프로필 화면과 라우팅

**Files:**
- Create: `src/ui/settings/ProfileForm.tsx`, `src/ui/settings/SettingsPage.tsx`
- Modify: `src/ui/App.tsx`
- Test: `src/ui/settings/ProfileForm.test.tsx`

**Interfaces:**
- Consumes: `getProfile`, `saveProfile` (Task 2), `SchoolProfile` (Task 1)
- Produces:
  - `<ProfileForm />` — 자체적으로 저장소를 읽고 쓰는 화면 컴포넌트
  - 라우트 `#/settings`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/settings/ProfileForm.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearDb } from '../../db/testUtils';
import { getProfile, saveProfile } from '../../db/profileRepo';
import ProfileForm from './ProfileForm';

describe('ProfileForm', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('입력한 값을 저장한다', async () => {
    const user = userEvent.setup();
    render(<ProfileForm />);

    await user.type(await screen.findByLabelText('학교명'), '한빛초등학교');
    await user.type(screen.getByLabelText('교장 성함'), '김철수');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(async () => {
      const saved = await getProfile();
      expect(saved?.schoolName).toBe('한빛초등학교');
      expect(saved?.principal.name).toBe('김철수');
    });
  });

  it('저장된 프로필을 불러와 보여준다', async () => {
    await saveProfile({
      id: 'singleton',
      schoolName: '새빛초등학교',
      principal: { title: '교장', name: '이영희' },
      vicePrincipal: null,
      foundedDate: null,
      updatedAt: 1,
    });

    render(<ProfileForm />);
    expect(await screen.findByDisplayValue('새빛초등학교')).toBeInTheDocument();
    expect(screen.getByDisplayValue('이영희')).toBeInTheDocument();
  });

  it('학교명이 비어 있으면 저장할 수 없다', async () => {
    const user = userEvent.setup();
    render(<ProfileForm />);

    await user.click(await screen.findByRole('button', { name: '저장' }));

    expect(await screen.findByText('학교명을 입력해 주세요.')).toBeInTheDocument();
    expect(await getProfile()).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- ProfileForm`
Expected: FAIL — `Failed to resolve import "./ProfileForm"`

- [ ] **Step 3: 구현**

`src/ui/settings/ProfileForm.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { getProfile, saveProfile } from '../../db/profileRepo';

export default function ProfileForm() {
  const [schoolName, setSchoolName] = useState('');
  const [principalTitle, setPrincipalTitle] = useState('교장');
  const [principalName, setPrincipalName] = useState('');
  const [vicePrincipalName, setVicePrincipalName] = useState('');
  const [foundedDate, setFoundedDate] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getProfile().then((profile) => {
      if (profile === null) return;
      setSchoolName(profile.schoolName);
      setPrincipalTitle(profile.principal.title);
      setPrincipalName(profile.principal.name);
      setVicePrincipalName(profile.vicePrincipal?.name ?? '');
      setFoundedDate(profile.foundedDate ?? '');
    });
  }, []);

  async function handleSave() {
    setSaved(false);
    if (schoolName.trim() === '') {
      setError('학교명을 입력해 주세요.');
      return;
    }
    setError('');
    await saveProfile({
      id: 'singleton',
      schoolName: schoolName.trim(),
      principal: { title: principalTitle.trim(), name: principalName.trim() },
      vicePrincipal:
        vicePrincipalName.trim() === ''
          ? null
          : { title: '교감', name: vicePrincipalName.trim() },
      foundedDate: foundedDate === '' ? null : foundedDate,
      updatedAt: Date.now(),
    });
    setSaved(true);
  }

  const field = 'w-full rounded border border-gray-400 px-3 py-2';

  return (
    <section className="mx-auto max-w-xl space-y-4 p-4">
      <h2 className="text-xl font-bold">학교 프로필</h2>
      <p className="text-sm text-gray-600">
        한 번 입력해 두면 모든 행사 대본에 자동으로 쓰입니다.
      </p>

      <div>
        <label className="block text-sm font-medium" htmlFor="schoolName">학교명</label>
        <input id="schoolName" className={field} value={schoolName}
               onChange={(e) => setSchoolName(e.target.value)} />
      </div>

      <div className="flex gap-2">
        <div className="w-28">
          <label className="block text-sm font-medium" htmlFor="principalTitle">직함</label>
          <input id="principalTitle" className={field} value={principalTitle}
                 onChange={(e) => setPrincipalTitle(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium" htmlFor="principalName">교장 성함</label>
          <input id="principalName" className={field} value={principalName}
                 onChange={(e) => setPrincipalName(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="vicePrincipalName">교감 성함 (선택)</label>
        <input id="vicePrincipalName" className={field} value={vicePrincipalName}
               onChange={(e) => setVicePrincipalName(e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="foundedDate">개교기념일 (선택)</label>
        <input id="foundedDate" type="date" className={field} value={foundedDate}
               onChange={(e) => setFoundedDate(e.target.value)} />
      </div>

      {error !== '' && <p className="text-red-600">{error}</p>}
      {saved && <p className="text-green-700">저장했습니다.</p>}

      <button className="rounded bg-blue-600 px-4 py-2 text-white"
              onClick={() => void handleSave()}>
        저장
      </button>
    </section>
  );
}
```

`src/ui/settings/SettingsPage.tsx`:

```tsx
import { Link } from 'react-router-dom';
import ProfileForm from './ProfileForm';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl">
      <header className="flex items-center gap-3 p-4">
        <Link to="/" className="text-blue-600">← 홈</Link>
        <h1 className="text-lg font-bold">설정</h1>
      </header>
      <ProfileForm />
    </div>
  );
}
```

- [ ] **Step 4: 라우트 등록**

`src/ui/App.tsx`를 교체한다.

```tsx
import { Routes, Route, Link } from 'react-router-dom';
import SettingsPage from './settings/SettingsPage';

function Placeholder() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">행사박사</h1>
      <Link to="/settings" className="text-blue-600">설정으로 이동</Link>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (전체 통과)

- [ ] **Step 6: 눈으로 확인**

Run: `npm run dev`
브라우저에서 `http://localhost:5173/#/settings` 를 열어 학교명을 입력하고 저장한 뒤, 새로고침해도 값이 남아 있는지 확인한다.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: 학교 프로필 입력 화면과 설정 라우트"
```

---

## Task 4: 음원 길이 실측과 음원 리포지토리

**Files:**
- Create: `src/audio/readAudioDuration.ts`, `src/db/audioRepo.ts`
- Test: `src/audio/readAudioDuration.test.ts`, `src/db/audioRepo.test.ts`

**Interfaces:**
- Consumes: `openHbDb` (Task 2), `AudioAsset`·`AudioRole` (Task 1)
- Produces:
  - `readAudioDuration(data: ArrayBuffer, mimeType: string): Promise<number>` — 초 단위, 읽지 못하면 reject
  - `putAudio(asset: AudioAsset): Promise<void>`
  - `listAudio(): Promise<AudioAsset[]>`
  - `getAudioByRole(role: AudioRole): Promise<AudioAsset | null>`
  - `deleteAudio(id: string): Promise<void>`
  - `getAvailableRoles(): Promise<Set<AudioRole>>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/audio/readAudioDuration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readAudioDuration } from './readAudioDuration';

class FakeAudio {
  static behavior: 'ok' | 'error' = 'ok';
  static reportedDuration = 0;

  duration = 0;
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => {
      if (FakeAudio.behavior === 'ok') {
        this.duration = FakeAudio.reportedDuration;
        this.onloadedmetadata?.();
      } else {
        this.onerror?.();
      }
    });
  }
}

beforeEach(() => {
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:fake',
    revokeObjectURL: () => undefined,
  });
  FakeAudio.behavior = 'ok';
  FakeAudio.reportedDuration = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readAudioDuration', () => {
  it('메타데이터에서 읽은 길이를 초로 돌려준다', async () => {
    FakeAudio.reportedDuration = 222.4;
    await expect(readAudioDuration(new ArrayBuffer(8), 'audio/mpeg')).resolves.toBe(222.4);
  });

  it('길이를 알 수 없으면 0을 돌려준다', async () => {
    FakeAudio.reportedDuration = Infinity;
    await expect(readAudioDuration(new ArrayBuffer(8), 'audio/mpeg')).resolves.toBe(0);
  });

  it('읽지 못하면 한국어 오류로 거부한다', async () => {
    FakeAudio.behavior = 'error';
    await expect(readAudioDuration(new ArrayBuffer(8), 'audio/mpeg')).rejects.toThrow(
      '음원 파일을 읽을 수 없습니다.',
    );
  });
});
```

`src/db/audioRepo.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { clearDb } from './testUtils';
import { putAudio, listAudio, getAudioByRole, deleteAudio, getAvailableRoles } from './audioRepo';
import type { AudioAsset, AudioRole } from '../types';

function makeAsset(id: string, role: AudioRole): AudioAsset {
  return {
    id,
    role,
    label: `${role} 음원`,
    data: new ArrayBuffer(16),
    mimeType: 'audio/mpeg',
    durationSec: 60,
    fileName: `${id}.mp3`,
    addedAt: 1,
  };
}

describe('audioRepo', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('저장한 음원을 역할로 찾는다', async () => {
    await putAudio(makeAsset('a1', 'anthem'));
    const found = await getAudioByRole('anthem');
    expect(found?.id).toBe('a1');
    expect(found?.data.byteLength).toBe(16);
  });

  it('등록되지 않은 역할은 null이다', async () => {
    expect(await getAudioByRole('schoolSong')).toBeNull();
  });

  it('같은 역할을 다시 저장하면 하나만 남는다', async () => {
    await putAudio(makeAsset('a1', 'anthem'));
    await putAudio(makeAsset('a2', 'anthem'));
    const all = await listAudio();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('a2');
  });

  it('삭제하면 목록에서 사라진다', async () => {
    await putAudio(makeAsset('a1', 'anthem'));
    await deleteAudio('a1');
    expect(await listAudio()).toHaveLength(0);
  });

  it('등록된 역할 집합을 돌려준다', async () => {
    await putAudio(makeAsset('a1', 'anthem'));
    await putAudio(makeAsset('a2', 'schoolSong'));
    const roles = await getAvailableRoles();
    expect(roles.has('anthem')).toBe(true);
    expect(roles.has('schoolSong')).toBe(true);
    expect(roles.has('silence')).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- readAudioDuration audioRepo`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/audio/readAudioDuration.ts`:

```ts
export function readAudioDuration(data: ArrayBuffer, mimeType: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const element = new Audio();

    element.onloadedmetadata = () => {
      const seconds = element.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(seconds) ? seconds : 0);
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('음원 파일을 읽을 수 없습니다.'));
    };

    element.src = url;
  });
}
```

`src/db/audioRepo.ts` — 한 역할에는 음원 하나만 둔다. 저장할 때 같은 역할의 기존 항목을 지운다.

```ts
import { openHbDb } from './schema';
import type { AudioAsset, AudioRole } from '../types';

export async function putAudio(asset: AudioAsset): Promise<void> {
  const db = await openHbDb();
  const tx = db.transaction('audio', 'readwrite');
  const index = tx.store.index('role');
  let cursor = await index.openCursor(asset.role);
  while (cursor) {
    if (cursor.value.id !== asset.id) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.store.put(asset);
  await tx.done;
}

export async function listAudio(): Promise<AudioAsset[]> {
  const db = await openHbDb();
  return db.getAll('audio');
}

export async function getAudioByRole(role: AudioRole): Promise<AudioAsset | null> {
  const db = await openHbDb();
  return (await db.getFromIndex('audio', 'role', role)) ?? null;
}

export async function deleteAudio(id: string): Promise<void> {
  const db = await openHbDb();
  await db.delete('audio', id);
}

export async function getAvailableRoles(): Promise<Set<AudioRole>> {
  const all = await listAudio();
  return new Set(all.map((asset) => asset.role));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- readAudioDuration audioRepo`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: 음원 길이 실측과 역할 기반 음원 리포지토리"
```

---

## Task 5: 음원 서랍 화면

**Files:**
- Create: `src/audio/roles.ts`, `src/ui/settings/AudioDrawer.tsx`
- Modify: `src/ui/settings/SettingsPage.tsx`
- Test: `src/ui/settings/AudioDrawer.test.tsx`

**Interfaces:**
- Consumes: `putAudio`·`listAudio`·`deleteAudio` (Task 4), `readAudioDuration` (Task 4), `newId` (Task 1), `formatDuration` (Task 1)
- Produces:
  - `STANDARD_ROLES: { role: AudioRole; label: string; hint: string }[]`
  - `roleLabel(role: AudioRole): string`
  - `<AudioDrawer />`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/settings/AudioDrawer.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearDb } from '../../db/testUtils';
import { getAudioByRole } from '../../db/audioRepo';
import AudioDrawer from './AudioDrawer';

vi.mock('../../audio/readAudioDuration', () => ({
  readAudioDuration: () => Promise.resolve(222),
}));

describe('AudioDrawer', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('표준 역할 슬롯을 모두 보여준다', async () => {
    render(<AudioDrawer />);
    expect(await screen.findByText('애국가')).toBeInTheDocument();
    expect(screen.getByText('교가')).toBeInTheDocument();
    expect(screen.getByText('묵념곡')).toBeInTheDocument();
  });

  it('등록되지 않은 슬롯은 "없음"으로 표시한다', async () => {
    render(<AudioDrawer />);
    const slot = await screen.findByTestId('slot-anthem');
    expect(slot).toHaveTextContent('없음');
  });

  it('파일을 고르면 저장하고 길이를 보여준다', async () => {
    const user = userEvent.setup();
    render(<AudioDrawer />);

    const input = await screen.findByTestId('file-anthem');
    const file = new File(['음원내용'], '애국가.mp3', { type: 'audio/mpeg' });
    await user.upload(input, file);

    await waitFor(async () => {
      const saved = await getAudioByRole('anthem');
      expect(saved?.fileName).toBe('애국가.mp3');
      expect(saved?.durationSec).toBe(222);
    });

    expect(await screen.findByText('3분 42초')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- AudioDrawer`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 역할 목록 구현**

`src/audio/roles.ts`:

```ts
import type { AudioRole } from '../types';

export const STANDARD_ROLES: { role: AudioRole; label: string; hint: string }[] = [
  { role: 'pledge', label: '국기에 대한 맹세', hint: '맹세문 낭독 음원' },
  { role: 'anthem', label: '애국가', hint: '보통 1절' },
  { role: 'silence', label: '묵념곡', hint: '순국선열에 대한 묵념' },
  { role: 'schoolSong', label: '교가', hint: '우리 학교 교가' },
  { role: 'entrance', label: '입장곡', hint: '졸업식·입학식 입장' },
  { role: 'exit', label: '퇴장곡', hint: '행사 마무리' },
  { role: 'award', label: '시상 배경음', hint: '시상식 배경' },
];

export function roleLabel(role: AudioRole): string {
  const found = STANDARD_ROLES.find((entry) => entry.role === role);
  if (found !== undefined) return found.label;
  return role.startsWith('custom:') ? role.slice('custom:'.length) : role;
}
```

- [ ] **Step 4: 서랍 화면 구현**

`src/ui/settings/AudioDrawer.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { STANDARD_ROLES } from '../../audio/roles';
import { readAudioDuration } from '../../audio/readAudioDuration';
import { deleteAudio, listAudio, putAudio } from '../../db/audioRepo';
import { newId } from '../../lib/id';
import { formatDuration } from '../../lib/format';
import type { AudioAsset, AudioRole } from '../../types';

export default function AudioDrawer() {
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [error, setError] = useState('');
  const [busyRole, setBusyRole] = useState<AudioRole | null>(null);

  const reload = useCallback(async () => {
    setAssets(await listAudio());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleFile(role: AudioRole, file: File) {
    setError('');
    setBusyRole(role);
    try {
      const data = await file.arrayBuffer();
      const durationSec = await readAudioDuration(data, file.type);
      await putAudio({
        id: newId('audio'),
        role,
        label: file.name,
        data,
        mimeType: file.type,
        durationSec,
        fileName: file.name,
        addedAt: Date.now(),
      });
      await reload();
    } catch {
      setError('음원 파일을 읽을 수 없습니다. mp3 파일인지 확인해 주세요.');
    } finally {
      setBusyRole(null);
    }
  }

  async function handleDelete(id: string) {
    await deleteAudio(id);
    await reload();
  }

  return (
    <section className="mx-auto max-w-xl space-y-4 p-4">
      <h2 className="text-xl font-bold">음원 서랍</h2>
      <p className="text-sm text-gray-600">
        이 기기에 한 번만 등록해 두면 모든 행사에서 쓰입니다. 인터넷 없이도 재생됩니다.
      </p>
      {error !== '' && <p className="text-red-600">{error}</p>}

      <ul className="space-y-2">
        {STANDARD_ROLES.map(({ role, label, hint }) => {
          const asset = assets.find((entry) => entry.role === role) ?? null;
          return (
            <li key={role} data-testid={`slot-${role}`}
                className="rounded border border-gray-300 p-3">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{label}</span>
                <span className="text-sm text-gray-500">{hint}</span>
              </div>

              <div className="mt-2 text-sm">
                {asset === null ? (
                  <span className="text-gray-500">없음</span>
                ) : (
                  <span>
                    {asset.fileName} · <span>{formatDuration(asset.durationSec)}</span>
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center gap-3">
                <input
                  data-testid={`file-${role}`}
                  aria-label={`${label} 파일 선택`}
                  type="file"
                  accept="audio/*"
                  className="text-sm"
                  disabled={busyRole !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file !== undefined) void handleFile(role, file);
                  }}
                />
                {busyRole === role && <span className="text-sm">읽는 중…</span>}
                {asset !== null && (
                  <button className="text-sm text-red-600"
                          onClick={() => void handleDelete(asset.id)}>
                    삭제
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: 설정 화면에 붙이기**

`src/ui/settings/SettingsPage.tsx`에서 `ProfileForm` 아래에 `<AudioDrawer />`를 추가하고 import 한다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (전체)

- [ ] **Step 7: 눈으로 확인**

`npm run dev` 후 `#/settings`에서 실제 mp3 파일을 애국가 슬롯에 넣고, 새로고침해도 파일명과 재생 길이가 남아 있는지 확인한다.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: 역할별 음원 서랍 화면"
```

---

## Task 6: 개학식 템플릿과 행사 리포지토리

**Files:**
- Create: `src/domain/templates/semesterOpening.ts`, `src/domain/templates/index.ts`, `src/db/eventRepo.ts`
- Test: `src/domain/templates/index.test.ts`, `src/db/eventRepo.test.ts`

**Interfaces:**
- Consumes: `newId` (Task 1), `EventCeremony`·`Segment` (Task 1), `openHbDb` (Task 2)
- Produces:
  - `type SegmentSeed = Omit<Segment, 'id' | 'order'>`
  - `type CeremonyTemplate = { id: string; label: string; seeds: SegmentSeed[] }`
  - `TEMPLATES: CeremonyTemplate[]`, `STANDARD_EXTRA_SEEDS: SegmentSeed[]`, `getTemplate(id: string): CeremonyTemplate | null`
  - `createEventFromTemplate(templateId: string, init: EventInit): EventCeremony`
  - `type EventInit = { title: string; date: string; place: string; mode: EventMode; audience: EventAudience; tone: EventTone; targetMinutes: number | null }`
  - `listEvents(): Promise<EventCeremony[]>` (최근 수정 순), `getEvent(id)`, `putEvent(e)`, `deleteEvent(id)`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/templates/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  TEMPLATES,
  STANDARD_EXTRA_SEEDS,
  getTemplate,
  createEventFromTemplate,
} from './index';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: 20,
};

describe('템플릿', () => {
  it('개학식 템플릿이 있다', () => {
    expect(getTemplate('semester-opening')).not.toBeNull();
  });

  it('없는 템플릿은 null이다', () => {
    expect(getTemplate('없는템플릿')).toBeNull();
  });

  it('모든 템플릿의 id가 겹치지 않는다', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('createEventFromTemplate', () => {
  it('개학식 표준 7개 순서를 만든다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(event.segments.map((s) => s.name)).toEqual([
      '개식사',
      '국기에 대한 경례',
      '애국가 제창',
      '순국선열 및 호국영령에 대한 묵념',
      '학교장 말씀',
      '교가 제창',
      '폐식사',
    ]);
  });

  it('전달 사항은 기본 식순에 넣지 않는다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(event.segments.map((s) => s.name)).not.toContain('전달 사항');
  });

  it('국민의례 세 순서에 같은 묶음 이름을 붙인다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    const grouped = event.segments.filter((s) => s.groupLabel === '국민의례');
    expect(grouped).toHaveLength(3);
  });

  it('묵념은 타이머이면서 묵념곡을 가진다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    const silence = event.segments.find((s) => s.audioRole === 'silence');
    expect(silence?.kind).toBe('timer');
    expect(silence?.timerSec).toBe(60);
  });

  it('학교장 말씀 기본 시간은 3분이다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    const address = event.segments.find((s) => s.name === '학교장 말씀');
    expect(address?.kind).toBe('address');
    expect(address?.manualDurationSec).toBe(180);
  });

  it('order를 0부터 차례로 매기고 id가 겹치지 않는다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(event.segments.map((s) => s.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(new Set(event.segments.map((s) => s.id)).size).toBe(7);
  });

  it('행사 정보를 그대로 담는다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(event.title).toBe('2학기 개학식');
    expect(event.mode).toBe('broadcast');
    expect(event.templateId).toBe('semester-opening');
  });

  it('빈 템플릿은 순서가 없다', () => {
    const event = createEventFromTemplate('blank', init);
    expect(event.segments).toEqual([]);
  });

  it('없는 템플릿 id는 오류를 던진다', () => {
    expect(() => createEventFromTemplate('없는템플릿', init)).toThrow(
      '알 수 없는 행사 템플릿입니다.',
    );
  });
});

describe('STANDARD_EXTRA_SEEDS', () => {
  it('전달 사항을 나중에 넣을 수 있게 제공한다', () => {
    const names = STANDARD_EXTRA_SEEDS.map((seed) => seed.name);
    expect(names).toContain('전달 사항');
  });

  it('전달 사항은 말씀 종류이고 기본 2분이다', () => {
    const found = STANDARD_EXTRA_SEEDS.find((seed) => seed.name === '전달 사항');
    expect(found?.kind).toBe('address');
    expect(found?.manualDurationSec).toBe(120);
  });

  it('자주 쓰는 순서를 갖추고 있다', () => {
    const names = STANDARD_EXTRA_SEEDS.map((seed) => seed.name);
    expect(names).toContain('시상');
    expect(names).toContain('내빈 소개');
    expect(names).toContain('입장');
  });

  it('이름이 겹치지 않는다', () => {
    const names = STANDARD_EXTRA_SEEDS.map((seed) => seed.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
```

`src/db/eventRepo.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { clearDb } from './testUtils';
import { listEvents, getEvent, putEvent, deleteEvent } from './eventRepo';
import { createEventFromTemplate } from '../domain/templates';

const init = {
  title: '개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

describe('eventRepo', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('저장한 행사를 id로 읽는다', async () => {
    const event = createEventFromTemplate('semester-opening', init);
    await putEvent(event);
    expect((await getEvent(event.id))?.title).toBe('개학식');
  });

  it('없는 id는 null이다', async () => {
    expect(await getEvent('없음')).toBeNull();
  });

  it('최근에 수정한 행사가 앞에 온다', async () => {
    const older = { ...createEventFromTemplate('blank', init), title: '오래된', updatedAt: 100 };
    const newer = { ...createEventFromTemplate('blank', init), title: '최신', updatedAt: 200 };
    await putEvent(older);
    await putEvent(newer);
    expect((await listEvents()).map((e) => e.title)).toEqual(['최신', '오래된']);
  });

  it('삭제하면 목록에서 사라진다', async () => {
    const event = createEventFromTemplate('blank', init);
    await putEvent(event);
    await deleteEvent(event.id);
    expect(await listEvents()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- templates eventRepo`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 개학식 식순 구현**

`src/domain/templates/semesterOpening.ts`:

```ts
import type { Segment } from '../../types';

export type SegmentSeed = Omit<Segment, 'id' | 'order'>;

function seed(partial: Partial<SegmentSeed> & { name: string; kind: Segment['kind'] }): SegmentSeed {
  return {
    groupLabel: null,
    script: '',
    audioRole: null,
    autoPlay: false,
    fadeOutSec: null,
    timerSec: null,
    manualDurationSec: null,
    note: '',
    ...partial,
  };
}

export const semesterOpeningSeeds: SegmentSeed[] = [
  seed({ name: '개식사', kind: 'speech' }),
  seed({
    name: '국기에 대한 경례',
    kind: 'audio',
    groupLabel: '국민의례',
    audioRole: 'pledge',
    note: '맹세문 낭독. 약식으로 진행할 때는 이 순서만 남깁니다.',
  }),
  seed({
    name: '애국가 제창',
    kind: 'audio',
    groupLabel: '국민의례',
    audioRole: 'anthem',
    note: '보통 1절만 제창합니다.',
  }),
  seed({
    name: '순국선열 및 호국영령에 대한 묵념',
    kind: 'timer',
    groupLabel: '국민의례',
    audioRole: 'silence',
    timerSec: 60,
  }),
  seed({ name: '학교장 말씀', kind: 'address', manualDurationSec: 180 }),
  seed({ name: '교가 제창', kind: 'audio', audioRole: 'schoolSong' }),
  seed({ name: '폐식사', kind: 'speech' }),
];

// 기본 식순에는 없지만 학교 사정에 따라 넣는 순서들.
// 편집기의 "순서 추가"에서 고를 수 있다.
export const standardExtraSeeds: SegmentSeed[] = [
  seed({ name: '전달 사항', kind: 'address', manualDurationSec: 120, note: '교무·생활·보건' }),
  seed({ name: '내빈 소개', kind: 'speech' }),
  seed({ name: '축사', kind: 'address', manualDurationSec: 180 }),
  seed({ name: '시상', kind: 'audio', audioRole: 'award' }),
  seed({ name: '학생 대표 인사', kind: 'address', manualDurationSec: 120 }),
  seed({ name: '입장', kind: 'audio', audioRole: 'entrance' }),
  seed({ name: '퇴장', kind: 'audio', audioRole: 'exit', fadeOutSec: 3 }),
];

// 팔레트에서 "직접 입력"을 골랐을 때 넣는 빈 순서.
// standardExtraSeeds에 넣지 않는다 — 그것은 실제 식순 이름들의 목록이고,
// 여기에 UI 동작을 섞으면 "새로 만들기"라는 이름의 순서가 식순에 들어간다.
export function blankSeed(): SegmentSeed {
  return seed({ name: '새 순서', kind: 'speech' });
}
```

`전달 사항`은 학교마다 넣기도 하고 빼기도 하므로 **기본 식순에서 제외**하고 여기에 두었다. 편집기에서 한 번 눌러 넣을 수 있다.

`src/domain/templates/index.ts`:

```ts
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

export function createEventFromTemplate(templateId: string, init: EventInit): EventCeremony {
  const template = getTemplate(templateId);
  if (template === null) throw new Error('알 수 없는 행사 템플릿입니다.');

  const now = Date.now();
  return {
    id: newId('event'),
    title: init.title,
    templateId,
    date: init.date,
    place: init.place,
    mode: init.mode,
    audience: init.audience,
    tone: init.tone,
    targetMinutes: init.targetMinutes,
    segments: template.seeds.map((seedValue, index) => ({
      ...seedValue,
      id: newId('seg'),
      order: index,
    })),
    createdAt: now,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: 행사 리포지토리 구현**

`src/db/eventRepo.ts`:

```ts
import { openHbDb } from './schema';
import type { EventCeremony } from '../types';

export async function listEvents(): Promise<EventCeremony[]> {
  const db = await openHbDb();
  const all = await db.getAllFromIndex('events', 'updatedAt');
  return all.reverse();
}

export async function getEvent(id: string): Promise<EventCeremony | null> {
  const db = await openHbDb();
  return (await db.get('events', id)) ?? null;
}

export async function putEvent(event: EventCeremony): Promise<void> {
  const db = await openHbDb();
  await db.put('events', event);
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await openHbDb();
  await db.delete('events', id);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- templates eventRepo`
Expected: PASS (20 tests)

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: 개학식 표준 식순 템플릿과 행사 리포지토리"
```

---

## Task 7: 예상 시간 계산과 빈칸 검출

**Files:**
- Create: `src/domain/timeEstimator.ts`, `src/domain/blanks.ts`
- Test: `src/domain/timeEstimator.test.ts`, `src/domain/blanks.test.ts`

**Interfaces:**
- Consumes: `Segment`·`EventCeremony`·`AudioRole` (Task 1)
- Produces:
  - `SPEAK_CHARS_PER_SEC = 4`
  - `estimateScriptSeconds(script: string): number`
  - `estimateSegmentSeconds(segment: Segment, audioDurationSec: number | null): number`
  - `estimateTotalSeconds(segments: Segment[], durationsByRole: Map<AudioRole, number>): number`
  - `findBlanks(text: string): string[]`
  - `type BlankHit = { segmentId: string; segmentName: string; labels: string[] }`
  - `findBlanksInEvent(event: EventCeremony): BlankHit[]`
  - `countBlanks(event: EventCeremony): number`
  - `hasMalformedMarker(text: string): boolean`
  - `type MalformedHit = { segmentId: string; segmentName: string }`
  - `findMalformedInEvent(event: EventCeremony): MalformedHit[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/timeEstimator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  SPEAK_CHARS_PER_SEC,
  estimateScriptSeconds,
  estimateSegmentSeconds,
  estimateTotalSeconds,
} from './timeEstimator';
import type { AudioRole, Segment } from '../types';

function seg(partial: Partial<Segment>): Segment {
  return {
    id: 's1',
    order: 0,
    name: '순서',
    groupLabel: null,
    kind: 'speech',
    script: '',
    audioRole: null,
    autoPlay: false,
    fadeOutSec: null,
    timerSec: null,
    manualDurationSec: null,
    note: '',
    ...partial,
  };
}

describe('estimateScriptSeconds', () => {
  it('초당 4자로 계산한다', () => {
    expect(SPEAK_CHARS_PER_SEC).toBe(4);
    expect(estimateScriptSeconds('가나다라마사')).toBe(2);
  });

  it('공백은 글자 수에서 뺀다', () => {
    expect(estimateScriptSeconds('가 나 다 라')).toBe(1);
  });

  it('빈 멘트는 0초다', () => {
    expect(estimateScriptSeconds('')).toBe(0);
  });

  it('나머지가 있으면 올림한다', () => {
    expect(estimateScriptSeconds('가나다라마')).toBe(2);
  });
});

describe('estimateSegmentSeconds', () => {
  it('멘트만 있는 순서는 낭독 시간만 센다', () => {
    expect(estimateSegmentSeconds(seg({ script: '가나다라' }), null)).toBe(1);
  });

  it('음원 순서는 멘트 + 음원 길이다', () => {
    const segment = seg({ kind: 'audio', script: '가나다라', audioRole: 'anthem' });
    expect(estimateSegmentSeconds(segment, 200)).toBe(201);
  });

  it('음원이 등록되지 않았으면 음원 시간을 0으로 본다', () => {
    const segment = seg({ kind: 'audio', script: '가나다라', audioRole: 'anthem' });
    expect(estimateSegmentSeconds(segment, null)).toBe(1);
  });

  it('타이머 순서는 멘트 + 타이머 시간이다', () => {
    const segment = seg({ kind: 'timer', script: '가나다라', timerSec: 60 });
    expect(estimateSegmentSeconds(segment, null)).toBe(61);
  });

  it('타이머 시간이 없으면 60초로 본다', () => {
    expect(estimateSegmentSeconds(seg({ kind: 'timer' }), null)).toBe(60);
  });

  it('말씀 순서는 멘트 + 지정한 시간이다', () => {
    const segment = seg({ kind: 'address', script: '가나다라', manualDurationSec: 180 });
    expect(estimateSegmentSeconds(segment, null)).toBe(181);
  });

  it('말씀 시간이 없으면 180초로 본다', () => {
    expect(estimateSegmentSeconds(seg({ kind: 'address' }), null)).toBe(180);
  });
});

describe('estimateTotalSeconds', () => {
  it('음원 길이를 역할로 찾아 합산한다', () => {
    const segments = [
      seg({ id: 's1', kind: 'audio', audioRole: 'anthem' }),
      seg({ id: 's2', kind: 'address', manualDurationSec: 120 }),
    ];
    const durations = new Map<AudioRole, number>([['anthem', 200]]);
    expect(estimateTotalSeconds(segments, durations)).toBe(320);
  });

  it('순서가 없으면 0초다', () => {
    expect(estimateTotalSeconds([], new Map())).toBe(0);
  });
});
```

`src/domain/blanks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findBlanks, findBlanksInEvent, countBlanks } from './blanks';
import { createEventFromTemplate } from './templates';

const init = {
  title: '개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

describe('findBlanks', () => {
  it('이중 중괄호 안의 이름을 뽑는다', () => {
    expect(findBlanks('{{교장 성함}} 선생님의 말씀')).toEqual(['교장 성함']);
  });

  it('여러 개를 순서대로 뽑는다', () => {
    expect(findBlanks('{{학교명}} {{교장 성함}}')).toEqual(['학교명', '교장 성함']);
  });

  it('앞뒤 공백을 없앤다', () => {
    expect(findBlanks('{{  교장 성함  }}')).toEqual(['교장 성함']);
  });

  it('빈칸이 없으면 빈 배열이다', () => {
    expect(findBlanks('평범한 문장입니다.')).toEqual([]);
  });

  it('중괄호 하나짜리는 빈칸이 아니다', () => {
    expect(findBlanks('{교장 성함}')).toEqual([]);
  });
});

describe('findBlanksInEvent', () => {
  it('빈칸이 있는 순서만 돌려준다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}} 개학식을 시작하겠습니다.';
    event.segments[1].script = '국기에 대하여 경례.';

    const hits = findBlanksInEvent(event);
    expect(hits).toHaveLength(1);
    expect(hits[0].segmentName).toBe('개식사');
    expect(hits[0].labels).toEqual(['학교명']);
  });

  it('빈칸 총 개수를 센다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}} {{교장 성함}}';
    event.segments[4].script = '{{교장 성함}}';
    expect(countBlanks(event)).toBe(3);
  });

  it('빈칸이 하나도 없으면 0이다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(countBlanks(event)).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- timeEstimator blanks`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/domain/timeEstimator.ts`:

```ts
import type { AudioRole, Segment } from '../types';

export const SPEAK_CHARS_PER_SEC = 4;
export const DEFAULT_TIMER_SEC = 60;
export const DEFAULT_ADDRESS_SEC = 180;

export function estimateScriptSeconds(script: string): number {
  const chars = script.replace(/\s/g, '').length;
  return Math.ceil(chars / SPEAK_CHARS_PER_SEC);
}

export function estimateSegmentSeconds(
  segment: Segment,
  audioDurationSec: number | null,
): number {
  const speaking = estimateScriptSeconds(segment.script);

  switch (segment.kind) {
    case 'address':
      return speaking + (segment.manualDurationSec ?? DEFAULT_ADDRESS_SEC);
    case 'timer':
      return speaking + (segment.timerSec ?? DEFAULT_TIMER_SEC);
    case 'audio':
      return speaking + (audioDurationSec ?? 0);
    case 'speech':
      return speaking;
  }
}

export function estimateTotalSeconds(
  segments: Segment[],
  durationsByRole: Map<AudioRole, number>,
): number {
  return segments.reduce((sum, segment) => {
    const duration =
      segment.audioRole === null ? null : durationsByRole.get(segment.audioRole) ?? null;
    return sum + estimateSegmentSeconds(segment, duration);
  }, 0);
}
```

`src/domain/blanks.ts`:

```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- timeEstimator blanks`
Expected: PASS (21 tests)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: 예상 시간 계산과 빈칸 검출 도메인 로직"
```

---

## Task 8: 순서 편집 연산 (순수 함수)

**Files:**
- Create: `src/domain/segmentOps.ts`
- Test: `src/domain/segmentOps.test.ts`

**Interfaces:**
- Consumes: `Segment` (Task 1), `SegmentSeed` (Task 6), `newId` (Task 1)
- Produces:
  - `reindex(segments: Segment[]): Segment[]` — `order`를 0부터 다시 매긴다
  - `moveSegment(segments: Segment[], id: string, delta: number): Segment[]`
  - `removeSegment(segments: Segment[], id: string): Segment[]`
  - `updateSegment(segments: Segment[], id: string, patch: Partial<Segment>): Segment[]`
  - `insertSegment(segments: Segment[], seed: SegmentSeed, atIndex: number): Segment[]`

이 연산들을 순수 함수로 분리하는 이유: 편집기 UI는 렌더링만 하고, 순서가 꼬이는 버그는 전부 여기서 테스트로 잡는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/segmentOps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { reindex, moveSegment, removeSegment, updateSegment, insertSegment } from './segmentOps';
import type { Segment } from '../types';

function seg(id: string, name: string, order: number): Segment {
  return {
    id,
    order,
    name,
    groupLabel: null,
    kind: 'speech',
    script: '',
    audioRole: null,
    autoPlay: false,
    fadeOutSec: null,
    timerSec: null,
    manualDurationSec: null,
    note: '',
  };
}

const base = [seg('a', '개식사', 0), seg('b', '애국가', 1), seg('c', '폐식사', 2)];

describe('reindex', () => {
  it('order를 0부터 다시 매긴다', () => {
    const messy = [seg('a', 'A', 7), seg('b', 'B', 3)];
    expect(reindex(messy).map((s) => s.order)).toEqual([0, 1]);
  });
});

describe('moveSegment', () => {
  it('한 칸 위로 올린다', () => {
    expect(moveSegment(base, 'b', -1).map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('한 칸 아래로 내린다', () => {
    expect(moveSegment(base, 'b', 1).map((s) => s.id)).toEqual(['a', 'c', 'b']);
  });

  it('맨 위에서 더 올리면 그대로 둔다', () => {
    expect(moveSegment(base, 'a', -1).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('맨 아래에서 더 내리면 그대로 둔다', () => {
    expect(moveSegment(base, 'c', 1).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('없는 id는 그대로 둔다', () => {
    expect(moveSegment(base, '없음', 1).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('이동 후 order를 다시 매긴다', () => {
    expect(moveSegment(base, 'b', -1).map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    moveSegment(base, 'b', -1);
    expect(base.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('removeSegment', () => {
  it('해당 순서를 지우고 order를 다시 매긴다', () => {
    const result = removeSegment(base, 'b');
    expect(result.map((s) => s.id)).toEqual(['a', 'c']);
    expect(result.map((s) => s.order)).toEqual([0, 1]);
  });

  it('없는 id면 그대로 둔다', () => {
    expect(removeSegment(base, '없음')).toHaveLength(3);
  });
});

describe('updateSegment', () => {
  it('지정한 순서만 바꾼다', () => {
    const result = updateSegment(base, 'b', { script: '애국가를 제창하겠습니다.' });
    expect(result[1].script).toBe('애국가를 제창하겠습니다.');
    expect(result[0].script).toBe('');
  });

  it('id와 order는 덮어쓰지 못한다', () => {
    const result = updateSegment(base, 'b', { id: '해킹', order: 99 } as Partial<Segment>);
    expect(result[1].id).toBe('b');
    expect(result[1].order).toBe(1);
  });
});

describe('insertSegment', () => {
  const seed = {
    name: '시상',
    groupLabel: null,
    kind: 'speech' as const,
    script: '',
    audioRole: null,
    autoPlay: false,
    fadeOutSec: null,
    timerSec: null,
    manualDurationSec: null,
    note: '',
  };

  it('지정한 위치에 새 순서를 넣는다', () => {
    const result = insertSegment(base, seed, 1);
    expect(result.map((s) => s.name)).toEqual(['개식사', '시상', '애국가', '폐식사']);
  });

  it('새 순서에 고유 id를 준다', () => {
    const result = insertSegment(base, seed, 1);
    expect(new Set(result.map((s) => s.id)).size).toBe(4);
  });

  it('맨 끝에 넣을 수 있다', () => {
    expect(insertSegment(base, seed, 3).map((s) => s.name).at(-1)).toBe('시상');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- segmentOps`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/domain/segmentOps.ts`:

```ts
import { newId } from '../lib/id';
import type { Segment } from '../types';
import type { SegmentSeed } from './templates';

export function reindex(segments: Segment[]): Segment[] {
  return segments.map((segment, index) => ({ ...segment, order: index }));
}

export function moveSegment(segments: Segment[], id: string, delta: number): Segment[] {
  const from = segments.findIndex((segment) => segment.id === id);
  if (from === -1) return segments;

  const to = from + delta;
  if (to < 0 || to >= segments.length) return segments;

  const next = [...segments];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return reindex(next);
}

export function removeSegment(segments: Segment[], id: string): Segment[] {
  return reindex(segments.filter((segment) => segment.id !== id));
}

export function updateSegment(
  segments: Segment[],
  id: string,
  patch: Partial<Segment>,
): Segment[] {
  return segments.map((segment) =>
    segment.id === id ? { ...segment, ...patch, id: segment.id, order: segment.order } : segment,
  );
}

export function insertSegment(
  segments: Segment[],
  seed: SegmentSeed,
  atIndex: number,
): Segment[] {
  const next = [...segments];
  next.splice(atIndex, 0, { ...seed, id: newId('seg'), order: atIndex });
  return reindex(next);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- segmentOps`
Expected: PASS (15 tests)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: 순서 이동·삭제·추가 편집 연산"
```

---

## Task 9: 시나리오 편집기 화면

**Files:**
- Create: `src/ui/editor/ScriptField.tsx`, `src/ui/editor/SegmentCard.tsx`, `src/ui/editor/EditorPage.tsx`
- Modify: `src/ui/App.tsx`
- Test: `src/ui/editor/EditorPage.test.tsx`

**Interfaces:**
- Consumes: `getEvent`·`putEvent` (Task 6), `segmentOps`(insertSegment 포함) (Task 8), `STANDARD_EXTRA_SEEDS` (Task 6), `estimateTotalSeconds` (Task 7), `countBlanks`·`findBlanks` (Task 7), `listAudio` (Task 4), `roleLabel`·`STANDARD_ROLES` (Task 5), `formatDuration` (Task 1)
- Produces:
  - 라우트 `#/event/:eventId/edit`
  - `<EditorPage />`, `<SegmentCard />`, `<ScriptField />`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/editor/EditorPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { getEvent, putEvent } from '../../db/eventRepo';
import { createEventFromTemplate } from '../../domain/templates';
import EditorPage from './EditorPage';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

async function renderEditor() {
  const event = createEventFromTemplate('semester-opening', init);
  await putEvent(event);
  render(
    <MemoryRouter initialEntries={[`/event/${event.id}/edit`]}>
      <Routes>
        <Route path="/event/:eventId/edit" element={<EditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return event;
}

describe('EditorPage', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('행사 제목과 순서 목록을 보여준다', async () => {
    await renderEditor();
    expect(await screen.findByText('2학기 개학식')).toBeInTheDocument();
    expect(screen.getByText('개식사')).toBeInTheDocument();
    expect(screen.getByText('교가 제창')).toBeInTheDocument();
  });

  it('총 예상 시간을 보여준다', async () => {
    await renderEditor();
    expect(await screen.findByTestId('total-time')).toHaveTextContent('예상');
  });

  it('멘트를 고치면 저장한다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();

    const card = await screen.findByTestId(`card-${event.segments[0].id}`);
    await user.click(within(card).getByRole('button', { name: '펼치기' }));
    await user.type(
      within(card).getByLabelText('사회자 멘트'),
      '개학식을 시작하겠습니다.',
    );
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(async () => {
      const saved = await getEvent(event.id);
      expect(saved?.segments[0].script).toBe('개학식을 시작하겠습니다.');
    });
  });

  it('순서를 위로 올릴 수 있다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();

    const card = await screen.findByTestId(`card-${event.segments[1].id}`);
    await user.click(within(card).getByRole('button', { name: '위로' }));

    const names = screen.getAllByTestId('segment-name').map((el) => el.textContent);
    expect(names[0]).toBe('국기에 대한 경례');
    expect(names[1]).toBe('개식사');
  });

  it('순서를 삭제할 수 있다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();

    const card = await screen.findByTestId(`card-${event.segments[0].id}`);
    await user.click(within(card).getByRole('button', { name: '삭제' }));

    expect(screen.queryByText('개식사')).not.toBeInTheDocument();
  });

  it('빈칸이 있으면 개수를 경고한다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();

    const card = await screen.findByTestId(`card-${event.segments[0].id}`);
    await user.click(within(card).getByRole('button', { name: '펼치기' }));
    await user.type(within(card).getByLabelText('사회자 멘트'), '{{{{학교명}} 개학식');

    expect(await screen.findByTestId('blank-warning')).toHaveTextContent('채워야 할 빈칸 1곳');
  });

  it('표준 순서를 골라 맨 끝에 넣을 수 있다', async () => {
    const user = userEvent.setup();
    await renderEditor();

    await user.click(await screen.findByRole('button', { name: '＋ 순서 추가' }));
    await user.click(await screen.findByRole('button', { name: '전달 사항' }));

    const names = screen.getAllByTestId('segment-name').map((el) => el.textContent);
    expect(names).toHaveLength(8);
    expect(names.at(-1)).toBe('전달 사항');
  });

  it('추가한 전달 사항은 말씀 종류로 들어간다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();

    await user.click(await screen.findByRole('button', { name: '＋ 순서 추가' }));
    await user.click(await screen.findByRole('button', { name: '전달 사항' }));
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(async () => {
      const saved = await getEvent(event.id);
      const added = saved?.segments.at(-1);
      expect(added?.kind).toBe('address');
      expect(added?.manualDurationSec).toBe(120);
    });
  });

  it('순서 추가 목록을 다시 눌러 닫을 수 있다', async () => {
    const user = userEvent.setup();
    await renderEditor();

    const toggle = await screen.findByRole('button', { name: '＋ 순서 추가' });
    await user.click(toggle);
    expect(screen.getByRole('button', { name: '전달 사항' })).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByRole('button', { name: '전달 사항' })).not.toBeInTheDocument();
  });
});
```

> `userEvent.type`은 `{`를 특수 키 시작으로 읽는다. 여는 중괄호 하나를 넣으려면 `{{`로 겹쳐 쓴다(`}`는 그냥 닫는 중괄호다). 그래서 `{{학교명}}`을 입력하려면 앞쪽 중괄호만 네 개로 적어 `{{{{학교명}}`로 쓴다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- EditorPage`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 멘트 입력 컴포넌트 구현**

`src/ui/editor/ScriptField.tsx`:

```tsx
import { findBlanks } from '../../domain/blanks';

type Props = {
  id: string;
  value: string;
  onChange: (next: string) => void;
};

export default function ScriptField({ id, value, onChange }: Props) {
  const blanks = findBlanks(value);

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium" htmlFor={id}>사회자 멘트</label>
      <textarea
        id={id}
        className="w-full rounded border border-gray-400 p-2"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {blanks.length > 0 && (
        <p className="text-sm">
          <span className="rounded bg-yellow-200 px-1">채워야 할 빈칸</span>{' '}
          {blanks.join(', ')}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 순서 카드 구현**

`src/ui/editor/SegmentCard.tsx`:

```tsx
import { useState } from 'react';
import ScriptField from './ScriptField';
import { STANDARD_ROLES, roleLabel } from '../../audio/roles';
import { formatDuration } from '../../lib/format';
import { estimateSegmentSeconds } from '../../domain/timeEstimator';
import type { AudioRole, Segment } from '../../types';

type Props = {
  segment: Segment;
  audioDurationSec: number | null;
  audioMissing: boolean;
  onChange: (patch: Partial<Segment>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
};

export default function SegmentCard({
  segment,
  audioDurationSec,
  audioMissing,
  onChange,
  onMove,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(false);
  const seconds = estimateSegmentSeconds(segment, audioDurationSec);

  return (
    <li data-testid={`card-${segment.id}`} className="rounded border border-gray-300 p-3">
      <div className="flex items-center gap-2">
        {segment.groupLabel !== null && (
          <span className="rounded bg-gray-200 px-2 py-0.5 text-xs">{segment.groupLabel}</span>
        )}
        <span data-testid="segment-name" className="flex-1 font-medium">
          {segment.name}
        </span>
        <span className="text-sm text-gray-500">{formatDuration(seconds)}</span>
        <button className="px-2" aria-label="위로" onClick={() => onMove(-1)}>▲</button>
        <button className="px-2" aria-label="아래로" onClick={() => onMove(1)}>▼</button>
        <button className="px-2 text-red-600" onClick={onRemove}>삭제</button>
        <button className="px-2 text-blue-600" onClick={() => setOpen(!open)}>
          {open ? '접기' : '펼치기'}
        </button>
      </div>

      {segment.audioRole !== null && (
        <p className="mt-1 text-sm">
          🎵 {roleLabel(segment.audioRole)}
          {audioMissing && <span className="ml-2 text-red-600">⚠ 이 기기에 음원이 없습니다</span>}
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-sm font-medium" htmlFor={`name-${segment.id}`}>순서명</label>
            <input
              id={`name-${segment.id}`}
              className="w-full rounded border border-gray-400 px-2 py-1"
              value={segment.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>

          <ScriptField
            id={`script-${segment.id}`}
            value={segment.script}
            onChange={(script) => onChange({ script })}
          />

          <div>
            <label className="block text-sm font-medium" htmlFor={`role-${segment.id}`}>연결 음원</label>
            <select
              id={`role-${segment.id}`}
              className="rounded border border-gray-400 px-2 py-1"
              value={segment.audioRole ?? ''}
              onChange={(e) =>
                onChange({ audioRole: e.target.value === '' ? null : (e.target.value as AudioRole) })
              }
            >
              <option value="">없음</option>
              {STANDARD_ROLES.map(({ role, label }) => (
                <option key={role} value={role}>{label}</option>
              ))}
            </select>
          </div>

          {segment.kind === 'timer' && (
            <div>
              <label className="block text-sm font-medium" htmlFor={`timer-${segment.id}`}>묵념 시간(초)</label>
              <input
                id={`timer-${segment.id}`}
                type="number"
                className="w-28 rounded border border-gray-400 px-2 py-1"
                value={segment.timerSec ?? 60}
                onChange={(e) => onChange({ timerSec: Number(e.target.value) })}
              />
            </div>
          )}

          {segment.kind === 'address' && (
            <div>
              <label className="block text-sm font-medium" htmlFor={`addr-${segment.id}`}>예상 시간(분)</label>
              <input
                id={`addr-${segment.id}`}
                type="number"
                className="w-28 rounded border border-gray-400 px-2 py-1"
                value={Math.round((segment.manualDurationSec ?? 180) / 60)}
                onChange={(e) => onChange({ manualDurationSec: Number(e.target.value) * 60 })}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={segment.autoPlay}
              onChange={(e) => onChange({ autoPlay: e.target.checked })}
            />
            이 순서로 넘어가면 음원을 바로 재생
          </label>

          <div>
            <label className="block text-sm font-medium" htmlFor={`note-${segment.id}`}>진행 메모</label>
            <input
              id={`note-${segment.id}`}
              className="w-full rounded border border-gray-400 px-2 py-1"
              value={segment.note}
              onChange={(e) => onChange({ note: e.target.value })}
            />
          </div>
        </div>
      )}
    </li>
  );
}
```

- [ ] **Step 5: 편집기 화면 구현**

`src/ui/editor/EditorPage.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SegmentCard from './SegmentCard';
import { getEvent, putEvent } from '../../db/eventRepo';
import { listAudio } from '../../db/audioRepo';
import { insertSegment, moveSegment, removeSegment, updateSegment } from '../../domain/segmentOps';
import { STANDARD_EXTRA_SEEDS, blankSeed } from '../../domain/templates';
import { estimateTotalSeconds } from '../../domain/timeEstimator';
import { countBlanks } from '../../domain/blanks';
import { formatDuration } from '../../lib/format';
import type { AudioRole, EventCeremony, Segment } from '../../types';

export default function EditorPage() {
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState<EventCeremony | null>(null);
  const [durations, setDurations] = useState<Map<AudioRole, number>>(new Map());
  const [saved, setSaved] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  useEffect(() => {
    void getEvent(eventId).then(setEvent);
    void listAudio().then((assets) => {
      setDurations(new Map(assets.map((asset) => [asset.role, asset.durationSec])));
    });
  }, [eventId]);

  const setSegments = useCallback((segments: Segment[]) => {
    setSaved(false);
    setEvent((current) => (current === null ? null : { ...current, segments }));
  }, []);

  const totalSeconds = useMemo(
    () => (event === null ? 0 : estimateTotalSeconds(event.segments, durations)),
    [event, durations],
  );

  if (event === null) {
    return <main className="p-8">행사를 불러오는 중입니다…</main>;
  }

  const blankCount = countBlanks(event);

  async function handleSave() {
    if (event === null) return;
    await putEvent({ ...event, updatedAt: Date.now() });
    setSaved(true);
  }

  return (
    <main className="mx-auto max-w-2xl pb-16">
      <header className="sticky top-0 z-10 space-y-1 border-b border-gray-300 bg-white p-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-blue-600">← 홈</Link>
          <h1 className="flex-1 truncate text-lg font-bold">{event.title}</h1>
          <button className="rounded bg-blue-600 px-3 py-1 text-white"
                  onClick={() => void handleSave()}>
            저장
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span data-testid="total-time">예상 {formatDuration(totalSeconds)}</span>
          {blankCount > 0 && (
            <span data-testid="blank-warning" className="rounded bg-yellow-200 px-2">
              채워야 할 빈칸 {blankCount}곳
            </span>
          )}
          {saved && <span className="text-green-700">저장했습니다</span>}
          <Link to={`/event/${event.id}/preflight`} className="ml-auto text-blue-600">
            점검하러 가기 →
          </Link>
        </div>
      </header>

      <ul className="space-y-2 p-3">
        {event.segments.map((segment) => (
          <SegmentCard
            key={segment.id}
            segment={segment}
            audioDurationSec={
              segment.audioRole === null ? null : durations.get(segment.audioRole) ?? null
            }
            audioMissing={segment.audioRole !== null && !durations.has(segment.audioRole)}
            onChange={(patch) => setSegments(updateSegment(event.segments, segment.id, patch))}
            onMove={(delta) => setSegments(moveSegment(event.segments, segment.id, delta))}
            onRemove={() => setSegments(removeSegment(event.segments, segment.id))}
          />
        ))}
      </ul>

      <div className="px-3">
        <button className="rounded border border-gray-400 px-3 py-2"
                onClick={() => setShowPalette(!showPalette)}>
          ＋ 순서 추가
        </button>

        {showPalette && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {STANDARD_EXTRA_SEEDS.map((seed) => (
              <li key={seed.name}>
                <button
                  className="rounded border border-blue-400 px-3 py-1 text-blue-700"
                  onClick={() => {
                    setSegments(insertSegment(event.segments, seed, event.segments.length));
                    setShowPalette(false);
                  }}
                >
                  {seed.name}
                </button>
              </li>
            ))}
            <li>
              <button
                className="rounded border border-gray-400 px-3 py-1"
                onClick={() => {
                  setSegments(insertSegment(event.segments, blankSeed(), event.segments.length));
                  setShowPalette(false);
                }}
              >
                직접 입력
              </button>
            </li>
          </ul>
        )}
      </div>
    </main>
  );
}
```

`전달 사항`처럼 학교마다 다른 순서는 기본 식순에 없고 여기서 한 번에 넣는다. 넣은 뒤에는 ▲▼로 원하는 자리로 옮긴다.

- [ ] **Step 6: 라우트 등록**

`src/ui/App.tsx`에 추가한다.

```tsx
import EditorPage from './editor/EditorPage';
// ...
<Route path="/event/:eventId/edit" element={<EditorPage />} />
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (전체 108개)

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: 시나리오 편집기 화면"
```

---

## Task 10: 진행 모드 상태 기계 (순수 함수)

**Files:**
- Create: `src/domain/runMachine.ts`
- Test: `src/domain/runMachine.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type RunPhase = 'ready' | 'running' | 'finished'`
  - `type RunModel = { phase: RunPhase; index: number; total: number }`
  - `type RunAction = { type: 'start' } | { type: 'next' } | { type: 'prev' } | { type: 'jump'; index: number } | { type: 'restart' }`
  - `createRunModel(total: number, index?: number): RunModel`
  - `runReducer(state: RunModel, action: RunAction): RunModel`

진행 중 순서가 튀거나 마지막에서 넘어가지 않는 버그는 전부 여기서 잡는다. 화면은 이 함수의 결과만 그린다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/runMachine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRunModel, runReducer } from './runMachine';

describe('createRunModel', () => {
  it('처음에는 시작 전 상태다', () => {
    expect(createRunModel(8)).toEqual({ phase: 'ready', index: 0, total: 8 });
  });

  it('중단된 위치에서 되살릴 수 있다', () => {
    expect(createRunModel(8, 3).index).toBe(3);
  });

  it('범위를 벗어난 위치는 잘라낸다', () => {
    expect(createRunModel(8, 99).index).toBe(7);
    expect(createRunModel(8, -5).index).toBe(0);
  });
});

describe('runReducer', () => {
  const ready = createRunModel(3);
  const running = { phase: 'running' as const, index: 0, total: 3 };

  it('시작하면 진행 상태가 된다', () => {
    expect(runReducer(ready, { type: 'start' })).toEqual({ phase: 'running', index: 0, total: 3 });
  });

  it('순서가 하나도 없으면 시작하자마자 끝난다', () => {
    expect(runReducer(createRunModel(0), { type: 'start' }).phase).toBe('finished');
  });

  it('다음으로 넘어간다', () => {
    expect(runReducer(running, { type: 'next' }).index).toBe(1);
  });

  it('마지막에서 다음을 누르면 종료된다', () => {
    const last = { ...running, index: 2 };
    expect(runReducer(last, { type: 'next' })).toEqual({ phase: 'finished', index: 2, total: 3 });
  });

  it('이전으로 돌아간다', () => {
    expect(runReducer({ ...running, index: 2 }, { type: 'prev' }).index).toBe(1);
  });

  it('첫 순서에서 이전을 누르면 그대로 있는다', () => {
    expect(runReducer(running, { type: 'prev' }).index).toBe(0);
  });

  it('종료 상태에서 이전을 누르면 마지막 순서로 돌아간다', () => {
    const finished = { phase: 'finished' as const, index: 2, total: 3 };
    expect(runReducer(finished, { type: 'prev' })).toEqual({
      phase: 'running',
      index: 2,
      total: 3,
    });
  });

  it('임의 순서로 건너뛴다', () => {
    expect(runReducer(running, { type: 'jump', index: 2 })).toEqual({
      phase: 'running',
      index: 2,
      total: 3,
    });
  });

  it('건너뛸 위치가 범위를 벗어나면 잘라낸다', () => {
    expect(runReducer(running, { type: 'jump', index: 99 }).index).toBe(2);
    expect(runReducer(running, { type: 'jump', index: -1 }).index).toBe(0);
  });

  it('시작 전에는 다음이 눌려도 움직이지 않는다', () => {
    expect(runReducer(ready, { type: 'next' })).toEqual(ready);
  });

  it('처음으로 되돌린다', () => {
    expect(runReducer({ ...running, index: 2 }, { type: 'restart' })).toEqual({
      phase: 'ready',
      index: 0,
      total: 3,
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- runMachine`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/domain/runMachine.ts`:

```ts
export type RunPhase = 'ready' | 'running' | 'finished';

export type RunModel = {
  phase: RunPhase;
  index: number;
  total: number;
};

export type RunAction =
  | { type: 'start' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'jump'; index: number }
  | { type: 'restart' };

function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

export function createRunModel(total: number, index = 0): RunModel {
  return { phase: 'ready', index: clampIndex(index, total), total };
}

export function runReducer(state: RunModel, action: RunAction): RunModel {
  switch (action.type) {
    case 'start':
      if (state.total === 0) return { ...state, phase: 'finished' };
      return { ...state, phase: 'running' };

    case 'next':
      if (state.phase !== 'running') return state;
      if (state.index >= state.total - 1) return { ...state, phase: 'finished' };
      return { ...state, index: state.index + 1 };

    case 'prev':
      if (state.phase === 'finished') return { ...state, phase: 'running' };
      if (state.phase !== 'running') return state;
      return { ...state, index: clampIndex(state.index - 1, state.total) };

    case 'jump':
      return { ...state, phase: 'running', index: clampIndex(action.index, state.total) };

    case 'restart':
      return { phase: 'ready', index: 0, total: state.total };
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- runMachine`
Expected: PASS (14 tests)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: 진행 모드 상태 기계"
```

---

## Task 11: 오디오 재생 제어

**Files:**
- Create: `src/audio/AudioController.ts`, `src/audio/usePlayer.ts`
- Test: `src/audio/AudioController.test.ts`

**Interfaces:**
- Consumes: `AudioAsset` (Task 1)
- Produces:
  - `type MediaLike = { play(): Promise<void>; pause(): void; currentTime: number; volume: number }`
  - `class AudioController` — `play()`, `pause()`, `restart()`, `setVolume(v)`, `getVolume()`, `fadeOut(seconds, stepMs?)`
  - `type PlayerStatus = 'idle' | 'ready' | 'playing' | 'paused' | 'fading' | 'ended'`
  - `usePlayer(asset: AudioAsset | null): { status; currentTime; duration; volume; play; pause; restart; fadeOut; setVolume }`

재생 로직은 `AudioController`가 전부 갖고 테스트로 덮는다. `usePlayer`는 React 수명주기에 묶어주는 얇은 껍데기라서 눈으로 확인한다 (jsdom에는 실제 오디오 디코더가 없어 자동 테스트가 무의미하다).

- [ ] **Step 1: 실패하는 테스트 작성**

`src/audio/AudioController.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioController, type MediaLike } from './AudioController';

function fakeMedia(): MediaLike & { paused: boolean; playCount: number } {
  return {
    currentTime: 0,
    volume: 1,
    paused: true,
    playCount: 0,
    play() {
      this.paused = false;
      this.playCount += 1;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
  };
}

describe('AudioController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('재생하면 소리가 난다', async () => {
    const media = fakeMedia();
    await new AudioController(media).play();
    expect(media.paused).toBe(false);
  });

  it('일시정지하면 멈춘다', async () => {
    const media = fakeMedia();
    const controller = new AudioController(media);
    await controller.play();
    controller.pause();
    expect(media.paused).toBe(true);
  });

  it('처음부터 다시 재생하면 위치가 0으로 간다', async () => {
    const media = fakeMedia();
    media.currentTime = 90;
    const controller = new AudioController(media);
    await controller.restart();
    expect(media.currentTime).toBe(0);
    expect(media.paused).toBe(false);
  });

  it('볼륨은 0과 1 사이로 잘린다', () => {
    const media = fakeMedia();
    const controller = new AudioController(media);
    controller.setVolume(2);
    expect(controller.getVolume()).toBe(1);
    controller.setVolume(-1);
    expect(controller.getVolume()).toBe(0);
  });

  it('페이드아웃이 끝나면 볼륨을 되돌리고 정지한다', async () => {
    const media = fakeMedia();
    const controller = new AudioController(media);
    await controller.play();

    const done = controller.fadeOut(3, 50);
    await vi.advanceTimersByTimeAsync(3000);
    await done;

    expect(media.paused).toBe(true);
    expect(media.currentTime).toBe(0);
    expect(media.volume).toBe(1);
  });

  it('페이드아웃 중간에는 볼륨이 줄어 있다', async () => {
    const media = fakeMedia();
    const controller = new AudioController(media);
    await controller.play();

    void controller.fadeOut(3, 50);
    await vi.advanceTimersByTimeAsync(1500);

    expect(media.volume).toBeGreaterThan(0);
    expect(media.volume).toBeLessThan(0.7);
  });

  it('설정한 볼륨을 기준으로 페이드한다', async () => {
    const media = fakeMedia();
    const controller = new AudioController(media);
    controller.setVolume(0.5);
    await controller.play();

    const done = controller.fadeOut(1, 50);
    await vi.advanceTimersByTimeAsync(1000);
    await done;

    expect(media.volume).toBe(0.5);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- AudioController`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/audio/AudioController.ts`:

```ts
export type MediaLike = {
  play(): Promise<void>;
  pause(): void;
  currentTime: number;
  volume: number;
};

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export class AudioController {
  private baseVolume = 1;

  constructor(private readonly media: MediaLike) {}

  async play(): Promise<void> {
    this.media.volume = this.baseVolume;
    await this.media.play();
  }

  pause(): void {
    this.media.pause();
  }

  async restart(): Promise<void> {
    this.media.currentTime = 0;
    await this.play();
  }

  setVolume(value: number): void {
    this.baseVolume = clamp01(value);
    this.media.volume = this.baseVolume;
  }

  getVolume(): number {
    return this.baseVolume;
  }

  fadeOut(seconds: number, stepMs = 50): Promise<void> {
    return new Promise((resolve) => {
      const steps = Math.max(1, Math.round((seconds * 1000) / stepMs));
      const startVolume = this.media.volume;
      let done = 0;

      const timer = setInterval(() => {
        done += 1;
        this.media.volume = clamp01(startVolume * (1 - done / steps));

        if (done >= steps) {
          clearInterval(timer);
          this.media.pause();
          this.media.currentTime = 0;
          this.media.volume = this.baseVolume;
          resolve();
        }
      }, stepMs);
    });
  }
}
```

`src/audio/usePlayer.ts`:

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioController } from './AudioController';
import type { AudioAsset } from '../types';

export type PlayerStatus = 'idle' | 'ready' | 'playing' | 'paused' | 'fading' | 'ended';

export function usePlayer(asset: AudioAsset | null) {
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolumeState] = useState(1);

  useEffect(() => {
    if (asset === null) {
      elementRef.current = null;
      setStatus('idle');
      return;
    }

    const url = URL.createObjectURL(new Blob([asset.data], { type: asset.mimeType }));
    const element = new Audio(url);
    element.volume = volume;
    element.ontimeupdate = () => setCurrentTime(element.currentTime);
    element.onended = () => setStatus('ended');
    elementRef.current = element;
    setCurrentTime(0);
    setStatus('ready');

    return () => {
      element.pause();
      element.ontimeupdate = null;
      element.onended = null;
      URL.revokeObjectURL(url);
      elementRef.current = null;
    };
    // volume은 아래 setVolume에서 직접 반영하므로 의존성에 넣지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  const controller = useMemo(
    () => (elementRef.current === null ? null : new AudioController(elementRef.current)),
    [status === 'idle' ? null : elementRef.current],
  );

  return {
    status,
    currentTime,
    duration: asset?.durationSec ?? 0,
    volume,
    async play() {
      if (controller === null) return;
      await controller.play();
      setStatus('playing');
    },
    pause() {
      controller?.pause();
      setStatus('paused');
    },
    async restart() {
      if (controller === null) return;
      await controller.restart();
      setStatus('playing');
    },
    async fadeOut(seconds: number) {
      if (controller === null) return;
      setStatus('fading');
      await controller.fadeOut(seconds);
      setStatus('ready');
    },
    setVolume(next: number) {
      setVolumeState(next);
      if (elementRef.current !== null) elementRef.current.volume = next;
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- AudioController`
Expected: PASS (8 tests)

- [ ] **Step 5: 전체 테스트와 빌드 확인**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: 타입 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: 오디오 재생·페이드아웃 제어와 재생 훅"
```

---

## Task 12: 행사 전 점검

**Files:**
- Create: `src/domain/preflight.ts`, `src/ui/preflight/PreflightPage.tsx`
- Modify: `src/ui/App.tsx`
- Test: `src/domain/preflight.test.ts`, `src/ui/preflight/PreflightPage.test.tsx`

**Interfaces:**
- Consumes: `findBlanksInEvent`·`BlankHit` (Task 7), `estimateTotalSeconds` (Task 7), `getEvent` (Task 6), `listAudio`·`getAvailableRoles` (Task 4), `usePlayer` (Task 11), `roleLabel` (Task 5), `formatDuration` (Task 1)
- Produces:
  - `requiredAudioRoles(event: EventCeremony): AudioRole[]`
  - `type PreflightResult = { blanks: BlankHit[]; missingAudioRoles: AudioRole[]; ok: boolean }`
  - `checkReadiness(event: EventCeremony, availableRoles: Set<AudioRole>): PreflightResult`
  - 라우트 `#/event/:eventId/preflight`

`ok`는 **자동으로 판정 가능한 두 가지**(빈칸 없음, 음원 준비됨)만 본다. 소리가 실제로 들렸는지·방해금지를 켰는지는 사람만 알 수 있으므로 화면에서 확인받는다.

- [ ] **Step 1: 실패하는 도메인 테스트 작성**

`src/domain/preflight.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { requiredAudioRoles, checkReadiness } from './preflight';
import { createEventFromTemplate } from './templates';
import type { AudioRole } from '../types';

const init = {
  title: '개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

const allRoles = new Set<AudioRole>(['pledge', 'anthem', 'silence', 'schoolSong']);

describe('requiredAudioRoles', () => {
  it('시나리오가 쓰는 역할을 중복 없이 모은다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(requiredAudioRoles(event)).toEqual(['pledge', 'anthem', 'silence', 'schoolSong']);
  });

  it('음원을 쓰지 않는 행사는 빈 배열이다', () => {
    expect(requiredAudioRoles(createEventFromTemplate('blank', init))).toEqual([]);
  });
});

describe('checkReadiness', () => {
  it('빈칸도 없고 음원도 다 있으면 통과다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(checkReadiness(event, allRoles).ok).toBe(true);
  });

  it('빈칸이 있으면 통과하지 못한다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}} 개학식';

    const result = checkReadiness(event, allRoles);
    expect(result.ok).toBe(false);
    expect(result.blanks[0].segmentName).toBe('개식사');
  });

  it('음원이 빠지면 통과하지 못하고 빠진 역할을 알려준다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    const partial = new Set<AudioRole>(['pledge', 'anthem', 'silence']);

    const result = checkReadiness(event, partial);
    expect(result.ok).toBe(false);
    expect(result.missingAudioRoles).toEqual(['schoolSong']);
  });

  it('둘 다 문제면 둘 다 보고한다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}}';

    const result = checkReadiness(event, new Set());
    expect(result.blanks).toHaveLength(1);
    expect(result.missingAudioRoles).toHaveLength(4);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- preflight`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 도메인 구현**

`src/domain/preflight.ts`:

```ts
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
```

- [ ] **Step 4: 도메인 테스트 통과 확인**

Run: `npm test -- src/domain/preflight`
Expected: PASS (6 tests)

- [ ] **Step 5: 실패하는 화면 테스트 작성**

`src/ui/preflight/PreflightPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { putEvent } from '../../db/eventRepo';
import { putAudio } from '../../db/audioRepo';
import { createEventFromTemplate } from '../../domain/templates';
import type { AudioRole, EventCeremony } from '../../types';
import PreflightPage from './PreflightPage';

vi.mock('../../audio/usePlayer', () => ({
  usePlayer: () => ({
    status: 'ready',
    currentTime: 0,
    duration: 60,
    volume: 1,
    play: () => Promise.resolve(),
    pause: () => undefined,
    restart: () => Promise.resolve(),
    fadeOut: () => Promise.resolve(),
    setVolume: () => undefined,
  }),
}));

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

async function seedAudio(role: AudioRole) {
  await putAudio({
    id: `audio-${role}`,
    role,
    label: role,
    data: new ArrayBuffer(8),
    mimeType: 'audio/mpeg',
    durationSec: 60,
    fileName: `${role}.mp3`,
    addedAt: 1,
  });
}

async function renderPreflight(event: EventCeremony) {
  await putEvent(event);
  render(
    <MemoryRouter initialEntries={[`/event/${event.id}/preflight`]}>
      <Routes>
        <Route path="/event/:eventId/preflight" element={<PreflightPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PreflightPage', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('빠진 음원을 이름으로 알려준다', async () => {
    await seedAudio('pledge');
    await renderPreflight(createEventFromTemplate('semester-opening', init));

    expect(await screen.findByTestId('check-audio')).toHaveTextContent('교가');
  });

  it('빈칸이 남아 있으면 순서 이름과 함께 보여준다', async () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}} 개학식';
    await renderPreflight(event);

    expect(await screen.findByTestId('check-blanks')).toHaveTextContent('개식사');
  });

  it('조건을 못 채우면 진행 시작 버튼을 누를 수 없다', async () => {
    await renderPreflight(createEventFromTemplate('semester-opening', init));
    expect(await screen.findByRole('button', { name: '진행 시작' })).toBeDisabled();
  });

  it('음원이 다 있고 소리를 확인하면 시작할 수 있다', async () => {
    const user = userEvent.setup();
    for (const role of ['pledge', 'anthem', 'silence', 'schoolSong'] as AudioRole[]) {
      await seedAudio(role);
    }
    await renderPreflight(createEventFromTemplate('semester-opening', init));

    await user.click(await screen.findByRole('button', { name: '소리 테스트' }));
    await user.click(await screen.findByRole('button', { name: '들렸어요' }));

    expect(await screen.findByRole('button', { name: '진행 시작' })).toBeEnabled();
  });

  it('총 예상 시간을 보여준다', async () => {
    await renderPreflight(createEventFromTemplate('semester-opening', init));
    expect(await screen.findByTestId('total-time')).toHaveTextContent('분');
  });
});
```

- [ ] **Step 6: 화면 테스트 실패 확인**

Run: `npm test -- PreflightPage`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 7: 화면 구현**

`src/ui/preflight/PreflightPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getEvent } from '../../db/eventRepo';
import { listAudio } from '../../db/audioRepo';
import { checkReadiness, type PreflightResult } from '../../domain/preflight';
import { estimateTotalSeconds } from '../../domain/timeEstimator';
import { usePlayer } from '../../audio/usePlayer';
import { roleLabel } from '../../audio/roles';
import { formatDuration } from '../../lib/format';
import type { AudioAsset, AudioRole, EventCeremony } from '../../types';

function CheckRow({
  testId,
  ok,
  title,
  children,
}: {
  testId: string;
  ok: boolean;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li data-testid={testId} className="rounded border border-gray-300 p-3">
      <p className="font-medium">
        {ok ? '✅' : '⚠️'} {title}
      </p>
      {children !== undefined && <div className="mt-1 text-sm">{children}</div>}
    </li>
  );
}

export default function PreflightPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventCeremony | null>(null);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [soundConfirmed, setSoundConfirmed] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [dndConfirmed, setDndConfirmed] = useState(false);
  const [wakeLockNote, setWakeLockNote] = useState('');

  const testAsset = assets[0] ?? null;
  const player = usePlayer(testAsset);

  useEffect(() => {
    void (async () => {
      const [loadedEvent, loadedAssets] = await Promise.all([getEvent(eventId), listAudio()]);
      setEvent(loadedEvent);
      setAssets(loadedAssets);
      if (loadedEvent !== null) {
        const roles = new Set<AudioRole>(loadedAssets.map((asset) => asset.role));
        setResult(checkReadiness(loadedEvent, roles));
      }
    })();
  }, [eventId]);

  useEffect(() => {
    if (!('wakeLock' in navigator)) {
      setWakeLockNote('이 브라우저는 화면 꺼짐 방지를 지원하지 않습니다. 화면 자동 잠금을 직접 꺼 주세요.');
    }
  }, []);

  if (event === null || result === null) {
    return <main className="p-8">행사를 불러오는 중입니다…</main>;
  }

  const durations = new Map<AudioRole, number>(
    assets.map((asset) => [asset.role, asset.durationSec]),
  );
  const totalSeconds = estimateTotalSeconds(event.segments, durations);
  const canStart = result.ok && soundConfirmed;

  async function handleSoundTest() {
    setTestStarted(true);
    await player.play();
    window.setTimeout(() => player.pause(), 3000);
  }

  return (
    <main className="mx-auto max-w-xl p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link to={`/event/${event.id}/edit`} className="text-blue-600">← 편집</Link>
        <h1 className="text-lg font-bold">행사 전 점검</h1>
      </header>

      <p className="mb-3 text-sm text-gray-600">
        행사 5분 전에 이 화면을 통과시켜 주세요. 여기만 통과하면 진행 중 사고가 나지 않습니다.
      </p>

      <ul className="space-y-2">
        <CheckRow
          testId="check-blanks"
          ok={result.blanks.length === 0}
          title={result.blanks.length === 0 ? '채워야 할 빈칸이 없습니다' : '아직 빈칸이 남아 있습니다'}
        >
          {result.blanks.length > 0 && (
            <ul className="list-disc pl-5">
              {result.blanks.map((hit) => (
                <li key={hit.segmentId}>
                  {hit.segmentName} — {hit.labels.join(', ')}
                </li>
              ))}
            </ul>
          )}
        </CheckRow>

        <CheckRow
          testId="check-malformed"
          ok={result.malformed.length === 0}
          title={
            result.malformed.length === 0
              ? '망가진 빈칸 표시가 없습니다'
              : '중괄호가 깨진 곳이 있습니다'
          }
        >
          {result.malformed.length > 0 && (
            <>
              <p className="text-gray-600">
                {'{{교장 성함}}'}처럼 짝이 맞아야 합니다. 한쪽이 빠지면 대본에 그대로 찍힙니다.
              </p>
              <ul className="list-disc pl-5">
                {result.malformed.map((hit) => (
                  <li key={hit.segmentId}>{hit.segmentName}</li>
                ))}
              </ul>
            </>
          )}
        </CheckRow>

        <CheckRow
          testId="check-audio"
          ok={result.missingAudioRoles.length === 0}
          title={
            result.missingAudioRoles.length === 0
              ? '필요한 음원이 이 기기에 모두 있습니다'
              : '이 기기에 없는 음원이 있습니다'
          }
        >
          {result.missingAudioRoles.length > 0 && (
            <p>
              {result.missingAudioRoles.map(roleLabel).join(', ')} —{' '}
              <Link to="/settings" className="text-blue-600">지금 등록하기</Link>
            </p>
          )}
        </CheckRow>

        <CheckRow testId="check-sound" ok={soundConfirmed} title="소리가 실제로 나는지 확인">
          {!soundConfirmed && (
            <div className="space-y-2">
              <p className="text-gray-600">
                아이폰은 옆면 무음 스위치가 켜져 있으면 소리가 나지 않습니다. 꼭 귀로 확인해 주세요.
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded border border-gray-400 px-3 py-1"
                  disabled={testAsset === null}
                  onClick={() => void handleSoundTest()}
                >
                  소리 테스트
                </button>
                {testStarted && (
                  <button
                    className="rounded bg-green-600 px-3 py-1 text-white"
                    onClick={() => setSoundConfirmed(true)}
                  >
                    들렸어요
                  </button>
                )}
              </div>
            </div>
          )}
        </CheckRow>

        <CheckRow testId="check-dnd" ok={dndConfirmed} title="방해금지 모드">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dndConfirmed}
              onChange={(e) => setDndConfirmed(e.target.checked)}
            />
            전화가 오면 소리가 끊깁니다. 방해금지 모드를 켰습니다.
          </label>
          {wakeLockNote !== '' && <p className="mt-1 text-amber-700">{wakeLockNote}</p>}
        </CheckRow>
      </ul>

      <p data-testid="total-time" className="mt-4 text-sm">
        전체 예상 소요 시간 <strong>{formatDuration(totalSeconds)}</strong>
      </p>

      <button
        className="mt-4 w-full rounded bg-blue-600 px-4 py-3 text-lg text-white disabled:bg-gray-400"
        disabled={!canStart}
        onClick={() => navigate(`/event/${event.id}/run`)}
      >
        진행 시작
      </button>
    </main>
  );
}
```

- [ ] **Step 8: 라우트 등록**

`src/ui/App.tsx`에 추가한다.

```tsx
import PreflightPage from './preflight/PreflightPage';
// ...
<Route path="/event/:eventId/preflight" element={<PreflightPage />} />
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (전체)

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat: 행사 전 점검 도메인 판정과 점검 화면"
```

---

## Task 13: 진행 모드 화면

**Files:**
- Create: `src/db/runStateRepo.ts`, `src/ui/run/useWakeLock.ts`, `src/ui/run/RunPage.tsx`
- Modify: `src/ui/App.tsx`
- Test: `src/db/runStateRepo.test.ts`, `src/ui/run/RunPage.test.tsx`

**Interfaces:**
- Consumes: `runReducer`·`createRunModel` (Task 10), `usePlayer` (Task 11), `getEvent` (Task 6), `listAudio` (Task 4), `roleLabel` (Task 5), `formatDuration` (Task 1)
- Produces:
  - `getRunState(): Promise<RunState | null>`, `saveRunState(state: RunState): Promise<void>`, `clearRunState(): Promise<void>`
  - `useWakeLock(active: boolean): { supported: boolean }`
  - 라우트 `#/event/:eventId/run`

- [ ] **Step 1: 실패하는 저장소 테스트 작성**

`src/db/runStateRepo.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { clearDb } from './testUtils';
import { getRunState, saveRunState, clearRunState } from './runStateRepo';

const sample = {
  id: 'singleton' as const,
  eventId: 'event-1',
  currentIndex: 3,
  startedAt: 100,
  updatedAt: 200,
};

describe('runStateRepo', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('저장한 진행 위치를 읽는다', async () => {
    await saveRunState(sample);
    expect((await getRunState())?.currentIndex).toBe(3);
  });

  it('저장한 적 없으면 null이다', async () => {
    expect(await getRunState()).toBeNull();
  });

  it('지우면 null이 된다', async () => {
    await saveRunState(sample);
    await clearRunState();
    expect(await getRunState()).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- runStateRepo`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 저장소와 화면 잠금 훅 구현**

`src/db/runStateRepo.ts`:

```ts
import { openHbDb } from './schema';
import type { RunState } from '../types';

export async function getRunState(): Promise<RunState | null> {
  const db = await openHbDb();
  return (await db.get('runState', 'singleton')) ?? null;
}

export async function saveRunState(state: RunState): Promise<void> {
  const db = await openHbDb();
  await db.put('runState', state);
}

export async function clearRunState(): Promise<void> {
  const db = await openHbDb();
  await db.delete('runState', 'singleton');
}
```

`src/ui/run/useWakeLock.ts`:

```ts
import { useEffect, useState } from 'react';

type WakeLockSentinelLike = { release(): Promise<void> };
type WakeLockCapableNavigator = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
};

export function useWakeLock(active: boolean): { supported: boolean } {
  const wakeLock = (navigator as WakeLockCapableNavigator).wakeLock;
  const supported = wakeLock !== undefined;

  useEffect(() => {
    if (!active || wakeLock === undefined) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let released = false;

    async function acquire() {
      try {
        sentinel = await wakeLock!.request('screen');
      } catch {
        // 사용자가 거부했거나 배터리 절약 모드다. 화면이 꺼질 수 있을 뿐 진행에는 지장이 없다.
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible' && !released) void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      void sentinel?.release();
    };
  }, [active, wakeLock]);

  return { supported };
}
```

- [ ] **Step 4: 실패하는 화면 테스트 작성**

`src/ui/run/RunPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { putEvent } from '../../db/eventRepo';
import { createEventFromTemplate } from '../../domain/templates';
import { updateSegment } from '../../domain/segmentOps';
import RunPage from './RunPage';

const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();

vi.mock('../../audio/usePlayer', () => ({
  usePlayer: () => ({
    status: 'ready',
    currentTime: 0,
    duration: 222,
    volume: 1,
    play,
    pause,
    restart: () => Promise.resolve(),
    fadeOut: () => Promise.resolve(),
    setVolume: () => undefined,
  }),
}));

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

async function renderRun() {
  let event = createEventFromTemplate('semester-opening', init);
  event = {
    ...event,
    segments: updateSegment(event.segments, event.segments[0].id, {
      script: '개학식을 시작하겠습니다.',
    }),
  };
  await putEvent(event);

  render(
    <MemoryRouter initialEntries={[`/event/${event.id}/run`]}>
      <Routes>
        <Route path="/event/:eventId/run" element={<RunPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return event;
}

describe('RunPage', () => {
  beforeEach(async () => {
    await clearDb();
    play.mockClear();
    pause.mockClear();
  });

  it('첫 순서의 멘트를 크게 보여준다', async () => {
    await renderRun();
    expect(await screen.findByTestId('script')).toHaveTextContent('개학식을 시작하겠습니다.');
  });

  it('진행 위치와 전체 순서 수를 보여준다', async () => {
    await renderRun();
    expect(await screen.findByTestId('position')).toHaveTextContent('1 / 7');
  });

  it('다음 순서를 미리 보여준다', async () => {
    await renderRun();
    expect(await screen.findByTestId('next-preview')).toHaveTextContent('국기에 대한 경례');
  });

  it('다음 버튼으로 넘어간다', async () => {
    const user = userEvent.setup();
    await renderRun();

    await user.click(await screen.findByRole('button', { name: '다음' }));
    expect(await screen.findByTestId('position')).toHaveTextContent('2 / 7');
  });

  it('첫 순서에서는 이전 버튼이 비활성이다', async () => {
    await renderRun();
    expect(await screen.findByRole('button', { name: '이전' })).toBeDisabled();
  });

  it('음원이 붙은 순서에서는 자동 재생하지 않는다', async () => {
    const user = userEvent.setup();
    await renderRun();

    await user.click(await screen.findByRole('button', { name: '다음' }));
    expect(play).not.toHaveBeenCalled();
  });

  it('재생 버튼을 누르면 재생한다', async () => {
    const user = userEvent.setup();
    await renderRun();

    await user.click(await screen.findByRole('button', { name: '다음' }));
    await user.click(await screen.findByRole('button', { name: '재생' }));
    expect(play).toHaveBeenCalled();
  });

  it('잠금을 켜면 다음 버튼이 막힌다', async () => {
    const user = userEvent.setup();
    await renderRun();

    await user.click(await screen.findByRole('button', { name: '화면 잠금' }));
    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByTestId('position')).toHaveTextContent('1 / 7');
  });

  it('마지막 순서에서 다음을 누르면 종료 화면이 나온다', async () => {
    const user = userEvent.setup();
    await renderRun();

    const next = await screen.findByRole('button', { name: '다음' });
    for (let i = 0; i < 7; i += 1) await user.click(next);

    expect(await screen.findByText('행사가 끝났습니다')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: 화면 테스트 실패 확인**

Run: `npm test -- RunPage`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 6: 진행 모드 화면 구현**

`src/ui/run/RunPage.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createRunModel, runReducer } from '../../domain/runMachine';
import { getEvent } from '../../db/eventRepo';
import { listAudio } from '../../db/audioRepo';
import { clearRunState, saveRunState } from '../../db/runStateRepo';
import { usePlayer } from '../../audio/usePlayer';
import { useWakeLock } from './useWakeLock';
import { roleLabel } from '../../audio/roles';
import { formatDuration } from '../../lib/format';
import type { AudioAsset, EventCeremony } from '../../types';

export default function RunPage() {
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState<EventCeremony | null>(null);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [run, dispatch] = useReducer(runReducer, createRunModel(0));
  const [locked, setLocked] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);

  useWakeLock(run.phase === 'running');

  useEffect(() => {
    void (async () => {
      const [loadedEvent, loadedAssets] = await Promise.all([getEvent(eventId), listAudio()]);
      setEvent(loadedEvent);
      setAssets(loadedAssets);
      if (loadedEvent !== null) {
        dispatch({ type: 'jump', index: 0 });
      }
    })();
  }, [eventId]);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const segment = event?.segments[run.index] ?? null;
  const nextSegment = event?.segments[run.index + 1] ?? null;

  const asset = useMemo(() => {
    if (segment === null || segment.audioRole === null) return null;
    return assets.find((entry) => entry.role === segment.audioRole) ?? null;
  }, [segment, assets]);

  const player = usePlayer(asset);

  // 순서가 바뀌면 타이머를 다시 세팅한다.
  useEffect(() => {
    setRemaining(segment !== null && segment.kind === 'timer' ? segment.timerSec ?? 60 : null);
  }, [segment]);

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  useEffect(() => {
    if (event === null || run.phase !== 'running') return;
    void saveRunState({
      id: 'singleton',
      eventId: event.id,
      currentIndex: run.index,
      startedAt,
      updatedAt: Date.now(),
    });
  }, [event, run.phase, run.index, startedAt]);

  useEffect(() => {
    if (run.phase === 'finished') void clearRunState();
  }, [run.phase]);

  const go = useCallback(
    (action: 'next' | 'prev') => {
      if (locked) return;
      player.pause();
      dispatch({ type: action });
    },
    [locked, player],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go('next');
      if (e.key === 'ArrowLeft') go('prev');
      if (e.key === ' ') {
        e.preventDefault();
        void (player.status === 'playing' ? player.pause() : player.play());
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, player]);

  if (event === null) {
    return <main className="p-8 text-white">행사를 불러오는 중입니다…</main>;
  }

  if (run.phase === 'finished') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <h1 className="text-3xl font-bold">행사가 끝났습니다</h1>
        <p>총 소요 시간 {formatDuration(elapsed)}</p>
        <Link to="/" className="rounded bg-blue-600 px-4 py-2">홈으로</Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-900 text-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-700 p-3 text-sm">
        <span className="font-medium">{event.title}</span>
        <span data-testid="position">
          {run.index + 1} / {event.segments.length}
        </span>
        <span>경과 {formatDuration(elapsed)}</span>
        <button className="rounded border border-slate-600 px-2"
                onClick={() => setLocked(!locked)}>
          {locked ? '잠금 해제' : '화면 잠금'}
        </button>
        <button className="rounded border border-slate-600 px-2"
                onClick={() => setFontScale(Math.min(fontScale + 0.2, 2.5))}>A+</button>
        <button className="rounded border border-slate-600 px-2"
                onClick={() => setFontScale(Math.max(fontScale - 0.2, 0.8))}>A−</button>
        <button className="ml-auto rounded border border-slate-600 px-2"
                onClick={() => setShowList(!showList)}>목록</button>
      </header>

      {showList && (
        <ul className="border-b border-slate-700 p-2 text-sm">
          {event.segments.map((entry, index) => (
            <li key={entry.id}>
              <button
                className={`w-full px-2 py-1 text-left ${index === run.index ? 'bg-slate-700' : ''}`}
                onClick={() => {
                  dispatch({ type: 'jump', index });
                  setShowList(false);
                }}
              >
                {index + 1}. {entry.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-1 flex-col justify-center p-6">
        <p className="mb-2 text-slate-400">{segment?.name}</p>
        <p data-testid="script"
           className="whitespace-pre-wrap font-bold leading-relaxed"
           style={{ fontSize: `${fontScale * 2}rem` }}>
          {segment?.script === '' ? '(멘트가 비어 있습니다)' : segment?.script}
        </p>
        {segment?.note !== '' && (
          <p className="mt-4 text-slate-400">📋 {segment?.note}</p>
        )}
        {remaining !== null && (
          <p className={`mt-6 text-5xl font-bold ${remaining === 0 ? 'text-amber-300' : ''}`}>
            {remaining === 0 ? '묵념을 끝내 주세요' : formatDuration(remaining)}
          </p>
        )}
      </section>

      {segment?.audioRole !== null && segment !== null && (
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-700 p-3">
          <span>🎵 {roleLabel(segment.audioRole!)}</span>
          {asset === null ? (
            <span className="text-red-400">이 기기에 음원이 없습니다</span>
          ) : (
            <>
              <button className="rounded bg-blue-600 px-3 py-1"
                      onClick={() => void player.play()}>재생</button>
              <button className="rounded border border-slate-600 px-3 py-1"
                      onClick={() => player.pause()}>일시정지</button>
              <button className="rounded border border-slate-600 px-3 py-1"
                      onClick={() => void player.restart()}>처음부터</button>
              <button className="rounded border border-slate-600 px-3 py-1"
                      onClick={() => void player.fadeOut(3)}>페이드아웃</button>
              <span className="text-sm text-slate-400">
                {formatDuration(player.currentTime)} / {formatDuration(player.duration)}
              </span>
            </>
          )}
        </div>
      )}

      <p data-testid="next-preview" className="border-t border-slate-700 px-3 py-2 text-slate-400">
        {nextSegment === null ? '마지막 순서입니다' : `다음 ▸ ${nextSegment.name}`}
      </p>

      <div className="flex gap-3 p-3">
        <button
          className="flex-1 rounded bg-slate-700 py-4 text-lg disabled:opacity-40"
          disabled={run.index === 0}
          onClick={() => go('prev')}
        >
          이전
        </button>
        <button className="flex-[2] rounded bg-blue-600 py-4 text-lg"
                onClick={() => go('next')}>
          다음
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: 라우트 등록**

`src/ui/App.tsx`에 추가한다.

```tsx
import RunPage from './run/RunPage';
// ...
<Route path="/event/:eventId/run" element={<RunPage />} />
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (전체)

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "feat: 진행 모드 화면과 화면 꺼짐 방지"
```

---

## Task 14: 홈 화면과 새 행사 만들기

**Files:**
- Create: `src/ui/NewEventPage.tsx`, `src/ui/Home.tsx`
- Modify: `src/ui/App.tsx`
- Test: `src/ui/NewEventPage.test.tsx`, `src/ui/Home.test.tsx`

**Interfaces:**
- Consumes: `TEMPLATES`·`createEventFromTemplate` (Task 6), `listEvents`·`putEvent`·`deleteEvent` (Task 6), `listAudio` (Task 4), `estimateTotalSeconds` (Task 7), `getRunState` (Task 13), `formatDuration` (Task 1)
- Produces:
  - 라우트 `#/new`, `#/` (홈)
  - `<NewEventPage />`, `<Home />`

이 작업이 끝나면 앱의 흐름이 처음부터 끝까지 이어진다: 홈 → 새 행사 → 편집 → 점검 → 진행.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/NewEventPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { clearDb } from '../db/testUtils';
import { listEvents } from '../db/eventRepo';
import NewEventPage from './NewEventPage';

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/new']}>
      <NewEventPage />
    </MemoryRouter>,
  );
}

describe('NewEventPage', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('개학식 템플릿을 고를 수 있다', async () => {
    renderPage();
    expect(await screen.findByLabelText('행사 종류')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '개학식 · 방학식' })).toBeInTheDocument();
  });

  it('대면과 방송을 고를 수 있다', async () => {
    renderPage();
    expect(await screen.findByLabelText('강당 등에서 대면 진행')).toBeInTheDocument();
    expect(screen.getByLabelText('교실 방송으로 진행')).toBeInTheDocument();
  });

  it('제목이 비면 만들 수 없다', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: '행사 만들기' }));

    expect(await screen.findByText('행사 제목을 입력해 주세요.')).toBeInTheDocument();
    expect(await listEvents()).toHaveLength(0);
  });

  it('행사를 만들어 저장한다', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('행사 제목'), '2학기 개학식');
    await user.click(screen.getByLabelText('교실 방송으로 진행'));
    await user.click(screen.getByRole('button', { name: '행사 만들기' }));

    await waitFor(async () => {
      const events = await listEvents();
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('2학기 개학식');
      expect(events[0].mode).toBe('broadcast');
      expect(events[0].segments).toHaveLength(7);
    });
  });
});
```

`src/ui/Home.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { clearDb } from '../db/testUtils';
import { putEvent, listEvents } from '../db/eventRepo';
import { createEventFromTemplate } from '../domain/templates';
import Home from './Home';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

describe('Home', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('행사가 없으면 안내를 보여준다', async () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(await screen.findByText('아직 만든 행사가 없습니다.')).toBeInTheDocument();
  });

  it('저장된 행사를 목록에 보여준다', async () => {
    await putEvent(createEventFromTemplate('semester-opening', init));
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(await screen.findByText('2학기 개학식')).toBeInTheDocument();
  });

  it('행사를 삭제할 수 있다', async () => {
    const user = userEvent.setup();
    await putEvent(createEventFromTemplate('semester-opening', init));
    render(<MemoryRouter><Home /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: '삭제' }));
    await user.click(await screen.findByRole('button', { name: '정말 삭제' }));

    expect(await listEvents()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- NewEventPage Home`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 새 행사 화면 구현**

`src/ui/NewEventPage.tsx`:

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TEMPLATES, createEventFromTemplate } from '../domain/templates';
import { putEvent } from '../db/eventRepo';
import type { EventAudience, EventMode, EventTone } from '../types';

const AUDIENCES: { value: EventAudience; label: string }[] = [
  { value: 'lower', label: '저학년 (1~2학년)' },
  { value: 'upper', label: '고학년' },
  { value: 'all', label: '전교생' },
  { value: 'withParents', label: '학부모·내빈 참석' },
];

const TONES: { value: EventTone; label: string }[] = [
  { value: 'formal', label: '정중하게' },
  { value: 'warm', label: '따뜻하게' },
  { value: 'concise', label: '간결하게' },
];

export default function NewEventPage() {
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState('semester-opening');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [place, setPlace] = useState('강당');
  const [mode, setMode] = useState<EventMode>('inPerson');
  const [audience, setAudience] = useState<EventAudience>('all');
  const [tone, setTone] = useState<EventTone>('formal');
  const [targetMinutes, setTargetMinutes] = useState('');
  const [error, setError] = useState('');

  const field = 'w-full rounded border border-gray-400 px-3 py-2';

  async function handleCreate() {
    if (title.trim() === '') {
      setError('행사 제목을 입력해 주세요.');
      return;
    }
    setError('');
    const event = createEventFromTemplate(templateId, {
      title: title.trim(),
      date,
      place: place.trim(),
      mode,
      audience,
      tone,
      targetMinutes: targetMinutes === '' ? null : Number(targetMinutes),
    });
    await putEvent(event);
    navigate(`/event/${event.id}/edit`);
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4 pb-16">
      <header className="flex items-center gap-3">
        <Link to="/" className="text-blue-600">← 홈</Link>
        <h1 className="text-lg font-bold">새 행사 만들기</h1>
      </header>

      <div>
        <label className="block text-sm font-medium" htmlFor="templateId">행사 종류</label>
        <select id="templateId" className={field} value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}>
          {TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>{template.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="title">행사 제목</label>
        <input id="title" className={field} value={title}
               onChange={(e) => setTitle(e.target.value)}
               placeholder="2026학년도 2학기 개학식" />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium" htmlFor="date">날짜</label>
          <input id="date" type="date" className={field} value={date}
                 onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium" htmlFor="place">장소</label>
          <input id="place" className={field} value={place}
                 onChange={(e) => setPlace(e.target.value)} />
        </div>
      </div>

      <fieldset className="rounded border border-blue-400 p-3">
        <legend className="px-1 text-sm font-medium">진행 방식</legend>
        <p className="mb-2 text-sm text-gray-600">
          이 선택에 따라 사회자 멘트가 크게 달라집니다.
        </p>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === 'inPerson'}
                 onChange={() => setMode('inPerson')} />
          강당 등에서 대면 진행
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === 'broadcast'}
                 onChange={() => setMode('broadcast')} />
          교실 방송으로 진행
        </label>
      </fieldset>

      <div>
        <label className="block text-sm font-medium" htmlFor="audience">대상</label>
        <select id="audience" className={field} value={audience}
                onChange={(e) => setAudience(e.target.value as EventAudience)}>
          {AUDIENCES.map((entry) => (
            <option key={entry.value} value={entry.value}>{entry.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="tone">멘트 톤</label>
        <select id="tone" className={field} value={tone}
                onChange={(e) => setTone(e.target.value as EventTone)}>
          {TONES.map((entry) => (
            <option key={entry.value} value={entry.value}>{entry.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="targetMinutes">
          목표 소요 시간(분, 선택)
        </label>
        <input id="targetMinutes" type="number" className={field} value={targetMinutes}
               onChange={(e) => setTargetMinutes(e.target.value)} placeholder="20" />
      </div>

      {error !== '' && <p className="text-red-600">{error}</p>}

      <button className="w-full rounded bg-blue-600 px-4 py-3 text-white"
              onClick={() => void handleCreate()}>
        행사 만들기
      </button>
    </main>
  );
}
```

- [ ] **Step 4: 홈 화면 구현**

`src/ui/Home.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteEvent, listEvents } from '../db/eventRepo';
import { listAudio } from '../db/audioRepo';
import { estimateTotalSeconds } from '../domain/timeEstimator';
import { formatDuration } from '../lib/format';
import type { AudioRole, EventCeremony } from '../types';

export default function Home() {
  const [events, setEvents] = useState<EventCeremony[] | null>(null);
  const [durations, setDurations] = useState<Map<AudioRole, number>>(new Map());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [loadedEvents, assets] = await Promise.all([listEvents(), listAudio()]);
    setEvents(loadedEvents);
    setDurations(new Map(assets.map((asset) => [asset.role, asset.durationSec])));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleDelete(id: string) {
    await deleteEvent(id);
    setConfirmId(null);
    await reload();
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <header className="mb-4 flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold">행사박사</h1>
        <Link to="/settings" className="text-blue-600">설정</Link>
      </header>

      <Link to="/new"
            className="mb-4 block rounded bg-blue-600 px-4 py-3 text-center text-white">
        ＋ 새 행사 만들기
      </Link>

      {events === null && <p>불러오는 중입니다…</p>}
      {events !== null && events.length === 0 && (
        <p className="text-gray-600">아직 만든 행사가 없습니다.</p>
      )}

      <ul className="space-y-2">
        {(events ?? []).map((event) => (
          <li key={event.id} className="rounded border border-gray-300 p-3">
            <p className="font-medium">{event.title}</p>
            <p className="text-sm text-gray-600">
              {event.date} · {event.place} · 순서 {event.segments.length}개 · 예상{' '}
              {formatDuration(estimateTotalSeconds(event.segments, durations))}
            </p>
            <div className="mt-2 flex gap-3 text-sm">
              <Link to={`/event/${event.id}/edit`} className="text-blue-600">편집</Link>
              <Link to={`/event/${event.id}/preflight`} className="text-blue-600">진행</Link>
              {confirmId === event.id ? (
                <>
                  <button className="text-red-600"
                          onClick={() => void handleDelete(event.id)}>정말 삭제</button>
                  <button onClick={() => setConfirmId(null)}>취소</button>
                </>
              ) : (
                <button className="text-red-600"
                        onClick={() => setConfirmId(event.id)}>삭제</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: 라우트 최종 정리**

`src/ui/App.tsx`를 교체한다.

```tsx
import { Routes, Route } from 'react-router-dom';
import Home from './Home';
import NewEventPage from './NewEventPage';
import SettingsPage from './settings/SettingsPage';
import EditorPage from './editor/EditorPage';
import PreflightPage from './preflight/PreflightPage';
import RunPage from './run/RunPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/new" element={<NewEventPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/event/:eventId/edit" element={<EditorPage />} />
      <Route path="/event/:eventId/preflight" element={<PreflightPage />} />
      <Route path="/event/:eventId/run" element={<RunPage />} />
    </Routes>
  );
}
```

- [ ] **Step 6: 테스트와 빌드 통과 확인**

Run: `npm test`
Expected: PASS (전체)

Run: `npm run build`
Expected: 타입 오류 없이 `dist/` 생성

- [ ] **Step 7: 손으로 전체 흐름 확인**

`npm run dev` 후 아래를 차례로 해본다.

- [ ] 설정에서 학교 프로필 저장
- [ ] 음원 서랍에 애국가·묵념곡·교가 mp3 등록 (국기에 대한 맹세 포함)
- [ ] 홈에서 새 행사 만들기 → 개학식 · 교실 방송 선택
- [ ] 편집기에서 각 순서 멘트를 직접 입력, 총 예상 시간이 늘어나는지 확인
- [ ] 점검 화면에서 음원 확인 → 소리 테스트 → 들렸어요 → 진행 시작 활성화
- [ ] 진행 모드에서 다음/이전, 애국가 재생, 묵념 카운트다운, 글자 크기 조절 확인
- [ ] 진행 중 새로고침해도 앱이 깨지지 않는지 확인
- [ ] 마지막 순서 다음에 종료 화면이 뜨는지 확인

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: 홈 화면과 새 행사 만들기로 전체 흐름 연결"
```

---

## 완료 기준

이 계획서의 14개 작업이 끝나면 다음이 성립한다.

- `npm test`가 전부 통과한다.
- `npm run build`가 타입 오류 없이 끝난다.
- **AI 없이** 개학식 대본을 처음부터 끝까지 만들고 당일 진행까지 마칠 수 있다.
- 음원은 이 기기에 저장되어 인터넷 없이 재생된다.

아직 안 되는 것 (계획서 2·3에서 다룬다):

- 휴대폰에서 사용 (HTTPS 배포와 PWA 설치가 필요하다 → 계획서 2)
- 계획서 파일에서 식순 자동 추출과 멘트 자동 생성 (→ 계획서 3)
- 인쇄용 대본, 전체 백업 (후속 과제)

## 자체 점검 결과

계획을 쓴 뒤 스펙과 대조해 확인한 사항이다.

**스펙 반영 확인**

| 스펙 항목 | 담당 작업 |
|---|---|
| 5절 데이터 모델 | Task 1 (타입), Task 2·4·6·13 (저장소) |
| 6.1 홈 | Task 14 |
| 6.2 설정 (프로필·음원서랍) | Task 3, Task 5 |
| 6.3 새 행사 (템플릿·폼 경로) | Task 14 |
| 6.4 편집기 | Task 8·9 |
| 6.5 행사 전 점검 | Task 12 |
| 6.6 진행 모드 | Task 10·11·13 |
| 9절 오디오 설계 | Task 4·11·12·13 |
| 10절 상태 기계 | Task 10 |
| 14절 개학식 템플릿 | Task 6 |

**스펙과 의도적으로 다르게 한 것**

1. **음원 저장을 `Blob` → `ArrayBuffer`로 변경.** IndexedDB의 `Blob` 저장은 환경별 지원 차가 있다. 재생 직전에 `Blob`으로 되살린다.
2. **순서 재정렬을 드래그 → ▲▼ 버튼으로 변경.** 터치 기기에서 안정적이고, 순수 함수로 테스트할 수 있다.
3. **`{{빈칸}}` 강조를 배경색 오버레이 → 입력창 아래 목록으로 변경.** `textarea` 안의 부분 강조는 브라우저가 지원하지 않는다. 빈칸 이름을 아래에 나열하는 편이 오히려 무엇을 채워야 하는지 분명하다.
4. **6.3의 1·2단계(계획서 넣기, 식순 확인)는 이 계획서에 없다.** AI가 필요한 단계라 계획서 3에서 만든다. 그때까지는 "템플릿에서 시작" 경로로 같은 결과에 도달할 수 있다.

**계획서 2·3으로 넘긴 스펙 항목**

- 7절 Gemini 연결 계층 → 계획서 3
- 8절 AI 시나리오 생성 → 계획서 3
- 11절 링크 공유·GitHub Pages 배포 → 계획서 2
