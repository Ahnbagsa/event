import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayer } from './usePlayer';
import type { AudioAsset } from '../types';

function asset(mimeType: string): AudioAsset {
  return {
    id: 'a1',
    role: 'anthem',
    label: '애국가',
    data: new ArrayBuffer(8),
    mimeType,
    durationSec: 69,
    fileName: mimeType.startsWith('video/') ? '애국가.mp4' : '애국가.mp3',
    addedAt: 1,
  };
}

beforeEach(() => {
  // jsdom에는 createObjectURL이 없다.
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:fake',
    revokeObjectURL: () => undefined,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePlayer', () => {
  it('자료가 없으면 놀고 있다', () => {
    const { result } = renderHook(() => usePlayer(null));
    expect(result.current.status).toBe('idle');
  });

  it('음원이면 종류를 음원이라 한다', () => {
    const { result } = renderHook(() => usePlayer(asset('audio/mpeg')));
    expect(result.current.kind).toBe('audio');
  });

  it('동영상이면 종류를 동영상이라 한다', () => {
    const { result } = renderHook(() => usePlayer(asset('video/mp4')));
    expect(result.current.kind).toBe('video');
  });

  it('길이는 저장해 둔 값을 쓴다', () => {
    const { result } = renderHook(() => usePlayer(asset('audio/mpeg')));
    expect(result.current.duration).toBe(69);
  });

  describe('화면 자리', () => {
    // 동영상은 new Audio()로 그릴 수 없다. 소리만 나고 화면이 안 나온다.
    it('동영상이면 video 요소를 자리에 넣는다', () => {
      const { result } = renderHook(() => usePlayer(asset('video/mp4')));
      const slot = document.createElement('div');
      act(() => result.current.mount(slot));
      expect(slot.firstElementChild?.tagName).toBe('VIDEO');
    });

    // 아이폰은 playsInline이 없으면 재생을 누르는 순간 제멋대로 전체화면으로
    // 넘어간다. 사회자가 대본을 보고 있어야 하는데 화면이 가려진다.
    it('아이폰이 멋대로 전체화면으로 넘기지 않게 한다', () => {
      const { result } = renderHook(() => usePlayer(asset('video/mp4')));
      const slot = document.createElement('div');
      act(() => result.current.mount(slot));
      expect((slot.firstElementChild as HTMLVideoElement).playsInline).toBe(true);
    });

    it('음원이면 자리에 화면을 만들지 않는다', () => {
      const { result } = renderHook(() => usePlayer(asset('audio/mpeg')));
      const slot = document.createElement('div');
      act(() => result.current.mount(slot));
      expect(slot.querySelector('video')).toBeNull();
    });
  });

  describe('크게 보기', () => {
    it('자료가 없으면 아무 일도 없다', async () => {
      const { result } = renderHook(() => usePlayer(null));
      await expect(result.current.enterFullscreen()).resolves.toBe(false);
    });

    it('전체화면을 요청한다', async () => {
      const { result } = renderHook(() => usePlayer(asset('video/mp4')));
      const slot = document.createElement('div');
      act(() => result.current.mount(slot));

      const video = slot.firstElementChild as HTMLVideoElement;
      const request = vi.fn(() => Promise.resolve());
      video.requestFullscreen = request;

      await expect(result.current.enterFullscreen()).resolves.toBe(true);
      expect(request).toHaveBeenCalled();
    });

    // 아이폰 사파리는 일반 요소의 전체화면을 막고 video에만 자기 방식을 준다.
    it('아이폰 방식만 있으면 그것을 쓴다', async () => {
      const { result } = renderHook(() => usePlayer(asset('video/mp4')));
      const slot = document.createElement('div');
      act(() => result.current.mount(slot));

      // 아이폰에는 requestFullscreen이 아예 없다. 그 상황을 흉내 내려면
      // 타입을 느슨하게 풀어야 한다.
      const video = slot.firstElementChild as unknown as Record<string, unknown>;
      const ios = vi.fn();
      video.requestFullscreen = undefined;
      video.webkitEnterFullscreen = ios;

      await expect(result.current.enterFullscreen()).resolves.toBe(true);
      expect(ios).toHaveBeenCalled();
    });

    // 권한이나 설정 때문에 거절될 수 있다. 그때 앱이 멈추면 행사가 멈춘다.
    it('거절당해도 던지지 않는다', async () => {
      const { result } = renderHook(() => usePlayer(asset('video/mp4')));
      const slot = document.createElement('div');
      act(() => result.current.mount(slot));

      const video = slot.firstElementChild as HTMLVideoElement;
      video.requestFullscreen = vi.fn(() => Promise.reject(new Error('거절')));

      await expect(result.current.enterFullscreen()).resolves.toBe(false);
    });
  });
});
