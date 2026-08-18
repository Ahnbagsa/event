import { openHbDb } from './schema';
import type { AudioAsset, AudioRole } from '../types';

export async function putAudio(asset: AudioAsset): Promise<void> {
  const db = await openHbDb();
  const tx = db.transaction('audio', 'readwrite');
  const index = tx.store.index('role');
  let cursor = await index.openCursor(asset.role);
  while (cursor) {
    if (cursor.value.id !== asset.id) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.store.put(asset);
  await tx.done;
}

export async function listAudio(): Promise<AudioAsset[]> {
  const db = await openHbDb();
  return db.getAll('audio');
}

export async function getAudioByRole(role: AudioRole): Promise<AudioAsset | null> {
  const db = await openHbDb();
  return (await db.getFromIndex('audio', 'role', role)) ?? null;
}

export async function deleteAudio(id: string): Promise<void> {
  const db = await openHbDb();
  await db.delete('audio', id);
}

export async function getAvailableRoles(): Promise<Set<AudioRole>> {
  const all = await listAudio();
  return new Set(all.map((asset) => asset.role));
}
