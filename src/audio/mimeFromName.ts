// 안드로이드 파일 관리자와 카카오톡이 내려받은 mp3는 종류를 application/octet-stream으로
// 보고하는 일이 잦다. 그 값을 그대로 믿으면 재생 길이를 재지 못해 등록이 실패한다.
const BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
};

const FALLBACK = 'audio/mpeg';

export function guessAudioMime(fileName: string, reportedType: string): string {
  if (reportedType.startsWith('audio/')) return reportedType;

  const parts = fileName.toLowerCase().split('.');
  if (parts.length > 1) {
    const found = BY_EXTENSION[parts[parts.length - 1]];
    if (found !== undefined) return found;
  }

  // 확장자도 모르면 mp3로 본다. 대부분 mp3이고, 틀렸다면 재생 시도에서 걸러진다.
  return FALLBACK;
}
