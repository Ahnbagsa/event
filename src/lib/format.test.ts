import { describe, it, expect } from 'vitest';
import { formatDuration } from './format';

describe('formatDuration', () => {
  it('1분 미만은 초만 표시한다', () => {
    expect(formatDuration(45)).toBe('45초');
  });

  it('분과 초를 함께 표시한다', () => {
    expect(formatDuration(200)).toBe('3분 20초');
  });

  it('초가 0이면 분만 표시한다', () => {
    expect(formatDuration(180)).toBe('3분');
  });

  it('0초는 "0초"다', () => {
    expect(formatDuration(0)).toBe('0초');
  });

  it('소수점은 올림한다', () => {
    expect(formatDuration(44.2)).toBe('45초');
  });

  it('올림한 값이 60초가 되면 1분으로 표시한다', () => {
    expect(formatDuration(59.2)).toBe('1분');
  });
});
