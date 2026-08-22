import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createRunModel, runReducer } from '../../domain/runMachine';
import { getEvent } from '../../db/eventRepo';
import { listAudio } from '../../db/audioRepo';
import { clearRunState, getRunState, saveRunState } from '../../db/runStateRepo';
import { usePlayer } from '../../audio/usePlayer';
import { useWakeLock } from './useWakeLock';
import { roleLabel } from '../../audio/roles';
import { assetForSegment } from '../../audio/audioSource';
import { formatDuration } from '../../lib/format';
import type { AudioAsset, EventCeremony } from '../../types';

export default function RunPage() {
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState<EventCeremony | null>(null);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [run, dispatch] = useReducer(runReducer, createRunModel(0));
  const [locked, setLocked] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  // 중단된 위치가 남아 있으면 바로 뛰어들지 않고 먼저 물어본다.
  const [resumeIndex, setResumeIndex] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);

  useWakeLock(run.phase === 'running');

  useEffect(() => {
    void (async () => {
      // 중단 위치는 아래 저장 effect가 0으로 덮어쓰기 전에 읽어둬야 한다.
      const [loadedEvent, loadedAssets, savedRun] = await Promise.all([
        getEvent(eventId),
        listAudio(),
        getRunState(),
      ]);
      setEvent(loadedEvent);
      setAssets(loadedAssets);
      if (loadedEvent !== null) {
        dispatch({ type: 'load', total: loadedEvent.segments.length });
        if (
          savedRun !== null &&
          savedRun.eventId === loadedEvent.id &&
          savedRun.currentIndex > 0
        ) {
          setResumeIndex(savedRun.currentIndex);
          setStartedAt(savedRun.startedAt);
        }
      }
    })();
  }, [eventId]);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const segment = event?.segments[run.index] ?? null;
  const nextSegment = event?.segments[run.index + 1] ?? null;

  // 순서가 콕 집은 음원을 쓰되, 이 기기에 없으면 역할의 기본 음원으로 되돌아간다.
  // 공유 링크로 옮겨 온 행사는 그 음원이 이쪽 기기에 없을 수 있다.
  const asset = useMemo(
    () => (segment === null ? null : assetForSegment(assets, segment)),
    [segment, assets],
  );

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
    // 재개를 물어보는 동안 저장하면 중단 위치가 0으로 지워진다.
    if (event === null || run.phase !== 'running' || resumeIndex !== null) return;
    void saveRunState({
      id: 'singleton',
      eventId: event.id,
      currentIndex: run.index,
      startedAt,
      updatedAt: Date.now(),
    });
  }, [event, run.phase, run.index, startedAt, resumeIndex]);

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
    return <main className="p-8 text-paper">행사를 불러오는 중입니다…</main>;
  }

  if (resumeIndex !== null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stage p-6 text-center text-paper">
        <h1 className="text-2xl font-bold">진행하던 행사가 남아 있습니다</h1>
        <p className="text-paper/70">
          {resumeIndex + 1}번째 순서 「{event.segments[resumeIndex]?.name}」에서 멈췄습니다.
        </p>
        <div className="flex gap-3">
          <button
            className="rounded-xl bg-accent px-4 py-3 text-lg"
            onClick={() => {
              dispatch({ type: 'jump', index: resumeIndex });
              setResumeIndex(null);
            }}
          >
            이어서 진행
          </button>
          <button
            className="rounded-xl border border-white/20 px-4 py-3 text-lg"
            onClick={() => {
              setStartedAt(Date.now());
              setResumeIndex(null);
            }}
          >
            처음부터 시작
          </button>
        </div>
      </main>
    );
  }

  if (run.phase === 'finished') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stage text-paper">
        <h1 className="text-3xl font-bold">행사가 끝났습니다</h1>
        <p>총 소요 시간 {formatDuration(elapsed)}</p>
        <Link to="/" className="rounded-xl bg-accent px-4 py-2">홈으로</Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-stage text-paper">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/20 p-3 text-sm">
        <span className="font-medium">{event.title}</span>
        <span data-testid="position">
          {run.index + 1} / {event.segments.length}
        </span>
        <span>경과 {formatDuration(elapsed)}</span>
        <button className="rounded-xl border border-white/20 px-2"
                onClick={() => setLocked(!locked)}>
          {locked ? '잠금 해제' : '화면 잠금'}
        </button>
        <button className="rounded-xl border border-white/20 px-2"
                onClick={() => setFontScale(Math.min(fontScale + 0.2, 2.5))}>A+</button>
        <button className="rounded-xl border border-white/20 px-2"
                onClick={() => setFontScale(Math.max(fontScale - 0.2, 0.8))}>A−</button>
        <button className="ml-auto rounded-xl border border-white/20 px-2"
                onClick={() => setShowList(!showList)}>목록</button>
      </header>

      {showList && (
        <ul className="border-b border-white/20 p-2 text-sm">
          {event.segments.map((entry, index) => (
            <li key={entry.id}>
              <button
                className={`w-full px-2 py-1 text-left ${index === run.index ? 'bg-white/10' : ''}`}
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
        <p className="mb-2 text-paper/70">{segment?.name}</p>
        <p data-testid="script"
           className="whitespace-pre-wrap font-bold leading-relaxed"
           style={{ fontSize: `${fontScale * 2}rem` }}>
          {segment?.script === '' ? '(멘트가 비어 있습니다)' : segment?.script}
        </p>
        {segment?.note !== '' && (
          <p className="mt-4 text-paper/70">📋 {segment?.note}</p>
        )}
        {remaining !== null && (
          <p className={`mt-6 text-5xl font-bold ${remaining === 0 ? 'text-warn-soft' : ''}`}>
            {remaining === 0 ? '묵념을 끝내 주세요' : formatDuration(remaining)}
          </p>
        )}
      </section>

      {segment?.audioRole !== null && segment !== null && (
        <div className="border-t border-white/20 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              {player.kind === 'video' ? '🎬' : '🎵'} {roleLabel(segment.audioRole!)}
            </span>
            {asset === null ? (
              <span className="text-danger-soft">이 기기에 음원이 없습니다</span>
            ) : (
              <>
                <button className="min-h-11 rounded-xl bg-accent px-3"
                        onClick={() => void player.play()}>재생</button>
                <button className="min-h-11 rounded-xl border border-white/20 px-3"
                        onClick={() => player.pause()}>일시정지</button>
                <button className="min-h-11 rounded-xl border border-white/20 px-3"
                        onClick={() => void player.restart()}>처음부터</button>
                <button className="min-h-11 rounded-xl border border-white/20 px-3"
                        onClick={() => void player.fadeOut(3)}>페이드아웃</button>
                {player.kind === 'video' && (
                  <button className="min-h-11 rounded-xl border border-white/20 px-3"
                          onClick={() => void player.enterFullscreen()}>크게 보기</button>
                )}
                <span className="text-sm text-paper/70">
                  {formatDuration(player.currentTime)} / {formatDuration(player.duration)}
                </span>
              </>
            )}
          </div>

          {/* 평소에는 대본이 주인공이라 영상을 작게 둔다. 빔프로젝터로 내보낼
              때만 '크게 보기'로 영상만 화면을 채운다. 사회자가 폰으로 대본을
              보며 진행하는 경우와 빔에 쓰는 경우를 한 벌로 덮는다. */}
          {player.kind === 'video' && asset !== null && (
            <div
              data-testid="video-stage"
              ref={player.mount}
              className="mt-2 aspect-video w-40 overflow-hidden rounded-xl bg-stage"
            />
          )}
        </div>
      )}

      <p data-testid="next-preview" className="border-t border-white/20 px-3 py-2 text-paper/70">
        {nextSegment === null ? '마지막 순서입니다' : `다음 ▸ ${nextSegment.name}`}
      </p>

      {/* pb-safe는 아이폰 아래쪽 홈 인디케이터 바를 피한다. 이게 없으면
          행사 도중 '다음' 버튼 아래쪽이 바에 가려 잘 눌리지 않는다. */}
      <div className="flex gap-3 p-3 pb-safe">
        <button
          className="flex-1 rounded-xl bg-white/10 py-4 text-lg disabled:opacity-40"
          disabled={run.index === 0}
          onClick={() => go('prev')}
        >
          이전
        </button>
        <button className="flex-[2] rounded-xl bg-accent py-4 text-lg"
                onClick={() => go('next')}>
          다음
        </button>
      </div>
    </main>
  );
}
