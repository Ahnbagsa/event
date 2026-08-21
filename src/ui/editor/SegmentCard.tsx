import { useState } from 'react';
import ScriptField from './ScriptField';
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
    <li data-testid={`card-${segment.id}`} className="rounded border border-gray-300 p-3">
      <div className="flex items-center gap-2">
        {segment.groupLabel !== null && (
          <span className="rounded bg-gray-200 px-2 py-0.5 text-xs">{segment.groupLabel}</span>
        )}
        <span data-testid="segment-name" className="flex-1 font-medium">
          {segment.name}
        </span>
        <span className="text-sm text-gray-500">{formatDuration(seconds)}</span>
        <button className="px-2" aria-label="위로" onClick={() => onMove(-1)}>▲</button>
        <button className="px-2" aria-label="아래로" onClick={() => onMove(1)}>▼</button>
        <button className="px-2 text-red-600" onClick={onRemove}>삭제</button>
        <button className="px-2 text-blue-600" onClick={() => setOpen(!open)}>
          {open ? '접기' : '펼치기'}
        </button>
      </div>

      {segment.audioRole !== null && (
        <p className="mt-1 text-sm">
          🎵 {roleLabel(segment.audioRole)}
          {audioMissing && <span className="ml-2 text-red-600">⚠ 이 기기에 음원이 없습니다</span>}
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-sm font-medium" htmlFor={`name-${segment.id}`}>순서명</label>
            <input
              id={`name-${segment.id}`}
              className="w-full rounded border border-gray-400 px-2 py-1"
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
              className="rounded border border-gray-400 px-2 py-1"
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
                className="w-28 rounded border border-gray-400 px-2 py-1"
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
                className="w-28 rounded border border-gray-400 px-2 py-1"
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
              className="w-full rounded border border-gray-400 px-2 py-1"
              value={segment.note}
              onChange={(e) => onChange({ note: e.target.value })}
            />
          </div>

          <button
            className="rounded border border-emerald-600 px-3 py-1 text-emerald-700 disabled:opacity-50"
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
