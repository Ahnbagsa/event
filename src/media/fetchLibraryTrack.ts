import { trackUrl, type LibraryTrack } from './library';
import { guessAudioMime } from '../audio/mimeFromName';
import { readAudioDuration } from '../audio/readAudioDuration';
import { newId } from '../lib/id';
import type { AudioAsset } from '../types';

export type FetchTrackDeps = {
  fetchFn: typeof fetch;
  readDuration: (data: ArrayBuffer, mimeType: string) => Promise<number>;
  baseUrl: string;
  now: () => number;
  makeId: () => string;
};

export function defaultFetchTrackDeps(): FetchTrackDeps {
  return {
    fetchFn: (...args) => fetch(...args),
    readDuration: readAudioDuration,
    baseUrl: document.baseURI,
    now: () => Date.now(),
    makeId: () => newId('audio'),
  };
}

/**
 * 공용 목록에서 고른 음원을 내려받아, 사용자가 직접 올린 음원과 똑같은 모양의
 * AudioAsset으로 만든다. 스트리밍하지 않고 통째로 받는 이유는 행사 당일 강당에서
 * 인터넷이 끊겨도 재생되어야 하기 때문이다.
 *
 * 받아오기 실패는 삼키지 않고 던진다. 사용자가 고르기를 눌렀는데 아무 일도
 * 일어나지 않으면 눌린 건지조차 알 수 없다.
 */
export async function fetchLibraryTrack(
  track: LibraryTrack,
  deps: FetchTrackDeps,
): Promise<AudioAsset> {
  let response: Response;
  try {
    response = await deps.fetchFn(trackUrl(track, deps.baseUrl));
  } catch {
    throw new Error('인터넷에 연결되어 있는지 확인해 주세요. 음원을 받아오지 못했습니다.');
  }

  if (!response.ok) {
    throw new Error(`${track.label} 파일을 받지 못했습니다. 잠시 후 다시 시도해 주세요.`);
  }

  const reported = response.headers?.get('content-type') ?? '';

  // 파일이 없을 때 웹페이지를 대신 돌려주는 서버가 있다. 상태는 200이라
  // ok만 믿으면 그 HTML을 음원이라며 기기에 저장하게 된다.
  if (reported.startsWith('text/html')) {
    throw new Error(
      `${track.label} 파일이 아직 올라와 있지 않습니다. 직접 파일을 올려 주세요.`,
    );
  }

  const data = await response.arrayBuffer();
  const mimeType = guessAudioMime(track.file, reported);

  // 목록의 durationSec은 사람이 손으로 적은 값이라 믿지 않고 파일에서 다시 잰다.
  // 재지 못해도 파일은 멀쩡히 받았으니 저장은 되어야 한다. 길이만 대략으로 둔다.
  let durationSec: number;
  try {
    durationSec = await deps.readDuration(data, mimeType);
  } catch {
    durationSec = track.durationSec ?? 0;
  }

  return {
    id: deps.makeId(),
    role: track.role,
    label: track.label,
    data,
    mimeType,
    durationSec,
    fileName: track.file,
    addedAt: deps.now(),
  };
}
