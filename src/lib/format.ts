export function formatDuration(seconds: number): string {
  const total = Math.ceil(seconds);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (min === 0) return `${sec}초`;
  if (sec === 0) return `${min}분`;
  return `${min}분 ${sec}초`;
}
