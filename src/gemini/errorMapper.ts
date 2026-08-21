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
