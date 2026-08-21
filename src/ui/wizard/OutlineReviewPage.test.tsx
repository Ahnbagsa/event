import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { listEvents } from '../../db/eventRepo';
import { savePlanDraft, clearPlanDraft } from './planDraft';
import OutlineReviewPage from './OutlineReviewPage';

const draft = {
  detectedEventType: 'semester-opening',
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  seeds: [
    { name: '개식사', groupLabel: null, kind: 'speech' as const, script: '', audioRole: null, autoPlay: false, fadeOutSec: null, timerSec: null, manualDurationSec: null, note: '' },
    { name: '애국가 제창', groupLabel: null, kind: 'audio' as const, script: '', audioRole: null, autoPlay: false, fadeOutSec: null, timerSec: null, manualDurationSec: null, note: '' },
  ],
};

describe('OutlineReviewPage', () => {
  beforeEach(async () => {
    await clearDb();
    clearPlanDraft();
  });

  it('뽑아낸 식순을 보여준다', async () => {
    savePlanDraft(draft);
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);

    expect(await screen.findByDisplayValue('개식사')).toBeInTheDocument();
    expect(screen.getByDisplayValue('애국가 제창')).toBeInTheDocument();
  });

  it('찾아낸 제목을 미리 채워 준다', async () => {
    savePlanDraft(draft);
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);
    expect(await screen.findByLabelText('행사 제목')).toHaveValue('2학기 개학식');
  });

  it('순서를 지울 수 있다', async () => {
    const user = userEvent.setup();
    savePlanDraft(draft);
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);

    const row = (await screen.findByDisplayValue('개식사')).closest('li')!;
    await user.click(within(row).getByRole('button', { name: '삭제' }));

    expect(screen.queryByDisplayValue('개식사')).not.toBeInTheDocument();
  });

  it('순서를 추가할 수 있다', async () => {
    const user = userEvent.setup();
    savePlanDraft(draft);
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: '＋ 순서 추가' }));
    expect(screen.getAllByTestId('outline-row')).toHaveLength(3);
  });

  it('확정하면 행사로 저장한다', async () => {
    const user = userEvent.setup();
    savePlanDraft(draft);
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: '이 식순으로 행사 만들기' }));

    const events = await listEvents();
    expect(events).toHaveLength(1);
    expect(events[0].segments.map((s) => s.name)).toEqual(['개식사', '애국가 제창']);
  });

  it('식순이 하나도 없으면 안내한다', async () => {
    savePlanDraft({ ...draft, seeds: [] });
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);
    expect(await screen.findByText(/식순을 찾지 못했습니다/)).toBeInTheDocument();
  });

  it('넘어온 자료가 없으면 처음으로 돌아가라고 안내한다', async () => {
    render(<MemoryRouter><OutlineReviewPage /></MemoryRouter>);
    expect(await screen.findByText(/계획서를 먼저 넣어 주세요/)).toBeInTheDocument();
  });
});
