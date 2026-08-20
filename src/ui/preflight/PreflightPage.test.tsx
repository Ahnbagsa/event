import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { putEvent } from '../../db/eventRepo';
import { putAudio } from '../../db/audioRepo';
import { createEventFromTemplate } from '../../domain/templates';
import type { AudioRole, EventCeremony } from '../../types';
import PreflightPage from './PreflightPage';

vi.mock('../../audio/usePlayer', () => ({
  usePlayer: () => ({
    status: 'ready',
    currentTime: 0,
    duration: 60,
    volume: 1,
    play: () => Promise.resolve(),
    pause: () => undefined,
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

async function seedAudio(role: AudioRole) {
  await putAudio({
    id: `audio-${role}`,
    role,
    label: role,
    data: new ArrayBuffer(8),
    mimeType: 'audio/mpeg',
    durationSec: 60,
    fileName: `${role}.mp3`,
    addedAt: 1,
  });
}

async function renderPreflight(event: EventCeremony) {
  await putEvent(event);
  render(
    <MemoryRouter initialEntries={[`/event/${event.id}/preflight`]}>
      <Routes>
        <Route path="/event/:eventId/preflight" element={<PreflightPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PreflightPage', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('빠진 음원을 이름으로 알려준다', async () => {
    await seedAudio('pledge');
    await renderPreflight(createEventFromTemplate('semester-opening', init));

    expect(await screen.findByTestId('check-audio')).toHaveTextContent('교가');
  });

  it('빈칸이 남아 있으면 순서 이름과 함께 보여준다', async () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '{{학교명}} 개학식';
    await renderPreflight(event);

    expect(await screen.findByTestId('check-blanks')).toHaveTextContent('개식사');
  });

  it('조건을 못 채우면 진행 시작 버튼을 누를 수 없다', async () => {
    await renderPreflight(createEventFromTemplate('semester-opening', init));
    expect(await screen.findByRole('button', { name: '진행 시작' })).toBeDisabled();
  });

  it('음원이 다 있고 소리를 확인하면 시작할 수 있다', async () => {
    const user = userEvent.setup();
    for (const role of ['pledge', 'anthem', 'silence', 'schoolSong'] as AudioRole[]) {
      await seedAudio(role);
    }
    await renderPreflight(createEventFromTemplate('semester-opening', init));

    await user.click(await screen.findByRole('button', { name: '소리 테스트' }));
    await user.click(await screen.findByRole('button', { name: '들렸어요' }));

    expect(await screen.findByRole('button', { name: '진행 시작' })).toBeEnabled();
  });

  it('총 예상 시간을 보여준다', async () => {
    await renderPreflight(createEventFromTemplate('semester-opening', init));
    expect(await screen.findByTestId('total-time')).toHaveTextContent('분');
  });
});
