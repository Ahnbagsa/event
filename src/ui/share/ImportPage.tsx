import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { decodeScenario } from '../../share/scenarioLink';
import { putEvent } from '../../db/eventRepo';
import { getAvailableRoles } from '../../db/audioRepo';
import { requiredAudioRoles } from '../../domain/preflight';
import { roleLabel } from '../../audio/roles';
import { newId } from '../../lib/id';
import Notice from '../kit/Notice';
import type { AudioRole, EventCeremony } from '../../types';

export default function ImportPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventCeremony | null>(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState<AudioRole[]>([]);

  useEffect(() => {
    const payload = params.get('d') ?? '';
    try {
      const decoded = decodeScenario(payload);
      setEvent(decoded);
      void getAvailableRoles().then((available) => {
        setMissing(requiredAudioRoles(decoded).filter((role) => !available.has(role)));
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '시나리오를 읽을 수 없습니다.');
    }
  }, [params]);

  async function handleImport() {
    if (event === null) return;
    const now = Date.now();
    const imported: EventCeremony = { ...event, id: newId('event'), createdAt: now, updatedAt: now };
    await putEvent(imported);
    navigate(`/event/${imported.id}/edit`);
  }

  if (error !== '') {
    return (
      <main className="mx-auto max-w-xl p-6">
        <p className="text-danger">{error}</p>
        <p className="mt-2 text-sm text-ink-soft">
          카카오톡 등에서 링크가 잘렸을 수 있습니다. 링크 전체를 다시 복사해 주소창에 붙여넣어 주세요.
        </p>
        <Link to="/" className="mt-4 inline-block text-accent">← 홈으로</Link>
      </main>
    );
  }

  if (event === null) return <main className="p-8">시나리오를 여는 중입니다…</main>;

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-xl font-bold">{event.title}</h1>
      <p className="text-sm text-ink-soft">
        {event.date} · {event.place} · 순서 {event.segments.length}개
      </p>

      {missing.length > 0 && (
        <Notice tone="warn" data-testid="missing-audio">
          <p className="font-medium">이 기기에 없는 음원이 있습니다</p>
          <p>{missing.map(roleLabel).join(', ')}</p>
          <p className="mt-1">
            <Link to="/settings" className="text-accent">설정 → 음원 서랍</Link>에서
            먼저 등록해 두면 이 기기만으로 행사를 진행할 수 있습니다.
          </p>
        </Notice>
      )}

      <ol className="list-decimal space-y-1 pl-6 text-sm">
        {event.segments.map((segment) => (
          <li key={segment.id}>{segment.name}</li>
        ))}
      </ol>

      <button className="w-full rounded-full bg-accent font-semibold px-4 py-3 text-white"
              onClick={() => void handleImport()}>
        이 기기에 가져오기
      </button>
    </main>
  );
}
