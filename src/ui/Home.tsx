import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import InstallHint from './InstallHint';
import AnbaksaMark from './kit/AnbaksaMark';
import Card from './kit/Card';
import ShareButton from './share/ShareButton';
import { deleteEvent, listEvents } from '../db/eventRepo';
import { listAudio } from '../db/audioRepo';
import { estimateTotalSeconds } from '../domain/timeEstimator';
import { formatDuration } from '../lib/format';
import type { AudioRole, EventCeremony } from '../types';

export default function Home() {
  const [events, setEvents] = useState<EventCeremony[] | null>(null);
  const [durations, setDurations] = useState<Map<AudioRole, number>>(new Map());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [loadedEvents, assets] = await Promise.all([listEvents(), listAudio()]);
    setEvents(loadedEvents);
    setDurations(new Map(assets.map((asset) => [asset.role, asset.durationSec])));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleDelete(id: string) {
    await deleteEvent(id);
    setConfirmId(null);
    await reload();
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <header className="mb-4 flex items-center gap-3">
        <AnbaksaMark size={44} className="shrink-0 text-ink" />
        <h1 className="flex-1 text-2xl font-bold">행사박사</h1>
        <Link to="/settings" className="text-accent">설정</Link>
      </header>

      <InstallHint />

      <Link to="/new"
            className="mb-4 flex h-12 items-center justify-center rounded-full bg-accent px-4 text-center font-medium text-white hover:bg-accent-strong">
        ＋ 새 행사 만들기
      </Link>

      {events === null && <p>불러오는 중입니다…</p>}
      {events !== null && events.length === 0 && (
        <p className="text-ink-soft">아직 만든 행사가 없습니다.</p>
      )}

      <ul className="space-y-2">
        {(events ?? []).map((event) => (
          <Card as="li" key={event.id}>
            <p className="font-medium">{event.title}</p>
            <p className="text-sm text-ink-soft">
              {event.date} · {event.place} · 순서 {event.segments.length}개 · 예상{' '}
              {formatDuration(estimateTotalSeconds(event.segments, durations))}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <Link to={`/event/${event.id}/edit`} className="text-accent">편집</Link>
              <Link to={`/event/${event.id}/preflight`} className="text-accent">진행</Link>
              <ShareButton event={event} />
              {confirmId === event.id ? (
                <>
                  <button className="text-danger"
                          onClick={() => void handleDelete(event.id)}>정말 삭제</button>
                  <button onClick={() => setConfirmId(null)}>취소</button>
                </>
              ) : (
                <button className="text-danger"
                        onClick={() => setConfirmId(event.id)}>삭제</button>
              )}
            </div>
          </Card>
        ))}
      </ul>

      <footer className="mt-10 flex flex-col items-center gap-1 pb-6 text-ink-soft">
        <AnbaksaMark variant="full" size={48} title="안박사" />
        <p className="text-sm">만든 이 · 안박사</p>
      </footer>
    </main>
  );
}
