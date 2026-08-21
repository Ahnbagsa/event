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
