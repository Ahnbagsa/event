import { describe, it, expect } from 'vitest';
import {
  TEMPLATES,
  STANDARD_EXTRA_SEEDS,
  getTemplate,
  createEventFromTemplate,
} from './index';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: 20,
};

describe('템플릿', () => {
  it('개학식 템플릿이 있다', () => {
    expect(getTemplate('semester-opening')).not.toBeNull();
  });

  it('없는 템플릿은 null이다', () => {
    expect(getTemplate('없는템플릿')).toBeNull();
  });

  it('모든 템플릿의 id가 겹치지 않는다', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('createEventFromTemplate', () => {
  it('개학식 표준 7개 순서를 만든다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(event.segments.map((s) => s.name)).toEqual([
      '개식사',
      '국기에 대한 경례',
      '애국가 제창',
      '순국선열 및 호국영령에 대한 묵념',
      '학교장 말씀',
      '교가 제창',
      '폐식사',
    ]);
  });

  it('전달 사항은 기본 식순에 넣지 않는다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(event.segments.map((s) => s.name)).not.toContain('전달 사항');
  });

  it('국민의례 세 순서에 같은 묶음 이름을 붙인다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    const grouped = event.segments.filter((s) => s.groupLabel === '국민의례');
    expect(grouped).toHaveLength(3);
  });

  it('묵념은 타이머이면서 묵념곡을 가진다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    const silence = event.segments.find((s) => s.audioRole === 'silence');
    expect(silence?.kind).toBe('timer');
    expect(silence?.timerSec).toBe(60);
  });

  it('학교장 말씀 기본 시간은 3분이다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    const address = event.segments.find((s) => s.name === '학교장 말씀');
    expect(address?.kind).toBe('address');
    expect(address?.manualDurationSec).toBe(180);
  });

  it('order를 0부터 차례로 매기고 id가 겹치지 않는다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(event.segments.map((s) => s.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(new Set(event.segments.map((s) => s.id)).size).toBe(7);
  });

  it('행사 정보를 그대로 담는다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    expect(event.title).toBe('2학기 개학식');
    expect(event.mode).toBe('broadcast');
    expect(event.templateId).toBe('semester-opening');
  });

  it('빈 템플릿은 순서가 없다', () => {
    const event = createEventFromTemplate('blank', init);
    expect(event.segments).toEqual([]);
  });

  it('없는 템플릿 id는 오류를 던진다', () => {
    expect(() => createEventFromTemplate('없는템플릿', init)).toThrow(
      '알 수 없는 행사 템플릿입니다.',
    );
  });
});

describe('STANDARD_EXTRA_SEEDS', () => {
  it('전달 사항을 나중에 넣을 수 있게 제공한다', () => {
    const names = STANDARD_EXTRA_SEEDS.map((seed) => seed.name);
    expect(names).toContain('전달 사항');
  });

  it('전달 사항은 말씀 종류이고 기본 2분이다', () => {
    const found = STANDARD_EXTRA_SEEDS.find((seed) => seed.name === '전달 사항');
    expect(found?.kind).toBe('address');
    expect(found?.manualDurationSec).toBe(120);
  });

  it('자주 쓰는 순서를 갖추고 있다', () => {
    const names = STANDARD_EXTRA_SEEDS.map((seed) => seed.name);
    expect(names).toContain('시상');
    expect(names).toContain('내빈 소개');
    expect(names).toContain('입장');
  });

  it('이름이 겹치지 않는다', () => {
    const names = STANDARD_EXTRA_SEEDS.map((seed) => seed.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
