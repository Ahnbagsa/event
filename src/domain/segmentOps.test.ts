import { describe, it, expect } from 'vitest';
import { reindex, moveSegment, removeSegment, updateSegment, insertSegment } from './segmentOps';
import type { Segment } from '../types';

function seg(id: string, name: string, order: number): Segment {
  return {
    id,
    order,
    name,
    groupLabel: null,
    kind: 'speech',
    script: '',
    audioRole: null,
    autoPlay: false,
    fadeOutSec: null,
    timerSec: null,
    manualDurationSec: null,
    note: '',
  };
}

const base = [seg('a', '개식사', 0), seg('b', '애국가', 1), seg('c', '폐식사', 2)];

describe('reindex', () => {
  it('order를 0부터 다시 매긴다', () => {
    const messy = [seg('a', 'A', 7), seg('b', 'B', 3)];
    expect(reindex(messy).map((s) => s.order)).toEqual([0, 1]);
  });
});

describe('moveSegment', () => {
  it('한 칸 위로 올린다', () => {
    expect(moveSegment(base, 'b', -1).map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('한 칸 아래로 내린다', () => {
    expect(moveSegment(base, 'b', 1).map((s) => s.id)).toEqual(['a', 'c', 'b']);
  });

  it('맨 위에서 더 올리면 그대로 둔다', () => {
    expect(moveSegment(base, 'a', -1).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('맨 아래에서 더 내리면 그대로 둔다', () => {
    expect(moveSegment(base, 'c', 1).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('없는 id는 그대로 둔다', () => {
    expect(moveSegment(base, '없음', 1).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('이동 후 order를 다시 매긴다', () => {
    expect(moveSegment(base, 'b', -1).map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    moveSegment(base, 'b', -1);
    expect(base.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('removeSegment', () => {
  it('해당 순서를 지우고 order를 다시 매긴다', () => {
    const result = removeSegment(base, 'b');
    expect(result.map((s) => s.id)).toEqual(['a', 'c']);
    expect(result.map((s) => s.order)).toEqual([0, 1]);
  });

  it('없는 id면 그대로 둔다', () => {
    expect(removeSegment(base, '없음')).toHaveLength(3);
    expect(removeSegment(base, '없음').map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    removeSegment(base, 'b');
    expect(base.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('updateSegment', () => {
  it('지정한 순서만 바꾼다', () => {
    const result = updateSegment(base, 'b', { script: '애국가를 제창하겠습니다.' });
    expect(result[1].script).toBe('애국가를 제창하겠습니다.');
    expect(result[0].script).toBe('');
  });

  it('id와 order는 덮어쓰지 못한다', () => {
    const result = updateSegment(base, 'b', { id: '해킹', order: 99 } as Partial<Segment>);
    expect(result[1].id).toBe('b');
    expect(result[1].order).toBe(1);
  });

  it('원본 배열과 원본 순서를 바꾸지 않는다', () => {
    updateSegment(base, 'b', { script: '새 멘트' });
    expect(base.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(base[1].script).toBe('');
  });
});

describe('insertSegment', () => {
  const seed = {
    name: '시상',
    groupLabel: null,
    kind: 'speech' as const,
    script: '',
    audioRole: null,
    autoPlay: false,
    fadeOutSec: null,
    timerSec: null,
    manualDurationSec: null,
    note: '',
  };

  it('지정한 위치에 새 순서를 넣는다', () => {
    const result = insertSegment(base, seed, 1);
    expect(result.map((s) => s.name)).toEqual(['개식사', '시상', '애국가', '폐식사']);
  });

  it('새 순서에 고유 id를 준다', () => {
    const result = insertSegment(base, seed, 1);
    expect(new Set(result.map((s) => s.id)).size).toBe(4);
  });

  it('맨 끝에 넣을 수 있다', () => {
    expect(insertSegment(base, seed, 3).map((s) => s.name).at(-1)).toBe('시상');
  });

  it('넣은 뒤 order를 0부터 다시 매긴다', () => {
    const result = insertSegment(base, seed, 1);
    expect(result.map((s) => s.order)).toEqual([0, 1, 2, 3]);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    insertSegment(base, seed, 1);
    expect(base).toHaveLength(3);
    expect(base.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});
