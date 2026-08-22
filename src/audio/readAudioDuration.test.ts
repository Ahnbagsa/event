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

// 동영상은 new Audio()로 길이를 읽지 못한다. 종류에 맞는 요소를 만드는지 확인한다.
describe('동영상', () => {
  function fakeReader(behavior: 'ok' | 'error', duration = 0) {
    const asked: string[] = [];
    const create = (kind: 'audio' | 'video') => {
      asked.push(kind);
      const reader = {
        duration: 0,
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
        set src(_value: string) {
          queueMicrotask(() => {
            if (behavior === 'ok') {
              reader.duration = duration;
              reader.onloadedmetadata?.();
            } else {
              reader.onerror?.();
            }
          });
        },
      };
      return reader;
    };
    return { create, asked };
  }

  it('동영상이면 video 요소로 잰다', async () => {
    const { create, asked } = fakeReader('ok', 95.5);
    await expect(readAudioDuration(new ArrayBuffer(8), 'video/mp4', create)).resolves.toBe(95.5);
    expect(asked).toEqual(['video']);
  });

  it('음원이면 audio 요소로 잰다', async () => {
    const { create, asked } = fakeReader('ok', 69);
    await readAudioDuration(new ArrayBuffer(8), 'audio/mpeg', create);
    expect(asked).toEqual(['audio']);
  });

  it('동영상을 읽지 못하면 동영상이라고 알린다', async () => {
    const { create } = fakeReader('error');
    await expect(readAudioDuration(new ArrayBuffer(8), 'video/mp4', create)).rejects.toThrow(
      '동영상 파일을 읽을 수 없습니다.',
    );
  });
});
