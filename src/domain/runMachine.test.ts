import { describe, it, expect } from 'vitest';
import { createRunModel, runReducer } from './runMachine';

describe('createRunModel', () => {
  it('처음에는 시작 전 상태다', () => {
    expect(createRunModel(8)).toEqual({ phase: 'ready', index: 0, total: 8 });
  });

  it('중단된 위치에서 되살릴 수 있다', () => {
    expect(createRunModel(8, 3).index).toBe(3);
  });

  it('범위를 벗어난 위치는 잘라낸다', () => {
    expect(createRunModel(8, 99).index).toBe(7);
    expect(createRunModel(8, -5).index).toBe(0);
  });
});

describe('runReducer', () => {
  const ready = createRunModel(3);
  const running = { phase: 'running' as const, index: 0, total: 3 };

  it('시작하면 진행 상태가 된다', () => {
    expect(runReducer(ready, { type: 'start' })).toEqual({ phase: 'running', index: 0, total: 3 });
  });

  it('순서가 하나도 없으면 시작하자마자 끝난다', () => {
    expect(runReducer(createRunModel(0), { type: 'start' }).phase).toBe('finished');
  });

  it('다음으로 넘어간다', () => {
    expect(runReducer(running, { type: 'next' }).index).toBe(1);
  });

  it('마지막에서 다음을 누르면 종료된다', () => {
    const last = { ...running, index: 2 };
    expect(runReducer(last, { type: 'next' })).toEqual({ phase: 'finished', index: 2, total: 3 });
  });

  it('이전으로 돌아간다', () => {
    expect(runReducer({ ...running, index: 2 }, { type: 'prev' }).index).toBe(1);
  });

  it('첫 순서에서 이전을 누르면 그대로 있는다', () => {
    expect(runReducer(running, { type: 'prev' }).index).toBe(0);
  });

  it('종료 상태에서 이전을 누르면 마지막 순서로 돌아간다', () => {
    const finished = { phase: 'finished' as const, index: 2, total: 3 };
    expect(runReducer(finished, { type: 'prev' })).toEqual({
      phase: 'running',
      index: 2,
      total: 3,
    });
  });

  it('임의 순서로 건너뛴다', () => {
    expect(runReducer(running, { type: 'jump', index: 2 })).toEqual({
      phase: 'running',
      index: 2,
      total: 3,
    });
  });

  it('건너뛸 위치가 범위를 벗어나면 잘라낸다', () => {
    expect(runReducer(running, { type: 'jump', index: 99 }).index).toBe(2);
    expect(runReducer(running, { type: 'jump', index: -1 }).index).toBe(0);
  });

  it('시작 전에는 다음이 눌려도 움직이지 않는다', () => {
    expect(runReducer(ready, { type: 'next' })).toEqual(ready);
  });

  it('처음으로 되돌린다', () => {
    expect(runReducer({ ...running, index: 2 }, { type: 'restart' })).toEqual({
      phase: 'ready',
      index: 0,
      total: 3,
    });
  });
});
