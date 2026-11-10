import { describe, expect, it, vi } from 'vitest';
import { isApiError } from './apiError';
import { API_BASE_PATH, readApiBaseUrl, resolveDataSource } from './config';

describe('resolveDataSource', () => {
  it('"mock" 과 "api" 만 그대로 인정한다', () => {
    expect(resolveDataSource('mock')).toBe('mock');
    expect(resolveDataSource('api')).toBe('api');
    expect(resolveDataSource('  api  ')).toBe('api');
  });

  it('비어 있거나 없으면 mock 이고 알리지 않는다', () => {
    const onInvalid = vi.fn();

    expect(resolveDataSource(undefined, onInvalid)).toBe('mock');
    expect(resolveDataSource('', onInvalid)).toBe('mock');
    expect(resolveDataSource('   ', onInvalid)).toBe('mock');
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it('잘못된 값은 mock 으로 처리하고 onInvalid 를 부른다', () => {
    const onInvalid = vi.fn();

    expect(resolveDataSource('API', onInvalid)).toBe('mock');
    expect(resolveDataSource('real', onInvalid)).toBe('mock');
    expect(onInvalid).toHaveBeenNthCalledWith(1, 'API');
    expect(onInvalid).toHaveBeenNthCalledWith(2, 'real');
  });
});

describe('readApiBaseUrl', () => {
  it('호스트만 받고 끝의 / 를 지운다(/api/v1 은 붙이지 않는다)', () => {
    expect(readApiBaseUrl('https://api.example.com')).toBe('https://api.example.com');
    expect(readApiBaseUrl(' https://api.example.com/ ')).toBe('https://api.example.com');
    expect(readApiBaseUrl('http://localhost:8080')).toBe('http://localhost:8080');
    expect(API_BASE_PATH).toBe('/api/v1');
  });

  it('인자를 주지 않으면 VITE_API_BASE_URL 을 읽는다', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://env.example.com/');
    expect(readApiBaseUrl()).toBe('https://env.example.com');

    // 값이 없거나 빈 값이면 기본값(빈 문자열)이라 요청 주소가 상대 경로 /api/v1 이 된다.
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(readApiBaseUrl()).toBe('');
  });

  it.each([undefined, '', '   ', ' / '])(
    '%j 는 기본값(빈 문자열 → 상대 경로 /api/v1)이다',
    (raw) => {
      expect(readApiBaseUrl(raw)).toBe('');
    },
  );

  it.each(['api.example.com', '/api', 'ftp://x.com', 'https://x.com/path'])(
    '%j 는 CONFIG_API_BASE_URL ApiError 다',
    (raw) => {
      try {
        readApiBaseUrl(raw);
        expect.unreachable();
      } catch (error) {
        expect(isApiError(error)).toBe(true);
        expect((error as { code?: string }).code).toBe('CONFIG_API_BASE_URL');
      }
    },
  );
});
