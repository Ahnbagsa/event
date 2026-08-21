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
