import { describe, it, expect } from 'vitest';
import { extractJson } from './jsonParser';

describe('extractJson', () => {
  it('순수 JSON을 읽는다', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('앞뒤 공백을 견딘다', () => {
    expect(extractJson('  \n {"a":1} \n ')).toEqual({ a: 1 });
  });

  it('코드펜스를 벗겨낸다', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('언어 표시 없는 코드펜스도 벗겨낸다', () => {
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('앞뒤 설명 문장을 무시한다', () => {
    expect(extractJson('요청하신 결과입니다.\n{"a":1}\n도움이 되었길 바랍니다.')).toEqual({ a: 1 });
  });

  it('중첩된 객체를 온전히 읽는다', () => {
    expect(extractJson('앞말 {"a":{"b":[1,2]}} 뒷말')).toEqual({ a: { b: [1, 2] } });
  });

  it('배열도 읽는다', () => {
    expect(extractJson('```json\n[1,2,3]\n```')).toEqual([1, 2, 3]);
  });

  it('JSON이 없으면 한국어 오류를 던진다', () => {
    expect(() => extractJson('그냥 문장입니다')).toThrow('AI 응답을 이해할 수 없습니다.');
  });

  it('깨진 JSON도 한국어 오류를 던진다', () => {
    expect(() => extractJson('{"a":')).toThrow('AI 응답을 이해할 수 없습니다.');
  });

  it('빈 문자열도 오류를 던진다', () => {
    expect(() => extractJson('')).toThrow('AI 응답을 이해할 수 없습니다.');
  });
});
