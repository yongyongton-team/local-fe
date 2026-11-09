/** JWT 페이로드의 시각 클레임(초 단위, JWT 표준). 읽을 수 없으면 undefined. */
export interface JwtTimes {
  exp?: number;
  iat?: number;
}

/**
 * JWT 의 페이로드에서 exp·iat 만 읽는다(서명은 검증하지 않는다. 만료 시각 계산용이다).
 * 토큰이 아니거나 깨져 있으면 빈 객체. 토큰이나 페이로드 내용은 어디에도 출력하지 않는다.
 */
export function readJwtTimes(token: string): JwtTimes {
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
    const body: unknown = JSON.parse(json);
    if (typeof body !== 'object' || body === null) return {};
    const { exp, iat } = body as Record<string, unknown>;
    return {
      ...(typeof exp === 'number' && Number.isFinite(exp) && { exp }),
      ...(typeof iat === 'number' && Number.isFinite(iat) && { iat }),
    };
  } catch {
    return {};
  }
}
