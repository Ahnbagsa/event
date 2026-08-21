import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import InstallHint, { isIos, isStandalone } from './InstallHint';

function stubUserAgent(value: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isIos', () => {
  it('아이폰을 알아본다', () => {
    stubUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(isIos()).toBe(true);
  });

  it('윈도우는 아이폰이 아니다', () => {
    stubUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(isIos()).toBe(false);
  });
});

describe('isStandalone', () => {
  it('홈 화면 실행이 아니면 false다', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(isStandalone()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('InstallHint', () => {
  it('아이폰 브라우저에서는 공유 버튼 안내를 보여준다', () => {
    stubUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));

    render(<InstallHint />);
    expect(screen.getByText(/공유/)).toBeInTheDocument();
    expect(screen.getByText(/홈 화면에 추가/)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('이미 홈 화면에서 실행 중이면 아무것도 보여주지 않는다', () => {
    stubUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    vi.stubGlobal('matchMedia', () => ({ matches: true }));

    const { container } = render(<InstallHint />);
    expect(container).toBeEmptyDOMElement();

    vi.unstubAllGlobals();
  });

  it('PC에서는 안내를 보여주지 않는다', () => {
    stubUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));

    const { container } = render(<InstallHint />);
    expect(container).toBeEmptyDOMElement();

    vi.unstubAllGlobals();
  });
});
