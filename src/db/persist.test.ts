import { describe, it, expect, vi, afterEach } from 'vitest';
import { isStoragePersisted, requestPersistentStorage } from './persist';

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

describe('requestPersistentStorage', () => {
  it('이미 영구 저장이면 다시 요청하지 않는다', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    withStorage({ persisted: () => Promise.resolve(true), persist });

    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('아직 아니면 요청해서 결과를 돌려준다', async () => {
    withStorage({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(true),
    });

    expect(await requestPersistentStorage()).toBe(true);
  });

  it('브라우저가 거절하면 false다', async () => {
    withStorage({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(false),
    });

    expect(await requestPersistentStorage()).toBe(false);
  });

  it('지원하지 않는 브라우저에서는 false다', async () => {
    withStorage(undefined);
    expect(await requestPersistentStorage()).toBe(false);
  });

  it('요청이 예외로 터져도 앱을 세우지 않는다', async () => {
    withStorage({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.reject(new Error('거부')),
    });

    expect(await requestPersistentStorage()).toBe(false);
  });
});

describe('isStoragePersisted', () => {
  it('브라우저가 알려주는 값을 그대로 돌려준다', async () => {
    withStorage({ persisted: () => Promise.resolve(true) });
    expect(await isStoragePersisted()).toBe(true);
  });

  it('지원하지 않으면 false다', async () => {
    withStorage({});
    expect(await isStoragePersisted()).toBe(false);
  });
});
