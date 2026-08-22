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
  onboardingDismissed: false,
};

export async function getSettings(): Promise<AppSettings> {
  const db = await openHbDb();
  const stored = await db.get('settings', 'singleton');
  if (stored !== undefined) return stored;
  // DEFAULT_SETTINGS는 모듈 상수다. 그대로 돌려주면 호출자가 손댈 때 상수가 오염되고
  // 그 뒤의 모든 호출이 오염된 값을 받는다. 배열까지 새로 만들어 복사본을 준다.
  return { ...DEFAULT_SETTINGS, discoveredModels: [] };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await openHbDb();
  await db.put('settings', settings);
}
