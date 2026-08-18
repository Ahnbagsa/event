import { newId } from '../lib/id';
import type { Segment } from '../types';
import type { SegmentSeed } from './templates';

export function reindex(segments: Segment[]): Segment[] {
  return segments.map((segment, index) => ({ ...segment, order: index }));
}

export function moveSegment(segments: Segment[], id: string, delta: number): Segment[] {
  const from = segments.findIndex((segment) => segment.id === id);
  if (from === -1) return segments;

  const to = from + delta;
  if (to < 0 || to >= segments.length) return segments;

  const next = [...segments];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return reindex(next);
}

export function removeSegment(segments: Segment[], id: string): Segment[] {
  return reindex(segments.filter((segment) => segment.id !== id));
}

export function updateSegment(
  segments: Segment[],
  id: string,
  patch: Partial<Segment>,
): Segment[] {
  return segments.map((segment) =>
    segment.id === id ? { ...segment, ...patch, id: segment.id, order: segment.order } : segment,
  );
}

export function insertSegment(
  segments: Segment[],
  seed: SegmentSeed,
  atIndex: number,
): Segment[] {
  const next = [...segments];
  next.splice(atIndex, 0, { ...seed, id: newId('seg'), order: atIndex });
  return reindex(next);
}
