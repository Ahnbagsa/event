export type MediaKind = 'audio' | 'video';

/**
 * 저장된 자료가 음원인지 동영상인지 mimeType으로 판정한다.
 *
 * AudioAsset에 종류를 함께 저장하지 않는 이유가 있다. 이 앱은 이미 기기마다
 * IndexedDB에 음원을 담고 있고, 거기에는 종류 칸이 없다. 저장할 때 정해 두면
 * 예전에 넣어 둔 음원이 전부 종류 없는 상태가 되어 마이그레이션이 필요하다.
 * 읽을 때 판정하면 예전 자료가 그대로 열린다.
 */
export function mediaKindOf(mimeType: string): MediaKind {
  return mimeType.startsWith('video/') ? 'video' : 'audio';
}

export function isVideo(mimeType: string): boolean {
  return mediaKindOf(mimeType) === 'video';
}

/** 파일 고르기 창에 넘길 허용 목록. */
export const MEDIA_ACCEPT =
  'audio/*,video/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.flac,.opus,.mp4,.m4v,.webm,.mov';
