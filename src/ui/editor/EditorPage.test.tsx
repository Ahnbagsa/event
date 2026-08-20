import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { getEvent, putEvent } from '../../db/eventRepo';
import { createEventFromTemplate } from '../../domain/templates';
import EditorPage from './EditorPage';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

async function renderEditor() {
  const event = createEventFromTemplate('semester-opening', init);
  await putEvent(event);
  render(
    <MemoryRouter initialEntries={[`/event/${event.id}/edit`]}>
      <Routes>
        <Route path="/event/:eventId/edit" element={<EditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return event;
}

describe('EditorPage', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('행사 제목과 순서 목록을 보여준다', async () => {
    await renderEditor();
    expect(await screen.findByText('2학기 개학식')).toBeInTheDocument();
    expect(screen.getByText('개식사')).toBeInTheDocument();
    expect(screen.getByText('교가 제창')).toBeInTheDocument();
  });

  it('총 예상 시간을 보여준다', async () => {
    await renderEditor();
    expect(await screen.findByTestId('total-time')).toHaveTextContent('예상');
  });

  it('멘트를 고치면 저장한다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();

    const card = await screen.findByTestId(`card-${event.segments[0].id}`);
    await user.click(within(card).getByRole('button', { name: '펼치기' }));
    await user.type(
      within(card).getByLabelText('사회자 멘트'),
      '개학식을 시작하겠습니다.',
    );
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(async () => {
      const saved = await getEvent(event.id);
      expect(saved?.segments[0].script).toBe('개학식을 시작하겠습니다.');
    });
  });

  it('순서를 위로 올릴 수 있다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();

    const card = await screen.findByTestId(`card-${event.segments[1].id}`);
    await user.click(within(card).getByRole('button', { name: '위로' }));

    const names = screen.getAllByTestId('segment-name').map((el) => el.textContent);
    expect(names[0]).toBe('국기에 대한 경례');
    expect(names[1]).toBe('개식사');
  });

  it('순서를 삭제할 수 있다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();

    const card = await screen.findByTestId(`card-${event.segments[0].id}`);
    await user.click(within(card).getByRole('button', { name: '삭제' }));

    expect(screen.queryByText('개식사')).not.toBeInTheDocument();
  });

  it('빈칸이 있으면 개수를 경고한다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();

    const card = await screen.findByTestId(`card-${event.segments[0].id}`);
    await user.click(within(card).getByRole('button', { name: '펼치기' }));
    await user.type(within(card).getByLabelText('사회자 멘트'), '{{{{학교명}} 개학식');

    expect(await screen.findByTestId('blank-warning')).toHaveTextContent('채워야 할 빈칸 1곳');
  });

  it('표준 순서를 골라 맨 끝에 넣을 수 있다', async () => {
    const user = userEvent.setup();
    await renderEditor();

    await user.click(await screen.findByRole('button', { name: '＋ 순서 추가' }));
    await user.click(await screen.findByRole('button', { name: '전달 사항' }));

    const names = screen.getAllByTestId('segment-name').map((el) => el.textContent);
    expect(names).toHaveLength(8);
    expect(names.at(-1)).toBe('전달 사항');
  });

  it('추가한 전달 사항은 말씀 종류로 들어간다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();

    await user.click(await screen.findByRole('button', { name: '＋ 순서 추가' }));
    await user.click(await screen.findByRole('button', { name: '전달 사항' }));
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(async () => {
      const saved = await getEvent(event.id);
      const added = saved?.segments.at(-1);
      expect(added?.kind).toBe('address');
      expect(added?.manualDurationSec).toBe(120);
    });
  });

  it('순서 추가 목록을 다시 눌러 닫을 수 있다', async () => {
    const user = userEvent.setup();
    await renderEditor();

    const toggle = await screen.findByRole('button', { name: '＋ 순서 추가' });
    await user.click(toggle);
    expect(screen.getByRole('button', { name: '전달 사항' })).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByRole('button', { name: '전달 사항' })).not.toBeInTheDocument();
  });
});
