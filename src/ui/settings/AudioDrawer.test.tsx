import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearDb } from '../../db/testUtils';
import { getAudioByRole, listAudio } from '../../db/audioRepo';
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

  it('음원을 읽지 못하면 안내를 보여주고 아무것도 저장하지 않는다', async () => {
    readDurationMock.mockRejectedValueOnce(new Error('음원 파일을 읽을 수 없습니다.'));

    const user = userEvent.setup();
    render(<AudioDrawer />);

    const input = await screen.findByTestId('file-anthem');
    await user.upload(input, new File(['깨진파일'], '이상한파일.mp3', { type: 'audio/mpeg' }));

    expect(
      await screen.findByText(
        '파일을 읽을 수 없습니다. mp3·m4a·wav 음원이나 mp4·mov 동영상인지 확인해 주세요. ' +
          '휴대폰이라면 카카오톡이나 다운로드 폴더에 받아 둔 파일을 골라 주세요.',
      ),
    ).toBeInTheDocument();
    expect(await getAudioByRole('anthem')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('file-anthem')).toBeEnabled());
  });

  it('휴대폰처럼 종류를 알려주지 않는 파일도 받아들인다', async () => {
    const user = userEvent.setup();
    render(<AudioDrawer />);

    // 안드로이드 파일 관리자와 카카오톡은 mp3를 종류 없이 넘기는 일이 잦다.
    const file = new File([new Uint8Array([1, 2, 3])], '애국가.mp3', {
      type: 'application/octet-stream',
    });
    await user.upload(screen.getByTestId('file-anthem'), file);

    await waitFor(async () => {
      const saved = await listAudio();
      expect(saved).toHaveLength(1);
      expect(saved[0].mimeType).toBe('audio/mpeg');
    });
  });
});
