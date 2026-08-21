import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom에는 matchMedia가 없다. 실제 브라우저에는 모두 있으므로 앱 코드에서 방어하지
// 않고 여기서 채워 둔다. 기본값은 "홈 화면 실행이 아님"이다.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
