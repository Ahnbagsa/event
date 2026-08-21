import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getEvent } from '../../db/eventRepo';
import { listAudio } from '../../db/audioRepo';
import { checkReadiness, type PreflightResult } from '../../domain/preflight';
import { estimateTotalSeconds } from '../../domain/timeEstimator';
import { usePlayer } from '../../audio/usePlayer';
import { roleLabel } from '../../audio/roles';
import { formatDuration } from '../../lib/format';
import type { AudioAsset, AudioRole, EventCeremony } from '../../types';

function CheckRow({
  testId,
  ok,
  title,
  children,
}: {
  testId: string;
  ok: boolean;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li data-testid={testId} className="rounded-xl border border-line p-3">
      <p className="font-medium">
        {ok ? '✅' : '⚠️'} {title}
      </p>
      {children !== undefined && <div className="mt-1 text-sm">{children}</div>}
    </li>
  );
}

export default function PreflightPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventCeremony | null>(null);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [soundConfirmed, setSoundConfirmed] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [dndConfirmed, setDndConfirmed] = useState(false);
  const [wakeLockNote, setWakeLockNote] = useState('');

  const testAsset = assets[0] ?? null;
  const player = usePlayer(testAsset);

  useEffect(() => {
    void (async () => {
      const [loadedEvent, loadedAssets] = await Promise.all([getEvent(eventId), listAudio()]);
      setEvent(loadedEvent);
      setAssets(loadedAssets);
      if (loadedEvent !== null) {
        const roles = new Set<AudioRole>(loadedAssets.map((asset) => asset.role));
        setResult(checkReadiness(loadedEvent, roles));
      }
    })();
  }, [eventId]);

  useEffect(() => {
    if (!('wakeLock' in navigator)) {
      setWakeLockNote('이 브라우저는 화면 꺼짐 방지를 지원하지 않습니다. 화면 자동 잠금을 직접 꺼 주세요.');
    }
  }, []);

  if (event === null || result === null) {
    return <main className="p-8">행사를 불러오는 중입니다…</main>;
  }

  const durations = new Map<AudioRole, number>(
    assets.map((asset) => [asset.role, asset.durationSec]),
  );
  const totalSeconds = estimateTotalSeconds(event.segments, durations);
  const canStart = result.ok && soundConfirmed;

  async function handleSoundTest() {
    setTestStarted(true);
    await player.play();
    window.setTimeout(() => player.pause(), 3000);
  }

  return (
    <main className="mx-auto max-w-xl p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link to={`/event/${event.id}/edit`} className="text-accent">← 편집</Link>
        <h1 className="text-lg font-bold">행사 전 점검</h1>
      </header>

      <p className="mb-3 text-sm text-ink-soft">
        행사 5분 전에 이 화면을 통과시켜 주세요. 여기만 통과하면 진행 중 사고가 나지 않습니다.
      </p>

      <ul className="space-y-2">
        <CheckRow
          testId="check-blanks"
          ok={result.blanks.length === 0}
          title={result.blanks.length === 0 ? '채워야 할 빈칸이 없습니다' : '아직 빈칸이 남아 있습니다'}
        >
          {result.blanks.length > 0 && (
            <ul className="list-disc pl-5">
              {result.blanks.map((hit) => (
                <li key={hit.segmentId}>
                  {hit.segmentName} — {hit.labels.join(', ')}
                </li>
              ))}
            </ul>
          )}
        </CheckRow>

        <CheckRow
          testId="check-malformed"
          ok={result.malformed.length === 0}
          title={
            result.malformed.length === 0
              ? '망가진 빈칸 표시가 없습니다'
              : '중괄호가 깨진 곳이 있습니다'
          }
        >
          {result.malformed.length > 0 && (
            <>
              <p className="text-ink-soft">
                {'{{교장 성함}}'}처럼 짝이 맞아야 합니다. 한쪽이 빠지면 대본에 그대로 찍힙니다.
              </p>
              <ul className="list-disc pl-5">
                {result.malformed.map((hit) => (
                  <li key={hit.segmentId}>{hit.segmentName}</li>
                ))}
              </ul>
            </>
          )}
        </CheckRow>

        <CheckRow
          testId="check-audio"
          ok={result.missingAudioRoles.length === 0}
          title={
            result.missingAudioRoles.length === 0
              ? '필요한 음원이 이 기기에 모두 있습니다'
              : '이 기기에 없는 음원이 있습니다'
          }
        >
          {result.missingAudioRoles.length > 0 && (
            <p>
              {result.missingAudioRoles.map(roleLabel).join(', ')} —{' '}
              <Link to="/settings" className="text-accent">지금 등록하기</Link>
            </p>
          )}
        </CheckRow>

        <CheckRow testId="check-sound" ok={soundConfirmed} title="소리가 실제로 나는지 확인">
          {!soundConfirmed && (
            <div className="space-y-2">
              <p className="text-ink-soft">
                아이폰은 옆면 무음 스위치가 켜져 있으면 소리가 나지 않습니다. 꼭 귀로 확인해 주세요.
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded-xl border border-line px-3 py-1"
                  disabled={testAsset === null}
                  onClick={() => void handleSoundTest()}
                >
                  소리 테스트
                </button>
                {testStarted && (
                  <button
                    className="rounded-xl bg-green-600 px-3 py-1 text-white"
                    onClick={() => setSoundConfirmed(true)}
                  >
                    들렸어요
                  </button>
                )}
              </div>
            </div>
          )}
        </CheckRow>

        <CheckRow testId="check-dnd" ok={dndConfirmed} title="방해금지 모드">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dndConfirmed}
              onChange={(e) => setDndConfirmed(e.target.checked)}
            />
            전화가 오면 소리가 끊깁니다. 방해금지 모드를 켰습니다.
          </label>
          {wakeLockNote !== '' && <p className="mt-1 text-amber-700">{wakeLockNote}</p>}
        </CheckRow>
      </ul>

      <p data-testid="total-time" className="mt-4 text-sm">
        전체 예상 소요 시간 <strong>{formatDuration(totalSeconds)}</strong>
      </p>

      <button
        className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-lg text-white disabled:bg-line"
        disabled={!canStart}
        onClick={() => navigate(`/event/${event.id}/run`)}
      >
        진행 시작
      </button>
    </main>
  );
}
