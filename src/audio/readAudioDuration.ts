export function readAudioDuration(data: ArrayBuffer, mimeType: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const element = new Audio();

    element.onloadedmetadata = () => {
      const seconds = element.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(seconds) ? seconds : 0);
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('음원 파일을 읽을 수 없습니다.'));
    };

    element.src = url;
  });
}
