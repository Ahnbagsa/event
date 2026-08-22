import { openHbDb } from './schema';
import { defaultAssetForRole } from '../audio/audioSource';
import type { AudioAsset, AudioRole } from '../types';

/**
 * 음원을 넣고 그 역할의 **기본 음원**으로 삼는다.
 *
 * 예전에는 같은 역할의 다른 음원을 지웠다. 그래서 기기에 애국가가 언제나 하나뿐이었고,
 * 개학식은 1절 졸업식은 1~4절처럼 행사마다 다르게 쓸 수 없었다.
 * 이제 지우지 않고 기본 표시만 옮긴다. 지우는 것은 사용자가 서랍에서 직접 한다.
 */
export async function putAudio(asset: AudioAsset): Promise<void> {
  const db = await openHbDb();
  const tx = db.transaction('audio', 'readwrite');
  const index = tx.store.index('role');
  let cursor = await index.openCursor(asset.role);
  while (cursor) {
    if (cursor.value.id !== asset.id && cursor.value.isDefault === true) {
      await cursor.update({ ...cursor.value, isDefault: false });
    }
    cursor = await cursor.continue();
  }
  await tx.store.put({ ...asset, isDefault: true });
  await tx.done;
}

/**
 * 음원을 넣되 **기본 음원은 건드리지 않는다.**
 * 한 행사에서만 다른 판본을 쓰려고 받은 것이 온 기기의 기본을 바꿔서는 안 된다.
 */
export async function addAudio(asset: AudioAsset): Promise<void> {
  const db = await openHbDb();
  await db.put('audio', asset);
}

/** 이미 갖고 있는 음원 중 하나를 그 역할의 기본으로 삼는다. */
export async function setDefaultAudio(role: AudioRole, id: string): Promise<void> {
  const db = await openHbDb();
  const tx = db.transaction('audio', 'readwrite');
  const index = tx.store.index('role');
  let cursor = await index.openCursor(role);
  while (cursor) {
    const shouldBe = cursor.value.id === id;
    if ((cursor.value.isDefault === true) !== shouldBe) {
      await cursor.update({ ...cursor.value, isDefault: shouldBe });
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

/** 이 기기에 이미 있는 음원인가. 같은 것을 두 번 받지 않으려고 쓴다. */
export async function findAudioBySourceId(sourceId: string): Promise<AudioAsset | null> {
  const all = await listAudio();
  return all.find((asset) => asset.sourceId === sourceId) ?? null;
}

export async function listAudio(): Promise<AudioAsset[]> {
  const db = await openHbDb();
  return db.getAll('audio');
}

/**
 * 그 역할의 **기본** 음원. 역할당 여러 개를 갖게 되었으므로 색인에서 아무거나
 * 집어오면 안 된다. 어느 것이 기본인지 판정해서 돌려준다.
 */
export async function getAudioByRole(role: AudioRole): Promise<AudioAsset | null> {
  return defaultAssetForRole(await listAudio(), role);
}

export async function deleteAudio(id: string): Promise<void> {
  const db = await openHbDb();
  await db.delete('audio', id);
}

export async function getAvailableRoles(): Promise<Set<AudioRole>> {
  const all = await listAudio();
  return new Set(all.map((asset) => asset.role));
}
