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
