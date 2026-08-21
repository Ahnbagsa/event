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
