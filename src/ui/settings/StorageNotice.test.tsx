import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StorageNotice from './StorageNotice';

type StorageLike = {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
};

function withStorage(storage: StorageLike | undefined) {
  Object.defineProperty(navigator, 'storage', {
    value: storage,
    configurable: true,
  });
}

afterEach(() => {
  withStorage(undefined);
});

describe('StorageNotice', () => {
  it('보호되고 있으면 그렇다고 알려준다', async () => {
    withStorage({ persisted: () => Promise.resolve(true) });
    render(<StorageNotice />);

    expect(await screen.findByTestId('storage-notice')).toHaveTextContent(
      '이 기기에 안전하게 보관',
    );
  });

  it('보호되지 않으면 지워질 수 있다고 경고한다', async () => {
    withStorage({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(false),
    });
    render(<StorageNotice />);

    expect(await screen.findByTestId('storage-notice')).toHaveTextContent(
      '저장 공간이 부족해지면',
    );
  });

  it('다시 요청해서 허락받으면 안내가 바뀐다', async () => {
    const user = userEvent.setup();
    let granted = false;
    withStorage({
      persisted: () => Promise.resolve(granted),
      persist: () => {
        granted = true;
        return Promise.resolve(true);
      },
    });
    render(<StorageNotice />);

    await user.click(await screen.findByRole('button', { name: '보호 요청하기' }));

    expect(await screen.findByTestId('storage-notice')).toHaveTextContent(
      '이 기기에 안전하게 보관',
    );
  });

  it('지원하지 않는 브라우저에서는 요청 단추를 보여주지 않는다', async () => {
    withStorage({});
    render(<StorageNotice />);

    await screen.findByTestId('storage-notice');
    expect(screen.queryByRole('button', { name: '보호 요청하기' })).not.toBeInTheDocument();
  });
});
