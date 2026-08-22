import { describe, it, expect, vi } from 'vitest';
import { fetchLibraryTrack } from './fetchLibraryTrack';
import { parseLibrary } from './library';

const [track] = parseLibrary({
  tracks: [
    {
      id: 'anthem-band-1',
      role: 'anthem',
      label: '애국가 1절 (관악 반주)',
      file: 'anthem-band-1.mp3',
      credit: '교육부 배포본',
      durationSec: 69,
    },
  ],
});

function okResponse(contentType = 'audio/mpeg'): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => contentType },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  } as unknown as Response;
}

function deps(over: Partial<Parameters<typeof fetchLibraryTrack>[1]> = {}) {
  return {
    fetchFn: vi.fn().mockResolvedValue(okResponse()),
    readDuration: vi.fn().mockResolvedValue(68.5),
    baseUrl: 'https://ahnbagsa.github.io/event/',
    now: () => 1_700_000_000_000,
    makeId: () => 'audio_test',
    ...over,
  };
}

describe('fetchLibraryTrack', () => {
  it('audio 폴더에서 파일을 받아온다', async () => {
    const d = deps();
    await fetchLibraryTrack(track, d);
    expect(d.fetchFn).toHaveBeenCalledWith(
      'https://ahnbagsa.github.io/event/audio/anthem-band-1.mp3',
    );
  });

  it('올려 둔 음원과 똑같은 모양으로 만든다', async () => {
    const asset = await fetchLibraryTrack(track, deps());
    expect(asset).toMatchObject({
      id: 'audio_test',
      role: 'anthem',
      label: '애국가 1절 (관악 반주)',
      mimeType: 'audio/mpeg',
      fileName: 'anthem-band-1.mp3',
      addedAt: 1_700_000_000_000,
    });
    expect(asset.data.byteLength).toBe(8);
  });

  // 목록의 durationSec은 사람이 손으로 적은 값이라 틀릴 수 있다.
  // 시간 계산과 진행 화면이 이 값에 기대므로 파일에서 다시 잰다.
  it('길이는 손으로 적은 값이 아니라 파일에서 잰다', async () => {
    const asset = await fetchLibraryTrack(track, deps());
    expect(asset.durationSec).toBe(68.5);
  });

  it('길이를 재지 못하면 목록에 적힌 값으로 대신한다', async () => {
    const asset = await fetchLibraryTrack(
      track,
      deps({ readDuration: vi.fn().mockRejectedValue(new Error('decode 실패')) }),
    );
    // 파일은 멀쩡히 받았으니 저장은 되어야 한다. 길이만 대략으로 둔다.
    expect(asset.durationSec).toBe(69);
  });

  it('길이도 못 재고 적힌 값도 없으면 0으로 둔다', async () => {
    const noDuration = { ...track, durationSec: null };
    const asset = await fetchLibraryTrack(
      noDuration,
      deps({ readDuration: vi.fn().mockRejectedValue(new Error('decode 실패')) }),
    );
    expect(asset.durationSec).toBe(0);
  });

  it('서버가 알려 준 종류가 없으면 파일 이름으로 본다', async () => {
    const asset = await fetchLibraryTrack(track, deps({
      fetchFn: vi.fn().mockResolvedValue(okResponse('application/octet-stream')),
    }));
    expect(asset.mimeType).toBe('audio/mpeg');
  });

  // 이쪽은 삼키지 않는다. 사용자가 고르기를 눌렀는데 아무 일도 안 일어나면
  // 눌린 건지 아닌지조차 알 수 없다. 화면이 한국어로 알려 줄 수 있게 던진다.
  it('파일이 없으면 한국어로 알린다', async () => {
    const d = deps({ fetchFn: vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response) });
    await expect(fetchLibraryTrack(track, d)).rejects.toThrow(/받지 못했습니다/);
  });

  it('인터넷이 끊겨 있으면 한국어로 알린다', async () => {
    const d = deps({ fetchFn: vi.fn().mockRejectedValue(new Error('offline')) });
    await expect(fetchLibraryTrack(track, d)).rejects.toThrow(/인터넷/);
  });
});

// 실제로 겪은 일이다. 파일이 없을 때 개발 서버가 404 대신 index.html을 200으로
// 돌려줬다. ok만 믿으면 그 HTML을 음원이라며 기기에 저장하게 된다.
describe('파일 대신 웹페이지가 오면', () => {
  function htmlResponse(): Response {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(4096)),
    } as unknown as Response;
  }

  it('저장하지 않고 한국어로 알린다', async () => {
    const d = deps({ fetchFn: vi.fn().mockResolvedValue(htmlResponse()) });
    await expect(fetchLibraryTrack(track, d)).rejects.toThrow(/올라와 있지 않습니다/);
  });

  it('무엇을 하면 되는지 알려 준다', async () => {
    const d = deps({ fetchFn: vi.fn().mockResolvedValue(htmlResponse()) });
    await expect(fetchLibraryTrack(track, d)).rejects.toThrow(/직접 파일을 올려/);
  });
});
