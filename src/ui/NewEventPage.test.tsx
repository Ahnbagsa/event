import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { clearDb } from '../db/testUtils';
import { listEvents } from '../db/eventRepo';
import NewEventPage from './NewEventPage';

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/new']}>
      <NewEventPage />
    </MemoryRouter>,
  );
}

describe('NewEventPage', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('개학식 템플릿을 고를 수 있다', async () => {
    renderPage();
    expect(await screen.findByLabelText('행사 종류')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '개학식 · 방학식' })).toBeInTheDocument();
  });

  it('대면과 방송을 고를 수 있다', async () => {
    renderPage();
    expect(await screen.findByLabelText('강당 등에서 대면 진행')).toBeInTheDocument();
    expect(screen.getByLabelText('교실 방송으로 진행')).toBeInTheDocument();
  });

  it('제목이 비면 만들 수 없다', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: '행사 만들기' }));

    expect(await screen.findByText('행사 제목을 입력해 주세요.')).toBeInTheDocument();
    expect(await listEvents()).toHaveLength(0);
  });

  it('행사를 만들어 저장한다', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('행사 제목'), '2학기 개학식');
    await user.click(screen.getByLabelText('교실 방송으로 진행'));
    await user.click(screen.getByRole('button', { name: '행사 만들기' }));

    await waitFor(async () => {
      const events = await listEvents();
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('2학기 개학식');
      expect(events[0].mode).toBe('broadcast');
      expect(events[0].segments).toHaveLength(7);
    });
  });
});
