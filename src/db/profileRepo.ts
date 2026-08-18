import { openHbDb } from './schema';
import type { SchoolProfile } from '../types';

export async function getProfile(): Promise<SchoolProfile | null> {
  const db = await openHbDb();
  return (await db.get('profile', 'singleton')) ?? null;
}

export async function saveProfile(profile: SchoolProfile): Promise<void> {
  const db = await openHbDb();
  await db.put('profile', profile);
}
