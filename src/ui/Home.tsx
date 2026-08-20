import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
        <h1 className="flex-1 text-2xl font-bold">행사박사</h1>
        <Link to="/settings" className="text-blue-600">설정</Link>
      </header>

      <Link to="/new"
            className="mb-4 block rounded bg-blue-600 px-4 py-3 text-center text-white">
        ＋ 새 행사 만들기
      </Link>

      {events === null && <p>불러오는 중입니다…</p>}
      {events !== null && events.length === 0 && (
        <p className="text-gray-600">아직 만든 행사가 없습니다.</p>
      )}

      <ul className="space-y-2">
        {(events ?? []).map((event) => (
          <li key={event.id} className="rounded border border-gray-300 p-3">
            <p className="font-medium">{event.title}</p>
            <p className="text-sm text-gray-600">
              {event.date} · {event.place} · 순서 {event.segments.length}개 · 예상{' '}
              {formatDuration(estimateTotalSeconds(event.segments, durations))}
            </p>
            <div className="mt-2 flex gap-3 text-sm">
              <Link to={`/event/${event.id}/edit`} className="text-blue-600">편집</Link>
              <Link to={`/event/${event.id}/preflight`} className="text-blue-600">진행</Link>
              {confirmId === event.id ? (
                <>
                  <button className="text-red-600"
                          onClick={() => void handleDelete(event.id)}>정말 삭제</button>
                  <button onClick={() => setConfirmId(null)}>취소</button>
                </>
              ) : (
                <button className="text-red-600"
                        onClick={() => setConfirmId(event.id)}>삭제</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
