import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTokenStore } from './tokenStore';

const KEY = 'yyt.session';

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

/** 모든 접근이 예외를 던지는 저장소(사생활 보호 모드·접근 차단) */
const blockedStorage = (): Storage =>
  ({
    getItem: () => {
      throw new DOMException('blocked', 'SecurityError');
    },
    setItem: () => {
      throw new DOMException('blocked', 'SecurityError');
    },
    removeItem: () => {
      throw new DOMException('blocked', 'SecurityError');
    },
  }) as unknown as Storage;

describe('createTokenStore', () => {
  it('저장한 세션을 읽고 sessionStorage 에도 복사한다', () => {
    const store = createTokenStore();

    store.write({ token: 'tok-a', expiresAt: 5000 });

    expect(store.read(1000)).toEqual({ token: 'tok-a', expiresAt: 5000 });
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual({ token: 'tok-a', expiresAt: 5000 });
  });

  it('새 store(새로고침)는 sessionStorage 에서 복원한다', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ token: 'tok-r', expiresAt: 9000 }));

    expect(createTokenStore().read(1000)?.token).toBe('tok-r');
  });

  it('만료된 세션은 읽을 때 지우고 null 을 돌려준다', () => {
    const store = createTokenStore();
    store.write({ token: 'tok-a', expiresAt: 1000 });

    expect(store.read(1000)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('만료 시각을 모르면(undefined) 만료되지 않은 것으로 본다', () => {
    const store = createTokenStore();
    store.write({ token: 'tok-a' });

    expect(store.read(Number.MAX_SAFE_INTEGER)?.token).toBe('tok-a');
  });

  it('clear 는 메모리와 저장소를 모두 지운다', () => {
    const store = createTokenStore();
    store.write({ token: 'tok-a' });

    store.clear();

    expect(store.read()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(createTokenStore().read()).toBeNull();
  });

  it.each([
    ['JSON 이 아님', 'not json'],
    ['토큰이 비어 있음', JSON.stringify({ token: '' })],
    ['토큰 타입이 다름', JSON.stringify({ token: 1 })],
    ['만료 시각 타입이 다름', JSON.stringify({ token: 'x', expiresAt: 'soon' })],
    ['객체가 아님', JSON.stringify('x')],
  ])('저장된 값이 깨져 있으면(%s) 세션이 없는 것으로 본다', (_name, raw) => {
    sessionStorage.setItem(KEY, raw);

    expect(createTokenStore().read()).toBeNull();
  });

  it('sessionStorage 접근이 막혀 있어도(예외) 메모리만으로 동작한다', () => {
    const store = createTokenStore(blockedStorage);

    expect(() => store.write({ token: 'tok-m', expiresAt: 9000 })).not.toThrow();
    expect(store.read(1000)?.token).toBe('tok-m');
    expect(() => store.clear()).not.toThrow();
    expect(store.read(1000)).toBeNull();
  });

  it('저장소를 얻는 것 자체가 예외여도(window.sessionStorage 접근 차단) 메모리로 동작한다', () => {
    const store = createTokenStore(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(store.read()).toBeNull();
    store.write({ token: 'tok-m' });
    expect(store.read()?.token).toBe('tok-m');
  });
});
