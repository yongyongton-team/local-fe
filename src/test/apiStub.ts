import { vi } from 'vitest';

/** 스텁 fetch 가 받은 요청(검증용). 토큰은 테스트용 가짜 값이다. */
export interface StubCall {
  method: string;
  /** 경로와 쿼리(호스트 제외). 예: /api/v1/me?x=1 */
  path: string;
  authorization: string | null;
  contentType: string | null;
  body: string | null;
}

type Handler = (call: StubCall, init: RequestInit) => Response | Promise<Response>;

/** 테스트용 JSON 응답 */
export const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * 전역 fetch 를 handler 로 바꾼다(setup.ts 의 네트워크 차단 스텁을 덮어쓴다). 받은 요청이 calls 에 쌓인다.
 * handler 가 던지면 fetch 가 그 오류로 거부된다.
 */
export function stubFetch(handler: Handler) {
  const calls: StubCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    // 상대 경로(/api/v1/...)로 부르는 경우도 있어 기준 주소를 둔다. 경로와 쿼리만 기록한다.
    const url = new URL(String(input), 'http://localhost');
    const headers = new Headers(init.headers);
    const call: StubCall = {
      method: init.method ?? 'GET',
      path: `${url.pathname}${url.search}`,
      authorization: headers.get('Authorization'),
      contentType: headers.get('Content-Type'),
      body: typeof init.body === 'string' ? init.body : null,
    };
    calls.push(call);
    return handler(call, init);
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}

/** 가짜 JWT(서명 없음). 페이로드의 exp·iat 는 초 단위다. */
export function fakeJwt(payload: { exp?: number; iat?: number } = {}): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'none' })}.${encode(payload)}.sig`;
}
