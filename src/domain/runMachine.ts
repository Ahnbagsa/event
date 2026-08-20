export type RunPhase = 'ready' | 'running' | 'finished';

export type RunModel = {
  phase: RunPhase;
  index: number;
  total: number;
};

export type RunAction =
  | { type: 'start' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'jump'; index: number }
  | { type: 'restart' }
  | { type: 'load'; total: number; index?: number };

function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

export function createRunModel(total: number, index = 0): RunModel {
  return { phase: 'ready', index: clampIndex(index, total), total };
}

export function runReducer(state: RunModel, action: RunAction): RunModel {
  switch (action.type) {
    case 'start':
      if (state.total === 0) return { ...state, phase: 'finished' };
      return { ...state, phase: 'running' };

    case 'next':
      if (state.phase !== 'running') return state;
      if (state.index >= state.total - 1) return { ...state, phase: 'finished' };
      return { ...state, index: state.index + 1 };

    case 'prev':
      if (state.phase === 'finished') return { ...state, phase: 'running' };
      if (state.phase !== 'running') return state;
      return { ...state, index: clampIndex(state.index - 1, state.total) };

    case 'jump':
      return { ...state, phase: 'running', index: clampIndex(action.index, state.total) };

    case 'restart':
      return { phase: 'ready', index: 0, total: state.total };

    // 행사를 불러온 순간 순서 수가 정해진다. 이걸 기계에 넣어주지 않으면
    // total이 0으로 남아 첫 '다음'에서 곧바로 종료로 떨어진다.
    case 'load':
      return runReducer(createRunModel(action.total, action.index ?? 0), { type: 'start' });
  }
}
