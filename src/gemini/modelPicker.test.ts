import { describe, it, expect } from 'vitest';
import { scoreModelName, isUsableModel, pickModels, type RawModel } from './modelPicker';

function raw(name: string, methods = ['generateContent'], outputTokenLimit = 8192): RawModel {
  return {
    name,
    displayName: name,
    supportedGenerationMethods: methods,
    inputTokenLimit: 1000000,
    outputTokenLimit,
  };
}

describe('isUsableModel', () => {
  it('generateContent를 지원하면 쓸 수 있다', () => {
    expect(isUsableModel(raw('models/gemini-2.5-flash'))).toBe(true);
  });

  it('generateContent가 없으면 쓸 수 없다', () => {
    expect(isUsableModel(raw('models/text-embedding-004', ['embedContent']))).toBe(false);
  });

  it('지원 목록이 아예 없으면 쓸 수 없다', () => {
    expect(isUsableModel({ name: 'models/알수없음' })).toBe(false);
  });

  it('임베딩·이미지·영상·음성 모델은 이름만으로도 제외한다', () => {
    expect(isUsableModel(raw('models/embedding-001'))).toBe(false);
    expect(isUsableModel(raw('models/imagen-3.0'))).toBe(false);
    expect(isUsableModel(raw('models/veo-2.0'))).toBe(false);
    expect(isUsableModel(raw('models/gemini-2.5-flash-tts'))).toBe(false);
    expect(isUsableModel(raw('models/aqa'))).toBe(false);
  });
});

describe('scoreModelName', () => {
  it('버전이 높을수록 점수가 높다', () => {
    expect(scoreModelName('models/gemini-2.5-flash')).toBeGreaterThan(
      scoreModelName('models/gemini-1.5-flash'),
    );
  });

  it('같은 버전이면 flash가 pro보다 높다', () => {
    expect(scoreModelName('models/gemini-2.5-flash')).toBeGreaterThan(
      scoreModelName('models/gemini-2.5-pro'),
    );
  });

  it('preview는 크게 감점된다', () => {
    expect(scoreModelName('models/gemini-3.0-flash-preview')).toBeLessThan(
      scoreModelName('models/gemini-2.5-flash'),
    );
  });

  it('experimental도 감점된다', () => {
    expect(scoreModelName('models/gemini-2.5-flash-exp')).toBeLessThan(
      scoreModelName('models/gemini-2.5-flash'),
    );
  });

  it('lite는 소폭 감점된다', () => {
    expect(scoreModelName('models/gemini-2.5-flash-lite')).toBeLessThan(
      scoreModelName('models/gemini-2.5-flash'),
    );
  });

  it('thinking은 감점된다', () => {
    expect(scoreModelName('models/gemini-2.5-flash-thinking')).toBeLessThan(
      scoreModelName('models/gemini-2.5-flash'),
    );
  });

  it('버전 숫자가 없어도 점수를 낸다', () => {
    expect(Number.isFinite(scoreModelName('models/gemini-flash'))).toBe(true);
  });
});

describe('pickModels', () => {
  it('쓸 수 없는 모델을 걸러내고 점수 순으로 정렬한다', () => {
    const picked = pickModels([
      raw('models/gemini-1.5-flash'),
      raw('models/text-embedding-004', ['embedContent']),
      raw('models/gemini-2.5-flash'),
      raw('models/gemini-2.5-pro'),
    ]);

    expect(picked.map((m) => m.name)).toEqual([
      'models/gemini-2.5-flash',
      'models/gemini-2.5-pro',
      'models/gemini-1.5-flash',
    ]);
  });

  it('점수가 같으면 출력 한도가 큰 쪽이 앞선다', () => {
    const picked = pickModels([
      { ...raw('models/gemini-2.5-flash'), outputTokenLimit: 8192 },
      { ...raw('models/gemini-2.5-flash'), outputTokenLimit: 65536 },
    ]);
    expect(picked[0].outputTokenLimit).toBe(65536);
  });

  it('쓸 수 있는 모델이 없으면 빈 배열이다', () => {
    expect(pickModels([raw('models/embedding-001')])).toEqual([]);
  });

  it('빠진 항목은 안전한 기본값으로 채운다', () => {
    const picked = pickModels([{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }]);
    expect(picked[0].displayName).toBe('models/gemini-2.5-flash');
    expect(picked[0].inputTokenLimit).toBe(0);
    expect(picked[0].outputTokenLimit).toBe(0);
  });
});
