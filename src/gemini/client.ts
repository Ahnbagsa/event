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
