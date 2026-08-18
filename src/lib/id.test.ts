import { describe, it, expect } from 'vitest';
import { newId } from './id';

describe('newId', () => {
  it('접두사로 시작한다', () => {
    expect(newId('seg')).toMatch(/^seg-/);
  });

  it('연속 호출해도 값이 겹치지 않는다', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId('x')));
    expect(ids.size).toBe(500);
  });
});
