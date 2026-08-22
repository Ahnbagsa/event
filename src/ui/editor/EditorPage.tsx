import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SegmentCard from './SegmentCard';
import ShareButton from '../share/ShareButton';
import { getEvent, putEvent } from '../../db/eventRepo';
import { listAudio } from '../../db/audioRepo';
import { insertSegment, moveSegment, removeSegment, updateSegment } from '../../domain/segmentOps';
import { STANDARD_EXTRA_SEEDS, blankSeed } from '../../domain/templates';
import { estimateTotalSeconds } from '../../domain/timeEstimator';
import { countBlanks } from '../../domain/blanks';
import { formatDuration } from '../../lib/format';
import { generateScripts, regenerateOne } from '../../gemini/generateScripts';
import { defaultDeps, GeminiError } from '../../gemini/client';
import { getProfile } from '../../db/profileRepo';
import { getSettings } from '../../db/settingsRepo';
import type { AudioRole, EventCeremony, Segment } from '../../types';

export default function EditorPage() {
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState<EventCeremony | null>(null);
  const [durations, setDurations] = useState<Map<AudioRole, number>>(new Map());
  const [saved, setSaved] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  // 아직 확인 전에는 null이다. 잠깐 스쳐 지나가는 안내를 보이지 않으려는 것이다.
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    void getEvent(eventId).then(setEvent);
    void listAudio().then((assets) => {
      setDurations(new Map(assets.map((asset) => [asset.role, asset.durationSec])));
    });
    void getSettings().then((settings) => setHasApiKey(settings.geminiApiKey.trim() !== ''));
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

  function describeAiError(caught: unknown): string {
    if (caught instanceof GeminiError) return caught.info.message;
    if (caught instanceof Error) return caught.message;
    return '멘트를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  async function handleGenerateAll() {
    if (event === null) return;
    setAiBusy(true);
    setAiError('');
    try {
      const profile = await getProfile();
      setSegments(await generateScripts(event, profile, defaultDeps()));
    } catch (caught) {
      setAiError(describeAiError(caught));
    } finally {
      setAiBusy(false);
    }
  }

  async function handleRegenerate(segmentId: string) {
    if (event === null) return;
    setAiBusy(true);
    setAiError('');
    try {
      const profile = await getProfile();
      setSegments(await regenerateOne(event, segmentId, profile, defaultDeps()));
    } catch (caught) {
      setAiError(describeAiError(caught));
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl pb-16">
      {/* 좁은 폰에서는 제목 아래로 버튼이 흐른다. 한 줄로 묶어 두면 긴 행사 제목이
          몇 글자만 남고 잘린다. 버튼들은 한 덩어리로 묶어 따로 흩어지지 않게 한다. */}
      <header className="sticky top-0 z-10 space-y-2 border-b border-line bg-paper-raised p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link to="/" className="shrink-0 text-accent">← 홈</Link>
          <h1 className="min-w-0 flex-1 text-lg font-bold">{event.title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <button className="min-h-11 rounded-xl bg-accent px-4 text-white"
                    onClick={() => void handleSave()}>
              저장
            </button>
            <ShareButton event={event} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span data-testid="total-time">예상 {formatDuration(totalSeconds)}</span>
          {blankCount > 0 && (
            <span data-testid="blank-warning" className="rounded-xl bg-warn-soft px-2">
              채워야 할 빈칸 {blankCount}곳
            </span>
          )}
          {saved && <span className="text-ok">저장했습니다</span>}
          <Link to={`/event/${event.id}/preflight`} className="ml-auto shrink-0 text-accent">
            점검하러 가기 →
          </Link>
        </div>
      </header>

      <div className="border-b border-line p-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="min-h-11 rounded-xl bg-accent px-4 text-white disabled:bg-line disabled:text-ink-soft"
            disabled={aiBusy || hasApiKey === false}
            onClick={() => void handleGenerateAll()}
          >
            {aiBusy ? '멘트를 쓰는 중입니다…' : 'AI로 멘트 채우기'}
          </button>
          {aiError !== '' && <span className="text-sm text-danger">{aiError}</span>}
        </div>

        {/* 키가 없으면 버튼만 회색이 되어 왜 안 되는지 알 수 없다. 무엇을 하면
            되는지, 그리고 안 해도 되는지를 함께 알려 준다. */}
        {hasApiKey === false && (
          <p data-testid="no-api-key" className="mt-2 text-sm text-ink-soft">
            <Link to="/settings" className="text-accent">설정에서 무료 API 키</Link>를 넣으면
            멘트를 자동으로 써 드립니다. 넣지 않아도 아래에서 직접 쓰고 행사를 진행할 수 있습니다.
          </p>
        )}
      </div>

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
            aiBusy={aiBusy}
            onRegenerate={() => void handleRegenerate(segment.id)}
          />
        ))}
      </ul>

      <div className="px-3">
        <button className="rounded-xl border border-line px-3 py-2"
                onClick={() => setShowPalette(!showPalette)}>
          ＋ 순서 추가
        </button>

        {showPalette && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {STANDARD_EXTRA_SEEDS.map((seed) => (
              <li key={seed.name}>
                <button
                  className="rounded-xl border border-accent px-3 py-1 text-accent"
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
                className="rounded-xl border border-line px-3 py-1"
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
