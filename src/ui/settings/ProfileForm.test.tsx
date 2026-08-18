import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearDb } from '../../db/testUtils';
import { getProfile, saveProfile } from '../../db/profileRepo';
import ProfileForm from './ProfileForm';

describe('ProfileForm', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('입력한 값을 저장한다', async () => {
    const user = userEvent.setup();
    render(<ProfileForm />);

    await user.type(await screen.findByLabelText('학교명'), '한빛초등학교');
    await user.type(screen.getByLabelText('교장 성함'), '김철수');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(async () => {
      const saved = await getProfile();
      expect(saved?.schoolName).toBe('한빛초등학교');
      expect(saved?.principal.name).toBe('김철수');
    });
  });

  it('저장된 프로필을 불러와 보여준다', async () => {
    await saveProfile({
      id: 'singleton',
      schoolName: '새빛초등학교',
      principal: { title: '교장', name: '이영희' },
      vicePrincipal: null,
      foundedDate: null,
      updatedAt: 1,
    });

    render(<ProfileForm />);
    expect(await screen.findByDisplayValue('새빛초등학교')).toBeInTheDocument();
    expect(screen.getByDisplayValue('이영희')).toBeInTheDocument();
  });

  it('학교명이 비어 있으면 저장할 수 없다', async () => {
    const user = userEvent.setup();
    render(<ProfileForm />);

    await user.click(await screen.findByRole('button', { name: '저장' }));

    expect(await screen.findByText('학교명을 입력해 주세요.')).toBeInTheDocument();
    expect(await getProfile()).toBeNull();
  });
});
