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

// 서버와 운영체제마다 같은 것을 다른 이름으로 부른다. GitHub Pages는 mp3를
// audio/mpeg가 아니라 **audio/mp3**로 알려준다(개발 서버는 audio/mpeg라 안 드러난다).
// 이 이름을 그대로 저장해 두면 나중에 재생할 때 비표준 이름으로 Blob을 만들게 되고,
// 브라우저에 따라 받아주지 않을 수 있다. 표준 이름으로 바로잡는다.
const ALIASES: Record<string, string> = {
  'audio/mp3': 'audio/mpeg',
  'audio/mpeg3': 'audio/mpeg',
  'audio/x-mp3': 'audio/mpeg',
  'audio/x-mpeg': 'audio/mpeg',
  'audio/x-mpeg-3': 'audio/mpeg',
  'audio/x-m4a': 'audio/mp4',
  'audio/wave': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-flac': 'audio/flac',
};

/** 종류에 붙은 부가 정보(charset 등)를 떼고 표준 이름으로 바로잡는다. */
function canonical(type: string): string {
  const bare = type.split(';')[0].trim().toLowerCase();
  return ALIASES[bare] ?? bare;
}

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function guessAudioMime(fileName: string, reportedType: string): string {
  const reported = canonical(reportedType);
  if (reported.startsWith('audio/')) return reported;

  const extension = extensionOf(fileName);

  // 아이폰은 소리만 담은 .m4a를 video/mp4로 보고한다. 그래서 video/ 라는 보고를
  // 그대로 믿으면 안 되고, 확장자도 동영상일 때만 받아들인다.
  if (reported.startsWith('video/') && VIDEO_EXTENSIONS.has(extension)) return reported;

  const found = BY_EXTENSION[extension];
  if (found !== undefined) return found;

  // 확장자도 모르면 mp3로 본다. 대부분 mp3이고, 틀렸다면 재생 시도에서 걸러진다.
  return FALLBACK;
}
