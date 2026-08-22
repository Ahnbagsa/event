import { describe, it, expect } from 'vitest';
import { mediaKindOf, isVideo, MEDIA_ACCEPT } from './mediaKind';
import { guessAudioMime } from '../audio/mimeFromName';

describe('mediaKindOf', () => {
  it.each(['video/mp4', 'video/webm', 'video/quicktime'])('%s 는 동영상이다', (mime) => {
    expect(mediaKindOf(mime)).toBe('video');
  });

  it.each(['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg'])('%s 는 음원이다', (mime) => {
    expect(mediaKindOf(mime)).toBe('audio');
  });

  // 예전에 저장해 둔 자료에는 종류 칸이 없다. 알 수 없으면 음원으로 본다.
  it('모르는 종류는 음원으로 본다', () => {
    expect(mediaKindOf('')).toBe('audio');
    expect(mediaKindOf('application/octet-stream')).toBe('audio');
  });

  it('isVideo는 같은 판정을 짧게 준다', () => {
    expect(isVideo('video/mp4')).toBe(true);
    expect(isVideo('audio/mpeg')).toBe(false);
  });

  it('파일 고르기가 음원과 동영상을 모두 받는다', () => {
    expect(MEDIA_ACCEPT).toContain('audio/*');
    expect(MEDIA_ACCEPT).toContain('video/*');
    expect(MEDIA_ACCEPT).toContain('.mp4');
  });
});

describe('guessAudioMime과 이어 붙였을 때', () => {
  it.each([
    ['교가영상.mp4', 'video'],
    ['교가영상.MP4', 'video'],
    ['a.webm', 'video'],
    ['아이폰녹화.mov', 'video'],
    ['애국가.mp3', 'audio'],
    ['교가.m4a', 'audio'],
  ])('%s 는 %s 로 이어진다', (fileName, kind) => {
    expect(mediaKindOf(guessAudioMime(fileName, ''))).toBe(kind);
  });

  // 아이폰은 소리만 담은 .m4a를 video/mp4로 보고한다. 그 말을 그대로 믿으면
  // 소리뿐인 파일에 동영상 화면이 붙어 검은 네모가 뜬다.
  it('아이폰이 m4a를 video/mp4라고 해도 음원으로 본다', () => {
    expect(mediaKindOf(guessAudioMime('교가.m4a', 'video/mp4'))).toBe('audio');
  });

  it('확장자까지 동영상이면 보고한 종류를 그대로 쓴다', () => {
    expect(guessAudioMime('교가영상.mp4', 'video/mp4')).toBe('video/mp4');
  });

  it('브라우저가 음원이라고 하면 그 말이 가장 세다', () => {
    expect(guessAudioMime('이상한이름.mp4', 'audio/mpeg')).toBe('audio/mpeg');
  });
});
