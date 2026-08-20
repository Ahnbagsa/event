import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SegmentCard from './SegmentCard';
import { getEvent, putEvent } from '../../db/eventRepo';
import { listAudio } from '../../db/audioRepo';
import { insertSegment, moveSegment, removeSegment, updateSegment } from '../../domain/segmentOps';
import { STANDARD_EXTRA_SEEDS, blankSeed } from '../../domain/templates';
import { estimateTotalSeconds } from '../../domain/timeEstimator';
import { countBlanks } from '../../domain/blanks';
import { formatDuration } from '../../lib/format';
import type { AudioRole, EventCeremony, Segment } from '../../types';

export default function EditorPage() {
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState<EventCeremony | null>(null);
  const [durations, setDurations] = useState<Map<AudioRole, number>>(new Map());
  const [saved, setSaved] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  useEffect(() => {
    void getEvent(eventId).then(setEvent);
    void listAudio().then((assets) => {
      setDurations(new Map(assets.map((asset) => [asset.role, asset.durationSec])));
    });
  }, [eventId]);

  const setSegments = useCallback((segments: Segment[]) => {
    setSaved(false);
    setEvent((current) => (current === null ? null : { ...current, segments }));
  }, []);

  const totalSeconds = useMemo(
    () => (event === null ? 0 : estimateTotalSeconds(event.segments, durations)),
    [event, durations],
  );

  if (event === null) {
    return <main className="p-8">행사를 불러오는 중입니다…</main>;
  }

  const blankCount = countBlanks(event);

  async function handleSave() {
    if (event === null) return;
    await putEvent({ ...event, updatedAt: Date.now() });
    setSaved(true);
  }

  return (
    <main className="mx-auto max-w-2xl pb-16">
      <header className="sticky top-0 z-10 space-y-1 border-b border-gray-300 bg-white p-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-blue-600">← 홈</Link>
          <h1 className="flex-1 truncate text-lg font-bold">{event.title}</h1>
          <button className="rounded bg-blue-600 px-3 py-1 text-white"
                  onClick={() => void handleSave()}>
            저장
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span data-testid="total-time">예상 {formatDuration(totalSeconds)}</span>
          {blankCount > 0 && (
            <span data-testid="blank-warning" className="rounded bg-yellow-200 px-2">
              채워야 할 빈칸 {blankCount}곳
            </span>
          )}
          {saved && <span className="text-green-700">저장했습니다</span>}
          <Link to={`/event/${event.id}/preflight`} className="ml-auto text-blue-600">
            점검하러 가기 →
          </Link>
        </div>
      </header>

      <ul className="space-y-2 p-3">
        {event.segments.map((segment) => (
          <SegmentCard
            key={segment.id}
            segment={segment}
            audioDurationSec={
              segment.audioRole === null ? null : durations.get(segment.audioRole) ?? null
            }
            audioMissing={segment.audioRole !== null && !durations.has(segment.audioRole)}
            onChange={(patch) => setSegments(updateSegment(event.segments, segment.id, patch))}
            onMove={(delta) => setSegments(moveSegment(event.segments, segment.id, delta))}
            onRemove={() => setSegments(removeSegment(event.segments, segment.id))}
          />
        ))}
      </ul>

      <div className="px-3">
        <button className="rounded border border-gray-400 px-3 py-2"
                onClick={() => setShowPalette(!showPalette)}>
          ＋ 순서 추가
        </button>

        {showPalette && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {STANDARD_EXTRA_SEEDS.map((seed) => (
              <li key={seed.name}>
                <button
                  className="rounded border border-blue-400 px-3 py-1 text-blue-700"
                  onClick={() => {
                    setSegments(insertSegment(event.segments, seed, event.segments.length));
                    setShowPalette(false);
                  }}
                >
                  {seed.name}
                </button>
              </li>
            ))}
            <li>
              <button
                className="rounded border border-gray-400 px-3 py-1"
                onClick={() => {
                  setSegments(insertSegment(event.segments, blankSeed(), event.segments.length));
                  setShowPalette(false);
                }}
              >
                직접 입력
              </button>
            </li>
          </ul>
        )}
      </div>
    </main>
  );
}
