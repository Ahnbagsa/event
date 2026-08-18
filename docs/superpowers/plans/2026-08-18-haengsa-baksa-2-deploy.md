# 행사박사 배포·공유 구현 계획 (계획서 2/3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 만든 시나리오를 링크 하나로 휴대폰에 옮기고, 휴대폰에서 앱처럼 설치해 오프라인으로 행사를 진행할 수 있게 한다.

**Architecture:** 시나리오(음원 제외)를 lz-string으로 압축해 URL 해시에 담아 전달한다. 음원은 기기별 서랍에서 역할로 해석되므로 링크에 넣지 않는다. vite-plugin-pwa로 서비스 워커와 매니페스트를 만들고 GitHub Actions로 GitHub Pages에 배포한다.

**Tech Stack:** lz-string · vite-plugin-pwa · GitHub Actions

**Spec:** `docs/superpowers/specs/2026-08-18-haengsa-baksa-design.md` (11절)

**전제:** 계획서 1의 14개 작업이 모두 끝나 있어야 한다.

## Global Constraints

- 계획서 1의 Global Constraints를 그대로 승계한다.
- 링크에는 **음원을 절대 넣지 않는다.** 텍스트만 담는다.
- 압축 결과가 **8KB를 넘으면 링크를 만들지 않고** 사용자에게 이유를 설명한다.
- 배포 주소는 `https://{사용자명}.github.io/{저장소명}/` 형태다. `base: './'`로 이미 상대 경로 빌드가 되어 있으므로 저장소 이름을 코드에 넣지 않는다.
- 서비스 워커는 **앱 껍데기만 캐시한다.** IndexedDB 데이터는 서비스 워커가 건드리지 않는다.

## File Structure

| 경로 | 책임 |
|---|---|
| `src/share/scenarioLink.ts` | 시나리오 ↔ 압축 문자열 변환 |
| `src/ui/share/ImportPage.tsx` | 링크로 받은 시나리오 미리보기·가져오기 |
| `src/ui/share/ShareButton.tsx` | 링크 만들기·복사 |
| `src/ui/InstallHint.tsx` | 휴대폰 홈 화면 추가 안내 |
| `.github/workflows/deploy.yml` | GitHub Pages 자동 배포 |
| `public/.nojekyll` | Pages의 Jekyll 처리 차단 |

---

## Task 1: 시나리오 링크 인코딩

**Files:**
- Create: `src/share/scenarioLink.ts`
- Test: `src/share/scenarioLink.test.ts`

**Interfaces:**
- Consumes: `EventCeremony` (계획서 1 Task 1), `newId` (계획서 1 Task 1)
- Produces:
  - `MAX_LINK_PAYLOAD = 8192`
  - `encodeScenario(event: EventCeremony): string` — 압축 문자열. 8KB 초과 시 오류를 던진다
  - `decodeScenario(payload: string): EventCeremony` — 잘못된 값이면 오류를 던진다
  - `buildShareUrl(event: EventCeremony, origin: string, pathname: string): string`

- [ ] **Step 1: 의존성 설치**

```bash
npm install lz-string
npm install -D @types/lz-string
```

> `lz-string`이 자체 타입을 포함하면 `@types/lz-string` 설치는 실패한다. 실패해도 무시하고 진행한다.

- [ ] **Step 2: 실패하는 테스트 작성**

