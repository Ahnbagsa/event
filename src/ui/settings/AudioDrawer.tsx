import { useCallback, useEffect, useState } from 'react';
import LibraryPicker from './LibraryPicker';
import { STANDARD_ROLES } from '../../audio/roles';
import { readAudioDuration } from '../../audio/readAudioDuration';
import { guessAudioMime } from '../../audio/mimeFromName';
import { deleteAudio, listAudio, putAudio } from '../../db/audioRepo';
import { loadLibrary, tracksForRole, type LibraryTrack } from '../../media/library';
import { defaultFetchTrackDeps, fetchLibraryTrack } from '../../media/fetchLibraryTrack';
import { newId } from '../../lib/id';
import { formatDuration } from '../../lib/format';
import type { AudioAsset, AudioRole } from '../../types';

export default function AudioDrawer() {
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [error, setError] = useState('');
  const [busyRole, setBusyRole] = useState<AudioRole | null>(null);
  const [library, setLibrary] = useState<LibraryTrack[]>([]);
  const [busyTrackId, setBusyTrackId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setAssets(await listAudio());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 목록이 없거나 인터넷이 끊겨 있으면 loadLibrary가 빈 목록을 준다.
  // 그때는 고르기 칸이 조용히 접히고 파일 올리기만 남는다.
  useEffect(() => {
    void loadLibrary().then(setLibrary);
  }, []);

  async function handlePick(role: AudioRole, track: LibraryTrack) {
    setError('');
    setBusyRole(role);
    setBusyTrackId(track.id);
    try {
      await putAudio(await fetchLibraryTrack(track, defaultFetchTrackDeps()));
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '음원을 받아오지 못했습니다.');
    } finally {
      setBusyRole(null);
      setBusyTrackId(null);
    }
  }

  async function handleFile(role: AudioRole, file: File) {
    setError('');
    setBusyRole(role);
    try {
      const data = await file.arrayBuffer();
      const mimeType = guessAudioMime(file.name, file.type);
      const durationSec = await readAudioDuration(data, mimeType);
      await putAudio({
        id: newId('audio'),
        role,
        label: file.name,
        data,
        mimeType,
        durationSec,
        fileName: file.name,
        addedAt: Date.now(),
      });
      await reload();
    } catch {
      setError(
        '음원 파일을 읽을 수 없습니다. mp3·m4a·wav 파일인지 확인해 주세요. ' +
          '휴대폰이라면 카카오톡이나 다운로드 폴더에 받아 둔 파일을 골라 주세요.',
      );
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
      <p className="text-sm text-ink-soft">
        이 기기에 한 번만 등록해 두면 모든 행사에서 쓰입니다. 인터넷 없이도 재생됩니다.
      </p>
      {error !== '' && <p className="text-danger">{error}</p>}

      <ul className="space-y-2">
        {STANDARD_ROLES.map(({ role, label, hint }) => {
          const asset = assets.find((entry) => entry.role === role) ?? null;
          return (
            <li key={role} data-testid={`slot-${role}`}
                className="rounded-xl border border-line p-3">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{label}</span>
                <span className="text-sm text-ink-soft">{hint}</span>
              </div>

              <div className="mt-2 text-sm">
                {asset === null ? (
                  <span className="text-ink-soft">없음</span>
                ) : (
                  <span>
                    {asset.fileName} · <span>{formatDuration(asset.durationSec)}</span>
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <input
                  data-testid={`file-${role}`}
                  aria-label={`${label} 파일 선택`}
                  type="file"
                  accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.flac,.opus"
                  className="text-sm"
                  disabled={busyRole !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file !== undefined) void handleFile(role, file);
                  }}
                />
                {busyRole === role && <span className="text-sm">읽는 중…</span>}
                {asset !== null && (
                  <button className="text-sm text-danger"
                          onClick={() => void handleDelete(asset.id)}>
                    삭제
                  </button>
                )}
              </div>

              <LibraryPicker
                roleLabel={label}
                tracks={tracksForRole(library, role)}
                busyTrackId={busyTrackId}
                disabled={busyRole !== null}
                onPick={(track) => void handlePick(role, track)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
