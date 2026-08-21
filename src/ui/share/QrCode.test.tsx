import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import QrCode from './QrCode';

describe('QrCode', () => {
  it('짧은 값을 QR로 그린다', () => {
    const { container } = render(<QrCode value="https://example.com" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelectorAll('rect').length).toBeGreaterThan(10);
  });

  it('실제 공유 링크 길이(약 850자)도 그린다', () => {
    const { container } = render(
      <QrCode value={`https://ahnbagsa.github.io/event/#/import?d=${'A'.repeat(810)}`} />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('크기를 지정할 수 있다', () => {
    const { container } = render(<QrCode value="짧음" size={320} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '320');
  });

  it('QR 한도를 넘으면 아무것도 그리지 않는다', () => {
    const { container } = render(<QrCode value={'A'.repeat(5000)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('빈 값이면 아무것도 그리지 않는다', () => {
    const { container } = render(<QrCode value="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
