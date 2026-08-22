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

export function readAudioDuration(
  data: ArrayBuffer,
  mimeType: string,
  create: (kind: MediaKind) => MetadataReader = createReader,
): Promise<number> {
  const kind = mediaKindOf(mimeType);

  return new Promise((resolve, reject) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const element = create(kind);

    element.onloadedmetadata = () => {
      const seconds = element.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(seconds) ? seconds : 0);
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(kind === 'video' ? '동영상 파일을 읽을 수 없습니다.' : '음원 파일을 읽을 수 없습니다.'));
    };

    element.src = url;
  });
}
