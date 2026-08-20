import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { clearDb } from '../db/testUtils';
import { putEvent, listEvents } from '../db/eventRepo';
import { createEventFromTemplate } from '../domain/templates';
import Home from './Home';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

describe('Home', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('행사가 없으면 안내를 보여준다', async () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(await screen.findByText('아직 만든 행사가 없습니다.')).toBeInTheDocument();
  });

  it('저장된 행사를 목록에 보여준다', async () => {
    await putEvent(createEventFromTemplate('semester-opening', init));
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(await screen.findByText('2학기 개학식')).toBeInTheDocument();
  });

  it('행사를 삭제할 수 있다', async () => {
    const user = userEvent.setup();
    await putEvent(createEventFromTemplate('semester-opening', init));
    render(<MemoryRouter><Home /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: '삭제' }));
    await user.click(await screen.findByRole('button', { name: '정말 삭제' }));

    expect(await listEvents()).toHaveLength(0);
  });
});
