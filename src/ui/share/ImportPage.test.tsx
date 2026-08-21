import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clearDb } from '../../db/testUtils';
import { listEvents } from '../../db/eventRepo';
import { putAudio } from '../../db/audioRepo';
import { createEventFromTemplate } from '../../domain/templates';
import { encodeScenario } from '../../share/scenarioLink';
import type { AudioRole } from '../../types';
import ImportPage from './ImportPage';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

function renderImport(payload: string) {
  render(
    <MemoryRouter initialEntries={[`/import?d=${payload}`]}>
      <Routes>
        <Route path="/import" element={<ImportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

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

describe('ImportPage', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('받은 시나리오를 미리 보여준다', async () => {
    renderImport(encodeScenario(createEventFromTemplate('semester-opening', init)));
    expect(await screen.findByText('2학기 개학식')).toBeInTheDocument();
    expect(screen.getByText('개식사')).toBeInTheDocument();
  });

  it('이 기기에 없는 음원을 미리 경고한다', async () => {
    await seedAudio('anthem');
    renderImport(encodeScenario(createEventFromTemplate('semester-opening', init)));

    const warning = await screen.findByTestId('missing-audio');
    expect(warning).toHaveTextContent('교가');
    expect(warning).not.toHaveTextContent('애국가');
  });

  it('가져오면 새 행사로 저장한다', async () => {
    const user = userEvent.setup();
    renderImport(encodeScenario(createEventFromTemplate('semester-opening', init)));

    await user.click(await screen.findByRole('button', { name: '이 기기에 가져오기' }));

    const events = await listEvents();
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('2학기 개학식');
  });

  it('가져올 때 새 id를 부여해 원본과 충돌하지 않는다', async () => {
    const user = userEvent.setup();
    const original = createEventFromTemplate('semester-opening', init);
    renderImport(encodeScenario(original));

    await user.click(await screen.findByRole('button', { name: '이 기기에 가져오기' }));

    const events = await listEvents();
    expect(events[0].id).not.toBe(original.id);
  });

  it('망가진 링크는 안내 문구를 보여준다', async () => {
    renderImport('망가진값!!!');
    expect(await screen.findByText(/시나리오를 읽을 수 없습니다/)).toBeInTheDocument();
  });
});
