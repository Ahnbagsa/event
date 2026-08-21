import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEventFromTemplate } from '../../domain/templates';
import ShareButton from './ShareButton';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

// 인자 타입을 명시해야 mock.calls[0][0]이 tsc --noEmit을 통과한다.
const writeText = vi.fn((_text: string) => Promise.resolve());

beforeEach(() => {
  writeText.mockClear();
});

// userEvent.setup()이 자기 클립보드 대역을 navigator에 설치한다. 그래서 대역은
// setup() 다음에 심어야 한다. beforeEach에서 미리 심으면 조용히 덮인다.
function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  return user;
}

describe('ShareButton', () => {
  it('누르면 링크를 복사한다', async () => {
    const user = setupUser();
    render(<ShareButton event={createEventFromTemplate('semester-opening', init)} />);

    await user.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(String(writeText.mock.calls[0][0])).toContain('#/import?d=');
    expect(await screen.findByText(/링크를 복사했습니다/)).toBeInTheDocument();
  });

  it('복사한 뒤 QR을 함께 보여준다', async () => {
    const user = setupUser();
    render(<ShareButton event={createEventFromTemplate('semester-opening', init)} />);

    await user.click(screen.getByRole('button', { name: '링크 복사' }));

    const panel = await screen.findByTestId('share-panel');
    expect(panel.querySelector('svg')).not.toBeNull();
    expect(panel).toHaveTextContent('휴대폰 카메라로 찍으세요');
  });

  it('닫기를 누르면 사라진다', async () => {
    const user = setupUser();
    render(<ShareButton event={createEventFromTemplate('semester-opening', init)} />);

    await user.click(screen.getByRole('button', { name: '링크 복사' }));
    await screen.findByTestId('share-panel');
    await user.click(screen.getByRole('button', { name: '닫기' }));

    expect(screen.queryByTestId('share-panel')).not.toBeInTheDocument();
  });

  it('복사가 막히면 한국어로 안내한다', async () => {
    const user = setupUser();
    writeText.mockRejectedValueOnce(new Error('denied'));
    render(<ShareButton event={createEventFromTemplate('semester-opening', init)} />);

    await user.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(await screen.findByText(/복사하지 못했습니다/)).toBeInTheDocument();
  });
});
