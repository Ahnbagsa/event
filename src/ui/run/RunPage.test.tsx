import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { putEvent } from '../../db/eventRepo';
import { putAudio } from '../../db/audioRepo';
import { getRunState, saveRunState } from '../../db/runStateRepo';
import { createEventFromTemplate } from '../../domain/templates';
import { updateSegment } from '../../domain/segmentOps';
import type { AudioRole, EventCeremony } from '../../types';
import RunPage from './RunPage';

const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();

vi.mock('../../audio/usePlayer', () => ({
  usePlayer: () => ({
    status: 'ready',
    currentTime: 0,
    duration: 222,
    volume: 1,
    play,
    pause,
    restart: () => Promise.resolve(),
    fadeOut: () => Promise.resolve(),
    setVolume: () => undefined,
  }),
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

// 음원이 이 기기에 없으면 재생 단추 대신 경고가 나온다(그게 정상 동작이다).
// 재생 조작을 확인하려면 개학식 식순이 쓰는 역할을 미리 깔아둬야 한다.
async function seedAudio(role: AudioRole) {
  await putAudio({
    id: `audio-${role}`,
    role,
    label: role,
    data: new ArrayBuffer(8),
    mimeType: 'audio/mpeg',
    durationSec: 222,
    fileName: `${role}.mp3`,
    addedAt: 1,
  });
}

async function seedEvent() {
  for (const role of ['pledge', 'anthem', 'silence', 'schoolSong'] as AudioRole[]) {
    await seedAudio(role);
  }

  let event = createEventFromTemplate('semester-opening', init);
  event = {
    ...event,
    segments: updateSegment(event.segments, event.segments[0].id, {
      script: '개학식을 시작하겠습니다.',
    }),
  };
  await putEvent(event);
  return event;
}

function mount(event: EventCeremony) {
  render(
    <MemoryRouter initialEntries={[`/event/${event.id}/run`]}>
      <Routes>
        <Route path="/event/:eventId/run" element={<RunPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function renderRun() {
  const event = await seedEvent();
  mount(event);
  return event;
}

describe('RunPage', () => {
  beforeEach(async () => {
    await clearDb();
    play.mockClear();
    pause.mockClear();
  });

  it('첫 순서의 멘트를 크게 보여준다', async () => {
    await renderRun();
    expect(await screen.findByTestId('script')).toHaveTextContent('개학식을 시작하겠습니다.');
  });

  it('진행 위치와 전체 순서 수를 보여준다', async () => {
    await renderRun();
    expect(await screen.findByTestId('position')).toHaveTextContent('1 / 7');
  });

  it('다음 순서를 미리 보여준다', async () => {
    await renderRun();
    expect(await screen.findByTestId('next-preview')).toHaveTextContent('국기에 대한 경례');
  });

  it('다음 버튼으로 넘어간다', async () => {
    const user = userEvent.setup();
    await renderRun();

    await user.click(await screen.findByRole('button', { name: '다음' }));
    expect(await screen.findByTestId('position')).toHaveTextContent('2 / 7');
  });

  it('첫 순서에서는 이전 버튼이 비활성이다', async () => {
    await renderRun();
    expect(await screen.findByRole('button', { name: '이전' })).toBeDisabled();
  });

  it('음원이 붙은 순서에서는 자동 재생하지 않는다', async () => {
    const user = userEvent.setup();
    await renderRun();

    await user.click(await screen.findByRole('button', { name: '다음' }));
    expect(play).not.toHaveBeenCalled();
  });

  it('재생 버튼을 누르면 재생한다', async () => {
    const user = userEvent.setup();
    await renderRun();

    await user.click(await screen.findByRole('button', { name: '다음' }));
    await user.click(await screen.findByRole('button', { name: '재생' }));
    expect(play).toHaveBeenCalled();
  });

  it('잠금을 켜면 다음 버튼이 막힌다', async () => {
    const user = userEvent.setup();
    await renderRun();

    await user.click(await screen.findByRole('button', { name: '화면 잠금' }));
    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByTestId('position')).toHaveTextContent('1 / 7');
  });

  it('중단된 위치가 남아 있으면 이어서 진행할지 물어본다', async () => {
    const user = userEvent.setup();
    const event = await seedEvent();
    await saveRunState({
      id: 'singleton',
      eventId: event.id,
      currentIndex: 3,
      startedAt: Date.now() - 60_000,
      updatedAt: Date.now(),
    });
    mount(event);

    await user.click(await screen.findByRole('button', { name: '이어서 진행' }));
    expect(await screen.findByTestId('position')).toHaveTextContent('4 / 7');
  });

  it('이어서 진행을 물어보는 동안에는 중단 위치를 덮어쓰지 않는다', async () => {
    const event = await seedEvent();
    await saveRunState({
      id: 'singleton',
      eventId: event.id,
      currentIndex: 3,
      startedAt: Date.now() - 60_000,
      updatedAt: Date.now(),
    });
    mount(event);

    await screen.findByRole('button', { name: '이어서 진행' });
    expect((await getRunState())?.currentIndex).toBe(3);
  });

  it('처음부터를 고르면 첫 순서에서 시작한다', async () => {
    const user = userEvent.setup();
    const event = await seedEvent();
    await saveRunState({
      id: 'singleton',
      eventId: event.id,
      currentIndex: 3,
      startedAt: Date.now() - 60_000,
      updatedAt: Date.now(),
    });
    mount(event);

    await user.click(await screen.findByRole('button', { name: '처음부터 시작' }));
    expect(await screen.findByTestId('position')).toHaveTextContent('1 / 7');
  });

  it('다른 행사의 중단 위치는 물어보지 않는다', async () => {
    const event = await seedEvent();
    await saveRunState({
      id: 'singleton',
      eventId: 'event-다른행사',
      currentIndex: 3,
      startedAt: Date.now() - 60_000,
      updatedAt: Date.now(),
    });
    mount(event);

    expect(await screen.findByTestId('position')).toHaveTextContent('1 / 7');
    expect(screen.queryByRole('button', { name: '이어서 진행' })).not.toBeInTheDocument();
  });

  it('마지막 순서에서 다음을 누르면 종료 화면이 나온다', async () => {
    const user = userEvent.setup();
    await renderRun();

    const next = await screen.findByRole('button', { name: '다음' });
    for (let i = 0; i < 7; i += 1) await user.click(next);

    expect(await screen.findByText('행사가 끝났습니다')).toBeInTheDocument();
  });
});
