import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnbaksaMark from './AnbaksaMark';

describe('AnbaksaMark', () => {
  it('기본은 얼굴만 보여준다', () => {
    const { container } = render(<AnbaksaMark />);
    expect(container.querySelector('[data-part="wordmark"]')).toBeNull();
  });

  it('full이면 안박사 글자까지 보여준다', () => {
    const { container } = render(<AnbaksaMark variant="full" />);
    expect(container.querySelector('[data-part="wordmark"]')).not.toBeNull();
  });

  it('갈래에 따라 viewBox가 다르다', () => {
    const { container: mark } = render(<AnbaksaMark variant="mark" />);
    const { container: full } = render(<AnbaksaMark variant="full" />);
    expect(mark.querySelector('svg')).toHaveAttribute('viewBox', '40 20 330 400');
    expect(full.querySelector('svg')).toHaveAttribute('viewBox', '0 0 400 550');
  });

  it('크기를 지정할 수 있다', () => {
    const { container } = render(<AnbaksaMark size={64} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).toHaveAttribute('height', '64');
  });

  it('선 색을 글자색에 맞춰 currentColor로 그린다', () => {
    const { container } = render(<AnbaksaMark />);
    expect(container.querySelector('g')).toHaveAttribute('stroke', 'currentColor');
  });

  it('설명을 주면 그림 이름으로 읽힌다', () => {
    render(<AnbaksaMark title="안박사" />);
    expect(screen.getByRole('img', { name: '안박사' })).toBeInTheDocument();
  });

  it('설명이 없으면 보조 기기에서 숨긴다', () => {
    const { container } = render(<AnbaksaMark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
