import { describe, it, expect } from 'vitest';
import { compressToEncodedURIComponent } from 'lz-string';
import {
  MAX_LINK_PAYLOAD,
  encodeScenario,
  decodeScenario,
  buildShareUrl,
} from './scenarioLink';
import { createEventFromTemplate } from '../domain/templates';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: 20,
};

function sampleEvent() {
  const event = createEventFromTemplate('semester-opening', init);
  event.segments[0].script = '지금부터 2026학년도 2학기 개학식을 시작하겠습니다.';
  return event;
}

// 테스트 전용 헬퍼: 검증 없이 아무 객체나 같은 방식으로 압축한다
function encodeScenarioRaw(value: unknown): string {
  return compressToEncodedURIComponent(JSON.stringify(value));
}

// 같은 글자를 반복하면 lz-string이 1KB 아래로 줄여 버려 한도를 못 넘긴다.
// 실제로 길어진 대본처럼 압축이 잘 안 먹는 글자열을 만든다.
function incompressibleText(length: number): string {
  let seed = 1;
  let text = '';
  for (let index = 0; index < length; index += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    text += String.fromCharCode(0xac00 + (seed % 11172));
  }
  return text;
}

describe('encodeScenario / decodeScenario', () => {
  it('압축했다가 풀면 내용을 잃지 않는다', () => {
    const event = sampleEvent();
    const restored = decodeScenario(encodeScenario(event));

    // id와 시각은 링크에 담지 않는다. 가져오는 기기에서 새로 만든다.
    const withoutVolatile = (value: typeof event) => ({
      ...value,
      id: '',
      createdAt: 0,
      updatedAt: 0,
      segments: value.segments.map((segment) => ({ ...segment, id: '' })),
    });
    expect(withoutVolatile(restored)).toEqual(withoutVolatile(event));
  });

  it('압축 결과가 URL에 넣어도 안전한 문자만 담는다', () => {
    expect(encodeScenario(sampleEvent())).toMatch(/^[A-Za-z0-9+\-$.]*$/);
  });

  it('개학식 한 건은 8KB를 크게 밑돈다', () => {
    expect(encodeScenario(sampleEvent()).length).toBeLessThan(MAX_LINK_PAYLOAD / 2);
  });

  it('너무 크면 이유를 담은 오류를 던진다', () => {
    const event = sampleEvent();
    event.segments[0].script = incompressibleText(8000);
    expect(() => encodeScenario(event)).toThrow('시나리오가 너무 길어');
  });

  it('망가진 문자열은 오류를 던진다', () => {
    expect(() => decodeScenario('망가진값!!!')).toThrow('시나리오를 읽을 수 없습니다.');
  });

  it('빈 문자열도 오류를 던진다', () => {
    expect(() => decodeScenario('')).toThrow('시나리오를 읽을 수 없습니다.');
  });

  it('행사 모양이 아닌 JSON은 오류를 던진다', () => {
    const notEvent = encodeScenarioRaw({ 아무거나: true });
    expect(() => decodeScenario(notEvent)).toThrow('시나리오를 읽을 수 없습니다.');
  });
});

describe('buildShareUrl', () => {
  it('해시 경로에 압축값을 붙인다', () => {
    const url = buildShareUrl(sampleEvent(), 'https://example.github.io', '/haengsa/');
    expect(url.startsWith('https://example.github.io/haengsa/#/import?d=')).toBe(true);
  });
});

describe('v2 형식', () => {
  it('멘트까지 채운 개학식 링크가 1000자 아래다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    for (const segment of event.segments) {
      segment.script = `${segment.name} 순서입니다. 모두 자리에서 일어나 주시기 바랍니다.`;
    }
    const url = buildShareUrl(event, 'https://ahnbagsa.github.io', '/event/');
    expect(url.length).toBeLessThan(1000);
  });

  it('id와 시각은 링크에 담지 않는다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    const restored = decodeScenario(encodeScenario(event));

    // 가져오는 쪽에서 새로 만드는 값이므로 원본과 같을 필요가 없다.
    expect(restored.segments.map((s) => s.name)).toEqual(event.segments.map((s) => s.name));
    expect(restored.segments.map((s) => s.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(restored.segments.every((s) => s.id !== '')).toBe(true);
  });

  it('내용에 관한 값은 하나도 잃지 않는다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '개학식을 시작하겠습니다.';
    event.segments[0].note = '마이크 확인';
    event.segments[0].groupLabel = '국민의례';
    event.segments[1].autoPlay = true;
    event.segments[1].fadeOutSec = 3;
    event.segments[3].timerSec = 45;
    event.segments[4].manualDurationSec = 240;

    const restored = decodeScenario(encodeScenario(event));

    const fields = (list: typeof event.segments) =>
      list.map((s) => [
        s.name, s.kind, s.script, s.groupLabel, s.audioRole,
        s.autoPlay, s.fadeOutSec, s.timerSec, s.manualDurationSec, s.note,
      ]);
    expect(fields(restored.segments)).toEqual(fields(event.segments));
    expect(restored.title).toBe(event.title);
    expect(restored.templateId).toBe(event.templateId);
    expect(restored.date).toBe(event.date);
    expect(restored.place).toBe(event.place);
    expect(restored.mode).toBe(event.mode);
    expect(restored.audience).toBe(event.audience);
    expect(restored.tone).toBe(event.tone);
    expect(restored.targetMinutes).toBe(event.targetMinutes);
  });

  it('직접 만든 음원 역할도 지킨다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].audioRole = 'custom:우리반 노래';
    const restored = decodeScenario(encodeScenario(event));
    expect(restored.segments[0].audioRole).toBe('custom:우리반 노래');
  });

  it('예전에 보낸 v1 링크도 그대로 열린다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '옛 링크입니다.';
    // v1은 행사 객체를 통째로 JSON으로 만들어 압축했다.
    const v1 = compressToEncodedURIComponent(JSON.stringify(event));

    const restored = decodeScenario(v1);
    expect(restored.title).toBe(event.title);
    expect(restored.segments[0].script).toBe('옛 링크입니다.');
    expect(restored.segments).toHaveLength(event.segments.length);
  });

  it('배열도 객체도 아닌 값은 오류를 던진다', () => {
    const notEvent = compressToEncodedURIComponent(JSON.stringify(42));
    expect(() => decodeScenario(notEvent)).toThrow('시나리오를 읽을 수 없습니다.');
  });

  it('칸이 모자란 v2 배열은 오류를 던진다', () => {
    const broken = compressToEncodedURIComponent(JSON.stringify([2, '제목']));
    expect(() => decodeScenario(broken)).toThrow('시나리오를 읽을 수 없습니다.');
  });
});
