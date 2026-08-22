import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryPicker from './LibraryPicker';
import { parseLibrary } from '../../media/library';

const tracks = parseLibrary({
  tracks: [
    {
      id: 'anthem-band-1',
      role: 'anthem',
      label: '애국가 1절 (관악 반주)',
      file: 'anthem-band-1.mp3',
      note: '전주 4마디 포함',
      credit: '교육부 배포본',
      durationSec: 69,
    },
    { id: 'anthem-choir', role: 'anthem', label: '애국가 (합창)', file: 'anthem-choir.mp3' },
  ],
});

function show(over: Partial<Parameters<typeof LibraryPicker>[0]> = {}) {
  const onPick = vi.fn();
  render(
    <LibraryPicker
      roleLabel="애국가"
      tracks={tracks}
      busyTrackId={null}
      disabled={false}
      onPick={onPick}
      {...over}
    />,
  );
  return { onPick };
}

describe('LibraryPicker', () => {
  it('같은 역할의 여러 판본을 모두 보여 준다', () => {
    show();
    expect(screen.getByText('애국가 1절 (관악 반주)')).toBeInTheDocument();
    expect(screen.getByText('애국가 (합창)')).toBeInTheDocument();
  });

  it('설명과 출처와 길이를 함께 보여 준다', () => {
    show();
    expect(screen.getByText('전주 4마디 포함')).toBeInTheDocument();
    expect(screen.getByText('출처 · 교육부 배포본')).toBeInTheDocument();
    expect(screen.getByText('1분 9초')).toBeInTheDocument();
  });

  // 음원 파일은 사용자가 나중에 채운다. 아직 없는 동안 빈 칸이 보이면
  // 고장 난 것처럼 보이므로 칸 자체를 접는다.
  it('후보가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(
      <LibraryPicker roleLabel="애국가" tracks={[]} busyTrackId={null} disabled={false}
                     onPick={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('이걸로 를 누르면 그 판본을 알려 준다', async () => {
    const { onPick } = show();
    await userEvent.click(screen.getAllByRole('button', { name: '이걸로' })[1]);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'anthem-choir' }));
  });

  it('받는 중에는 그 판본만 받는 중으로 보인다', () => {
    show({ busyTrackId: 'anthem-choir', disabled: true });
    expect(screen.getByText('받는 중…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이걸로' })).toBeDisabled();
  });

  describe('들어보기', () => {
    it('누르기 전에는 재생기가 없다', () => {
      show();
      expect(screen.queryByTestId('preview-anthem-band-1')).not.toBeInTheDocument();
    });

    it('누르면 그 판본의 재생기가 열린다', async () => {
      show();
      await userEvent.click(screen.getByRole('button', { name: '애국가 1절 (관악 반주) 들어보기' }));
      expect(screen.getByTestId('preview-anthem-band-1')).toBeInTheDocument();
    });

    // 고르지 않을 파일까지 기기에 쌓을 이유가 없다.
    it('들어보기는 미리 내려받지 않는다', async () => {
      show();
      await userEvent.click(screen.getByRole('button', { name: '애국가 1절 (관악 반주) 들어보기' }));
      expect(screen.getByTestId('preview-anthem-band-1')).toHaveAttribute('preload', 'none');
    });

    it('다시 누르면 닫힌다', async () => {
      show();
      const open = screen.getByRole('button', { name: '애국가 1절 (관악 반주) 들어보기' });
      await userEvent.click(open);
      await userEvent.click(screen.getByRole('button', { name: '애국가 1절 (관악 반주) 들어보기' }));
      expect(screen.queryByTestId('preview-anthem-band-1')).not.toBeInTheDocument();
    });

    it('한 번에 하나만 열린다', async () => {
      show();
      await userEvent.click(screen.getByRole('button', { name: '애국가 1절 (관악 반주) 들어보기' }));
      await userEvent.click(screen.getByRole('button', { name: '애국가 (합창) 들어보기' }));
      expect(screen.queryByTestId('preview-anthem-band-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('preview-anthem-choir')).toBeInTheDocument();
    });
  });
});
