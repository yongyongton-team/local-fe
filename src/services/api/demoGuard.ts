import { ApiError } from './apiError';
import type { GuestSession } from './session';

/** 오류 코드(서버 코드가 아니라 프런트가 만든 값). errorMessages 가 이 코드의 문구를 가진다. */
export const DEMO_SESSION_CODE = 'DEMO_SESSION';

/**
 * 데모 세션이면 던진다. 데모 계정은 모두가 공유하는 계정이라 서버에 쓰는 호출(PUT /me, PUT /me/shop, POST /requests 등)이
 * 이 함수를 거쳐야 한다. 쓰기 호출을 추가할 때 이 함수를 먼저 부른다.
 */
export function assertNotDemoSession(session: Pick<GuestSession, 'isDemo'>): void {
  if (session.isDemo()) {
    throw new ApiError({
      kind: 'parse',
      code: DEMO_SESSION_CODE,
      message: '데모 세션에서는 서버에 쓰지 않아요.',
    });
  }
}
