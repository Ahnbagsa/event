import { describe, it, expect, beforeEach } from 'vitest';
import { clearDb } from './testUtils';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from './settingsRepo';

describe('settingsRepo', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('저장된 값이 없으면 기본값을 돌려준다', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('기본 테마는 어두운 화면이다', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('dark');
  });

  it('저장한 값을 읽는다', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, geminiApiKey: 'AIza-테스트' });
    expect((await getSettings()).geminiApiKey).toBe('AIza-테스트');
  });

  it('기본값을 돌려줄 때마다 서로 다른 객체를 준다', async () => {
    const first = await getSettings();
    const second = await getSettings();
    expect(first).not.toBe(second);
    expect(first.discoveredModels).not.toBe(DEFAULT_SETTINGS.discoveredModels);
  });
});
