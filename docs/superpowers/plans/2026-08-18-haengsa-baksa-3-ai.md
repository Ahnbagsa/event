# 행사박사 AI 시나리오 생성 구현 계획 (계획서 3/3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 계획서 파일이나 붙여넣은 글에서 식순을 뽑아내고, 대상·진행방식에 맞는 사회자 멘트를 자동으로 써 준다. 모델 이름이 바뀌어도 앱이 스스로 맞춘다.

**Architecture:** Gemini 모델 이름을 코드에 넣지 않는다. API 키를 저장할 때 `ListModels`로 그 키가 쓸 수 있는 모델을 조회하고, 이름 패턴으로 점수를 매겨 고른다. 호출이 404로 실패하면 재탐색 후 다음 후보로 자동 재시도한다. 생성은 **식순 추출**과 **멘트 작성** 두 번으로 나눈다.

**Tech Stack:** Gemini Generative Language REST API (`fetch` 직접 호출, SDK 없음) · 계획서 1의 React/Vite 기반

**Spec:** `docs/superpowers/specs/2026-08-18-haengsa-baksa-design.md` (7절·8절)

**전제:** 계획서 1이 모두 끝나 있어야 한다. 계획서 2는 끝나 있지 않아도 된다.

## Global Constraints

- 계획서 1의 Global Constraints를 그대로 승계한다.
- **모델 이름을 소스에 하드코딩하지 않는다.** 후보는 항상 `ListModels` 응답에서 온다. 테스트에 등장하는 이름은 고정값(fixture)일 뿐 구현이 참조해서는 안 된다.
- **네트워크를 타는 자동 테스트를 만들지 않는다.** `fetch`를 대역으로 바꿔 검증한다.
- 사용자에게 보이는 오류는 **항상 한국어**여야 한다. 영문 JSON을 그대로 노출하지 않는다.
- API 키는 IndexedDB의 `settings`에만 둔다. 로그·URL 표시·오류 메시지에 키를 절대 넣지 않는다.
- AI 응답을 **그대로 믿지 않는다.** 반드시 형태를 검사한 뒤 저장한다.
- 진행 모드와 편집기는 AI 없이도 계속 동작해야 한다. AI는 얹는 기능이지 전제가 아니다.

## File Structure

| 경로 | 책임 |
|---|---|
| `src/gemini/modelPicker.ts` | 모델 후보 걸러내기·점수화·선택 |
| `src/gemini/errorMapper.ts` | Gemini 오류 → 한국어 메시지 |
| `src/gemini/jsonParser.ts` | 지저분한 응답에서 JSON 뽑기 |
| `src/gemini/client.ts` | 모델 탐색·생성 호출·폴백·재시도 |
| `src/gemini/prompts.ts` | 식순 추출·멘트 생성 프롬프트 |
| `src/gemini/extractOutline.ts` | 식순 추출 호출과 결과 검증 |
| `src/gemini/generateScripts.ts` | 멘트 생성·부분 재생성 |
| `src/ui/settings/ApiKeyForm.tsx` | API 키 입력과 연결 테스트 |
| `src/ui/wizard/ImportPlanPage.tsx` | 계획서 넣기 (붙여넣기·PDF·사진) |
| `src/ui/wizard/OutlineReviewPage.tsx` | 뽑아낸 식순 확인·수정 |

---

## Task 1: 모델 선택 규칙

**Files:**
- Create: `src/gemini/modelPicker.ts`
- Test: `src/gemini/modelPicker.test.ts`

**Interfaces:**
- Consumes: `DiscoveredModel` (계획서 1 Task 1)
- Produces:
  - `type RawModel = { name: string; displayName?: string; supportedGenerationMethods?: string[]; inputTokenLimit?: number; outputTokenLimit?: number }`
  - `scoreModelName(name: string): number`
  - `isUsableModel(model: RawModel): boolean`
  - `pickModels(models: RawModel[]): DiscoveredModel[]` — 점수 높은 순 정렬

- [ ] **Step 1: 실패하는 테스트 작성**

`src/gemini/modelPicker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scoreModelName, isUsableModel, pickModels, type RawModel } from './modelPicker';

function raw(name: string, methods = ['generateContent'], outputTokenLimit = 8192): RawModel {
  return {
    name,
    displayName: name,
    supportedGenerationMethods: methods,
    inputTokenLimit: 1000000,
    outputTokenLimit,
  };
}

describe('isUsableModel', () => {
  it('generateContent를 지원하면 쓸 수 있다', () => {
    expect(isUsableModel(raw('models/gemini-2.5-flash'))).toBe(true);
  });

  it('generateContent가 없으면 쓸 수 없다', () => {
    expect(isUsableModel(raw('models/text-embedding-004', ['embedContent']))).toBe(false);
  });

  it('지원 목록이 아예 없으면 쓸 수 없다', () => {
    expect(isUsableModel({ name: 'models/알수없음' })).toBe(false);
  });

  it('임베딩·이미지·영상·음성 모델은 이름만으로도 제외한다', () => {
    expect(isUsableModel(raw('models/embedding-001'))).toBe(false);
    expect(isUsableModel(raw('models/imagen-3.0'))).toBe(false);
    expect(isUsableModel(raw('models/veo-2.0'))).toBe(false);
    expect(isUsableModel(raw('models/gemini-2.5-flash-tts'))).toBe(false);
    expect(isUsableModel(raw('models/aqa'))).toBe(false);
  });
});

describe('scoreModelName', () => {
  it('버전이 높을수록 점수가 높다', () => {
    expect(scoreModelName('models/gemini-2.5-flash')).toBeGreaterThan(
      scoreModelName('models/gemini-1.5-flash'),
    );
  });

  it('같은 버전이면 flash가 pro보다 높다', () => {
    expect(scoreModelName('models/gemini-2.5-flash')).toBeGreaterThan(
      scoreModelName('models/gemini-2.5-pro'),
    );
  });

  it('preview는 크게 감점된다', () => {
    expect(scoreModelName('models/gemini-3.0-flash-preview')).toBeLessThan(
      scoreModelName('models/gemini-2.5-flash'),
    );
  });

  it('experimental도 감점된다', () => {
    expect(scoreModelName('models/gemini-2.5-flash-exp')).toBeLessThan(
      scoreModelName('models/gemini-2.5-flash'),
    );
  });

  it('lite는 소폭 감점된다', () => {
    expect(scoreModelName('models/gemini-2.5-flash-lite')).toBeLessThan(
      scoreModelName('models/gemini-2.5-flash'),
    );
  });

  it('thinking은 감점된다', () => {
    expect(scoreModelName('models/gemini-2.5-flash-thinking')).toBeLessThan(
      scoreModelName('models/gemini-2.5-flash'),
    );
  });

  it('버전 숫자가 없어도 점수를 낸다', () => {
    expect(Number.isFinite(scoreModelName('models/gemini-flash'))).toBe(true);
  });
});

describe('pickModels', () => {
  it('쓸 수 없는 모델을 걸러내고 점수 순으로 정렬한다', () => {
    const picked = pickModels([
      raw('models/gemini-1.5-flash'),
      raw('models/text-embedding-004', ['embedContent']),
      raw('models/gemini-2.5-flash'),
      raw('models/gemini-2.5-pro'),
    ]);

    expect(picked.map((m) => m.name)).toEqual([
      'models/gemini-2.5-flash',
      'models/gemini-2.5-pro',
      'models/gemini-1.5-flash',
    ]);
  });

  it('점수가 같으면 출력 한도가 큰 쪽이 앞선다', () => {
    const picked = pickModels([
      { ...raw('models/gemini-2.5-flash'), outputTokenLimit: 8192 },
      { ...raw('models/gemini-2.5-flash'), outputTokenLimit: 65536 },
    ]);
    expect(picked[0].outputTokenLimit).toBe(65536);
  });

  it('쓸 수 있는 모델이 없으면 빈 배열이다', () => {
    expect(pickModels([raw('models/embedding-001')])).toEqual([]);
  });

  it('빠진 항목은 안전한 기본값으로 채운다', () => {
    const picked = pickModels([{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }]);
    expect(picked[0].displayName).toBe('models/gemini-2.5-flash');
    expect(picked[0].inputTokenLimit).toBe(0);
    expect(picked[0].outputTokenLimit).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- modelPicker`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/gemini/modelPicker.ts`:

```ts
import type { DiscoveredModel } from '../types';

export type RawModel = {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
};

const EXCLUDED_NAME_PARTS = ['embedding', 'aqa', 'imagen', 'veo', 'tts'];

export function isUsableModel(model: RawModel): boolean {
  const lower = model.name.toLowerCase();
  if (EXCLUDED_NAME_PARTS.some((part) => lower.includes(part))) return false;
  return model.supportedGenerationMethods?.includes('generateContent') ?? false;
}

export function scoreModelName(name: string): number {
  const lower = name.toLowerCase();
  let score = 0;

  const version = /(\d+)\.(\d+)/.exec(lower);
  if (version !== null) {
    score += (Number(version[1]) + Number(version[2]) / 10) * 100;
  }

  if (lower.includes('flash')) score += 50;
  if (lower.includes('pro')) score += 10;
  if (lower.includes('lite')) score -= 15;
  if (lower.includes('thinking')) score -= 20;
  if (lower.includes('preview') || lower.includes('experimental') || /\bexp\b|-exp/.test(lower)) {
    score -= 80;
  }

  return score;
}

