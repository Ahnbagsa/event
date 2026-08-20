import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createRunModel, runReducer } from '../../domain/runMachine';
import { getEvent } from '../../db/eventRepo';
import { listAudio } from '../../db/audioRepo';
import { clearRunState, saveRunState } from '../../db/runStateRepo';
import { usePlayer } from '../../audio/usePlayer';
import { useWakeLock } from './useWakeLock';
import { roleLabel } from '../../audio/roles';
import { formatDuration } from '../../lib/format';
import type { AudioAsset, EventCeremony } from '../../types';

export default function RunPage() {
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState<EventCeremony | null>(null);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [run, dispatch] = useReducer(runReducer, createRunModel(0));
  const [locked, setLocked] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);

  useWakeLock(run.phase === 'running');

  useEffect(() => {
    void (async () => {
      const [loadedEvent, loadedAssets] = await Promise.all([getEvent(eventId), listAudio()]);
      setEvent(loadedEvent);
      setAssets(loadedAssets);
      if (loadedEvent !== null) {
        dispatch({ type: 'load', total: loadedEvent.segments.length });
      }
    })();
  }, [eventId]);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const segment = event?.segments[run.index] ?? null;
  const nextSegment = event?.segments[run.index + 1] ?? null;

  const asset = useMemo(() => {
    if (segment === null || segment.audioRole === null) return null;
    return assets.find((entry) => entry.role === segment.audioRole) ?? null;
  }, [segment, assets]);

  const player = usePlayer(asset);

  // 순서가 바뀌면 타이머를 다시 세팅한다.
  useEffect(() => {
    setRemaining(segment !== null && segment.kind === 'timer' ? segment.timerSec ?? 60 : null);
  }, [segment]);

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  useEffect(() => {
    if (event === null || run.phase !== 'running') return;
    void saveRunState({
      id: 'singleton',
      eventId: event.id,
      currentIndex: run.index,
      startedAt,
      updatedAt: Date.now(),
    });
  }, [event, run.phase, run.index, startedAt]);

  useEffect(() => {
    if (run.phase === 'finished') void clearRunState();
  }, [run.phase]);

  const go = useCallback(
    (action: 'next' | 'prev') => {
      if (locked) return;
      player.pause();
      dispatch({ type: action });
    },
    [locked, player],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go('next');
      if (e.key === 'ArrowLeft') go('prev');
      if (e.key === ' ') {
        e.preventDefault();
        void (player.status === 'playing' ? player.pause() : player.play());
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, player]);

  if (event === null) {
    return <main className="p-8 text-white">행사를 불러오는 중입니다…</main>;
  }

  if (run.phase === 'finished') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <h1 className="text-3xl font-bold">행사가 끝났습니다</h1>
        <p>총 소요 시간 {formatDuration(elapsed)}</p>
        <Link to="/" className="rounded bg-blue-600 px-4 py-2">홈으로</Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-900 text-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-700 p-3 text-sm">
        <span className="font-medium">{event.title}</span>
        <span data-testid="position">
          {run.index + 1} / {event.segments.length}
        </span>
        <span>경과 {formatDuration(elapsed)}</span>
        <button className="rounded border border-slate-600 px-2"
                onClick={() => setLocked(!locked)}>
          {locked ? '잠금 해제' : '화면 잠금'}
        </button>
        <button className="rounded border border-slate-600 px-2"
                onClick={() => setFontScale(Math.min(fontScale + 0.2, 2.5))}>A+</button>
        <button className="rounded border border-slate-600 px-2"
                onClick={() => setFontScale(Math.max(fontScale - 0.2, 0.8))}>A−</button>
        <button className="ml-auto rounded border border-slate-600 px-2"
                onClick={() => setShowList(!showList)}>목록</button>
      </header>

      {showList && (
        <ul className="border-b border-slate-700 p-2 text-sm">
          {event.segments.map((entry, index) => (
            <li key={entry.id}>
              <button
                className={`w-full px-2 py-1 text-left ${index === run.index ? 'bg-slate-700' : ''}`}
                onClick={() => {
                  dispatch({ type: 'jump', index });
                  setShowList(false);
                }}
              >
                {index + 1}. {entry.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-1 flex-col justify-center p-6">
        <p className="mb-2 text-slate-400">{segment?.name}</p>
        <p data-testid="script"
           className="whitespace-pre-wrap font-bold leading-relaxed"
           style={{ fontSize: `${fontScale * 2}rem` }}>
          {segment?.script === '' ? '(멘트가 비어 있습니다)' : segment?.script}
        </p>
        {segment?.note !== '' && (
          <p className="mt-4 text-slate-400">📋 {segment?.note}</p>
        )}
        {remaining !== null && (
          <p className={`mt-6 text-5xl font-bold ${remaining === 0 ? 'text-amber-300' : ''}`}>
            {remaining === 0 ? '묵념을 끝내 주세요' : formatDuration(remaining)}
          </p>
        )}
      </section>

      {segment?.audioRole !== null && segment !== null && (
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-700 p-3">
          <span>🎵 {roleLabel(segment.audioRole!)}</span>
          {asset === null ? (
            <span className="text-red-400">이 기기에 음원이 없습니다</span>
          ) : (
            <>
              <button className="rounded bg-blue-600 px-3 py-1"
                      onClick={() => void player.play()}>재생</button>
              <button className="rounded border border-slate-600 px-3 py-1"
                      onClick={() => player.pause()}>일시정지</button>
              <button className="rounded border border-slate-600 px-3 py-1"
                      onClick={() => void player.restart()}>처음부터</button>
              <button className="rounded border border-slate-600 px-3 py-1"
                      onClick={() => void player.fadeOut(3)}>페이드아웃</button>
              <span className="text-sm text-slate-400">
                {formatDuration(player.currentTime)} / {formatDuration(player.duration)}
              </span>
            </>
          )}
        </div>
      )}

      <p data-testid="next-preview" className="border-t border-slate-700 px-3 py-2 text-slate-400">
        {nextSegment === null ? '마지막 순서입니다' : `다음 ▸ ${nextSegment.name}`}
      </p>

      <div className="flex gap-3 p-3">
        <button
          className="flex-1 rounded bg-slate-700 py-4 text-lg disabled:opacity-40"
          disabled={run.index === 0}
          onClick={() => go('prev')}
        >
          이전
        </button>
        <button className="flex-[2] rounded bg-blue-600 py-4 text-lg"
                onClick={() => go('next')}>
          다음
        </button>
      </div>
    </main>
  );
}
