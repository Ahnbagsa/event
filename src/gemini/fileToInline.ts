export const ACCEPTED_PLAN_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

const MAX_BYTES = 20 * 1024 * 1024;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function fileToInline(
  file: File,
): Promise<{ mimeType: string; base64: string }> {
  if (!ACCEPTED_PLAN_TYPES.includes(file.type)) {
    throw new Error(
      '한글(hwp) 파일은 읽을 수 없습니다. 한글에서 "PDF로 저장"한 뒤 그 파일을 넣거나, 내용을 복사해 붙여넣어 주세요.',
    );
  }
  if (file.size > MAX_BYTES) {
    throw new Error('파일이 너무 큽니다. 20MB 이하로 줄여 주세요.');
  }
  return { mimeType: file.type, base64: toBase64(await file.arrayBuffer()) };
}
