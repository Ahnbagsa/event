import { describe, it, expect, vi } from 'vitest';
import { parseLibrary, loadLibrary, tracksForRole, LIBRARY_PATH } from './library';

function json(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const track = {
  id: 'anthem-band-1',
  role: 'anthem',
  label: '애국가 1절 (관악 반주)',
  file: 'anthem-band-1.mp3',
};

describe('parseLibrary', () => {
  it('정상 목록을 읽는다', () => {
    expect(parseLibrary({ version: 1, tracks: [track] })).toEqual([
      { ...track, note: '', credit: '', durationSec: null },
    ]);
  });

  it('note·credit·durationSec을 함께 읽는다', () => {
    const [read] = parseLibrary({
      tracks: [{ ...track, note: '전주 4마디', credit: '교육부 배포본', durationSec: 69 }],
    });
    expect(read.note).toBe('전주 4마디');
    expect(read.credit).toBe('교육부 배포본');
    expect(read.durationSec).toBe(69);
  });

  it('모르는 필드는 무시한다', () => {
    const [read] = parseLibrary({ tracks: [{ ...track, 앞으로생길필드: '값' }] });
    expect(read.id).toBe('anthem-band-1');
  });

  it('같은 역할에 여러 개를 그대로 둔다', () => {
    const two = parseLibrary({
      tracks: [track, { ...track, id: 'anthem-choir', label: '애국가 (합창)' }],
    });
    expect(two).toHaveLength(2);
  });

  // 이 파일은 사람이 손으로 고친다. 한 줄이 잘못되었다고 목록 전체가
  // 사라지면 왜 안 나오는지 알 길이 없다. 잘못된 줄만 건너뛴다.
  it.each([
    ['id가 없으면', { ...track, id: undefined }],
    ['label이 없으면', { ...track, label: '' }],
    ['file이 없으면', { ...track, file: undefined }],
    ['role을 모르면', { ...track, role: '없는역할' }],
    ['줄이 객체가 아니면', '문자열'],
  ])('%s 그 줄만 건너뛴다', (_설명, bad) => {
    expect(parseLibrary({ tracks: [bad, track] })).toHaveLength(1);
  });

  // file은 public/audio/ 안의 파일 이름이어야 한다. 위로 올라가거나
  // 바깥 주소를 가리키면 의도치 않은 곳을 받아오게 된다.
  it.each(['../secret.mp3', '/etc/passwd', 'https://example.com/a.mp3', 'sub/../../x.mp3'])(
    'file이 %s 이면 건너뛴다',
    (file) => {
      expect(parseLibrary({ tracks: [{ ...track, file }] })).toEqual([]);
    },
  );

  it('custom: 으로 시작하는 역할은 받아들인다', () => {
    expect(parseLibrary({ tracks: [{ ...track, role: 'custom:개교기념가' }] })).toHaveLength(1);
  });

  it('durationSec이 숫자가 아니면 null로 둔다', () => {
    expect(parseLibrary({ tracks: [{ ...track, durationSec: '1분' }] })[0].durationSec).toBeNull();
  });

  it.each([[null], [undefined], ['문자열'], [42], [{}], [{ tracks: '배열아님' }], [[]]])(
    '%s 을 받아도 던지지 않고 빈 목록을 준다',
    (bad) => {
      expect(parseLibrary(bad)).toEqual([]);
    },
  );
});

describe('loadLibrary', () => {
  it('앱 뿌리를 기준으로 목록 파일을 찾는다', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ tracks: [track] }));
    await loadLibrary(fetchFn, 'https://ahnbagsa.github.io/event/');
    expect(fetchFn).toHaveBeenCalledWith('https://ahnbagsa.github.io/event/' + LIBRARY_PATH);
  });

  it('찾으면 목록을 준다', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ tracks: [track] }));
    expect(await loadLibrary(fetchFn, 'https://x/')).toHaveLength(1);
  });

  // 음원 파일은 사용자가 나중에 채운다. 아직 없는 동안에도 앱은
  // 지금과 똑같이 동작해야 하므로 어떤 실패도 빈 목록으로 삼킨다.
  it('파일이 없으면 빈 목록을 준다', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(null, false));
    expect(await loadLibrary(fetchFn, 'https://x/')).toEqual([]);
  });

  it('인터넷이 끊겨 있으면 빈 목록을 준다', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await loadLibrary(fetchFn, 'https://x/')).toEqual([]);
  });

  it('JSON이 깨져 있으면 빈 목록을 준다', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('bad json')),
    } as unknown as Response);
    expect(await loadLibrary(fetchFn, 'https://x/')).toEqual([]);
  });
});

describe('tracksForRole', () => {
  const tracks = parseLibrary({
    tracks: [track, { ...track, id: 'anthem-2' }, { ...track, id: 'p1', role: 'pledge' }],
  });

  it('그 역할의 것만 고른다', () => {
    expect(tracksForRole(tracks, 'anthem').map((t) => t.id)).toEqual(['anthem-band-1', 'anthem-2']);
  });

  it('없는 역할이면 빈 목록이다', () => {
    expect(tracksForRole(tracks, 'exit')).toEqual([]);
  });
});
