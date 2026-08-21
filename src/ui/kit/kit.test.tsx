import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Button from './Button';
import Card from './Card';
import Notice from './Notice';
import PageHeader from './PageHeader';

describe('Button', () => {
  it('글자를 그대로 보여준다', () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
  });

  it('기본 갈래는 secondary다', () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'secondary');
  });

  it('갈래를 지정하면 그대로 표시한다', () => {
    render(<Button variant="primary">저장</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'primary');
  });

  it('누르면 처리기를 부른다', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>저장</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled면 눌러도 처리기를 부르지 않는다', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>저장</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('type을 주지 않으면 button이다 (폼 안에서 제출되지 않도록)', () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Card', () => {
  it('내용을 감싼다', () => {
    render(<Card>안쪽</Card>);
    expect(screen.getByText('안쪽')).toBeInTheDocument();
  });

  it('목록 항목으로도 쓸 수 있다', () => {
    render(<ul><Card as="li">항목</Card></ul>);
    expect(screen.getByRole('listitem')).toHaveTextContent('항목');
  });
});

describe('Notice', () => {
  it('기본 결은 info다', () => {
    render(<Notice>알림</Notice>);
    expect(screen.getByText('알림')).toHaveAttribute('data-tone', 'info');
  });

  it('결을 지정하면 그대로 표시한다', () => {
    render(<Notice tone="danger">위험</Notice>);
    expect(screen.getByText('위험')).toHaveAttribute('data-tone', 'danger');
  });
});

describe('PageHeader', () => {
  it('제목을 보여준다', () => {
    render(<MemoryRouter><PageHeader title="설정" /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument();
  });

  it('뒤로가기 주소를 주면 링크를 단다', () => {
    render(<MemoryRouter><PageHeader title="설정" backTo="/" backLabel="← 홈" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: '← 홈' })).toHaveAttribute('href', '/');
  });

  it('뒤로가기 주소가 없으면 링크가 없다', () => {
    render(<MemoryRouter><PageHeader title="행사박사" /></MemoryRouter>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('오른쪽 슬롯을 붙인다', () => {
    render(
      <MemoryRouter>
        <PageHeader title="설정" right={<span>오른쪽</span>} />
      </MemoryRouter>,
    );
    expect(screen.getByText('오른쪽')).toBeInTheDocument();
  });
});
