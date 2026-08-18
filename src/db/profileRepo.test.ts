import { describe, it, expect, beforeEach } from 'vitest';
import { clearDb } from './testUtils';
import { getProfile, saveProfile } from './profileRepo';
import type { SchoolProfile } from '../types';

const sample: SchoolProfile = {
  id: 'singleton',
  schoolName: '한빛초등학교',
  principal: { title: '교장', name: '김철수' },
  vicePrincipal: null,
  foundedDate: null,
  updatedAt: 1,
};

describe('profileRepo', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('저장 전에는 null을 돌려준다', async () => {
    expect(await getProfile()).toBeNull();
  });

  it('저장한 프로필을 그대로 읽는다', async () => {
    await saveProfile(sample);
    expect(await getProfile()).toEqual(sample);
  });

  it('다시 저장하면 덮어쓴다', async () => {
    await saveProfile(sample);
    await saveProfile({ ...sample, schoolName: '새빛초등학교', updatedAt: 2 });
    const got = await getProfile();
    expect(got?.schoolName).toBe('새빛초등학교');
  });
});
