import { useCallback, useEffect, useState } from 'react';
import { STANDARD_ROLES } from '../../audio/roles';
import { readAudioDuration } from '../../audio/readAudioDuration';
import { deleteAudio, listAudio, putAudio } from '../../db/audioRepo';
import { newId } from '../../lib/id';
import { formatDuration } from '../../lib/format';
import type { AudioAsset, AudioRole } from '../../types';

export default function AudioDrawer() {
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [error, setError] = useState('');
  const [busyRole, setBusyRole] = useState<AudioRole | null>(null);

  const reload = useCallback(async () => {
    setAssets(await listAudio());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleFile(role: AudioRole, file: File) {
    setError('');
    setBusyRole(role);
    try {
      const data = await file.arrayBuffer();
      const durationSec = await readAudioDuration(data, file.type);
      await putAudio({
        id: newId('audio'),
        role,
        label: file.name,
        data,
        mimeType: file.type,
        durationSec,
        fileName: file.name,
        addedAt: Date.now(),
      });
      await reload();
    } catch {
      setError('음원 파일을 읽을 수 없습니다. mp3 파일인지 확인해 주세요.');
    } finally {
      setBusyRole(null);
    }
  }

  async function handleDelete(id: string) {
    await deleteAudio(id);
    await reload();
  }

  return (
    <section className="mx-auto max-w-xl space-y-4 p-4">
      <h2 className="text-xl font-bold">음원 서랍</h2>
      <p className="text-sm text-gray-600">
        이 기기에 한 번만 등록해 두면 모든 행사에서 쓰입니다. 인터넷 없이도 재생됩니다.
      </p>
      {error !== '' && <p className="text-red-600">{error}</p>}

      <ul className="space-y-2">
        {STANDARD_ROLES.map(({ role, label, hint }) => {
          const asset = assets.find((entry) => entry.role === role) ?? null;
          return (
            <li key={role} data-testid={`slot-${role}`}
                className="rounded border border-gray-300 p-3">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{label}</span>
                <span className="text-sm text-gray-500">{hint}</span>
              </div>

              <div className="mt-2 text-sm">
                {asset === null ? (
                  <span className="text-gray-500">없음</span>
                ) : (
                  <span>
                    {asset.fileName} · <span>{formatDuration(asset.durationSec)}</span>
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center gap-3">
                <input
                  data-testid={`file-${role}`}
                  aria-label={`${label} 파일 선택`}
                  type="file"
                  accept="audio/*"
                  className="text-sm"
                  disabled={busyRole !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file !== undefined) void handleFile(role, file);
                  }}
                />
                {busyRole === role && <span className="text-sm">읽는 중…</span>}
                {asset !== null && (
                  <button className="text-sm text-red-600"
                          onClick={() => void handleDelete(asset.id)}>
                    삭제
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
