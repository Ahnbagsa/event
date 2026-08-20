import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioController } from './AudioController';
import type { AudioAsset } from '../types';

export type PlayerStatus = 'idle' | 'ready' | 'playing' | 'paused' | 'fading' | 'ended';

export function usePlayer(asset: AudioAsset | null) {
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolumeState] = useState(1);

  useEffect(() => {
    if (asset === null) {
      elementRef.current = null;
      setStatus('idle');
      return;
    }

    const url = URL.createObjectURL(new Blob([asset.data], { type: asset.mimeType }));
    const element = new Audio(url);
    element.volume = volume;
    element.ontimeupdate = () => setCurrentTime(element.currentTime);
    element.onended = () => setStatus('ended');
    elementRef.current = element;
    setCurrentTime(0);
    setStatus('ready');

    return () => {
      element.pause();
      element.ontimeupdate = null;
      element.onended = null;
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

  return {
    status,
    currentTime,
    duration: asset?.durationSec ?? 0,
    volume,
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
