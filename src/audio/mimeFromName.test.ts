import { describe, it, expect } from 'vitest';
import { guessAudioMime } from './mimeFromName';

describe('guessAudioMime', () => {
  it('브라우저가 제대로 알려주면 그대로 쓴다', () => {
    expect(guessAudioMime('애국가.mp3', 'audio/mpeg')).toBe('audio/mpeg');
    expect(guessAudioMime('교가.m4a', 'audio/mp4')).toBe('audio/mp4');
  });

  it('종류를 모른다고 하면 확장자로 정한다', () => {
    expect(guessAudioMime('애국가.mp3', '')).toBe('audio/mpeg');
    expect(guessAudioMime('애국가.mp3', 'application/octet-stream')).toBe('audio/mpeg');
  });

  it('주요 확장자를 알아본다', () => {
    expect(guessAudioMime('a.m4a', '')).toBe('audio/mp4');
    expect(guessAudioMime('a.aac', '')).toBe('audio/aac');
    expect(guessAudioMime('a.wav', '')).toBe('audio/wav');
    expect(guessAudioMime('a.ogg', '')).toBe('audio/ogg');
    expect(guessAudioMime('a.oga', '')).toBe('audio/ogg');
    expect(guessAudioMime('a.opus', '')).toBe('audio/ogg');
    expect(guessAudioMime('a.flac', '')).toBe('audio/flac');
  });

  it('대문자 확장자도 알아본다', () => {
    expect(guessAudioMime('애국가.MP3', '')).toBe('audio/mpeg');
  });

  it('점이 여러 개여도 마지막 확장자를 본다', () => {
    expect(guessAudioMime('2026.개학식.교가.wav', '')).toBe('audio/wav');
  });

  it('확장자를 모르면 mp3로 본다', () => {
    expect(guessAudioMime('음원', '')).toBe('audio/mpeg');
    expect(guessAudioMime('음원.xyz', 'application/octet-stream')).toBe('audio/mpeg');
  });

  it('video/로 보고된 mp4 음원도 확장자로 되돌린다', () => {
    expect(guessAudioMime('교가.m4a', 'video/mp4')).toBe('audio/mp4');
  });
});

// 실제로 겪은 일이다. GitHub Pages는 mp3를 audio/mpeg가 아니라 audio/mp3로 알려준다.
// 개발 서버는 audio/mpeg를 줘서 배포 전까지 드러나지 않았다. 비표준 이름을 그대로
// 저장해 두면 나중에 그 이름으로 Blob을 만들게 되고, 브라우저에 따라 받아주지 않는다.
describe('서버가 비표준 이름으로 알려줄 때', () => {
  it.each([
    ['audio/mp3', 'audio/mpeg'],
    ['audio/mpeg3', 'audio/mpeg'],
    ['audio/x-mp3', 'audio/mpeg'],
    ['audio/x-mpeg', 'audio/mpeg'],
    ['audio/x-m4a', 'audio/mp4'],
    ['audio/wave', 'audio/wav'],
    ['audio/x-wav', 'audio/wav'],
    ['audio/x-flac', 'audio/flac'],
  ])('%s 를 %s 로 바로잡는다', (reported, expected) => {
    expect(guessAudioMime('a.mp3', reported)).toBe(expected);
  });

  it('대문자로 와도 바로잡는다', () => {
    expect(guessAudioMime('a.mp3', 'AUDIO/MP3')).toBe('audio/mpeg');
  });

  it('뒤에 붙은 부가 정보를 떼어낸다', () => {
    expect(guessAudioMime('a.mp3', 'audio/mp3; charset=binary')).toBe('audio/mpeg');
  });

  it('표준 이름은 그대로 둔다', () => {
    expect(guessAudioMime('a.mp3', 'audio/mpeg')).toBe('audio/mpeg');
    expect(guessAudioMime('a.ogg', 'audio/ogg')).toBe('audio/ogg');
  });

  it('별칭을 바로잡아도 m4a는 여전히 음원이다', () => {
    expect(guessAudioMime('교가.m4a', 'video/mp4')).toBe('audio/mp4');
  });
});
