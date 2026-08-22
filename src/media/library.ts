import { STANDARD_ROLES } from '../audio/roles';
import type { AudioRole } from '../types';

/** 앱 뿌리를 기준으로 한 공용 음원 목록 파일의 위치. */
export const LIBRARY_PATH = 'audio/library.json';

export type LibraryTrack = {
  id: string;
  role: AudioRole;
  label: string;
  /** public/audio/ 안의 파일 이름. 폴더를 벗어날 수 없다. */
  file: string;
  note: string;
  credit: string;
  /** 목록에 보여 줄 대략의 길이. 실제 저장할 때는 파일에서 다시 잰다. */
  durationSec: number | null;
};

const KNOWN_ROLES = new Set<string>(STANDARD_ROLES.map((entry) => entry.role));

function isRole(value: unknown): value is AudioRole {
  if (typeof value !== 'string') return false;
  return KNOWN_ROLES.has(value) || value.startsWith('custom:');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * file은 public/audio/ 안의 파일 이름이어야 한다. 위로 올라가거나 바깥 주소를
 * 가리키면 목록을 고친 사람의 의도와 다른 곳에서 파일을 받아오게 된다.
 */
function isSafeFileName(file: string): boolean {
  if (file === '') return false;
  if (file.startsWith('/') || file.includes('..') || file.includes('\\')) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(file);
}

function parseTrack(raw: unknown): LibraryTrack | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;

  const id = text(row.id);
  const label = text(row.label);
  const file = text(row.file);
  if (id === '' || label === '' || !isSafeFileName(file)) return null;
  if (!isRole(row.role)) return null;

  const durationSec =
    typeof row.durationSec === 'number' && Number.isFinite(row.durationSec)
      ? row.durationSec
      : null;

  return { id, role: row.role, label, file, note: text(row.note), credit: text(row.credit), durationSec };
}

/**
 * 목록을 관대하게 읽는다. 이 파일은 사람이 손으로 고치므로 한 줄이 잘못되었다고
 * 목록 전체를 버리면 왜 안 나오는지 알 길이 없다. 잘못된 줄만 건너뛴다.
 * 어떤 값이 들어와도 던지지 않는다.
 */
export function parseLibrary(raw: unknown): LibraryTrack[] {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const tracks = (raw as Record<string, unknown>).tracks;
  if (!Array.isArray(tracks)) return [];

  return tracks.map(parseTrack).filter((entry): entry is LibraryTrack => entry !== null);
}

/**
 * 목록을 불러온다. 파일이 없거나, 깨졌거나, 인터넷이 끊겨 있어도 던지지 않고
 * 빈 목록을 준다. 음원 파일은 사용자가 나중에 채우는 것이므로 아직 없는
 * 동안에도 앱이 지금과 똑같이 동작해야 한다.
 *
 * HashRouter를 쓰므로 화면을 옮겨 다녀도 document.baseURI는 앱 뿌리에 머문다.
 * 그래서 배포 주소(/event/)에서도 개발 서버에서도 같은 계산이 통한다.
 */
export async function loadLibrary(
  fetchFn: typeof fetch = fetch,
  baseUrl: string = document.baseURI,
): Promise<LibraryTrack[]> {
  try {
    const response = await fetchFn(new URL(LIBRARY_PATH, baseUrl).toString());
    if (!response.ok) return [];
    return parseLibrary(await response.json());
  } catch {
    return [];
  }
}

export function tracksForRole(tracks: LibraryTrack[], role: AudioRole): LibraryTrack[] {
  return tracks.filter((entry) => entry.role === role);
}

/** 목록의 file 이름을 실제로 받아올 주소로 바꾼다. */
export function trackUrl(track: LibraryTrack, baseUrl: string = document.baseURI): string {
  return new URL(`audio/${track.file}`, baseUrl).toString();
}
