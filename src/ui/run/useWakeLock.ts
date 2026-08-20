import { useEffect } from 'react';

type WakeLockSentinelLike = { release(): Promise<void> };
type WakeLockCapableNavigator = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
};

export function useWakeLock(active: boolean): { supported: boolean } {
  const wakeLock = (navigator as WakeLockCapableNavigator).wakeLock;
  const supported = wakeLock !== undefined;

  useEffect(() => {
    if (!active || wakeLock === undefined) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let released = false;

    async function acquire() {
      try {
        sentinel = await wakeLock!.request('screen');
      } catch {
        // 사용자가 거부했거나 배터리 절약 모드다. 화면이 꺼질 수 있을 뿐 진행에는 지장이 없다.
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible' && !released) void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      void sentinel?.release();
    };
  }, [active, wakeLock]);

  return { supported };
}
