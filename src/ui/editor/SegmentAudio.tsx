import { useState } from 'react';
import Button from '../kit/Button';
import { assetForSegment, defaultAssetForRole, libSourceId, sourceIdOf } from '../../audio/audioSource';
import { trackUrl, tracksForRole, type LibraryTrack } from '../../media/library';
import { addAudio, findAudioBySourceId } from '../../db/audioRepo';
import { defaultFetchTrackDeps, fetchLibraryTrack } from '../../media/fetchLibraryTrack';
import { formatDuration } from '../../lib/format';
import type { AudioAsset, Segment } from '../../types';

type Choice = {
  sourceId: string;
  label: string;
  note: string;
  durationSec: number | null;
  /** 이미 이 기기에 있는가. 없으면 고를 때 내려받는다. */
  onDevice: boolean;
  /** 아직 안 받았을 때 들어보기용 주소. */
  previewUrl: string | null;
};

type Props = {
  segment: Segment;
  assets: AudioAsset[];
  library: LibraryTrack[];
  onChange: (patch: Partial<Segment>) => void;
  onAssetsChanged: () => void;
};

function buildChoices(segment: Segment, assets: AudioAsset[], library: LibraryTrack[]): Choice[] {
  if (segment.audioRole === null) return [];

  const mine = assets.filter((asset) => asset.role === segment.audioRole);
  const choices: Choice[] = mine.map((asset) => ({
    sourceId: sourceIdOf(asset),
    label: asset.label,
    note: '',
    durationSec: asset.durationSec,
    onDevice: true,
    previewUrl: null,
  }));

  const have = new Set(choices.map((choice) => choice.sourceId));
  for (const track of tracksForRole(library, segment.audioRole)) {
    const sourceId = libSourceId(track.id);
    if (have.has(sourceId)) continue;
    choices.push({
      sourceId,
      label: track.label,
      note: track.note,
      durationSec: track.durationSec,
      onDevice: false,
      previewUrl: trackUrl(track),
    });
  }
  return choices;
}

/**
 * 이 순서에만 다른 음원을 쓰도록 고른다.
 *
 * 개학식은 애국가 1절, 졸업식은 1~4절처럼 행사마다 다르게 쓰기 위한 것이다.
 * 여기서 고른 것은 이 순서에만 적용되고 **기기의 기본 음원은 그대로 둔다.**
 */
export default function SegmentAudio({
  segment,
  assets,
  library,
  onChange,
  onAssetsChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (segment.audioRole === null) return null;

  const inUse = assetForSegment(assets, segment);
  const fallback = defaultAssetForRole(assets, segment.audioRole);
  const choices = buildChoices(segment, assets, library);
  const pickedMissing =
    segment.audioSourceId !== null &&
    !choices.some((choice) => choice.onDevice && choice.sourceId === segment.audioSourceId);

  async function pick(choice: Choice) {
    setError('');
    if (choice.onDevice) {
      onChange({ audioSourceId: choice.sourceId });
      setOpen(false);
      return;
    }

    setBusy(choice.sourceId);
    try {
      // 같은 것을 두 번 받지 않는다.
      if ((await findAudioBySourceId(choice.sourceId)) === null) {
        const track = library.find((entry) => libSourceId(entry.id) === choice.sourceId);
        if (track === undefined) throw new Error('목록에서 그 음원을 찾지 못했습니다.');
        const asset = await fetchLibraryTrack(track, defaultFetchTrackDeps());
        // 기본 음원은 건드리지 않는다. 이 순서에서만 쓰려고 받은 것이다.
        await addAudio({ ...asset, sourceId: choice.sourceId });
      }
      onChange({ audioSourceId: choice.sourceId });
      onAssetsChanged();
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '음원을 받아오지 못했습니다.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div data-testid={`segment-audio-${segment.id}`} className="rounded-xl bg-accent-soft/60 p-3">
      <p className="text-sm font-medium">이 순서에 쓸 음원</p>

      <p className="mt-1 text-sm">
        {inUse === null ? (
          <span className="text-danger">이 기기에 음원이 없습니다</span>
        ) : (
          <>
            {inUse.label}
            <span className="text-ink-soft"> · {formatDuration(inUse.durationSec)}</span>
            {segment.audioSourceId === null && (
              <span className="text-ink-soft"> · 기본 음원</span>
            )}
          </>
        )}
      </p>

      {/* 공유 링크로 옮겨 온 행사가 이 기기에 없는 음원을 가리킬 수 있다.
          조용히 다른 것이 나가면 행사 당일에야 알아차린다. */}
      {pickedMissing && inUse !== null && (
        <p className="mt-1 text-sm text-warn">
          ⚠ 고르신 음원이 이 기기에 없어 기본 음원으로 재생됩니다.
          {fallback !== null && ` (${fallback.label})`}
        </p>
      )}

      {error !== '' && <p className="mt-1 text-sm text-danger">{error}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button className="h-9 px-3 text-sm" onClick={() => setOpen(!open)}>
          {open ? '닫기' : '다른 음원으로'}
        </Button>
        {segment.audioSourceId !== null && (
          <Button
            className="h-9 px-3 text-sm"
            onClick={() => onChange({ audioSourceId: null })}
          >
            기본 음원 쓰기
          </Button>
        )}
      </div>

      {open && (
        <ul className="mt-2 space-y-2">
          {choices.length === 0 && (
            <li className="text-sm text-ink-soft">고를 수 있는 음원이 없습니다.</li>
          )}
          {choices.map((choice) => {
            const chosen =
              segment.audioSourceId === null
                ? inUse !== null && sourceIdOf(inUse) === choice.sourceId
                : segment.audioSourceId === choice.sourceId;
            return (
              <li key={choice.sourceId}
                  data-testid={`choice-${choice.sourceId}`}
                  className="rounded-xl bg-paper-raised p-2">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {chosen && '✓ '}{choice.label}
                  </span>
                  {choice.durationSec !== null && (
                    <span className="text-sm text-ink-soft">
                      {formatDuration(choice.durationSec)}
                    </span>
                  )}
                </div>
                {choice.note !== '' && <p className="text-xs text-ink-soft">{choice.note}</p>}
                {!choice.onDevice && (
                  <p className="text-xs text-ink-soft">고르면 이 기기에 받아 둡니다</p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {choice.previewUrl !== null && (
                    <Button
                      className="h-9 px-3 text-sm"
                      aria-label={`${choice.label} 들어보기`}
                      onClick={() =>
                        setPreviewId(previewId === choice.sourceId ? null : choice.sourceId)
                      }
                    >
                      {previewId === choice.sourceId ? '닫기' : '들어보기'}
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    className="h-9 px-3 text-sm"
                    disabled={busy !== null}
                    onClick={() => void pick(choice)}
                  >
                    {busy === choice.sourceId ? '받는 중…' : '이 순서에 쓰기'}
                  </Button>
                </div>

                {previewId === choice.sourceId && choice.previewUrl !== null && (
                  <audio
                    data-testid={`segment-preview-${choice.sourceId}`}
                    className="mt-2 w-full"
                    controls
                    preload="none"
                    src={choice.previewUrl}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
