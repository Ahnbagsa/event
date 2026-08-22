import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioController } from './AudioController';
import { mediaKindOf, type MediaKind } from '../media/mediaKind';
import type { AudioAsset } from '../types';

export type PlayerStatus = 'idle' | 'ready' | 'playing' | 'paused' | 'fading' | 'ended';

export function usePlayer(asset: AudioAsset | null) {
  const elementRef = useRef<HTMLMediaElement | null>(null);
  const mountRef = useRef<HTMLElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolumeState] = useState(1);

  const kind: MediaKind = asset === null ? 'audio' : mediaKindOf(asset.mimeType);

  useEffect(() => {
    if (asset === null) {
      elementRef.current = null;
      setStatus('idle');
      return;
    }

    const url = URL.createObjectURL(new Blob([asset.data], { type: asset.mimeType }));

    // 동영상은 new Audio()로 그릴 수 없다. 소리만 나고 화면이 안 나온다.
    const element: HTMLMediaElement =
      mediaKindOf(asset.mimeType) === 'video'
        ? document.createElement('video')
        : new Audio();
    element.src = url;
    element.volume = volume;
    element.ontimeupdate = () => setCurrentTime(element.currentTime);
    element.onended = () => setStatus('ended');

    if (element instanceof HTMLVideoElement) {
      element.playsInline = true;
      element.className = 'h-full w-full bg-stage object-contain';
    }

    elementRef.current = element;
    // 화면이 이미 자리를 잡아 두었다면 새 요소를 그 자리에 넣는다.
    // (다음 순서로 넘어가 자료가 바뀌었을 때가 이 경우다)
    if (mountRef.current !== null) {
      mountRef.current.replaceChildren(element);
    }
    setCurrentTime(0);
    setStatus('ready');

    return () => {
      element.pause();
      element.ontimeupdate = null;
      element.onended = null;
      element.remove();
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

  /**
   * 동영상 화면이 들어갈 자리를 알려 준다. <div ref={player.mount} /> 처럼 쓴다.
   * 요소를 React가 아니라 여기서 만들기 때문에(음원과 동영상을 같은 길로 다룬다)
   * 자리만 받아서 직접 넣는다.
   */
  const mount = useCallback((node: HTMLElement | null) => {
    mountRef.current = node;
    if (node !== null && elementRef.current !== null) {
      node.replaceChildren(elementRef.current);
    }
  }, []);

  return {
    status,
    kind,
    currentTime,
    duration: asset?.durationSec ?? 0,
    volume,
    mount,
    /**
     * 동영상만 화면을 가득 채운다. 사회자는 폰으로 대본을 보고, 빔프로젝터에
     * 연결된 기기에서는 이걸 눌러 영상만 내보낸다.
     *
     * iOS Safari는 일반 요소의 전체화면을 막지만 video 요소에는 허용한다.
     * 그래도 거절될 수 있으니(권한·설정) 실패하면 조용히 원래대로 둔다.
     */
    async enterFullscreen(): Promise<boolean> {
      const element = elementRef.current;
      if (element === null) return false;
      const withIos = element as HTMLMediaElement & { webkitEnterFullscreen?: () => void };
      try {
        if (typeof element.requestFullscreen === 'function') {
          await element.requestFullscreen();
          return true;
        }
        if (typeof withIos.webkitEnterFullscreen === 'function') {
          withIos.webkitEnterFullscreen();
          return true;
        }
      } catch {
        return false;
      }
      return false;
    },
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
