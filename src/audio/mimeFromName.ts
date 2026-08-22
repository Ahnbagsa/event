// 안드로이드 파일 관리자와 카카오톡이 내려받은 mp3는 종류를 application/octet-stream으로
// 보고하는 일이 잦다. 그 값을 그대로 믿으면 재생 길이를 재지 못해 등록이 실패한다.
const BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  // .mp4는 대부분 동영상이다. 소리만 담은 것은 .m4a로 오는 것이 관례다.
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'webm', 'mov']);

const FALLBACK = 'audio/mpeg';

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function guessAudioMime(fileName: string, reportedType: string): string {
  if (reportedType.startsWith('audio/')) return reportedType;

  const extension = extensionOf(fileName);

  // 아이폰은 소리만 담은 .m4a를 video/mp4로 보고한다. 그래서 video/ 라는 보고를
  // 그대로 믿으면 안 되고, 확장자도 동영상일 때만 받아들인다.
  if (reportedType.startsWith('video/') && VIDEO_EXTENSIONS.has(extension)) return reportedType;

  const found = BY_EXTENSION[extension];
  if (found !== undefined) return found;

  // 확장자도 모르면 mp3로 본다. 대부분 mp3이고, 틀렸다면 재생 시도에서 걸러진다.
  return FALLBACK;
}