`src/share/scenarioLink.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  MAX_LINK_PAYLOAD,
  encodeScenario,
  decodeScenario,
  buildShareUrl,
} from './scenarioLink';
import { createEventFromTemplate } from '../domain/templates';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: 20,
};

function sampleEvent() {
  const event = createEventFromTemplate('semester-opening', init);
  event.segments[0].script = '지금부터 2026학년도 2학기 개학식을 시작하겠습니다.';
  return event;
}

describe('encodeScenario / decodeScenario', () => {
  it('압축했다가 풀면 원본과 같다', () => {
    const event = sampleEvent();
    expect(decodeScenario(encodeScenario(event))).toEqual(event);
  });

  it('압축 결과가 URL에 넣어도 안전한 문자만 담는다', () => {
    expect(encodeScenario(sampleEvent())).toMatch(/^[A-Za-z0-9+\-$.]*$/);
  });

  it('개학식 한 건은 8KB를 크게 밑돈다', () => {
    expect(encodeScenario(sampleEvent()).length).toBeLessThan(MAX_LINK_PAYLOAD / 2);
  });

  it('너무 크면 이유를 담은 오류를 던진다', () => {
    const event = sampleEvent();
    event.segments[0].script = '가'.repeat(200000);
    expect(() => encodeScenario(event)).toThrow('시나리오가 너무 길어');
  });

  it('망가진 문자열은 오류를 던진다', () => {
    expect(() => decodeScenario('망가진값!!!')).toThrow('시나리오를 읽을 수 없습니다.');
  });

  it('빈 문자열도 오류를 던진다', () => {
    expect(() => decodeScenario('')).toThrow('시나리오를 읽을 수 없습니다.');
  });

  it('행사 모양이 아닌 JSON은 오류를 던진다', () => {
    const notEvent = encodeScenarioRaw({ 아무거나: true });
    expect(() => decodeScenario(notEvent)).toThrow('시나리오를 읽을 수 없습니다.');
  });
});

// 테스트 전용 헬퍼: 검증 없이 아무 객체나 같은 방식으로 압축한다
function encodeScenarioRaw(value: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const lz = require('lz-string') as typeof import('lz-string');
  return lz.compressToEncodedURIComponent(JSON.stringify(value));
}

describe('buildShareUrl', () => {
  it('해시 경로에 압축값을 붙인다', () => {
    const url = buildShareUrl(sampleEvent(), 'https://example.github.io', '/haengsa/');
    expect(url.startsWith('https://example.github.io/haengsa/#/import?d=')).toBe(true);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- scenarioLink`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 4: 구현**

`src/share/scenarioLink.ts`:

```ts
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
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- scenarioLink`
Expected: PASS (8 tests)

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: 시나리오 링크 압축 인코딩과 복원"
```

---

## Task 2: 링크 만들기와 가져오기 화면

**Files:**
- Create: `src/ui/share/ShareButton.tsx`, `src/ui/share/ImportPage.tsx`
- Modify: `src/ui/editor/EditorPage.tsx`, `src/ui/Home.tsx`, `src/ui/App.tsx`
- Test: `src/ui/share/ImportPage.test.tsx`

**Interfaces:**
- Consumes: `encodeScenario`·`decodeScenario`·`buildShareUrl` (Task 1), `putEvent`·`getEvent` (계획서 1 Task 6), `getAvailableRoles` (계획서 1 Task 4), `requiredAudioRoles` (계획서 1 Task 12), `roleLabel` (계획서 1 Task 5), `newId` (계획서 1 Task 1)
- Produces:
  - `<ShareButton event={event} />`
  - `<ImportPage />` — 라우트 `#/import?d=...`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/share/ImportPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { listEvents } from '../../db/eventRepo';
import { putAudio } from '../../db/audioRepo';
import { createEventFromTemplate } from '../../domain/templates';
import { encodeScenario } from '../../share/scenarioLink';
import type { AudioRole } from '../../types';
import ImportPage from './ImportPage';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

