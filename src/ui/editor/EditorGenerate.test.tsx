import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { putEvent } from '../../db/eventRepo';
import { createEventFromTemplate } from '../../domain/templates';
import EditorPage from './EditorPage';

const generateScripts = vi.fn();
const regenerateOne = vi.fn();

vi.mock('../../gemini/generateScripts', () => ({
  generateScripts: (...args: unknown[]) => generateScripts(...args),
  regenerateOne: (...args: unknown[]) => regenerateOne(...args),
}));

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

describe('편집기의 AI 생성', () => {
  beforeEach(async () => {
    await clearDb();
    generateScripts.mockReset();
    regenerateOne.mockReset();
  });

  it('전체 멘트를 생성해 화면에 반영한다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();
    generateScripts.mockResolvedValue(
      event.segments.map((segment, index) =>
        index === 0 ? { ...segment, script: '개학식을 시작하겠습니다.' } : segment,
      ),
    );

    await user.click(await screen.findByRole('button', { name: 'AI로 멘트 채우기' }));

    const card = await screen.findByTestId(`card-${event.segments[0].id}`);
    await user.click(within(card).getByRole('button', { name: '펼치기' }));
    expect(within(card).getByLabelText('사회자 멘트')).toHaveValue('개학식을 시작하겠습니다.');
  });

  it('생성 중에는 버튼을 다시 누를 수 없다', async () => {
    const user = userEvent.setup();
    await renderEditor();
    generateScripts.mockReturnValue(new Promise(() => undefined));

    await user.click(await screen.findByRole('button', { name: 'AI로 멘트 채우기' }));
    expect(await screen.findByRole('button', { name: '멘트를 쓰는 중입니다…' })).toBeDisabled();
  });

  it('실패하면 한국어 안내를 보여주고 기존 내용을 지킨다', async () => {
    const user = userEvent.setup();
    const { GeminiError } = await import('../../gemini/client');
    await renderEditor();
    generateScripts.mockRejectedValue(
      new GeminiError({ kind: 'quota', retryAfterSec: 30, message: '무료 사용량을 초과했습니다.' }),
    );

    await user.click(await screen.findByRole('button', { name: 'AI로 멘트 채우기' }));

    expect(await screen.findByText('무료 사용량을 초과했습니다.')).toBeInTheDocument();
    expect(screen.getByText('개식사')).toBeInTheDocument();
  });

  it('순서 하나만 다시 생성한다', async () => {
    const user = userEvent.setup();
    const event = await renderEditor();
    regenerateOne.mockResolvedValue(
      event.segments.map((segment, index) =>
        index === 0 ? { ...segment, script: '새로 쓴 멘트' } : segment,
      ),
    );

    const card = await screen.findByTestId(`card-${event.segments[0].id}`);
    await user.click(within(card).getByRole('button', { name: '펼치기' }));
    await user.click(within(card).getByRole('button', { name: '🔄 이 순서만 다시 생성' }));

    expect(regenerateOne).toHaveBeenCalled();
    expect(within(card).getByLabelText('사회자 멘트')).toHaveValue('새로 쓴 멘트');
  });
});
