import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Onboarding from './Onboarding';
import { clearDb } from '../../db/testUtils';
import { saveProfile } from '../../db/profileRepo';
import { putAudio } from '../../db/audioRepo';
import { getSettings, saveSettings } from '../../db/settingsRepo';

async function seedProfile() {
  await saveProfile({
    id: 'singleton',
    schoolName: '햇살초등학교',
    principal: { title: '교장', name: '김한빛' },
    vicePrincipal: null,
    foundedDate: null,
    updatedAt: 1,
  });
}

async function seedAudio() {
  await putAudio({
    id: 'a1',
    role: 'anthem',
    label: '애국가',
    data: new ArrayBuffer(8),
    mimeType: 'audio/mpeg',
    durationSec: 69,
    fileName: '애국가.mp3',
    addedAt: 1,
  });
}

function show() {
  render(
    <MemoryRouter>
      <Onboarding />
    </MemoryRouter>,
  );
}

describe('Onboarding', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('백지 상태에서는 무엇부터 할지 알려 준다', async () => {
    show();
    expect(await screen.findByTestId('onboarding')).toBeInTheDocument();
  });

  it('자료가 이 기기에만 담긴다는 것을 알려 준다', async () => {
    show();
    expect(await screen.findByTestId('onboarding')).toHaveTextContent('이 기기 안에만');
  });

  it('끝낸 걸음에는 표시가 붙는다', async () => {
    await seedProfile();
    show();
    expect(await screen.findByTestId('step-profile')).toHaveTextContent('✅');
  });

  it('아직 안 한 걸음은 비어 있다', async () => {
    await seedProfile();
    show();
    expect(await screen.findByTestId('step-audio')).toHaveTextContent('⬜');
  });

  // AI는 없어도 멘트를 직접 쓰고 행사를 진행할 수 있다.
  it('AI 연결은 건너뛰어도 된다고 알려 준다', async () => {
    show();
    expect(await screen.findByTestId('step-ai')).toHaveTextContent('건너뛰어도 됩니다');
  });

  it('꼭 필요한 걸음을 다 끝내면 사라진다', async () => {
    await seedProfile();
    await seedAudio();
    show();
    // AI 키는 여전히 비어 있지만 그것만으로는 붙잡지 않는다.
    await expect(screen.findByTestId('onboarding')).rejects.toThrow();
  });

  describe('나중에 하기', () => {
    it('누르면 사라진다', async () => {
      show();
      await userEvent.click(await screen.findByRole('button', { name: '나중에 하기' }));
      expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument();
    });

    it('다시 열어도 나오지 않는다', async () => {
      show();
      await userEvent.click(await screen.findByRole('button', { name: '나중에 하기' }));
      expect((await getSettings()).onboardingDismissed).toBe(true);
    });

    // 닫아 둔 것을 되살리면서 API 키 같은 다른 설정을 날리면 안 된다.
    it('닫아도 다른 설정은 그대로 둔다', async () => {
      await saveSettings({ ...(await getSettings()), geminiApiKey: 'AIza-테스트' });
      show();
      await userEvent.click(await screen.findByRole('button', { name: '나중에 하기' }));
      expect((await getSettings()).geminiApiKey).toBe('AIza-테스트');
    });
  });

  it('이미 닫아 둔 사람에게는 나오지 않는다', async () => {
    await saveSettings({ ...(await getSettings()), onboardingDismissed: true });
    show();
    await expect(screen.findByTestId('onboarding')).rejects.toThrow();
  });
});
