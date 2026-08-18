import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, AudioAsset, EventCeremony, RunState, SchoolProfile } from '../types';

export const DB_NAME = 'haengsa-baksa';
export const DB_VERSION = 1;

export interface HbSchema extends DBSchema {
  profile: { key: string; value: SchoolProfile };
  audio: { key: string; value: AudioAsset; indexes: { role: string } };
  events: { key: string; value: EventCeremony; indexes: { updatedAt: number } };
  settings: { key: string; value: AppSettings };
  runState: { key: string; value: RunState };
}

let dbPromise: Promise<IDBPDatabase<HbSchema>> | null = null;

export function openHbDb(): Promise<IDBPDatabase<HbSchema>> {
  if (dbPromise === null) {
    dbPromise = openDB<HbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('audio')) {
          const store = db.createObjectStore('audio', { keyPath: 'id' });
          store.createIndex('role', 'role');
        }
        if (!db.objectStoreNames.contains('events')) {
          const store = db.createObjectStore('events', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('runState')) {
          db.createObjectStore('runState', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export function resetDbHandleForTests(): void {
  dbPromise = null;
}
