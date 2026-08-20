import { openHbDb } from './schema';
import type { RunState } from '../types';

export async function getRunState(): Promise<RunState | null> {
  const db = await openHbDb();
  return (await db.get('runState', 'singleton')) ?? null;
}

export async function saveRunState(state: RunState): Promise<void> {
  const db = await openHbDb();
  await db.put('runState', state);
}

export async function clearRunState(): Promise<void> {
  const db = await openHbDb();
  await db.delete('runState', 'singleton');
}
