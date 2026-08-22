import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { putEvent } from '../../db/eventRepo';
import { createEventFromTemplate } from '../../domain/templates';
import { getSettings, saveSettings } from '../../db/settingsRepo';
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
  // 키가 없으면 AI 버튼이 막힌다(그게 정상 동작이다). 생성 자체를 확인하려면
  // 키를 미리 넣어 둬야 한다.
  await saveSettings({ ...(await getSettings()), geminiApiKey: 'AIza-테스트' });
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

// AI 키 없이도 식순을 짜고 행사를 진행할 수 있다. 그런데 버튼만 회색이 되면
// 왜 안 되는지 알 수 없어서, 무엇을 하면 되는지와 안 해도 된다는 것을 함께 알린다.
describe('API 키가 없을 때', () => {
  // 이 describe는 위 describe 밖이라 그쪽 beforeEach가 걸리지 않는다.
  // 지우지 않으면 앞 테스트가 저장해 둔 키가 남아 키 있는 상태로 시작한다.
  beforeEach(async () => {
    await clearDb();
  });

  async function renderWithoutKey() {
    const event = createEventFromTemplate('semester-opening', init);
    await putEvent(event);
    render(
      <MemoryRouter initialEntries={[`/event/${event.id}/edit`]}>
        <Routes>
          <Route path="/event/:eventId/edit" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('무엇을 하면 되는지 알려 준다', async () => {
    await renderWithoutKey();
    expect(await screen.findByTestId('no-api-key')).toHaveTextContent('설정에서 무료 API 키');
  });

  it('없어도 직접 쓸 수 있다고 알려 준다', async () => {
    await renderWithoutKey();
    expect(await screen.findByTestId('no-api-key')).toHaveTextContent('직접 쓰고 행사를 진행할 수 있습니다');
  });

  it('AI 버튼은 눌리지 않는다', async () => {
    await renderWithoutKey();
    expect(await screen.findByRole('button', { name: 'AI로 멘트 채우기' })).toBeDisabled();
  });

  it('키가 있으면 안내가 나오지 않는다', async () => {
    await renderEditor();
    expect(await screen.findByRole('button', { name: 'AI로 멘트 채우기' })).toBeEnabled();
    expect(screen.queryByTestId('no-api-key')).not.toBeInTheDocument();
  });
});