export function pickModels(models: RawModel[]): DiscoveredModel[] {
  return models
    .filter(isUsableModel)
    .map((model) => ({
      name: model.name,
      displayName: model.displayName ?? model.name,
      score: scoreModelName(model.name),
      inputTokenLimit: model.inputTokenLimit ?? 0,
      outputTokenLimit: model.outputTokenLimit ?? 0,
    }))
    .sort((a, b) => (b.score - a.score) || (b.outputTokenLimit - a.outputTokenLimit));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- modelPicker`
Expected: PASS (15 tests)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: Gemini 모델 자동 선택 점수 규칙"
```

---

## Task 2: 오류 한국어 변환

**Files:**
- Create: `src/gemini/errorMapper.ts`
- Test: `src/gemini/errorMapper.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type GeminiFailure = { status: number; body: unknown }`
  - `type MappedError = { message: string; retryAfterSec: number | null; kind: 'key' | 'permission' | 'model' | 'quota' | 'server' | 'safety' | 'network' | 'unknown' }`
  - `mapGeminiError(failure: GeminiFailure): MappedError`
  - `mapNetworkError(): MappedError`
  - `parseRetryDelaySec(body: unknown): number | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/gemini/errorMapper.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapGeminiError, mapNetworkError, parseRetryDelaySec } from './errorMapper';

describe('mapGeminiError', () => {
  it('잘못된 키를 알려준다', () => {
    const mapped = mapGeminiError({
      status: 400,
      body: { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } },
    });
    expect(mapped.kind).toBe('key');
    expect(mapped.message).toContain('API 키가 올바르지 않습니다');
  });

  it('권한 거부를 알려준다', () => {
    const mapped = mapGeminiError({
      status: 403,
      body: { error: { status: 'PERMISSION_DENIED', message: 'denied' } },
    });
    expect(mapped.kind).toBe('permission');
    expect(mapped.message).toContain('허용되지 않았습니다');
  });

  it('모델을 찾지 못한 경우를 구분한다', () => {
    const mapped = mapGeminiError({
      status: 404,
      body: { error: { status: 'NOT_FOUND', message: 'models/gemini-1.0-pro is not found' } },
    });
    expect(mapped.kind).toBe('model');
  });

  it('사용량 초과와 대기 시간을 알려준다', () => {
    const mapped = mapGeminiError({
      status: 429,
      body: {
        error: {
          status: 'RESOURCE_EXHAUSTED',
          message: 'quota exceeded',
          details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' }],
        },
      },
    });
    expect(mapped.kind).toBe('quota');
    expect(mapped.retryAfterSec).toBe(37);
    expect(mapped.message).toContain('37초');
  });

  it('대기 시간이 없으면 기본 안내만 한다', () => {
    const mapped = mapGeminiError({ status: 429, body: { error: { status: 'RESOURCE_EXHAUSTED' } } });
    expect(mapped.retryAfterSec).toBeNull();
    expect(mapped.message).toContain('무료 사용량');
  });

  it('서버 오류는 재시도 중임을 알린다', () => {
    expect(mapGeminiError({ status: 503, body: {} }).kind).toBe('server');
    expect(mapGeminiError({ status: 500, body: {} }).kind).toBe('server');
  });

  it('안전 필터 차단을 알려준다', () => {
    const mapped = mapGeminiError({
      status: 200,
      body: { promptFeedback: { blockReason: 'SAFETY' } },
    });
    expect(mapped.kind).toBe('safety');
    expect(mapped.message).toContain('안전 필터');
  });

  it('모르는 오류도 한국어로 답한다', () => {
    const mapped = mapGeminiError({ status: 418, body: {} });
    expect(mapped.kind).toBe('unknown');
    expect(mapped.message).toMatch(/[가-힣]/);
  });

  it('원문 영어 메시지를 사용자에게 그대로 내보내지 않는다', () => {
    const mapped = mapGeminiError({
      status: 400,
      body: { error: { message: 'API key not valid. Please pass a valid API key.' } },
    });
    expect(mapped.message).not.toContain('API key not valid');
  });
});

describe('mapNetworkError', () => {
  it('인터넷 연결을 안내한다', () => {
    const mapped = mapNetworkError();
    expect(mapped.kind).toBe('network');
    expect(mapped.message).toContain('인터넷 연결');
  });
});

describe('parseRetryDelaySec', () => {
  it('초 단위 문자열을 숫자로 바꾼다', () => {
    expect(
      parseRetryDelaySec({ error: { details: [{ retryDelay: '12s' }] } }),
    ).toBe(12);
  });

  it('소수점도 읽는다', () => {
    expect(parseRetryDelaySec({ error: { details: [{ retryDelay: '7.5s' }] } })).toBe(7.5);
  });

  it('없으면 null이다', () => {
    expect(parseRetryDelaySec({ error: {} })).toBeNull();
    expect(parseRetryDelaySec(null)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- errorMapper`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/gemini/errorMapper.ts`:

```ts
export type GeminiFailure = { status: number; body: unknown };

export type MappedError = {
  message: string;
  retryAfterSec: number | null;
  kind: 'key' | 'permission' | 'model' | 'quota' | 'server' | 'safety' | 'network' | 'unknown';
};

function readError(body: unknown): { status?: string; message?: string } {
  if (typeof body !== 'object' || body === null) return {};
  const error = (body as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null) return {};
  const record = error as Record<string, unknown>;
  return {
    status: typeof record.status === 'string' ? record.status : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
}

export function parseRetryDelaySec(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) return null;
  const error = (body as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null) return null;
  const details = (error as Record<string, unknown>).details;
  if (!Array.isArray(details)) return null;

  for (const detail of details) {
    if (typeof detail !== 'object' || detail === null) continue;
    const delay = (detail as Record<string, unknown>).retryDelay;
    if (typeof delay !== 'string') continue;
    const match = /^([\d.]+)s$/.exec(delay);
    if (match !== null) return Number(match[1]);
  }
  return null;
}

function isBlocked(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const feedback = (body as Record<string, unknown>).promptFeedback;
  if (typeof feedback !== 'object' || feedback === null) return false;
  return typeof (feedback as Record<string, unknown>).blockReason === 'string';
}

export function mapNetworkError(): MappedError {
  return {
    kind: 'network',
    retryAfterSec: null,
    message:
      '인터넷 연결을 확인해 주세요. 이미 만들어 둔 시나리오는 그대로 사용할 수 있습니다.',
  };
}

export function mapGeminiError(failure: GeminiFailure): MappedError {
  const { status, body } = failure;
  const detail = readError(body);
  const text = `${detail.status ?? ''} ${detail.message ?? ''}`.toLowerCase();

  if (isBlocked(body)) {
    return {
      kind: 'safety',
      retryAfterSec: null,
      message: '내용 일부가 안전 필터에 걸렸습니다. 문구를 조금 바꿔 다시 생성해 보세요.',
    };
  }

  if (status === 400 && (text.includes('api key') || text.includes('api_key'))) {
    return {
      kind: 'key',
      retryAfterSec: null,
      message: 'API 키가 올바르지 않습니다. 키를 다시 복사해 붙여넣어 주세요.',
    };
  }

  if (status === 403) {
    return {
      kind: 'permission',
      retryAfterSec: null,
      message:
        '이 키로는 Gemini API 사용이 허용되지 않았습니다. Google AI Studio에서 키를 다시 발급해 주세요.',
    };
  }

  if (status === 404) {
    return {
      kind: 'model',
      retryAfterSec: null,
      message:
        '사용 가능한 모델을 찾지 못했습니다. 설정 → 연결 테스트를 눌러 확인해 주세요.',
    };
  }

  if (status === 429) {
    const retryAfterSec = parseRetryDelaySec(body);
    return {
      kind: 'quota',
      retryAfterSec,
      message:
        retryAfterSec === null
          ? '무료 사용량을 초과했습니다. 잠시 후 다시 시도해 주세요.'
          : `무료 사용량을 초과했습니다. 약 ${retryAfterSec}초 후 자동으로 다시 시도합니다.`,
    };
  }

  if (status >= 500) {
    return {
      kind: 'server',
      retryAfterSec: null,
      message: '서버가 혼잡합니다. 자동으로 다시 시도합니다.',
    };
  }

  return {
    kind: 'unknown',
    retryAfterSec: null,
    message: '시나리오를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- errorMapper`
Expected: PASS (13 tests)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: Gemini 오류를 한국어 안내로 변환"
```

---

## Task 3: 관대한 JSON 파서

**Files:**
- Create: `src/gemini/jsonParser.ts`
- Test: `src/gemini/jsonParser.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `extractJson(text: string): unknown` — 실패하면 오류를 던진다

모델이 스키마를 지원하지 않거나 무시할 때를 대비한다. 코드펜스, 앞뒤 잡담, 설명 문장이 섞여 와도 JSON만 뽑아낸다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/gemini/jsonParser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractJson } from './jsonParser';

describe('extractJson', () => {
  it('순수 JSON을 읽는다', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('앞뒤 공백을 견딘다', () => {
    expect(extractJson('  \n {"a":1} \n ')).toEqual({ a: 1 });
  });

  it('코드펜스를 벗겨낸다', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('언어 표시 없는 코드펜스도 벗겨낸다', () => {
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('앞뒤 설명 문장을 무시한다', () => {
    expect(extractJson('요청하신 결과입니다.\n{"a":1}\n도움이 되었길 바랍니다.')).toEqual({ a: 1 });
  });

  it('중첩된 객체를 온전히 읽는다', () => {
    expect(extractJson('앞말 {"a":{"b":[1,2]}} 뒷말')).toEqual({ a: { b: [1, 2] } });
  });

  it('배열도 읽는다', () => {
    expect(extractJson('```json\n[1,2,3]\n```')).toEqual([1, 2, 3]);
  });

  it('JSON이 없으면 한국어 오류를 던진다', () => {
    expect(() => extractJson('그냥 문장입니다')).toThrow('AI 응답을 이해할 수 없습니다.');
  });

  it('깨진 JSON도 한국어 오류를 던진다', () => {
    expect(() => extractJson('{"a":')).toThrow('AI 응답을 이해할 수 없습니다.');
  });

  it('빈 문자열도 오류를 던진다', () => {
    expect(() => extractJson('')).toThrow('AI 응답을 이해할 수 없습니다.');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- jsonParser`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/gemini/jsonParser.ts`:

```ts
const PARSE_FAILURE = 'AI 응답을 이해할 수 없습니다. 다시 시도해 주세요.';

function stripFence(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  return fenced === null ? text : fenced[1];
}

function sliceOutermost(text: string): string | null {
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  const candidates = [firstBrace, firstBracket].filter((index) => index !== -1);
  if (candidates.length === 0) return null;

  const start = Math.min(...candidates);
  const closing = text[start] === '{' ? '}' : ']';
  const end = text.lastIndexOf(closing);
  if (end <= start) return null;

  return text.slice(start, end + 1);
}

export function extractJson(text: string): unknown {
  const candidate = sliceOutermost(stripFence(text));
  if (candidate === null) throw new Error(PARSE_FAILURE);

  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error(PARSE_FAILURE);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- jsonParser`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: 지저분한 AI 응답에서 JSON을 뽑는 파서"
```

---

## Task 4: Gemini 연결 계층 (탐색·호출·폴백·재시도)

**Files:**
- Create: `src/gemini/client.ts`
- Test: `src/gemini/client.test.ts`

**Interfaces:**
- Consumes: `pickModels` (Task 1), `mapGeminiError`·`mapNetworkError`·`MappedError` (Task 2), `AppSettings`·`DiscoveredModel` (계획서 1 Task 1)
- Produces:
  - `GEMINI_BASE = 'https://generativelanguage.googleapis.com'`
  - `class GeminiError extends Error` — `info: MappedError`
  - `type Part = { text: string } | { inlineData: { mimeType: string; data: string } }`
  - `type ClientDeps = { fetchFn: typeof fetch; loadSettings: () => Promise<AppSettings>; saveSettings: (s: AppSettings) => Promise<void>; sleep: (ms: number) => Promise<void> }`
  - `type GenerateInput = { systemInstruction?: string; parts: Part[]; responseSchema?: unknown; temperature?: number }`
  - `type GenerateResult = { text: string; modelUsed: string; modelChanged: boolean }`
  - `discoverModels(apiKey: string, deps: ClientDeps): Promise<{ apiVersion: 'v1beta' | 'v1'; models: DiscoveredModel[] }>`
  - `generateText(input: GenerateInput, deps: ClientDeps): Promise<GenerateResult>`
  - `defaultDeps(): ClientDeps`

의존성을 밖에서 주입받는 이유: 네트워크를 타지 않고 404 폴백·429 대기·503 재시도를 전부 테스트하기 위해서다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/gemini/client.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { discoverModels, generateText, GeminiError, type ClientDeps } from './client';
import { DEFAULT_SETTINGS } from '../db/settingsRepo';
import type { AppSettings } from '../types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// vi.fn(() => ...)은 인자 없는 함수로 추론되어 mock.calls[0][0]이 타입 검사를 통과하지
// 못한다(빌드의 tsc --noEmit에서만 드러난다). 호출 인자를 fetch와 같은 모양으로 못박는다.
function fetchMock(impl: (...args: Parameters<typeof fetch>) => Promise<Response>) {
  return vi.fn(impl);
}

const MODELS_BODY = {
  models: [
    { name: 'models/gemini-2.5-flash', displayName: 'Flash', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1000000, outputTokenLimit: 65536 },
    { name: 'models/gemini-2.5-pro', displayName: 'Pro', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1000000, outputTokenLimit: 65536 },
    { name: 'models/text-embedding-004', displayName: 'Embed', supportedGenerationMethods: ['embedContent'] },
  ],
};

function textBody(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

function makeDeps(
  fetchFn: ClientDeps['fetchFn'],
  settings: Partial<AppSettings> = {},
): ClientDeps & { saved: AppSettings[] } {
  const saved: AppSettings[] = [];
  let current: AppSettings = { ...DEFAULT_SETTINGS, geminiApiKey: '키', ...settings };
  return {
    fetchFn,
    loadSettings: () => Promise.resolve(current),
    saveSettings: (next) => {
      current = next;
      saved.push(next);
      return Promise.resolve();
    },
    sleep: () => Promise.resolve(),
    saved,
  };
}

describe('discoverModels', () => {
  it('v1beta로 조회해 쓸 수 있는 모델만 점수 순으로 돌려준다', async () => {
    const fetchFn = fetchMock(() => Promise.resolve(jsonResponse(200, MODELS_BODY)));
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn']);

    const result = await discoverModels('키', deps);

    expect(result.apiVersion).toBe('v1beta');
    expect(result.models.map((m) => m.name)).toEqual([
      'models/gemini-2.5-flash',
      'models/gemini-2.5-pro',
    ]);
    expect(String(fetchFn.mock.calls[0][0])).toContain('/v1beta/models');
  });

  it('v1beta가 실패하면 v1으로 다시 시도한다', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(404, { error: { status: 'NOT_FOUND' } }))
      .mockResolvedValueOnce(jsonResponse(200, MODELS_BODY));
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn']);

    const result = await discoverModels('키', deps);

    expect(result.apiVersion).toBe('v1');
    expect(String(fetchFn.mock.calls[1][0])).toContain('/v1/models');
  });

  it('키가 잘못되면 한국어 오류를 던진다', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        jsonResponse(400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid' } }),
      ),
    );
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn']);

    await expect(discoverModels('나쁜키', deps)).rejects.toThrow('API 키가 올바르지 않습니다');
  });

  it('쓸 수 있는 모델이 하나도 없으면 오류를 던진다', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(jsonResponse(200, { models: [] })));
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn']);

    await expect(discoverModels('키', deps)).rejects.toThrow('사용 가능한 모델');
  });

  it('URL에 키를 담되 오류 메시지에는 키를 남기지 않는다', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(jsonResponse(403, { error: { status: 'PERMISSION_DENIED' } })),
    );
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn']);

    await expect(discoverModels('비밀키', deps)).rejects.not.toThrow(/비밀키/);
  });
});

describe('generateText', () => {
  it('저장된 모델로 호출하고 본문을 돌려준다', async () => {
    const fetchFn = fetchMock(() => Promise.resolve(jsonResponse(200, textBody('안녕하세요'))));
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn'], {
      selectedModel: 'models/gemini-2.5-flash',
    });

    const result = await generateText({ parts: [{ text: '인사해줘' }] }, deps);

    expect(result.text).toBe('안녕하세요');
    expect(result.modelUsed).toBe('models/gemini-2.5-flash');
    expect(result.modelChanged).toBe(false);
    expect(String(fetchFn.mock.calls[0][0])).toContain(
      '/v1beta/models/gemini-2.5-flash:generateContent',
    );
  });

  it('모델이 정해져 있지 않으면 먼저 탐색한다', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, MODELS_BODY))
      .mockResolvedValueOnce(jsonResponse(200, textBody('생성됨')));
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn'], { selectedModel: null });

    const result = await generateText({ parts: [{ text: '안녕' }] }, deps);

    expect(result.text).toBe('생성됨');
    expect(result.modelUsed).toBe('models/gemini-2.5-flash');
  });

  it('모델이 사라지면 재탐색해 다음 후보로 성공한다', async () => {
    const fetchFn = vi
      .fn()
      // 1) 저장된 모델 호출 → 404
      .mockResolvedValueOnce(jsonResponse(404, { error: { status: 'NOT_FOUND' } }))
      // 2) 재탐색 (사라진 모델은 목록에 없음)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          models: [
            {
              name: 'models/gemini-3.0-flash',
              supportedGenerationMethods: ['generateContent'],
              outputTokenLimit: 65536,
            },
          ],
        }),
      )
      // 3) 새 모델로 재시도 → 성공
      .mockResolvedValueOnce(jsonResponse(200, textBody('새 모델 응답')));

    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn'], {
      selectedModel: 'models/사라진모델',
    });

    const result = await generateText({ parts: [{ text: '안녕' }] }, deps);

    expect(result.text).toBe('새 모델 응답');
    expect(result.modelUsed).toBe('models/gemini-3.0-flash');
    expect(result.modelChanged).toBe(true);
    expect(deps.saved.at(-1)?.selectedModel).toBe('models/gemini-3.0-flash');
  });

  it('사용량 초과면 안내한 시간만큼 기다렸다 한 번 더 시도한다', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, {
          error: {
            status: 'RESOURCE_EXHAUSTED',
            details: [{ retryDelay: '5s' }],
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, textBody('두 번째에 성공')));

    const sleep = vi.fn((_ms: number) => Promise.resolve());
    const deps = { ...makeDeps(fetchFn as unknown as ClientDeps['fetchFn'], { selectedModel: 'models/gemini-2.5-flash' }), sleep };

    const result = await generateText({ parts: [{ text: '안녕' }] }, deps);

    expect(result.text).toBe('두 번째에 성공');
    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it('서버 오류는 세 번까지 늘려가며 다시 시도한다', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, textBody('세 번째에 성공')));

    const sleep = vi.fn((_ms: number) => Promise.resolve());
    const deps = { ...makeDeps(fetchFn as unknown as ClientDeps['fetchFn'], { selectedModel: 'models/gemini-2.5-flash' }), sleep };

    const result = await generateText({ parts: [{ text: '안녕' }] }, deps);

    expect(result.text).toBe('세 번째에 성공');
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([1000, 2000]);
  });

  it('계속 서버 오류면 한국어 오류를 던진다', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(jsonResponse(503, {})));
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn'], {
      selectedModel: 'models/gemini-2.5-flash',
    });

    await expect(generateText({ parts: [{ text: '안녕' }] }, deps)).rejects.toThrow('서버가 혼잡');
  });

  it('안전 필터에 걸리면 그렇게 알려준다', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } })),
    );
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn'], {
      selectedModel: 'models/gemini-2.5-flash',
    });

    await expect(generateText({ parts: [{ text: '안녕' }] }, deps)).rejects.toThrow('안전 필터');
  });

  it('네트워크가 끊기면 인터넷 연결을 안내한다', async () => {
    const fetchFn = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn'], {
      selectedModel: 'models/gemini-2.5-flash',
    });

    await expect(generateText({ parts: [{ text: '안녕' }] }, deps)).rejects.toThrow('인터넷 연결');
  });

  it('키가 비어 있으면 호출하지 않고 안내한다', async () => {
    const fetchFn = vi.fn();
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn'], { geminiApiKey: '' });

    await expect(generateText({ parts: [{ text: '안녕' }] }, deps)).rejects.toThrow(
      'API 키를 먼저 등록해 주세요.',
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('스키마를 주면 JSON 응답을 요청한다', async () => {
    const fetchFn = fetchMock(() => Promise.resolve(jsonResponse(200, textBody('{}'))));
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn'], {
      selectedModel: 'models/gemini-2.5-flash',
    });

    await generateText(
      { parts: [{ text: '안녕' }], responseSchema: { type: 'object' } },
      deps,
    );

    const init = fetchFn.mock.calls[0][1] as RequestInit;
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    const config = sent.generationConfig as Record<string, unknown>;
    expect(config.responseMimeType).toBe('application/json');
    expect(config.responseSchema).toEqual({ type: 'object' });
  });

  it('여러 조각으로 나뉜 응답을 이어 붙인다', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, {
          candidates: [{ content: { parts: [{ text: '앞부분' }, { text: '뒷부분' }] } }],
        }),
      ),
    );
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn'], {
      selectedModel: 'models/gemini-2.5-flash',
    });

    const result = await generateText({ parts: [{ text: '안녕' }] }, deps);
    expect(result.text).toBe('앞부분뒷부분');
  });

  it('GeminiError는 종류를 함께 담는다', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(jsonResponse(403, { error: { status: 'PERMISSION_DENIED' } })),
    );
    const deps = makeDeps(fetchFn as unknown as ClientDeps['fetchFn'], {
      selectedModel: 'models/gemini-2.5-flash',
    });

    await expect(generateText({ parts: [{ text: '안녕' }] }, deps)).rejects.toMatchObject({
      info: { kind: 'permission' },
    });
    await expect(generateText({ parts: [{ text: '안녕' }] }, deps)).rejects.toBeInstanceOf(
      GeminiError,
    );
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- gemini/client`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/gemini/client.ts`:

```ts
import { pickModels, type RawModel } from './modelPicker';
import { mapGeminiError, mapNetworkError, type MappedError } from './errorMapper';
import type { AppSettings, DiscoveredModel } from '../types';

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

export class GeminiError extends Error {
  constructor(readonly info: MappedError) {
    super(info.message);
    this.name = 'GeminiError';
  }
}

export type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export type ClientDeps = {
  fetchFn: typeof fetch;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
};

export type GenerateInput = {
  systemInstruction?: string;
  parts: Part[];
  responseSchema?: unknown;
  temperature?: number;
};

export type GenerateResult = {
  text: string;
  modelUsed: string;
  modelChanged: boolean;
};

type CallOutcome =
  | { ok: true; body: unknown }
  | { ok: false; status: number; body: unknown };

async function call(
  url: string,
  init: RequestInit | undefined,
  deps: ClientDeps,
): Promise<CallOutcome> {
  let response: Response;
  try {
    response = await deps.fetchFn(url, init);
  } catch {
    throw new GeminiError(mapNetworkError());
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return response.ok ? { ok: true, body } : { ok: false, status: response.status, body };
}

async function fetchModelList(
  apiKey: string,
  apiVersion: 'v1beta' | 'v1',
  deps: ClientDeps,
): Promise<CallOutcome> {
  return call(
    `${GEMINI_BASE}/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`,
    undefined,
    deps,
  );
}

export async function discoverModels(
  apiKey: string,
  deps: ClientDeps,
): Promise<{ apiVersion: 'v1beta' | 'v1'; models: DiscoveredModel[] }> {
  const attempts: ('v1beta' | 'v1')[] = ['v1beta', 'v1'];
  let lastFailure: CallOutcome | null = null;

  for (const apiVersion of attempts) {
    const outcome = await fetchModelList(apiKey, apiVersion, deps);
    if (!outcome.ok) {
      lastFailure = outcome;
      continue;
    }

    const raw = (outcome.body as { models?: RawModel[] } | null)?.models ?? [];
    const models = pickModels(raw);
    if (models.length === 0) {
      throw new GeminiError({
        kind: 'model',
        retryAfterSec: null,
        message:
          '이 API 키로 사용 가능한 모델을 찾지 못했습니다. Google AI Studio에서 키를 다시 발급해 주세요.',
      });
    }
    return { apiVersion, models };
  }

  throw new GeminiError(
    lastFailure === null || lastFailure.ok
      ? mapNetworkError()
      : mapGeminiError({ status: lastFailure.status, body: lastFailure.body }),
  );
}

function readText(body: unknown): string {
  const mapped = mapGeminiError({ status: 200, body });
  if (mapped.kind === 'safety') throw new GeminiError(mapped);

  const candidates = (body as { candidates?: unknown } | null)?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new GeminiError({
      kind: 'unknown',
      retryAfterSec: null,
      message: 'AI가 아무 내용도 만들지 못했습니다. 다시 시도해 주세요.',
    });
  }

  const parts = (candidates[0] as { content?: { parts?: unknown } }).content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => (typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : ''))
    .join('');
}

function buildBody(input: GenerateInput): string {
  const generationConfig: Record<string, unknown> = {
    temperature: input.temperature ?? 0.7,
  };
  if (input.responseSchema !== undefined) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = input.responseSchema;
  }

  const payload: Record<string, unknown> = {
    contents: [{ role: 'user', parts: input.parts }],
    generationConfig,
  };
  if (input.systemInstruction !== undefined) {
    payload.systemInstruction = { parts: [{ text: input.systemInstruction }] };
  }

  return JSON.stringify(payload);
}

async function callModel(
  model: string,
  apiVersion: 'v1beta' | 'v1',
  apiKey: string,
  input: GenerateInput,
  deps: ClientDeps,
): Promise<CallOutcome> {
  return call(
    `${GEMINI_BASE}/${apiVersion}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: buildBody(input),
    },
    deps,
  );
}

export async function generateText(
  input: GenerateInput,
  deps: ClientDeps,
): Promise<GenerateResult> {
  const settings = await deps.loadSettings();

  if (settings.geminiApiKey.trim() === '') {
    throw new GeminiError({
      kind: 'key',
      retryAfterSec: null,
      message: 'API 키를 먼저 등록해 주세요. 설정 화면에서 넣을 수 있습니다.',
    });
  }

  let apiVersion = settings.apiVersion;
  let model = settings.selectedModel;
  let modelChanged = false;

  if (model === null) {
    const discovered = await discoverModels(settings.geminiApiKey, deps);
    apiVersion = discovered.apiVersion;
    model = discovered.models[0].name;
    await deps.saveSettings({
      ...settings,
      apiVersion,
      selectedModel: model,
      discoveredModels: discovered.models,
      discoveredAt: Date.now(),
    });
  }

  let serverAttempts = 0;
  let quotaRetried = false;
  let modelRetried = false;

  for (;;) {
    const outcome = await callModel(model, apiVersion, settings.geminiApiKey, input, deps);

    if (outcome.ok) {
      return { text: readText(outcome.body), modelUsed: model, modelChanged };
    }

    const mapped = mapGeminiError({ status: outcome.status, body: outcome.body });

    if (mapped.kind === 'model' && !modelRetried) {
      modelRetried = true;
      const discovered = await discoverModels(settings.geminiApiKey, deps);
      const next =
        discovered.models.find((candidate) => candidate.name !== model) ?? discovered.models[0];
      apiVersion = discovered.apiVersion;
      model = next.name;
      modelChanged = true;
      await deps.saveSettings({
        ...(await deps.loadSettings()),
        apiVersion,
        selectedModel: model,
        modelPinnedByUser: false,
        discoveredModels: discovered.models,
        discoveredAt: Date.now(),
      });
      continue;
    }

    if (mapped.kind === 'quota' && !quotaRetried) {
      quotaRetried = true;
      await deps.sleep((mapped.retryAfterSec ?? 5) * 1000);
      continue;
    }

    if (mapped.kind === 'server' && serverAttempts < 2) {
      await deps.sleep(1000 * 2 ** serverAttempts);
      serverAttempts += 1;
      continue;
    }

    throw new GeminiError(mapped);
  }
}

export function defaultDeps(): ClientDeps {
  return {
    fetchFn: (...args) => fetch(...args),
    loadSettings: () => import('../db/settingsRepo').then((mod) => mod.getSettings()),
    saveSettings: (settings) =>
      import('../db/settingsRepo').then((mod) => mod.saveSettings(settings)),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- gemini/client`
Expected: PASS (17 tests)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: Gemini 모델 자동 탐색과 폴백·재시도 호출 계층"
```

---

## Task 5: API 키 설정과 연결 테스트 화면

**Files:**
- Create: `src/ui/settings/ApiKeyForm.tsx`
- Modify: `src/ui/settings/SettingsPage.tsx`
- Test: `src/ui/settings/ApiKeyForm.test.tsx`

**Interfaces:**
- Consumes: `discoverModels`·`generateText`·`GeminiError`·`defaultDeps` (Task 4), `getSettings`·`saveSettings` (계획서 1 Task 2)
- Produces: `<ApiKeyForm />`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/settings/ApiKeyForm.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearDb } from '../../db/testUtils';
import { getSettings } from '../../db/settingsRepo';
import ApiKeyForm from './ApiKeyForm';

const discoverModels = vi.fn();
const generateText = vi.fn();

vi.mock('../../gemini/client', async () => {
  const actual = await vi.importActual<typeof import('../../gemini/client')>('../../gemini/client');
  return {
    ...actual,
    discoverModels: (...args: unknown[]) => discoverModels(...args),
    generateText: (...args: unknown[]) => generateText(...args),
    defaultDeps: () => ({}),
  };
});

const MODELS = [
  { name: 'models/gemini-2.5-flash', displayName: 'Flash', score: 300, inputTokenLimit: 1, outputTokenLimit: 1 },
  { name: 'models/gemini-2.5-pro', displayName: 'Pro', score: 260, inputTokenLimit: 1, outputTokenLimit: 1 },
];

describe('ApiKeyForm', () => {
  beforeEach(async () => {
    await clearDb();
    discoverModels.mockReset();
    generateText.mockReset();
  });

  it('키를 저장하면 모델을 탐색해 자동으로 고른다', async () => {
    const user = userEvent.setup();
    discoverModels.mockResolvedValue({ apiVersion: 'v1beta', models: MODELS });

    render(<ApiKeyForm />);
    await user.type(await screen.findByLabelText('Gemini API 키'), 'AIza-테스트');
    await user.click(screen.getByRole('button', { name: '저장하고 모델 찾기' }));

    await waitFor(async () => {
      const settings = await getSettings();
      expect(settings.geminiApiKey).toBe('AIza-테스트');
      expect(settings.selectedModel).toBe('models/gemini-2.5-flash');
      expect(settings.discoveredModels).toHaveLength(2);
    });

    expect(await screen.findByText(/모델 2개를 찾았습니다/)).toBeInTheDocument();
  });

  it('키가 잘못되면 한국어 오류를 보여준다', async () => {
    const user = userEvent.setup();
    const { GeminiError } = await import('../../gemini/client');
    discoverModels.mockRejectedValue(
      new GeminiError({ kind: 'key', retryAfterSec: null, message: 'API 키가 올바르지 않습니다.' }),
    );

    render(<ApiKeyForm />);
    await user.type(await screen.findByLabelText('Gemini API 키'), '나쁜키');
    await user.click(screen.getByRole('button', { name: '저장하고 모델 찾기' }));

    expect(await screen.findByText('API 키가 올바르지 않습니다.')).toBeInTheDocument();
  });

  it('연결 테스트가 각 단계 결과를 보여준다', async () => {
    const user = userEvent.setup();
    discoverModels.mockResolvedValue({ apiVersion: 'v1beta', models: MODELS });
    generateText.mockResolvedValue({
      text: '안녕하세요',
      modelUsed: 'models/gemini-2.5-flash',
      modelChanged: false,
    });

    render(<ApiKeyForm />);
    await user.type(await screen.findByLabelText('Gemini API 키'), 'AIza-테스트');
    await user.click(screen.getByRole('button', { name: '저장하고 모델 찾기' }));
    await screen.findByText(/모델 2개를 찾았습니다/);

    await user.click(screen.getByRole('button', { name: '연결 테스트' }));

    const report = await screen.findByTestId('test-report');
    await waitFor(() => {
      expect(report).toHaveTextContent('모델 목록 조회');
      expect(report).toHaveTextContent('문장 생성 테스트');
      expect(report).toHaveTextContent('성공');
    });
  });

  it('모델을 직접 고르면 그 선택을 기억한다', async () => {
    const user = userEvent.setup();
    discoverModels.mockResolvedValue({ apiVersion: 'v1beta', models: MODELS });

    render(<ApiKeyForm />);
    await user.type(await screen.findByLabelText('Gemini API 키'), 'AIza-테스트');
    await user.click(screen.getByRole('button', { name: '저장하고 모델 찾기' }));
    await screen.findByText(/모델 2개를 찾았습니다/);

    await user.selectOptions(screen.getByLabelText('사용할 모델'), 'models/gemini-2.5-pro');

    await waitFor(async () => {
      const settings = await getSettings();
      expect(settings.selectedModel).toBe('models/gemini-2.5-pro');
      expect(settings.modelPinnedByUser).toBe(true);
    });
  });

  it('키를 화면에 그대로 노출하지 않는다', async () => {
    render(<ApiKeyForm />);
    expect(await screen.findByLabelText('Gemini API 키')).toHaveAttribute('type', 'password');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- ApiKeyForm`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/ui/settings/ApiKeyForm.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { discoverModels, generateText, defaultDeps, GeminiError } from '../../gemini/client';
import { getSettings, saveSettings } from '../../db/settingsRepo';
import type { AppSettings } from '../../types';

type Line = { label: string; state: 'pending' | 'ok' | 'fail'; detail: string };

export default function ApiKeyForm() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Line[] | null>(null);

  useEffect(() => {
    void getSettings().then((loaded) => {
      setSettings(loaded);
      setApiKey(loaded.geminiApiKey);
    });
  }, []);

  function describe(caught: unknown): string {
    if (caught instanceof GeminiError) return caught.info.message;
    return '알 수 없는 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.';
  }

  async function handleSaveAndDiscover() {
    if (settings === null) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const discovered = await discoverModels(apiKey.trim(), defaultDeps());
      const next: AppSettings = {
        ...settings,
        geminiApiKey: apiKey.trim(),
        apiVersion: discovered.apiVersion,
        selectedModel: discovered.models[0].name,
        modelPinnedByUser: false,
        discoveredModels: discovered.models,
        discoveredAt: Date.now(),
      };
      await saveSettings(next);
      setSettings(next);
      setMessage(
        `모델 ${discovered.models.length}개를 찾았습니다. ${discovered.models[0].displayName}을(를) 쓰겠습니다.`,
      );
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handlePickModel(name: string) {
    if (settings === null) return;
    const next: AppSettings = { ...settings, selectedModel: name, modelPinnedByUser: true };
    await saveSettings(next);
    setSettings(next);
  }

  async function handleTest() {
    if (settings === null) return;
    setBusy(true);
    const lines: Line[] = [
      { label: '모델 목록 조회', state: 'pending', detail: '' },
      { label: '문장 생성 테스트', state: 'pending', detail: '' },
    ];
    setReport([...lines]);

    try {
      const discovered = await discoverModels(settings.geminiApiKey, defaultDeps());
      lines[0] = { label: '모델 목록 조회', state: 'ok', detail: `성공 — ${discovered.models.length}개` };
      setReport([...lines]);

      const started = Date.now();
      const result = await generateText(
        { parts: [{ text: '"안녕하세요"라고만 답해 주세요.' }], temperature: 0 },
        defaultDeps(),
      );
      lines[1] = {
        label: '문장 생성 테스트',
        state: 'ok',
        detail: `성공 — ${result.modelUsed} (${((Date.now() - started) / 1000).toFixed(1)}초)`,
      };
      setReport([...lines]);
    } catch (caught) {
      const failedIndex = lines.findIndex((line) => line.state === 'pending');
      if (failedIndex !== -1) {
        lines[failedIndex] = { ...lines[failedIndex], state: 'fail', detail: describe(caught) };
      }
      setReport([...lines]);
    } finally {
      setBusy(false);
    }
  }

  if (settings === null) return null;

  return (
    <section className="mx-auto max-w-xl space-y-4 p-4">
      <h2 className="text-xl font-bold">AI 연결</h2>
      <p className="text-sm text-gray-600">
        Google AI Studio에서 무료 API 키를 발급받아 넣어 주세요. 키는 이 기기에만 저장됩니다.
        AI 없이도 대본을 직접 작성하고 행사를 진행할 수 있습니다.
      </p>

      <div>
        <label className="block text-sm font-medium" htmlFor="apiKey">Gemini API 키</label>
        <input
          id="apiKey"
          type="password"
          className="w-full rounded border border-gray-400 px-3 py-2"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button className="rounded bg-blue-600 px-4 py-2 text-white disabled:bg-gray-400"
                disabled={busy || apiKey.trim() === ''}
                onClick={() => void handleSaveAndDiscover()}>
          저장하고 모델 찾기
        </button>
        <button className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50"
                disabled={busy || settings.geminiApiKey === ''}
                onClick={() => void handleTest()}>
          연결 테스트
        </button>
      </div>

      {message !== '' && <p className="text-green-700">{message}</p>}
      {error !== '' && <p className="text-red-600">{error}</p>}

      {settings.discoveredModels.length > 0 && (
        <div>
          <label className="block text-sm font-medium" htmlFor="model">사용할 모델</label>
          <select
            id="model"
            className="w-full rounded border border-gray-400 px-3 py-2"
            value={settings.selectedModel ?? ''}
            onChange={(e) => void handlePickModel(e.target.value)}
          >
            {settings.discoveredModels.map((model) => (
              <option key={model.name} value={model.name}>
                {model.displayName}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-600">
            보통은 그대로 두시면 됩니다. 앱이 가장 알맞은 모델을 자동으로 고릅니다.
          </p>
        </div>
      )}

      {report !== null && (
        <ul data-testid="test-report" className="space-y-1 rounded border border-gray-300 p-3 text-sm">
          {report.map((line) => (
            <li key={line.label}>
              {line.state === 'ok' ? '✅' : line.state === 'fail' ? '❌' : '⏳'} {line.label}
              {line.detail !== '' && ` — ${line.detail}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: 설정 화면에 붙이기**

`src/ui/settings/SettingsPage.tsx`에서 `<AudioDrawer />` 아래에 `<ApiKeyForm />`을 추가하고 import 한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (전체)

- [ ] **Step 6: 실제 키로 손으로 확인**

- [ ] Google AI Studio에서 무료 API 키를 발급받아 입력
- [ ] `저장하고 모델 찾기` → 찾은 모델 개수와 이름이 표시되는지
- [ ] `연결 테스트` → 두 줄 모두 ✅ 인지
- [ ] 일부러 키를 틀리게 넣었을 때 **영문 오류가 아니라 한국어 안내**가 나오는지

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: API 키 등록과 모델 자동 탐색·연결 테스트 화면"
```

---

## Task 6: 식순 추출

**Files:**
- Create: `src/gemini/prompts.ts`, `src/gemini/extractOutline.ts`
- Test: `src/gemini/prompts.test.ts`, `src/gemini/extractOutline.test.ts`

**Interfaces:**
- Consumes: `generateText`·`Part`·`ClientDeps` (Task 4), `extractJson` (Task 3), `SegmentSeed` (계획서 1 Task 6), `SchoolProfile` (계획서 1 Task 1)
- Produces:
  - `buildOutlineInstruction(profile: SchoolProfile | null): string`
  - `OUTLINE_SCHEMA: unknown`
  - `type OutlineResult = { detectedEventType: string | null; title: string | null; date: string | null; place: string | null; seeds: SegmentSeed[] }`
  - `normalizeOutline(raw: unknown): OutlineResult`
  - `extractOutline(input: { text: string; files: { mimeType: string; base64: string }[] }, profile: SchoolProfile | null, deps: ClientDeps): Promise<OutlineResult>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/gemini/prompts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildOutlineInstruction } from './prompts';
import type { SchoolProfile } from '../types';

const profile: SchoolProfile = {
  id: 'singleton',
  schoolName: '한빛초등학교',
  principal: { title: '교장', name: '김철수' },
  vicePrincipal: null,
  foundedDate: null,
  updatedAt: 1,
};

describe('buildOutlineInstruction', () => {
  it('학교 정보를 프롬프트에 담는다', () => {
    const instruction = buildOutlineInstruction(profile);
    expect(instruction).toContain('한빛초등학교');
    expect(instruction).toContain('김철수');
  });

  it('없는 값을 지어내지 말라고 지시한다', () => {
    expect(buildOutlineInstruction(profile)).toContain('지어내지');
  });

  it('프로필이 없어도 프롬프트를 만든다', () => {
    expect(buildOutlineInstruction(null)).toContain('지어내지');
  });

  it('허용된 순서 종류를 명시한다', () => {
    const instruction = buildOutlineInstruction(profile);
    for (const kind of ['speech', 'audio', 'timer', 'address']) {
      expect(instruction).toContain(kind);
    }
  });
});
```

`src/gemini/extractOutline.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { normalizeOutline, extractOutline } from './extractOutline';
import type { ClientDeps, GenerateInput } from './client';

const fakeDeps = {} as ClientDeps;

// 인자 타입을 명시해야 mock.calls[0][0]이 tsc --noEmit을 통과한다.
const generateTextMock = vi.fn((_input: GenerateInput, _deps: ClientDeps) =>
  Promise.resolve({ text: '{"segments":[]}', modelUsed: 'models/x', modelChanged: false }),
);

// vi.doMock은 이미 정적 import된 모듈에는 먹지 않는다. 호이스팅되는 vi.mock으로 바꾼다.
// 팩토리는 위 const보다 먼저 실행되지만, 화살표 함수 안에서만 참조하므로 호출 시점에는
// 이미 초기화되어 있다.
vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof import('./client')>('./client');
  return {
    ...actual,
    generateText: (input: GenerateInput, deps: ClientDeps) => generateTextMock(input, deps),
  };
});

describe('normalizeOutline', () => {
  it('정상 응답을 그대로 옮긴다', () => {
    const result = normalizeOutline({
      detectedEventType: 'semester-opening',
      title: '2학기 개학식',
      date: '2026-08-18',
      place: '각 교실',
      segments: [
        { name: '개식사', kind: 'speech', note: '' },
        { name: '애국가 제창', kind: 'audio', note: '1절' },
      ],
    });

    expect(result.title).toBe('2학기 개학식');
    expect(result.seeds).toHaveLength(2);
    expect(result.seeds[1].name).toBe('애국가 제창');
    expect(result.seeds[1].note).toBe('1절');
  });

  it('새 순서의 멘트는 비워 둔다', () => {
    const result = normalizeOutline({ segments: [{ name: '개식사', kind: 'speech' }] });
    expect(result.seeds[0].script).toBe('');
  });

  it('모르는 종류는 speech로 본다', () => {
    const result = normalizeOutline({ segments: [{ name: '무언가', kind: '이상한값' }] });
    expect(result.seeds[0].kind).toBe('speech');
  });

  it('이름이 없는 순서는 버린다', () => {
    const result = normalizeOutline({
      segments: [{ kind: 'speech' }, { name: '개식사', kind: 'speech' }],
    });
    expect(result.seeds).toHaveLength(1);
  });

  it('식순을 못 찾으면 빈 목록을 돌려준다', () => {
    const result = normalizeOutline({ detectedEventType: 'semester-opening', segments: [] });
    expect(result.seeds).toEqual([]);
    expect(result.detectedEventType).toBe('semester-opening');
  });

  it('segments가 배열이 아니면 오류를 던진다', () => {
    expect(() => normalizeOutline({ segments: '아님' })).toThrow('AI 응답을 이해할 수 없습니다.');
  });

  it('객체가 아니면 오류를 던진다', () => {
    expect(() => normalizeOutline('문자열')).toThrow('AI 응답을 이해할 수 없습니다.');
  });

  it('묵념은 타이머로 만들고 60초를 기본으로 준다', () => {
    const result = normalizeOutline({
      segments: [{ name: '순국선열에 대한 묵념', kind: 'timer' }],
    });
    expect(result.seeds[0].kind).toBe('timer');
    expect(result.seeds[0].timerSec).toBe(60);
  });

  it('말씀 순서에는 기본 3분을 준다', () => {
    const result = normalizeOutline({ segments: [{ name: '학교장 말씀', kind: 'address' }] });
    expect(result.seeds[0].manualDurationSec).toBe(180);
  });
});

describe('extractOutline', () => {
  it('텍스트와 첨부를 함께 보낸다', async () => {
    generateTextMock.mockClear();
    generateTextMock.mockResolvedValue({
      text: '{"segments":[{"name":"개식사","kind":"speech"}]}',
      modelUsed: 'models/x',
      modelChanged: false,
    });

    const result = await extractOutline(
      { text: '개학식 계획서', files: [{ mimeType: 'application/pdf', base64: 'AAA' }] },
      null,
      fakeDeps,
    );

    expect(result.seeds).toHaveLength(1);
    const sentParts = generateTextMock.mock.calls[0][0].parts;
    expect(sentParts).toContainEqual({ text: '개학식 계획서' });
    expect(sentParts).toContainEqual({
      inlineData: { mimeType: 'application/pdf', data: 'AAA' },
    });
  });

  it('넣은 내용이 없으면 호출하지 않고 안내한다', async () => {
    generateTextMock.mockClear();

    await expect(extractOutline({ text: '   ', files: [] }, null, fakeDeps)).rejects.toThrow(
      '계획서 내용을 먼저 넣어 주세요.',
    );
    expect(generateTextMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- prompts extractOutline`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 프롬프트 구현**

`src/gemini/prompts.ts`:

```ts
import type { EventCeremony, SchoolProfile } from '../types';

function describeProfile(profile: SchoolProfile | null): string {
  if (profile === null) return '학교 정보가 등록되어 있지 않습니다.';
  const vice =
    profile.vicePrincipal === null
      ? ''
      : `\n- ${profile.vicePrincipal.title}: ${profile.vicePrincipal.name}`;
  return [
    `- 학교명: ${profile.schoolName}`,
    `- ${profile.principal.title}: ${profile.principal.name}`,
  ].join('\n') + vice;
}

const NO_INVENTION = [
  '아래 규칙을 반드시 지키세요.',
  '1. 주어지지 않은 사실을 지어내지 마세요. 학교명, 사람 이름, 날짜, 인원수, 수상자 이름은',
  '   아래 "학교 정보"와 사용자가 준 자료에 있는 값만 쓸 수 있습니다.',
  '2. 값을 모르면 비워 두지 말고 {{교장 성함}}처럼 이중 중괄호로 표시하세요.',
  '3. 한국 초등학교의 의식행사 관례를 따르세요.',
].join('\n');

export function buildOutlineInstruction(profile: SchoolProfile | null): string {
  return [
    '당신은 한국 초등학교의 행사 진행을 돕는 도우미입니다.',
    '사용자가 준 행사 계획서에서 식순(행사 순서)만 뽑아 JSON으로 정리하세요.',
    '멘트(사회자 대사)는 아직 만들지 마세요.',
    '',
    NO_INVENTION,
    '',
    '각 순서의 kind는 다음 중 하나여야 합니다.',
    '- speech: 사회자가 말만 하는 순서 (개식사, 폐식사 등)',
    '- audio: 음원을 트는 순서 (애국가 제창, 교가 제창, 국기에 대한 경례)',
    '- timer: 정해진 시간 동안 진행하는 순서 (묵념)',
    '- address: 다른 사람이 말하는 순서 (학교장 말씀, 전달 사항)',
    '',
    '학교 정보',
    describeProfile(profile),
  ].join('\n');
}

export function buildScriptInstruction(
  event: EventCeremony,
  profile: SchoolProfile | null,
): string {
  const modeRule =
    event.mode === 'broadcast'
      ? '이 행사는 교실에서 방송으로 진행합니다. "각 교실에서", "화면을 향해" 같은 표현을 쓰고, 강당 이동이나 무대 관련 표현은 절대 쓰지 마세요.'
      : '이 행사는 강당 등에서 대면으로 진행합니다. "자리에서 일어서 주시기 바랍니다" 같은 표현을 쓰세요.';

  const audienceRule = {
    lower: '듣는 사람은 1~2학년입니다. 문장을 짧게 하고 쉬운 낱말만 쓰세요.',
    upper: '듣는 사람은 고학년입니다. 표준적인 정중한 문체를 쓰세요.',
    all: '듣는 사람은 전교생입니다. 고학년 기준의 정중한 문체를 쓰되 저학년도 알아들을 낱말을 쓰세요.',
    withParents: '학부모와 내빈이 참석합니다. 격식을 높이고 내빈에 대한 감사 인사를 포함하세요.',
  }[event.audience];

  const toneRule = {
    formal: '정중하고 담백하게 쓰세요.',
    warm: '따뜻하고 다정한 느낌을 담으세요.',
    concise: '군더더기 없이 짧게 쓰세요.',
  }[event.tone];

  const targetRule =
    event.targetMinutes === null
      ? ''
      : `전체 행사가 약 ${event.targetMinutes}분에 맞도록 멘트 분량을 조절하세요.`;

  return [
    '당신은 한국 초등학교 행사의 사회자 대본을 쓰는 도우미입니다.',
    '각 순서마다 사회자가 마이크에 대고 그대로 읽을 문장만 쓰세요.',
    '무대 지시, 괄호 설명, 진행 요령은 절대 넣지 마세요.',
    '',
    NO_INVENTION,
    '',
    '국민의례, 국기에 대한 경례, 묵념 같은 의식 절차의 표준 표현은 임의로 바꾸지 마세요.',
    '',
    modeRule,
    audienceRule,
    toneRule,
    targetRule,
    '',
    `행사명: ${event.title}`,
    `날짜: ${event.date}`,
    `장소: ${event.place}`,
    '',
    '학교 정보',
    describeProfile(profile),
  ]
    .filter((line) => line !== '')
    .join('\n');
}
```

- [ ] **Step 4: 식순 추출 구현**

`src/gemini/extractOutline.ts`:

```ts
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
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- prompts extractOutline`
Expected: PASS (15 tests)

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: 계획서에서 식순을 뽑아내는 AI 호출"
```

---

## Task 7: 멘트 생성과 부분 재생성

**Files:**
- Create: `src/gemini/generateScripts.ts`
- Test: `src/gemini/generateScripts.test.ts`

**Interfaces:**
- Consumes: `generateText`·`ClientDeps` (Task 4), `extractJson` (Task 3), `buildScriptInstruction` (Task 6), `EventCeremony`·`Segment`·`SchoolProfile` (계획서 1 Task 1)
- Produces:
  - `SCRIPT_SCHEMA: unknown`
  - `applyScripts(segments: Segment[], raw: unknown): Segment[]`
  - `generateScripts(event: EventCeremony, profile: SchoolProfile | null, deps: ClientDeps): Promise<Segment[]>`
  - `regenerateOne(event: EventCeremony, segmentId: string, profile: SchoolProfile | null, deps: ClientDeps): Promise<Segment[]>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/gemini/generateScripts.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyScripts, generateScripts, regenerateOne } from './generateScripts';
import { createEventFromTemplate } from '../domain/templates';
import type { ClientDeps, GenerateInput } from './client';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

// 인자 타입을 명시해야 mock.calls[0][0]이 tsc --noEmit을 통과한다.
const generateTextMock = vi.fn((_input: GenerateInput, _deps: ClientDeps) =>
  Promise.resolve({ text: '{"segments":[]}', modelUsed: 'models/x', modelChanged: false }),
);

// vi.doMock은 이미 정적 import된 모듈에 먹지 않으므로 호이스팅되는 vi.mock을 쓴다.
vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof import('./client')>('./client');
  return {
    ...actual,
    generateText: (input: GenerateInput, deps: ClientDeps) => generateTextMock(input, deps),
  };
});

beforeEach(() => {
  generateTextMock.mockClear();
});

describe('applyScripts', () => {
  it('id로 짝지어 멘트를 채운다', () => {
    const { segments } = createEventFromTemplate('semester-opening', init);
    const updated = applyScripts(segments, {
      segments: [
        { id: segments[0].id, script: '개학식을 시작하겠습니다.' },
        { id: segments[6].id, script: '이상으로 마치겠습니다.' },
      ],
    });

    expect(updated[0].script).toBe('개학식을 시작하겠습니다.');
    expect(updated[6].script).toBe('이상으로 마치겠습니다.');
  });

  it('응답에 없는 순서는 원래 멘트를 지킨다', () => {
    const { segments } = createEventFromTemplate('semester-opening', init);
    segments[1].script = '기존 멘트';

    const updated = applyScripts(segments, {
      segments: [{ id: segments[0].id, script: '새 멘트' }],
    });

    expect(updated[1].script).toBe('기존 멘트');
  });

  it('모르는 id는 무시한다', () => {
    const { segments } = createEventFromTemplate('semester-opening', init);
    const updated = applyScripts(segments, {
      segments: [{ id: '없는id', script: '엉뚱한 멘트' }],
    });
    expect(updated.every((segment) => segment.script === '')).toBe(true);
  });

  it('순서 개수와 순서 자체는 바뀌지 않는다', () => {
    const { segments } = createEventFromTemplate('semester-opening', init);
    const updated = applyScripts(segments, { segments: [] });
    expect(updated.map((s) => s.id)).toEqual(segments.map((s) => s.id));
  });

  it('script가 문자열이 아니면 건너뛴다', () => {
    const { segments } = createEventFromTemplate('semester-opening', init);
    const updated = applyScripts(segments, {
      segments: [{ id: segments[0].id, script: 123 }],
    });
    expect(updated[0].script).toBe('');
  });

  it('응답 모양이 틀리면 오류를 던진다', () => {
    const { segments } = createEventFromTemplate('semester-opening', init);
    expect(() => applyScripts(segments, { 아무거나: true })).toThrow(
      'AI 응답을 이해할 수 없습니다.',
    );
  });
});

describe('generateScripts', () => {
  it('진행 방식을 지시문에 담아 보낸다', async () => {
    const event = createEventFromTemplate('semester-opening', init);
    await generateScripts(event, null, {} as ClientDeps);

    const instruction = String(generateTextMock.mock.calls[0][0].systemInstruction);
    expect(instruction).toContain('각 교실');
  });
});

describe('regenerateOne', () => {
  it('대상 순서와 앞뒤 한 개씩만 보낸다', async () => {
    const event = createEventFromTemplate('semester-opening', init);
    await regenerateOne(event, event.segments[3].id, null, {} as ClientDeps);

    const sent = String((generateTextMock.mock.calls[0][0].parts as { text: string }[])[0].text);
    expect(sent).toContain(event.segments[2].name);
    expect(sent).toContain(event.segments[3].name);
    expect(sent).toContain(event.segments[4].name);
    expect(sent).not.toContain(event.segments[6].name);
  });

  it('없는 순서를 지정하면 오류를 던진다', async () => {
    const event = createEventFromTemplate('semester-opening', init);
    await expect(regenerateOne(event, '없는id', null, {} as ClientDeps)).rejects.toThrow(
      '순서를 찾을 수 없습니다.',
    );
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- generateScripts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/gemini/generateScripts.ts`:

```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- generateScripts`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: 사회자 멘트 생성과 순서별 재생성"
```

---

## Task 8: 계획서 넣기와 식순 확인 화면

**Files:**
- Create: `src/gemini/fileToInline.ts`, `src/ui/wizard/planDraft.ts`, `src/ui/wizard/ImportPlanPage.tsx`, `src/ui/wizard/OutlineReviewPage.tsx`
- Modify: `src/domain/templates/index.ts`, `src/ui/NewEventPage.tsx`, `src/ui/App.tsx`
- Test: `src/gemini/fileToInline.test.ts`, `src/domain/templates/createFromSeeds.test.ts`, `src/ui/wizard/OutlineReviewPage.test.tsx`

**Interfaces:**
- Consumes: `extractOutline`·`OutlineResult` (Task 6), `defaultDeps`·`GeminiError` (Task 4), `getProfile` (계획서 1 Task 2), `putEvent` (계획서 1 Task 6), `segmentOps` (계획서 1 Task 8)
- Produces:
  - `fileToInline(file: File): Promise<{ mimeType: string; base64: string }>`
  - `ACCEPTED_PLAN_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']`
  - `savePlanDraft(draft: OutlineResult): void`, `loadPlanDraft(): OutlineResult | null`, `clearPlanDraft(): void`
  - `createEventFromSeeds(seeds: SegmentSeed[], init: EventInit): EventCeremony` (templates에 추가)
  - 라우트 `#/new/plan`, `#/new/outline`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/gemini/fileToInline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fileToInline, ACCEPTED_PLAN_TYPES } from './fileToInline';

describe('fileToInline', () => {
  it('파일을 base64로 바꾼다', async () => {
    const file = new File([new Uint8Array([72, 105])], '계획서.pdf', { type: 'application/pdf' });
    const result = await fileToInline(file);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.base64).toBe('SGk=');
  });

  it('빈 파일도 처리한다', async () => {
    const file = new File([], '빈파일.pdf', { type: 'application/pdf' });
    expect((await fileToInline(file)).base64).toBe('');
  });

  it('지원하지 않는 형식은 오류를 던진다', async () => {
    const file = new File(['내용'], '계획서.hwp', { type: 'application/x-hwp' });
    await expect(fileToInline(file)).rejects.toThrow(
      '한글(hwp) 파일은 읽을 수 없습니다',
    );
  });

  it('20MB를 넘으면 오류를 던진다', async () => {
    const big = new File([new Uint8Array(21 * 1024 * 1024)], '큰파일.pdf', {
      type: 'application/pdf',
    });
    await expect(fileToInline(big)).rejects.toThrow('파일이 너무 큽니다');
  });

  it('PDF와 주요 이미지 형식을 허용한다', () => {
    expect(ACCEPTED_PLAN_TYPES).toContain('application/pdf');
    expect(ACCEPTED_PLAN_TYPES).toContain('image/jpeg');
  });
});
```

`src/domain/templates/createFromSeeds.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createEventFromSeeds } from './index';
import type { SegmentSeed } from './index';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

const seeds: SegmentSeed[] = [
  {
    name: '개식사',
    groupLabel: null,
    kind: 'speech',
    script: '',
    audioRole: null,
    autoPlay: false,
    fadeOutSec: null,
    timerSec: null,
    manualDurationSec: null,
    note: '',
  },
];

describe('createEventFromSeeds', () => {
  it('주어진 순서로 행사를 만든다', () => {
    const event = createEventFromSeeds(seeds, init);
    expect(event.segments).toHaveLength(1);
    expect(event.segments[0].name).toBe('개식사');
    expect(event.segments[0].order).toBe(0);
  });

  it('templateId를 custom으로 표시한다', () => {
    expect(createEventFromSeeds(seeds, init).templateId).toBe('custom');
  });

  it('빈 목록도 허용한다', () => {
    expect(createEventFromSeeds([], init).segments).toEqual([]);
  });
});
```

`src/ui/wizard/OutlineReviewPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { listEvents } from '../../db/eventRepo';
import { savePlanDraft, clearPlanDraft } from './planDraft';
import OutlineReviewPage from './OutlineReviewPage';

const draft = {
  detectedEventType: 'semester-opening',
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  seeds: [
    { name: '개식사', groupLabel: null, kind: 'speech' as const, script: '', audioRole: null, autoPlay: false, fadeOutSec: null, timerSec: null, manualDurationSec: null, note: '' },
    { name: '애국가 제창', groupLabel: null, kind: 'audio' as const, script: '', audioRole: null, autoPlay: false, fadeOutSec: null, timerSec: null, manualDurationSec: null, note: '' },
  ],
};

describe('OutlineReviewPage', () => {
  beforeEach(async () => {
    await clearDb();
    clearPlanDraft();
  });

  it('뽑아낸 식순을 보여준다', async () => {
    savePlanDraft(draft);
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);

    expect(await screen.findByDisplayValue('개식사')).toBeInTheDocument();
    expect(screen.getByDisplayValue('애국가 제창')).toBeInTheDocument();
  });

  it('찾아낸 제목을 미리 채워 준다', async () => {
    savePlanDraft(draft);
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);
    expect(await screen.findByLabelText('행사 제목')).toHaveValue('2학기 개학식');
  });

  it('순서를 지울 수 있다', async () => {
    const user = userEvent.setup();
    savePlanDraft(draft);
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);

    const row = (await screen.findByDisplayValue('개식사')).closest('li')!;
    await user.click(within(row).getByRole('button', { name: '삭제' }));

    expect(screen.queryByDisplayValue('개식사')).not.toBeInTheDocument();
  });

  it('순서를 추가할 수 있다', async () => {
    const user = userEvent.setup();
    savePlanDraft(draft);
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: '＋ 순서 추가' }));
    expect(screen.getAllByTestId('outline-row')).toHaveLength(3);
  });

  it('확정하면 행사로 저장한다', async () => {
    const user = userEvent.setup();
    savePlanDraft(draft);
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: '이 식순으로 행사 만들기' }));

    const events = await listEvents();
    expect(events).toHaveLength(1);
    expect(events[0].segments.map((s) => s.name)).toEqual(['개식사', '애국가 제창']);
  });

  it('식순이 하나도 없으면 안내한다', async () => {
    savePlanDraft({ ...draft, seeds: [] });
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);
    expect(await screen.findByText(/식순을 찾지 못했습니다/)).toBeInTheDocument();
  });

  it('넘어온 자료가 없으면 처음으로 돌아가라고 안내한다', async () => {
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);
    expect(await screen.findByText(/계획서를 먼저 넣어 주세요/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- fileToInline createFromSeeds OutlineReviewPage`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 파일 변환 구현**

`src/gemini/fileToInline.ts`:

```ts
export const ACCEPTED_PLAN_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

const MAX_BYTES = 20 * 1024 * 1024;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function fileToInline(
  file: File,
): Promise<{ mimeType: string; base64: string }> {
  if (!ACCEPTED_PLAN_TYPES.includes(file.type)) {
    throw new Error(
      '한글(hwp) 파일은 읽을 수 없습니다. 한글에서 "PDF로 저장"한 뒤 그 파일을 넣거나, 내용을 복사해 붙여넣어 주세요.',
    );
  }
  if (file.size > MAX_BYTES) {
    throw new Error('파일이 너무 큽니다. 20MB 이하로 줄여 주세요.');
  }
  return { mimeType: file.type, base64: toBase64(await file.arrayBuffer()) };
}
```

- [ ] **Step 4: 임시 저장과 행사 생성 함수 추가**

`src/ui/wizard/planDraft.ts`:

```ts
import type { OutlineResult } from '../../gemini/extractOutline';

const KEY = 'haengsa-baksa:plan-draft';

export function savePlanDraft(draft: OutlineResult): void {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function loadPlanDraft(): OutlineResult | null {
  const raw = sessionStorage.getItem(KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as OutlineResult;
  } catch {
    return null;
  }
}

export function clearPlanDraft(): void {
  sessionStorage.removeItem(KEY);
}
```

`src/domain/templates/index.ts`에 아래 함수를 추가한다.

```ts
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
```

`createEventFromTemplate`은 이 함수를 재사용하도록 고친다.

```ts
export function createEventFromTemplate(templateId: string, init: EventInit): EventCeremony {
  const template = getTemplate(templateId);
  if (template === null) throw new Error('알 수 없는 행사 템플릿입니다.');
  return { ...createEventFromSeeds(template.seeds, init), templateId };
}
```

- [ ] **Step 5: 계획서 넣기 화면 구현**

`src/ui/wizard/ImportPlanPage.tsx`:

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fileToInline, ACCEPTED_PLAN_TYPES } from '../../gemini/fileToInline';
import { extractOutline } from '../../gemini/extractOutline';
import { defaultDeps, GeminiError } from '../../gemini/client';
import { getProfile } from '../../db/profileRepo';
import { savePlanDraft } from './planDraft';

export default function ImportPlanPage() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleExtract() {
    setBusy(true);
    setError('');
    try {
      const inline = await Promise.all(files.map(fileToInline));
      const profile = await getProfile();
      const outline = await extractOutline({ text, files: inline }, profile, defaultDeps());
      savePlanDraft(outline);
      navigate('/new/outline');
    } catch (caught) {
      if (caught instanceof GeminiError) setError(caught.info.message);
      else if (caught instanceof Error) setError(caught.message);
      else setError('식순을 뽑아내지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4 pb-16">
      <header className="flex items-center gap-3">
        <Link to="/new" className="text-blue-600">← 뒤로</Link>
        <h1 className="text-lg font-bold">계획서에서 식순 뽑기</h1>
      </header>

      <div>
        <label className="block text-sm font-medium" htmlFor="planText">
          계획서 내용 붙여넣기
        </label>
        <textarea
          id="planText"
          rows={10}
          className="w-full rounded border border-gray-400 p-2"
          placeholder="한글 문서에서 식순 부분을 드래그해 복사한 뒤 여기에 붙여넣으세요. 표를 그대로 붙여넣어도 됩니다."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="planFiles">
          또는 파일 올리기 (PDF · 사진)
        </label>
        <input
          id="planFiles"
          type="file"
          multiple
          accept={ACCEPTED_PLAN_TYPES.join(',')}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <p className="mt-1 text-sm text-gray-600">
          한글(hwp) 파일은 읽을 수 없습니다. 한글에서 <strong>PDF로 저장</strong>한 뒤 그 파일을 올려 주세요.
        </p>
        {files.length > 0 && (
          <ul className="mt-1 text-sm">
            {files.map((file) => <li key={file.name}>· {file.name}</li>)}
          </ul>
        )}
      </div>

      {error !== '' && <p className="text-red-600">{error}</p>}

      <button
        className="w-full rounded bg-blue-600 px-4 py-3 text-white disabled:bg-gray-400"
        disabled={busy || (text.trim() === '' && files.length === 0)}
        onClick={() => void handleExtract()}
      >
        {busy ? '식순을 읽는 중입니다…' : '식순 뽑아내기'}
      </button>
    </main>
  );
}
```

- [ ] **Step 6: 식순 확인 화면 구현**

`src/ui/wizard/OutlineReviewPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearPlanDraft, loadPlanDraft } from './planDraft';
import { createEventFromSeeds, type SegmentSeed } from '../../domain/templates';
import { putEvent } from '../../db/eventRepo';
import type { EventAudience, EventMode, EventTone, SegmentKind } from '../../types';

const KINDS: { value: SegmentKind; label: string }[] = [
  { value: 'speech', label: '멘트만' },
  { value: 'audio', label: '음원 재생' },
  { value: 'timer', label: '묵념 등 시간' },
  { value: 'address', label: '말씀·전달' },
];

function blankSeed(): SegmentSeed {
  return {
    name: '',
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

export default function OutlineReviewPage() {
  const navigate = useNavigate();
  const [seeds, setSeeds] = useState<SegmentSeed[] | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [place, setPlace] = useState('');
  const [mode, setMode] = useState<EventMode>('inPerson');
  const [audience, setAudience] = useState<EventAudience>('all');
  const [tone, setTone] = useState<EventTone>('formal');
  const [error, setError] = useState('');

  useEffect(() => {
    const draft = loadPlanDraft();
    if (draft === null) return;
    setSeeds(draft.seeds);
    setTitle(draft.title ?? '');
    if (draft.date !== null) setDate(draft.date);
    setPlace(draft.place ?? '');
  }, []);

  if (seeds === null) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <p>계획서를 먼저 넣어 주세요.</p>
        <Link to="/new/plan" className="mt-3 inline-block text-blue-600">← 계획서 넣기로</Link>
      </main>
    );
  }

  function update(index: number, patch: Partial<SegmentSeed>) {
    setSeeds((current) =>
      current === null ? null : current.map((seed, i) => (i === index ? { ...seed, ...patch } : seed)),
    );
  }

  async function handleCreate() {
    if (seeds === null) return;
    const named = seeds.filter((seed) => seed.name.trim() !== '');
    if (title.trim() === '') {
      setError('행사 제목을 입력해 주세요.');
      return;
    }
    if (named.length === 0) {
      setError('순서를 최소 하나는 넣어 주세요.');
      return;
    }
    const event = createEventFromSeeds(named, {
      title: title.trim(),
      date,
      place: place.trim(),
      mode,
      audience,
      tone,
      targetMinutes: null,
    });
    await putEvent(event);
    clearPlanDraft();
    navigate(`/event/${event.id}/edit`);
  }

  const field = 'w-full rounded border border-gray-400 px-3 py-2';

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4 pb-16">
      <header className="flex items-center gap-3">
        <Link to="/new/plan" className="text-blue-600">← 다시 넣기</Link>
        <h1 className="text-lg font-bold">식순 확인</h1>
      </header>

      {seeds.length === 0 && (
        <p className="rounded bg-amber-100 p-3 text-sm">
          계획서에서 식순을 찾지 못했습니다. 아래에서 직접 순서를 추가하시거나,
          <Link to="/new" className="text-blue-600"> 표준 템플릿으로 시작</Link>하셔도 됩니다.
        </p>
      )}

      <ul className="space-y-2">
        {seeds.map((seed, index) => (
          <li key={index} data-testid="outline-row"
              className="flex items-center gap-2 rounded border border-gray-300 p-2">
            <span className="w-6 text-sm text-gray-500">{index + 1}</span>
            <input
              className="flex-1 rounded border border-gray-400 px-2 py-1"
              aria-label={`${index + 1}번 순서명`}
              value={seed.name}
              onChange={(e) => update(index, { name: e.target.value })}
            />
            <select
              className="rounded border border-gray-400 px-1 py-1 text-sm"
              aria-label={`${index + 1}번 종류`}
              value={seed.kind}
              onChange={(e) => update(index, { kind: e.target.value as SegmentKind })}
            >
              {KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>{kind.label}</option>
              ))}
            </select>
            <button className="text-sm text-red-600"
                    onClick={() => setSeeds(seeds.filter((_, i) => i !== index))}>
              삭제
            </button>
          </li>
        ))}
      </ul>

      <button className="rounded border border-gray-400 px-3 py-2"
              onClick={() => setSeeds([...seeds, blankSeed()])}>
        ＋ 순서 추가
      </button>

      <hr className="border-gray-300" />

      <div>
        <label className="block text-sm font-medium" htmlFor="title">행사 제목</label>
        <input id="title" className={field} value={title}
               onChange={(e) => setTitle(e.target.value)} />
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

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium" htmlFor="audience">대상</label>
          <select id="audience" className={field} value={audience}
                  onChange={(e) => setAudience(e.target.value as EventAudience)}>
            <option value="lower">저학년 (1~2학년)</option>
            <option value="upper">고학년</option>
            <option value="all">전교생</option>
            <option value="withParents">학부모·내빈 참석</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium" htmlFor="tone">멘트 톤</label>
          <select id="tone" className={field} value={tone}
                  onChange={(e) => setTone(e.target.value as EventTone)}>
            <option value="formal">정중하게</option>
            <option value="warm">따뜻하게</option>
            <option value="concise">간결하게</option>
          </select>
        </div>
      </div>

      {error !== '' && <p className="text-red-600">{error}</p>}

      <button className="w-full rounded bg-blue-600 px-4 py-3 text-white"
              onClick={() => void handleCreate()}>
        이 식순으로 행사 만들기
      </button>
    </main>
  );
}
```

- [ ] **Step 7: 진입점과 라우트 연결**

`src/ui/NewEventPage.tsx` 맨 위에 링크를 추가한다.

```tsx
<Link to="/new/plan"
      className="block rounded border border-blue-400 p-3 text-center text-blue-700">
  📄 계획서 파일이나 붙여넣은 글에서 식순 뽑기
</Link>
```

`src/ui/App.tsx`에 라우트를 추가한다.

```tsx
import ImportPlanPage from './wizard/ImportPlanPage';
import OutlineReviewPage from './wizard/OutlineReviewPage';
// ...
<Route path="/new/plan" element={<ImportPlanPage />} />
<Route path="/new/outline" element={<OutlineReviewPage />} />
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (전체)

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "feat: 계획서에서 식순 뽑기와 식순 확인 화면"
```

---

## Task 9: 편집기에서 멘트 생성

**Files:**
- Modify: `src/ui/editor/EditorPage.tsx`, `src/ui/editor/SegmentCard.tsx`
- Test: `src/ui/editor/EditorGenerate.test.tsx`

**Interfaces:**
- Consumes: `generateScripts`·`regenerateOne` (Task 7), `defaultDeps`·`GeminiError` (Task 4), `getProfile` (계획서 1 Task 2)
- Produces: 편집기의 `AI로 멘트 채우기` 버튼과 카드별 `🔄 이 순서만 다시 생성` 버튼

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/editor/EditorGenerate.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { putEvent } from '../../db/eventRepo';
import { createEventFromTemplate } from '../../domain/templates';
import EditorPage from './EditorPage';

const generateScripts = vi.fn();
const regenerateOne = vi.fn();

vi.mock('../../gemini/generateScripts', () => ({
  generateScripts: (...args: unknown[]) => generateScripts(...args),
  regenerateOne: (...args: unknown[]) => regenerateOne(...args),
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

describe('편집기의 AI 생성', () => {
  beforeEach(async () => {
    await clearDb();
    generateScripts.mockReset();
    regenerateOne.mockReset();
  });

  it('전체 멘트를 생성해 화면에 반영한다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();
    generateScripts.mockResolvedValue(
      event.segments.map((segment, index) =>
        index === 0 ? { ...segment, script: '개학식을 시작하겠습니다.' } : segment,
      ),
    );

    await user.click(await screen.findByRole('button', { name: 'AI로 멘트 채우기' }));

    const card = await screen.findByTestId(`card-${event.segments[0].id}`);
    await user.click(within(card).getByRole('button', { name: '펼치기' }));
    expect(within(card).getByLabelText('사회자 멘트')).toHaveValue('개학식을 시작하겠습니다.');
  });

  it('생성 중에는 버튼을 다시 누를 수 없다', async () => {
    const user = userEvent.setup();
    await renderEditor();
    generateScripts.mockReturnValue(new Promise(() => undefined));

    await user.click(await screen.findByRole('button', { name: 'AI로 멘트 채우기' }));
    expect(await screen.findByRole('button', { name: '멘트를 쓰는 중입니다…' })).toBeDisabled();
  });

  it('실패하면 한국어 안내를 보여주고 기존 내용을 지킨다', async () => {
    const user = userEvent.setup();
    const { GeminiError } = await import('../../gemini/client');
    await renderEditor();
    generateScripts.mockRejectedValue(
      new GeminiError({ kind: 'quota', retryAfterSec: 30, message: '무료 사용량을 초과했습니다.' }),
    );

    await user.click(await screen.findByRole('button', { name: 'AI로 멘트 채우기' }));

    expect(await screen.findByText('무료 사용량을 초과했습니다.')).toBeInTheDocument();
    expect(screen.getByText('개식사')).toBeInTheDocument();
  });

  it('순서 하나만 다시 생성한다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();
    regenerateOne.mockResolvedValue(
      event.segments.map((segment, index) =>
        index === 0 ? { ...segment, script: '새로 쓴 멘트' } : segment,
      ),
    );

    const card = await screen.findByTestId(`card-${event.segments[0].id}`);
    await user.click(within(card).getByRole('button', { name: '펼치기' }));
    await user.click(within(card).getByRole('button', { name: '🔄 이 순서만 다시 생성' }));

    expect(regenerateOne).toHaveBeenCalled();
    expect(within(card).getByLabelText('사회자 멘트')).toHaveValue('새로 쓴 멘트');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- EditorGenerate`
Expected: FAIL — `AI로 멘트 채우기` 버튼을 찾을 수 없음

- [ ] **Step 3: 편집기 수정**

`src/ui/editor/EditorPage.tsx`에 상태와 처리를 추가한다.

```tsx
import { generateScripts, regenerateOne } from '../../gemini/generateScripts';
import { defaultDeps, GeminiError } from '../../gemini/client';
import { getProfile } from '../../db/profileRepo';
// ...
const [aiBusy, setAiBusy] = useState(false);
const [aiError, setAiError] = useState('');

function describeAiError(caught: unknown): string {
  if (caught instanceof GeminiError) return caught.info.message;
  if (caught instanceof Error) return caught.message;
  return '멘트를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

async function handleGenerateAll() {
  if (event === null) return;
  setAiBusy(true);
  setAiError('');
  try {
    const profile = await getProfile();
    setSegments(await generateScripts(event, profile, defaultDeps()));
  } catch (caught) {
    setAiError(describeAiError(caught));
  } finally {
    setAiBusy(false);
  }
}

async function handleRegenerate(segmentId: string) {
  if (event === null) return;
  setAiBusy(true);
  setAiError('');
  try {
    const profile = await getProfile();
    setSegments(await regenerateOne(event, segmentId, profile, defaultDeps()));
  } catch (caught) {
    setAiError(describeAiError(caught));
  } finally {
    setAiBusy(false);
  }
}
```

상단 바 아래에 버튼과 오류 표시를 넣는다.

```tsx
<div className="flex items-center gap-3 border-b border-gray-200 p-3">
  <button
    className="rounded bg-emerald-600 px-3 py-2 text-white disabled:bg-gray-400"
    disabled={aiBusy}
    onClick={() => void handleGenerateAll()}
  >
    {aiBusy ? '멘트를 쓰는 중입니다…' : 'AI로 멘트 채우기'}
  </button>
  {aiError !== '' && <span className="text-sm text-red-600">{aiError}</span>}
</div>
```

`SegmentCard`에 `onRegenerate: () => void`와 `aiBusy: boolean` 속성을 추가하고, 펼친 영역 맨 아래에 버튼을 넣는다.

```tsx
<button
  className="rounded border border-emerald-600 px-3 py-1 text-emerald-700 disabled:opacity-50"
  disabled={aiBusy}
  onClick={onRegenerate}
>
  🔄 이 순서만 다시 생성
</button>
```

`EditorPage`에서 `<SegmentCard ... aiBusy={aiBusy} onRegenerate={() => void handleRegenerate(segment.id)} />`로 넘긴다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (전체)

Run: `npm run build`
Expected: 타입 오류 없음

- [ ] **Step 5: 실제 키로 손으로 확인**

- [ ] 실제 개학식 계획서를 PDF로 저장해 올리고 식순이 뽑히는지
- [ ] 한글 표를 그대로 복사해 붙여넣어도 식순이 뽑히는지
- [ ] 대면/방송을 바꿔가며 생성했을 때 **멘트 표현이 실제로 달라지는지**
- [ ] 저학년/전교생을 바꿨을 때 문장 길이가 달라지는지
- [ ] 교장 성함을 프로필에 넣지 않은 상태로 생성했을 때 **이름을 지어내지 않고 `{{교장 성함}}`으로 남기는지** ← 가장 중요
- [ ] `이 순서만 다시 생성`이 다른 순서의 멘트를 건드리지 않는지
- [ ] 빈칸이 남은 채로 점검 화면에 갔을 때 진행 시작이 막히는지

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: 편집기에서 AI 멘트 생성과 순서별 재생성"
```

---

## 완료 기준

- `npm test`가 전부 통과한다.
- API 키를 넣으면 앱이 스스로 모델을 찾아 고르고, 모델이 바뀌어도 사용자가 아무것도 하지 않아도 된다.
- 어떤 오류가 나도 화면에는 **한국어 안내**만 뜬다.
- 계획서(PDF·사진·붙여넣기)에서 식순이 뽑히고, 대상·진행방식에 맞는 멘트가 생성된다.
- **AI가 사람 이름을 지어내지 않는다.** 모르면 `{{ }}`로 남기고, 그 상태로는 진행 모드에 들어갈 수 없다.

## 자체 점검 결과

**스펙 반영 확인**

| 스펙 항목 | 담당 작업 |
|---|---|
| 7.2 실행 시점 모델 탐색 (v1beta → v1) | Task 4 |
| 7.3 modelPicker 점수 규칙 | Task 1 |
| 7.4 404/429/5xx 폴백·재시도 | Task 4 |
| 7.5 errorMapper 한국어 변환 | Task 2 |
| 7.6 연결 테스트 화면 | Task 5 |
| 8.1 식순 추출 + 관대한 파서 | Task 3·6 |
| 8.2 멘트 생성 + 부분 재생성 | Task 7·9 |
| 8.3 프롬프트 가드레일 (지어내기 금지·대면/방송·대상별) | Task 6 (`prompts.ts`) |
| 8.4 빈칸 검증 | 계획서 1 Task 7·12에서 이미 구현됨 |
| 6.3 1·2단계 (계획서 넣기, 식순 확인) | Task 8 |

**스펙과 다르게 한 것**

1. **연결 테스트의 "PDF 읽기 지원 확인"을 뺐다.** 더미 PDF를 만들어 보내는 비용에 비해 얻는 정보가 적고, 실제로 계획서를 올릴 때 바로 알 수 있다. 대신 파일이 거부되면 "PDF로 저장해 올려 주세요"라는 안내가 뜬다.
2. **모델 목록 주기적 재탐색을 넣지 않았다.** 404가 났을 때 재탐색하는 것만으로 충분하고, 주기 관리는 복잡도만 늘린다. 사용자가 `목록 새로고침`을 눌러 직접 갱신할 수 있다.
3. **`extractOutline`이 `groupLabel`을 채우지 않는다.** 국민의례 묶음은 표준 템플릿에만 있고, 뽑아낸 식순에서는 사용자가 편집기에서 정리하는 편이 정확하다.

**주의할 점**

- `defaultDeps()`가 `settingsRepo`를 동적 import 한다. 테스트에서 `client` 모듈을 대역으로 바꿀 때 `defaultDeps`도 함께 바꿔야 IndexedDB에 손대지 않는다.
- Gemini의 `responseSchema` 지원은 모델마다 다르다. 스키마를 무시한 응답이 와도 `extractJson`이 받아내지만, 형태가 아예 다르면 `normalizeOutline`/`applyScripts`가 한국어 오류를 던진다. 이때 사용자는 다시 시도하거나 표준 템플릿으로 우회할 수 있다.
