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
  it('압축했다가 풀면 원본과 같다', () => {
    const event = sampleEvent();
    expect(decodeScenario(encodeScenario(event))).toEqual(event);
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
