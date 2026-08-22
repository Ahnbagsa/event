import { useState } from 'react';
import ScriptField from './ScriptField';
import IconButton from '../kit/IconButton';
import { STANDARD_ROLES, roleLabel } from '../../audio/roles';
import { formatDuration } from '../../lib/format';
import { estimateSegmentSeconds } from '../../domain/timeEstimator';
import type { AudioRole, Segment } from '../../types';

type Props = {
  segment: Segment;
  audioDurationSec: number | null;
  audioMissing: boolean;
  onChange: (patch: Partial<Segment>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  aiBusy: boolean;
  onRegenerate: () => void;
};

export default function SegmentCard({
  segment,
  audioDurationSec,
  audioMissing,
  onChange,
  onMove,
  onRemove,
  aiBusy,
  onRegenerate,
}: Props) {
  const [open, setOpen] = useState(false);
  const seconds = estimateSegmentSeconds(segment, audioDurationSec);

  return (
    <li data-testid={`card-${segment.id}`} className="rounded-xl border border-line p-3">
      {/* 제목 줄과 조작 줄을 나눈다. 한 줄에 일곱 개를 넣으면 오른쪽 여섯이 폭을
          먼저 가져가고 제목만 짓눌려 두세 줄로 접힌다. 제목이 전체 폭을 쓰면
          "순국선열 및 호국영령에 대한 묵념" 정도는 한 줄에 들어간다. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {segment.groupLabel !== null && (
          <span className="rounded-xl bg-accent-soft px-2 py-0.5 text-xs">{segment.groupLabel}</span>
        )}
        <span data-testid="segment-name" className="min-w-0 flex-1 font-medium">
          {segment.name}
        </span>
      </div>

      {segment.audioRole !== null && (
        <p className="mt-1 text-sm">
          🎵 {roleLabel(segment.audioRole)}
          {audioMissing && <span className="ml-2 text-danger">⚠ 이 기기에 음원이 없습니다</span>}
        </p>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className="mr-auto text-sm text-ink-soft">{formatDuration(seconds)}</span>
        <IconButton aria-label="위로" onClick={() => onMove(-1)}>▲</IconButton>
        <IconButton aria-label="아래로" onClick={() => onMove(1)}>▼</IconButton>
        <IconButton tone="danger" onClick={onRemove}>삭제</IconButton>
        <IconButton tone="accent" onClick={() => setOpen(!open)}>
          {open ? '접기' : '펼치기'}
        </IconButton>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-sm font-medium" htmlFor={`name-${segment.id}`}>순서명</label>
            <input
              id={`name-${segment.id}`}
              className="w-full rounded-xl border border-line px-2 py-1"
              value={segment.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>

          <ScriptField
            id={`script-${segment.id}`}
            value={segment.script}
            onChange={(script) => onChange({ script })}
          />

          <div>
            <label className="block text-sm font-medium" htmlFor={`role-${segment.id}`}>연결 음원</label>
            <select
              id={`role-${segment.id}`}
              className="rounded-xl border border-line px-2 py-1"
              value={segment.audioRole ?? ''}
              onChange={(e) =>
                onChange({ audioRole: e.target.value === '' ? null : (e.target.value as AudioRole) })
              }
            >
              <option value="">없음</option>
              {STANDARD_ROLES.map(({ role, label }) => (
                <option key={role} value={role}>{label}</option>
              ))}
            </select>
          </div>

          {segment.kind === 'timer' && (
            <div>
              <label className="block text-sm font-medium" htmlFor={`timer-${segment.id}`}>묵념 시간(초)</label>
              <input
                id={`timer-${segment.id}`}
                type="number"
                className="w-28 rounded-xl border border-line px-2 py-1"
                value={segment.timerSec ?? 60}
                onChange={(e) => onChange({ timerSec: Number(e.target.value) })}
              />
            </div>
          )}

          {segment.kind === 'address' && (
            <div>
              <label className="block text-sm font-medium" htmlFor={`addr-${segment.id}`}>예상 시간(분)</label>
              <input
                id={`addr-${segment.id}`}
                type="number"
                className="w-28 rounded-xl border border-line px-2 py-1"
                value={Math.round((segment.manualDurationSec ?? 180) / 60)}
                onChange={(e) => onChange({ manualDurationSec: Number(e.target.value) * 60 })}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={segment.autoPlay}
              onChange={(e) => onChange({ autoPlay: e.target.checked })}
            />
            이 순서로 넘어가면 음원을 바로 재생
          </label>

          <div>
            <label className="block text-sm font-medium" htmlFor={`note-${segment.id}`}>진행 메모</label>
            <input
              id={`note-${segment.id}`}
              className="w-full rounded-xl border border-line px-2 py-1"
              value={segment.note}
              onChange={(e) => onChange({ note: e.target.value })}
            />
          </div>

          <button
            className="rounded-xl border border-accent px-3 py-1 text-accent disabled:opacity-50"
            disabled={aiBusy}
            onClick={onRegenerate}
          >
            🔄 이 순서만 다시 생성
          </button>
        </div>
      )}
    </li>
  );
}
