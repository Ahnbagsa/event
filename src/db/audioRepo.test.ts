import { describe, it, expect, beforeEach } from 'vitest';
import { clearDb } from './testUtils';
import { putAudio, listAudio, getAudioByRole, deleteAudio, getAvailableRoles } from './audioRepo';
import type { AudioAsset, AudioRole } from '../types';

function makeAsset(id: string, role: AudioRole): AudioAsset {
  return {
    id,
    role,
    label: `${role} 음원`,
    data: new ArrayBuffer(16),
    mimeType: 'audio/mpeg',
    durationSec: 60,
    fileName: `${id}.mp3`,
    addedAt: 1,
  };
}

describe('audioRepo', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('저장한 음원을 역할로 찾는다', async () => {
    await putAudio(makeAsset('a1', 'anthem'));
    const found = await getAudioByRole('anthem');
    expect(found?.id).toBe('a1');
    expect(found?.data.byteLength).toBe(16);
  });

  it('등록되지 않은 역할은 null이다', async () => {
    expect(await getAudioByRole('schoolSong')).toBeNull();
  });

  // 예전에는 같은 역할의 다른 음원을 지웠다. 그래서 개학식은 1절 졸업식은 1~4절처럼
  // 행사마다 다르게 쓸 수 없었다. 이제 둘 다 갖고, 나중에 넣은 것이 기본이 된다.
  it('같은 역할을 다시 저장해도 앞의 것을 지우지 않는다', async () => {
    await putAudio(makeAsset('a1', 'anthem'));
    await putAudio(makeAsset('a2', 'anthem'));
    expect(await listAudio()).toHaveLength(2);
  });

  it('나중에 넣은 것이 그 역할의 기본이 된다', async () => {
    await putAudio(makeAsset('a1', 'anthem'));
    await putAudio(makeAsset('a2', 'anthem'));
    expect((await getAudioByRole('anthem'))?.id).toBe('a2');
  });

  it('기본 표시는 한 역할에 하나뿐이다', async () => {
    await putAudio(makeAsset('a1', 'anthem'));
    await putAudio(makeAsset('a2', 'anthem'));
    const marked = (await listAudio()).filter((a) => a.isDefault === true);
    expect(marked.map((a) => a.id)).toEqual(['a2']);
  });

  it('삭제하면 목록에서 사라진다', async () => {
    await putAudio(makeAsset('a1', 'anthem'));
    await deleteAudio('a1');
    expect(await listAudio()).toHaveLength(0);
  });

  it('등록된 역할 집합을 돌려준다', async () => {
    await putAudio(makeAsset('a1', 'anthem'));
    await putAudio(makeAsset('a2', 'schoolSong'));
    const roles = await getAvailableRoles();
    expect(roles.has('anthem')).toBe(true);
    expect(roles.has('schoolSong')).toBe(true);
    expect(roles.has('silence')).toBe(false);
  });
});
