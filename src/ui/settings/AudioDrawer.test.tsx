import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearDb } from '../../db/testUtils';
import { getAudioByRole } from '../../db/audioRepo';
import AudioDrawer from './AudioDrawer';

const readDurationMock = vi.hoisted(() => vi.fn(() => Promise.resolve(222)));

vi.mock('../../audio/readAudioDuration', () => ({
  readAudioDuration: readDurationMock,
}));

describe('AudioDrawer', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('표준 역할 슬롯을 모두 보여준다', async () => {
    render(<AudioDrawer />);
    expect(await screen.findByText('애국가')).toBeInTheDocument();
    expect(screen.getByText('교가')).toBeInTheDocument();
    expect(screen.getByText('묵념곡')).toBeInTheDocument();
  });

  it('등록되지 않은 슬롯은 "없음"으로 표시한다', async () => {
    render(<AudioDrawer />);
    const slot = await screen.findByTestId('slot-anthem');
    expect(slot).toHaveTextContent('없음');
  });

  it('파일을 고르면 저장하고 길이를 보여준다', async () => {
    const user = userEvent.setup();
    render(<AudioDrawer />);

    const input = await screen.findByTestId('file-anthem');
    const file = new File(['음원내용'], '애국가.mp3', { type: 'audio/mpeg' });
    await user.upload(input, file);

    await waitFor(async () => {
      const saved = await getAudioByRole('anthem');
      expect(saved?.fileName).toBe('애국가.mp3');
      expect(saved?.durationSec).toBe(222);
    });

    expect(await screen.findByText('3분 42초')).toBeInTheDocument();
  });

  it('파일을 읽는 동안에는 다른 파일을 고를 수 없다', async () => {
    let release: (seconds: number) => void = () => undefined;
    readDurationMock.mockImplementationOnce(
      () => new Promise<number>((resolve) => { release = resolve; }),
    );

    const user = userEvent.setup();
    render(<AudioDrawer />);

    const input = await screen.findByTestId('file-anthem');
    await user.upload(input, new File(['음원'], '애국가.mp3', { type: 'audio/mpeg' }));

    expect(await screen.findByTestId('file-schoolSong')).toBeDisabled();

    release(222);
    await waitFor(() => expect(screen.getByTestId('file-schoolSong')).toBeEnabled());
  });
});
