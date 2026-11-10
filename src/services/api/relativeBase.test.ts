import { beforeEach, describe, expect, it } from 'vitest';
import { fakeJwt, jsonResponse, stubFetch } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { readApiBaseUrl } from './config';
import { createTokenStore } from './tokenStore';

/** API 기준 주소가 비어 있으면(상대 경로 /api/v1) 요청 주소·쿼리가 올바르게 만들어지는지. */
const login = () =>
  jsonResponse(200, { accessToken: fakeJwt({ exp: 9_999_999_999 }), expiresIn: 3600 });

function relativeClient() {
  return createApiClient({
    baseUrl: readApiBaseUrl(''),
    store: createTokenStore(),
    now: () => 1_000_000,
  });
}
/** fetch 에 실제로 넘어간 주소 문자열(스텁이 기준 주소를 붙여 해석하기 전의 값) */
const urls = (fn: { mock: { calls: unknown[][] } }) =>
  fn.mock.calls.map(([input]) => String(input));

beforeEach(() => localStorage.clear());

describe('상대 기준 주소(/api/v1)', () => {
  it('쿼리가 없는 호출은 /api/v1 + 경로 문자열이고 origin 이 붙지 않는다', async () => {
    const { fn } = stubFetch((call) =>
      call.path === '/api/v1/auth/guest' ? login() : jsonResponse(200, { id: 1 }),
    );

    await relativeClient().request('/me');

    expect(urls(fn)).toEqual(['/api/v1/auth/guest', '/api/v1/me']);
  });

  it('쿼리가 있는 호출은 기존과 같은 방식(?a=1&b=2, 한글·특수문자 인코딩, 배열 반복, null 생략)으로 붙는다', async () => {
    const { fn } = stubFetch((call) =>
      call.path === '/api/v1/auth/guest' ? login() : jsonResponse(200, {}),
    );

    await relativeClient().request('/owner/demand', {
      query: { radiusKm: 3, gu: '기흥구', skip: null, ids: [1, 2] },
    });

    expect(urls(fn).at(-1)).toBe(
      `/api/v1/owner/demand?radiusKm=3&gu=${encodeURIComponent('기흥구')}&ids=1&ids=2`,
    );
  });

  it('경로 매개변수와 쿼리가 함께 있어도 맞게 만들어진다', async () => {
    const { fn } = stubFetch((call) =>
      call.path === '/api/v1/auth/guest' ? login() : jsonResponse(200, {}),
    );

    await relativeClient().request('/founder/report', { query: { dongId: 22, categoryId: 7 } });

    expect(urls(fn).at(-1)).toBe('/api/v1/founder/report?dongId=22&categoryId=7');
  });

  it('게스트 로그인(POST)도 상대 경로로 간다', async () => {
    const { fn, calls } = stubFetch((call) =>
      call.path === '/api/v1/auth/guest' ? login() : jsonResponse(200, {}),
    );

    await relativeClient().request('/me');

    expect(calls[0]).toMatchObject({ method: 'POST', path: '/api/v1/auth/guest' });
    expect(urls(fn)[0]).toBe('/api/v1/auth/guest');
  });

  it('절대 기준 주소를 주면 지금처럼 그 호스트 뒤에 /api/v1 이 붙는다(선택 사항)', async () => {
    const { fn } = stubFetch((call) =>
      call.path === '/api/v1/auth/guest' ? login() : jsonResponse(200, {}),
    );
    const client = createApiClient({
      baseUrl: readApiBaseUrl(' http://localhost:8080/ '),
      store: createTokenStore(),
      now: () => 1_000_000,
    });

    await client.request('/me', { query: { a: 1 } });

    expect(urls(fn)).toEqual([
      'http://localhost:8080/api/v1/auth/guest',
      'http://localhost:8080/api/v1/me?a=1',
    ]);
  });
});
