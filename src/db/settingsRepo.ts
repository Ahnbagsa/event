import { openHbDb } from './schema';
import type { AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'singleton',
  geminiApiKey: '',
  apiVersion: 'v1beta',
  selectedModel: null,
  modelPinnedByUser: false,
  discoveredModels: [],
  discoveredAt: null,
  fontScale: 1,
  theme: 'dark',
};

export async function getSettings(): Promise<AppSettings> {
  const db = await openHbDb();
  return (await db.get('settings', 'singleton')) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await openHbDb();
  await db.put('settings', settings);
}
