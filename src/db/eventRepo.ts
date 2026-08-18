import { openHbDb } from './schema';
import type { EventCeremony } from '../types';

export async function listEvents(): Promise<EventCeremony[]> {
  const db = await openHbDb();
  const all = await db.getAllFromIndex('events', 'updatedAt');
  return all.reverse();
}

export async function getEvent(id: string): Promise<EventCeremony | null> {
  const db = await openHbDb();
  return (await db.get('events', id)) ?? null;
}

export async function putEvent(event: EventCeremony): Promise<void> {
  const db = await openHbDb();
  await db.put('events', event);
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await openHbDb();
  await db.delete('events', id);
}
