import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch, jsonResponse } from '@/test/apiStub';
import { ApiError } from './apiError';
import { buildQueryString, sendRequest } from './http';

const URL_ = 'https://api.test/api/v1/x';
const failure = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('거부되어야 해요');
};

afterEach(() => vi.useRealTimers());

describe('buildQueryString', () => {
  it('null·undefined 는 빼고 배열은 같은 이름을 반복하며 값을 인코딩한다', () => {
    expect(buildQueryString({ a: 1, b: undefined, c: null, d: ['x', 'y'], e: '한 글&' })).toBe(
      '?a=1&d=x&d=y&e=%ED%95%9C+%EA%B8%80%26',
    );
    expect(buildQueryString({})).toBe('');
    expect(buildQueryString(undefined)).toBe('');
  });
});

describe('sendRequest 요청', () => {
  it('Authorization 헤더, 쿼리, JSON 본문을 보낸다', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, { ok: true }));

    await sendRequest({
      url: URL_,
      method: 'POST',
      query: { categoryId: 3 },
      body: { text: '과일' },
      token: 'tok',
    });

    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/x?categoryId=3',
      authorization: 'Bearer tok',
      contentType: 'application/json',
      body: '{"text":"과일"}',
    });
  });

  it('토큰과 본문이 없으면 Authorization·Content-Type 을 보내지 않는다', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, {}));

    await sendRequest({ url: URL_ });

    expect(calls[0]).toMatchObject({ authorization: null, contentType: null, body: null });
  });
});

describe('sendRequest 응답', () => {
  it('JSON 을 돌려준다', async () => {
    stubFetch(() => jsonResponse(200, { a: 1 }));

    await expect(sendRequest({ url: URL_ })).resolves.toEqual({ a: 1 });
  });

  it('204 와 빈 본문은 undefined 다', async () => {
    stubFetch(() => new Response(null, { status: 204 }));
    await expect(sendRequest({ url: URL_ })).resolves.toBeUndefined();

    stubFetch(() => new Response('', { status: 200 }));
    await expect(sendRequest({ url: URL_ })).resolves.toBeUndefined();

    stubFetch(() => new Response('   \n', { status: 200 }));
    await expect(sendRequest({ url: URL_ })).resolves.toBeUndefined();
  });

  it('성공인데 JSON 이 아니면 parse 오류다', async () => {
    stubFetch(() => new Response('<html>ok</html>', { status: 200 }));

    const error = await failure(sendRequest({ url: URL_ }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'parse', status: 200 });
  });
});

describe('sendRequest 오류 정규화', () => {
  it('오류 본문이 {code, message} 이면 code 만 보존하고 서버 message 는 오류 메시지에 쓰지 않는다', async () => {
    stubFetch(() => jsonResponse(409, { code: 'ALREADY_REQUESTED', message: '서버가 준 문구' }));

    const error = await failure(sendRequest({ url: URL_ }));

    expect(error).toMatchObject({ kind: 'http', status: 409, code: 'ALREADY_REQUESTED' });
    expect(error.message).not.toContain('서버가 준 문구');
    expect(error.message).toContain('409');
  });

  it('숫자 code 는 문자열로 보존한다', async () => {
    stubFetch(() => jsonResponse(400, { code: 4001 }));

    expect(await failure(sendRequest({ url: URL_ }))).toMatchObject({ kind: 'http', code: '4001' });
  });

  it.each([
    ['nginx HTML', new Response('<html><body>502 Bad Gateway</body></html>', { status: 502 })],
    ['빈 본문', new Response('', { status: 500 })],
    ['JSON 배열', jsonResponse(400, [1, 2])],
    ['code 가 없는 JSON', jsonResponse(404, { error: 'Not Found', status: 404 })],
    ['문자열 본문', new Response('plain text', { status: 503 })],
    ['깨진 JSON', new Response('{"code":', { status: 500 })],
    ['null', new Response('null', { status: 500 })],
  ])('오류 본문이 %s 여도 ApiError(http, code 없음)로 정규화된다', async (_name, response) => {
    stubFetch(() => response);

    const error = await failure(sendRequest({ url: URL_ }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe('http');
    expect(error.status).toBe(response.status);
    expect(error.code).toBeUndefined();
  });

  it('서버에 닿지 못하면 network 오류다', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch');
    });

    expect(await failure(sendRequest({ url: URL_ }))).toMatchObject({ kind: 'network' });
  });

  it('응답 시간이 지나면 timeout 오류이고 network 와 구분된다', async () => {
    vi.useFakeTimers();
    stubFetch(
      (_call, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError')));
        }),
    );

    const pending = failure(sendRequest({ url: URL_, timeoutMs: 50 }));
    await vi.advanceTimersByTimeAsync(49);
    await vi.advanceTimersByTimeAsync(2);

    expect(await pending).toMatchObject({ kind: 'timeout' });
  });

  it('기본 타임아웃은 10초다', async () => {
    vi.useFakeTimers();
    stubFetch(
      (_call, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError')));
        }),
    );

    const pending = failure(sendRequest({ url: URL_ }));
    await vi.advanceTimersByTimeAsync(9_999);
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);

    expect(await pending).toMatchObject({ kind: 'timeout' });
  });

  it('호출한 쪽이 취소하면 ApiError 가 아니라 AbortError 로 그대로 던진다', async () => {
    stubFetch(
      (_call, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const controller = new AbortController();

    const pending = failure(sendRequest({ url: URL_, signal: controller.signal }));
    controller.abort();
    const error = await pending;

    expect(error).not.toBeInstanceOf(ApiError);
    expect(error.name).toBe('AbortError');
  });

  it('이미 취소된 signal 이면 요청을 보내지 않고 AbortError 다', async () => {
    const { fn } = stubFetch(() => jsonResponse(200, {}));
    const controller = new AbortController();
    controller.abort();

    const error = await failure(sendRequest({ url: URL_, signal: controller.signal }));

    expect(error.name).toBe('AbortError');
    expect(fn).not.toHaveBeenCalled();
  });
});
