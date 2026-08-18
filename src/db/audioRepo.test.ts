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

  it('같은 역할을 다시 저장하면 하나만 남는다', async () => {
    await putAudio(makeAsset('a1', 'anthem'));
    await putAudio(makeAsset('a2', 'anthem'));
    const all = await listAudio();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('a2');
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
