import { mediaKindOf, type MediaKind } from '../media/mediaKind';

type MetadataReader = {
  duration: number;
  onloadedmetadata: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
};

/**
 * new Audio()는 동영상의 길이를 읽지 못한다. 종류에 맞는 요소를 만든다.
 * 화면에 붙이지 않아도 메타데이터는 읽힌다.
 */
function createReader(kind: MediaKind): MetadataReader {
  return kind === 'video'
    ? (document.createElement('video') as unknown as MetadataReader)
    : (new Audio() as unknown as MetadataReader);
}

/**
 * 브라우저가 성공도 실패도 알려주지 않고 잠자코 있는 파일이 있다. 실제로 겪었다.
 * 그러면 화면이 "읽는 중…"에 영영 멈추고 사용자는 빠져나갈 길이 없다.
 * 넉넉히 기다린 뒤 실패로 끊는다.
 */
const TIMEOUT_MS = 20_000;

export function readAudioDuration(
  data: ArrayBuffer,
  mimeType: string,
  create: (kind: MediaKind) => MetadataReader = createReader,
): Promise<number> {
  const kind = mediaKindOf(mimeType);
  const cannotRead = () =>
    new Error(kind === 'video' ? '동영상 파일을 읽을 수 없습니다.' : '음원 파일을 읽을 수 없습니다.');

  return new Promise((resolve, reject) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const element = create(kind);

    let settled = false;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      run();
    };

    const timer = setTimeout(() => finish(() => reject(cannotRead())), TIMEOUT_MS);

    element.onloadedmetadata = () => {
      const seconds = element.duration;
      finish(() => resolve(Number.isFinite(seconds) ? seconds : 0));
    };
    element.onerror = () => finish(() => reject(cannotRead()));

    element.src = url;
  });
}
