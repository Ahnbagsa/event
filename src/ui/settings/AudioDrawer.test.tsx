import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearDb } from '../../db/testUtils';
import { getAudioByRole } from '../../db/audioRepo';
import AudioDrawer from './AudioDrawer';

vi.mock('../../audio/readAudioDuration', () => ({
  readAudioDuration: () => Promise.resolve(222),
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
});
