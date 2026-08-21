import { describe, it, expect } from 'vitest';
import { buildOutlineInstruction } from './prompts';
import type { SchoolProfile } from '../types';

const profile: SchoolProfile = {
  id: 'singleton',
  schoolName: '한빛초등학교',
  principal: { title: '교장', name: '김철수' },
  vicePrincipal: null,
  foundedDate: null,
  updatedAt: 1,
};

describe('buildOutlineInstruction', () => {
  it('학교 정보를 프롬프트에 담는다', () => {
    const instruction = buildOutlineInstruction(profile);
    expect(instruction).toContain('한빛초등학교');
    expect(instruction).toContain('김철수');
  });

  it('없는 값을 지어내지 말라고 지시한다', () => {
    expect(buildOutlineInstruction(profile)).toContain('지어내지');
  });

  it('프로필이 없어도 프롬프트를 만든다', () => {
    expect(buildOutlineInstruction(null)).toContain('지어내지');
  });

  it('허용된 순서 종류를 명시한다', () => {
    const instruction = buildOutlineInstruction(profile);
    for (const kind of ['speech', 'audio', 'timer', 'address']) {
      expect(instruction).toContain(kind);
    }
  });
});