function renderImport(payload: string) {
  render(
    <MemoryRouter initialEntries={[`/import?d=${payload}`]}>
      <Routes>
        <Route path="/import" element={<ImportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

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

describe('ImportPage', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('받은 시나리오를 미리 보여준다', async () => {
    renderImport(encodeScenario(createEventFromTemplate('semester-opening', init)));
    expect(await screen.findByText('2학기 개학식')).toBeInTheDocument();
    expect(screen.getByText('개식사')).toBeInTheDocument();
  });

  it('이 기기에 없는 음원을 미리 경고한다', async () => {
    await seedAudio('anthem');
    renderImport(encodeScenario(createEventFromTemplate('semester-opening', init)));

    const warning = await screen.findByTestId('missing-audio');
    expect(warning).toHaveTextContent('교가');
    expect(warning).not.toHaveTextContent('애국가');
  });

  it('가져오면 새 행사로 저장한다', async () => {
    const user = userEvent.setup();
    renderImport(encodeScenario(createEventFromTemplate('semester-opening', init)));

    await user.click(await screen.findByRole('button', { name: '이 기기에 가져오기' }));

    const events = await listEvents();
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('2학기 개학식');
  });

  it('가져올 때 새 id를 부여해 원본과 충돌하지 않는다', async () => {
    const user = userEvent.setup();
    const original = createEventFromTemplate('semester-opening', init);
    renderImport(encodeScenario(original));

    await user.click(await screen.findByRole('button', { name: '이 기기에 가져오기' }));

    const events = await listEvents();
    expect(events[0].id).not.toBe(original.id);
  });

  it('망가진 링크는 안내 문구를 보여준다', async () => {
    renderImport('망가진값!!!');
    expect(await screen.findByText(/시나리오를 읽을 수 없습니다/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- ImportPage`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 가져오기 화면 구현**

`src/ui/share/ImportPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { decodeScenario } from '../../share/scenarioLink';
import { putEvent } from '../../db/eventRepo';
import { getAvailableRoles } from '../../db/audioRepo';
import { requiredAudioRoles } from '../../domain/preflight';
import { roleLabel } from '../../audio/roles';
import { newId } from '../../lib/id';
import type { AudioRole, EventCeremony } from '../../types';

export default function ImportPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventCeremony | null>(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState<AudioRole[]>([]);

  useEffect(() => {
    const payload = params.get('d') ?? '';
    try {
      const decoded = decodeScenario(payload);
      setEvent(decoded);
      void getAvailableRoles().then((available) => {
        setMissing(requiredAudioRoles(decoded).filter((role) => !available.has(role)));
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '시나리오를 읽을 수 없습니다.');
    }
  }, [params]);

  async function handleImport() {
    if (event === null) return;
    const now = Date.now();
    const imported: EventCeremony = { ...event, id: newId('event'), createdAt: now, updatedAt: now };
    await putEvent(imported);
    navigate(`/event/${imported.id}/edit`);
  }

  if (error !== '') {
    return (
      <main className="mx-auto max-w-xl p-6">
        <p className="text-red-600">{error}</p>
        <p className="mt-2 text-sm text-gray-600">
          카카오톡 등에서 링크가 잘렸을 수 있습니다. 링크 전체를 다시 복사해 주소창에 붙여넣어 주세요.
        </p>
        <Link to="/" className="mt-4 inline-block text-blue-600">← 홈으로</Link>
      </main>
    );
  }

  if (event === null) return <main className="p-8">시나리오를 여는 중입니다…</main>;

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-xl font-bold">{event.title}</h1>
      <p className="text-sm text-gray-600">
        {event.date} · {event.place} · 순서 {event.segments.length}개
      </p>

      {missing.length > 0 && (
        <div data-testid="missing-audio" className="rounded bg-amber-100 p-3 text-sm">
          <p className="font-medium">이 기기에 없는 음원이 있습니다</p>
          <p>{missing.map(roleLabel).join(', ')}</p>
          <p className="mt-1">
            <Link to="/settings" className="text-blue-600">설정 → 음원 서랍</Link>에서
            먼저 등록해 두면 이 기기만으로 행사를 진행할 수 있습니다.
          </p>
        </div>
      )}

      <ol className="list-decimal space-y-1 pl-6 text-sm">
        {event.segments.map((segment) => (
          <li key={segment.id}>{segment.name}</li>
        ))}
      </ol>

      <button className="w-full rounded bg-blue-600 px-4 py-3 text-white"
              onClick={() => void handleImport()}>
        이 기기에 가져오기
      </button>
    </main>
  );
}
```

- [ ] **Step 4: 링크 복사 버튼 구현**

`src/ui/share/ShareButton.tsx`:

```tsx
import { useState } from 'react';
import { buildShareUrl } from '../../share/scenarioLink';
import type { EventCeremony } from '../../types';

export default function ShareButton({ event }: { event: EventCeremony }) {
  const [message, setMessage] = useState('');

  async function handleCopy() {
    try {
      const url = buildShareUrl(event, window.location.origin, window.location.pathname);
      await navigator.clipboard.writeText(url);
      setMessage('링크를 복사했습니다. 휴대폰으로 보내세요.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '링크를 만들지 못했습니다.');
    }
  }

  return (
    <span className="flex items-center gap-2">
      <button className="text-blue-600" onClick={() => void handleCopy()}>
        링크 복사
      </button>
      {message !== '' && <span className="text-sm text-gray-600">{message}</span>}
    </span>
  );
}
```

- [ ] **Step 5: 편집기와 홈에 붙이고 라우트 등록**

`src/ui/editor/EditorPage.tsx`의 상단 바에서 `저장` 버튼 옆에 `<ShareButton event={event} />`를 넣는다.

`src/ui/Home.tsx`의 각 행사 카드 액션 줄에 `<ShareButton event={event} />`를 넣는다.

`src/ui/App.tsx`에 라우트를 추가한다.

```tsx
import ImportPage from './share/ImportPage';
// ...
<Route path="/import" element={<ImportPage />} />
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (전체)

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: 시나리오 링크 복사와 가져오기 화면"
```

---

## Task 3: PWA 설치와 오프라인 실행

**Files:**
- Create: `src/ui/InstallHint.tsx`, `public/icon-192.png`, `public/icon-512.png`, `public/.nojekyll`
- Modify: `vite.config.ts`, `src/ui/Home.tsx`
- Test: `src/ui/InstallHint.test.tsx`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `isStandalone(): boolean` — 홈 화면에서 실행 중인지
  - `isIos(): boolean`
  - `<InstallHint />`

- [ ] **Step 1: 의존성 설치와 아이콘 준비**

```bash
npm install -D vite-plugin-pwa
```

아이콘은 파란 배경에 흰 글씨 "행"을 넣은 정사각 PNG 두 장(192px, 512px)을 `public/`에 만든다. 아래 Node 스크립트로 단색 아이콘을 즉석에서 만들 수 있다.

```bash
node -e "
const fs=require('fs');
const {createCanvas}=(()=>{try{return require('canvas')}catch{return {}}})();
if(!createCanvas){console.log('canvas 미설치 — 아이콘을 직접 준비하세요');process.exit(0)}
for(const size of [192,512]){
  const c=createCanvas(size,size),x=c.getContext('2d');
  x.fillStyle='#2563eb';x.fillRect(0,0,size,size);
  x.fillStyle='#fff';x.font=\`bold \${size*0.55}px sans-serif\`;
  x.textAlign='center';x.textBaseline='middle';x.fillText('행',size/2,size/2);
  fs.writeFileSync(\`public/icon-\${size}.png\`,c.toBuffer('image/png'));
}
"
```

`canvas` 패키지가 없으면 그림판이나 온라인 도구로 두 장을 직접 만들어 `public/`에 넣는다. **아이콘 없이 배포하면 홈 화면 추가 시 아이콘이 깨진다.**

`public/.nojekyll`은 빈 파일로 만든다.

- [ ] **Step 2: PWA 플러그인 설정**

`vite.config.ts`를 수정한다.

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: '행사박사',
        short_name: '행사박사',
        description: '학교 의식행사 시나리오 작성과 진행',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#2563eb',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

- [ ] **Step 3: 실패하는 테스트 작성**

`src/ui/InstallHint.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import InstallHint, { isIos, isStandalone } from './InstallHint';

function stubUserAgent(value: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isIos', () => {
  it('아이폰을 알아본다', () => {
    stubUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(isIos()).toBe(true);
  });

  it('윈도우는 아이폰이 아니다', () => {
    stubUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(isIos()).toBe(false);
  });
});

describe('isStandalone', () => {
  it('홈 화면 실행이 아니면 false다', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(isStandalone()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('InstallHint', () => {
  it('아이폰 브라우저에서는 공유 버튼 안내를 보여준다', () => {
    stubUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));

    render(<InstallHint />);
    expect(screen.getByText(/공유/)).toBeInTheDocument();
    expect(screen.getByText(/홈 화면에 추가/)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('이미 홈 화면에서 실행 중이면 아무것도 보여주지 않는다', () => {
    stubUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    vi.stubGlobal('matchMedia', () => ({ matches: true }));

    const { container } = render(<InstallHint />);
    expect(container).toBeEmptyDOMElement();

    vi.unstubAllGlobals();
  });

  it('PC에서는 안내를 보여주지 않는다', () => {
    stubUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));

    const { container } = render(<InstallHint />);
    expect(container).toBeEmptyDOMElement();

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `npm test -- InstallHint`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 5: 구현**

`src/ui/InstallHint.tsx`:

```tsx
export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

export default function InstallHint() {
  if (isStandalone()) return null;
  if (!isIos() && !isAndroid()) return null;

  return (
    <div className="mb-4 rounded bg-amber-100 p-3 text-sm">
      <p className="font-medium">📱 휴대폰으로 행사를 진행하시려면 먼저 설치해 주세요</p>
      {isIos() ? (
        <p className="mt-1">
          아래쪽 <strong>공유</strong> 버튼 → <strong>홈 화면에 추가</strong>를 눌러 주세요.
          설치하지 않으면 며칠 뒤 사파리가 등록해 둔 음원을 지울 수 있습니다.
        </p>
      ) : (
        <p className="mt-1">
          브라우저 메뉴(⋮) → <strong>홈 화면에 추가</strong>를 눌러 주세요.
          설치하면 인터넷 없이도 실행됩니다.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: 홈 화면에 붙이기**

`src/ui/Home.tsx`에서 헤더 바로 아래에 `<InstallHint />`를 넣고 import 한다.

- [ ] **Step 7: 테스트와 빌드 통과 확인**

Run: `npm test`
Expected: PASS (전체)

Run: `npm run build`
Expected: `dist/sw.js`와 `dist/manifest.webmanifest`가 만들어진다

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: PWA 설치와 오프라인 실행, 휴대폰 설치 안내"
```

---

## Task 4: GitHub Pages 배포

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`
- Test: 없음 (배포 결과를 손으로 확인한다)

**Interfaces:**
- Consumes: `npm run build`의 `dist/` 산출물
- Produces: `https://{사용자명}.github.io/{저장소명}/`에서 동작하는 앱

- [ ] **Step 1: 배포 워크플로 작성**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

테스트가 실패하면 배포되지 않는다. 깨진 앱이 행사 당일에 올라가는 사고를 막는다.

- [ ] **Step 2: README 작성**

`README.md`:

```markdown
# 행사박사

초등학교 의식행사의 사회 대본을 만들고, 행사 당일 대본과 음원을 한 화면에서 진행하는 웹앱.

## 처음 쓸 때

1. **설정 → 학교 프로필**에 학교명과 교장 선생님 성함을 입력합니다.
2. **설정 → 음원 서랍**에 국기에 대한 맹세·애국가·묵념곡·교가 mp3를 등록합니다.
   - 이 파일들은 이 기기 안에만 저장되며 어디로도 전송되지 않습니다.
3. 휴대폰에서는 **홈 화면에 추가**를 꼭 해 주세요. 하지 않으면 아이폰이 며칠 뒤 음원을 지울 수 있습니다.

## 행사 준비

홈 → **새 행사 만들기** → 행사 종류와 **진행 방식(대면/방송)** 선택 → 편집기에서 순서별 멘트 작성

## 행사 당일

행사 카드의 **진행** → 행사 전 점검을 통과 → **진행 시작**

- `→` 다음 순서, `←` 이전 순서, `Space` 재생/정지
- 잠금을 켜면 실수로 화면을 눌러도 순서가 넘어가지 않습니다.

## 휴대폰으로 옮기기

편집기의 **링크 복사** → 카카오톡 등으로 나에게 전송 → 휴대폰에서 링크를 열고 **가져오기**

음원은 링크에 포함되지 않습니다. 휴대폰에도 음원 서랍을 한 번 채워 두세요.

## 개발

```bash
npm install
npm run dev     # 개발 서버
npm test        # 테스트
npm run build   # 배포용 빌드
```

`main`에 푸시하면 GitHub Actions가 테스트를 돌리고 GitHub Pages에 배포합니다.
```

- [ ] **Step 3: 커밋**

```bash
git add -A
git commit -m "chore: GitHub Pages 자동 배포 워크플로와 사용 안내"
```

- [ ] **Step 4: GitHub 저장소 연결**

사용자에게 다음을 요청한다 (에이전트가 대신 하지 않는다 — 계정 권한이 필요하다).

1. GitHub에서 새 저장소를 만든다 (공개/비공개 모두 가능하나, **무료 계정은 비공개 저장소에서 Pages를 쓸 수 없다**).
2. 원격을 연결하고 푸시한다.

```bash
git remote add origin https://github.com/{사용자명}/{저장소명}.git
git push -u origin main
```

3. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꾼다.

- [ ] **Step 5: 배포 결과 확인**

- [ ] Actions 탭에서 워크플로가 초록색으로 끝났는지 확인
- [ ] `https://{사용자명}.github.io/{저장소명}/`이 열리는지 확인
- [ ] 화면이 백지면 브라우저 개발자도구 콘솔에서 404 자산 경로를 확인한다 (`base: './'` 설정 누락 여부)

- [ ] **Step 6: 휴대폰에서 손으로 확인**

- [ ] 아이폰 사파리에서 배포 주소 접속 → 공유 → 홈 화면에 추가
- [ ] 홈 화면 아이콘으로 실행했을 때 주소창 없이 앱처럼 뜨는지
- [ ] 설정 → 음원 서랍에 mp3 등록
- [ ] PC 편집기에서 링크 복사 → 카카오톡으로 전송 → 휴대폰에서 열어 가져오기
- [ ] 행사 전 점검에서 **소리 테스트가 실제로 들리는지** (무음 스위치 확인)
- [ ] 진행 모드에서 애국가 재생, 화면이 꺼지지 않는지
- [ ] 비행기 모드로 바꾼 뒤에도 앱이 실행되고 음원이 재생되는지
- [ ] 안드로이드 크롬에서도 같은 항목 확인

---

## 완료 기준

- `main`에 푸시하면 자동으로 배포된다.
- 휴대폰에서 홈 화면에 설치되고, 비행기 모드에서도 행사를 진행할 수 있다.
- PC에서 만든 시나리오가 링크 하나로 휴대폰에 옮겨진다.

## 자체 점검 결과

**스펙 반영 확인**

| 스펙 항목 | 담당 작업 |
|---|---|
| 11.1 폰 전송 링크 | Task 1·2 |
| 11.2 GitHub Pages 배포 (`base`, 해시 라우터, `.nojekyll`) | Task 3·4 |
| 9.2 iOS 데이터 소실 대비 (PWA 설치 안내) | Task 3 |
| 3절 범위의 PWA 오프라인 실행 | Task 3 |

**주의할 점**

- `ShareButton`은 `navigator.clipboard`를 쓴다. **HTTPS 또는 localhost에서만 동작**한다. 배포 후에는 문제없지만, 파일을 직접 열어서는 동작하지 않는다.
- 서비스 워커는 앱 껍데기만 캐시한다. 음원과 시나리오는 IndexedDB에 있으므로 서비스 워커 갱신과 무관하게 유지된다.
