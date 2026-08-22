import { useState } from 'react';
import Button from '../kit/Button';
import { trackUrl, type LibraryTrack } from '../../media/library';
import { formatDuration } from '../../lib/format';

type Props = {
  roleLabel: string;
  tracks: LibraryTrack[];
  busyTrackId: string | null;
  disabled: boolean;
  onPick: (track: LibraryTrack) => void;
};

/**
 * 이미 준비되어 올라와 있는 공용 음원 중에서 고른다.
 * 맹세문·애국가·묵념곡은 판본이 여럿이라 학교마다 쓰는 것이 다르다.
 *
 * 후보가 없으면 아무것도 그리지 않는다. 음원 파일은 나중에 채우는 것이므로
 * 아직 없는 동안 빈 칸이 보이면 고장 난 것처럼 보인다.
 */
export default function LibraryPicker({
  roleLabel,
  tracks,
  busyTrackId,
  disabled,
  onPick,
}: Props) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (tracks.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl bg-accent-soft/60 p-3">
      <p className="text-sm font-medium">이미 준비된 {roleLabel} 중에서 고르기</p>
      <ul className="mt-2 space-y-2">
        {tracks.map((track) => (
          <li key={track.id} data-testid={`library-track-${track.id}`}
              className="rounded-xl bg-paper-raised p-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="min-w-0 flex-1 text-sm font-medium">{track.label}</span>
              {track.durationSec !== null && (
                <span className="text-sm text-ink-soft">{formatDuration(track.durationSec)}</span>
              )}
            </div>

            {track.note !== '' && <p className="text-xs text-ink-soft">{track.note}</p>}
            {track.credit !== '' && <p className="text-xs text-ink-soft">출처 · {track.credit}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                className="h-9 px-3 text-sm"
                aria-label={`${track.label} 들어보기`}
                onClick={() => setPreviewId(previewId === track.id ? null : track.id)}
              >
                {previewId === track.id ? '닫기' : '들어보기'}
              </Button>
              <Button
                variant="primary"
                className="h-9 px-3 text-sm"
                disabled={disabled}
                onClick={() => onPick(track)}
              >
                {busyTrackId === track.id ? '받는 중…' : '이걸로'}
              </Button>
            </div>

            {/* 들어보기는 내려받지 않고 주소를 그대로 재생한다(preload="none").
                고르지 않을 파일까지 기기에 쌓을 이유가 없다. */}
            {previewId === track.id && (
              <audio
                data-testid={`preview-${track.id}`}
                className="mt-2 w-full"
                controls
                preload="none"
                src={trackUrl(track)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
