import { useCallback, useEffect, useState } from 'react';
import LibraryPicker from './LibraryPicker';
import { STANDARD_ROLES } from '../../audio/roles';
import { readAudioDuration } from '../../audio/readAudioDuration';
import { guessAudioMime } from '../../audio/mimeFromName';
import { deleteAudio, listAudio, putAudio, setDefaultAudio } from '../../db/audioRepo';
import { loadLibrary, tracksForRole, type LibraryTrack } from '../../media/library';
import { MEDIA_ACCEPT, isVideo } from '../../media/mediaKind';
import { defaultAssetForRole, sourceIdOf, uploadSourceId, usedSourceIds } from '../../audio/audioSource';
import { listEvents } from '../../db/eventRepo';
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
  // 어떤 행사가 콕 집어 쓰는 음원. 아무도 안 쓰는 것을 알려 지우기 쉽게 한다.
  const [used, setUsed] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const [loadedAssets, events] = await Promise.all([listAudio(), listEvents()]);
    setAssets(loadedAssets);
    setUsed(usedSourceIds(events));
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
      const id = newId('audio');
      await putAudio({
        id,
        role,
        label: file.name,
        // 이름표를 붙여 둬야 이 파일도 순서에서 콕 집어 고를 수 있다.
        sourceId: uploadSourceId(id),
        data,
        mimeType,
        durationSec,
        fileName: file.name,
        addedAt: Date.now(),
      });
      await reload();
    } catch {
      setError(
        '파일을 읽을 수 없습니다. mp3·m4a·wav 음원이나 mp4·mov 동영상인지 확인해 주세요. ' +
          '휴대폰이라면 카카오톡이나 다운로드 폴더에 받아 둔 파일을 골라 주세요.',
      );
    } finally {
      setBusyRole(null);
    }
  }

  async function handleMakeDefault(role: AudioRole, id: string) {
    await setDefaultAudio(role, id);
    await reload();
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
        음원과 동영상 둘 다 됩니다 — 동영상은 진행 화면에서 <b>크게 보기</b>로 빔프로젝터에
        내보낼 수 있습니다. 다만 동영상은 자리를 많이 차지하니 꼭 필요한 것만 넣어 주세요.
      </p>
      {error !== '' && <p className="text-danger">{error}</p>}

      <ul className="space-y-2">
        {STANDARD_ROLES.map(({ role, label, hint }) => {
          const mine = assets.filter((entry) => entry.role === role);
          const defaultAsset = defaultAssetForRole(assets, role);
          return (
            <li key={role} data-testid={`slot-${role}`}
                className="rounded-xl border border-line p-3">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{label}</span>
                <span className="text-sm text-ink-soft">{hint}</span>
              </div>

              {/* 역할당 여러 개를 가질 수 있다. 받아 둔 것을 모두 보여야
                  무엇이 자리를 차지하는지 알고 지울 수 있다. */}
              <ul className="mt-2 space-y-1 text-sm">
                {mine.length === 0 && <li className="text-ink-soft">없음</li>}
                {mine.map((entry) => {
                  const sourceId = sourceIdOf(entry);
                  const isDefault = defaultAsset !== null && defaultAsset.id === entry.id;
                  const unused = !isDefault && !used.has(sourceId);
                  return (
                    <li key={entry.id} data-testid={`asset-${entry.id}`}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 flex-1">
                        {isVideo(entry.mimeType) ? '🎬 ' : ''}
                        {entry.label}
                        <span className="text-ink-soft"> · {formatDuration(entry.durationSec)}</span>
                      </span>
                      {isDefault && (
                        <span className="rounded-xl bg-accent-soft px-2 text-xs">기본</span>
                      )}
                      {unused && (
                        <span className="rounded-xl bg-warn-soft px-2 text-xs text-warn">
                          안 쓰는 음원
                        </span>
                      )}
                      {!isDefault && (
                        <button className="min-h-11 px-2 text-accent"
                                onClick={() => void handleMakeDefault(role, entry.id)}>
                          기본으로
                        </button>
                      )}
                      <button className="min-h-11 px-2 text-danger"
                              onClick={() => void handleDelete(entry.id)}>
                        삭제
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <input
                  data-testid={`file-${role}`}
                  aria-label={`${label} 파일 선택`}
                  type="file"
                  accept={MEDIA_ACCEPT}
                  className="min-w-0 flex-1 text-sm"
                  disabled={busyRole !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file !== undefined) void handleFile(role, file);
                  }}
                />
                {busyRole === role && <span className="text-sm">읽는 중…</span>}
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
