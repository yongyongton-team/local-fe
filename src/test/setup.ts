import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetMockDb } from '@/mocks/memoryDb';
import { resetNaverMapScriptForTests } from '@/shared/lib/useNaverMapScript';

/**
 * 실제 네트워크를 막는 전역 fetch 스텁. 호출되면 그 테스트는 실패한다(오류가 앱 코드에서 삼켜져도 afterEach 가 잡는다).
 * 클라이언트 테스트는 vi.stubGlobal('fetch', ...) 으로 이 스텁을 덮어써서 쓴다.
 */
const blockedFetch = vi.fn(async () => {
  throw new Error('테스트에서 실제 네트워크 요청은 허용되지 않아요. fetch 를 스텁하세요.');
});

beforeEach(() => {
  blockedFetch.mockClear();
  vi.stubGlobal('fetch', blockedFetch);
  // 개발자의 .env.local 에 실제 키가 있어도 테스트는 키가 없는 상태로 시작한다(네트워크·실제 SDK 사용 금지).
  // 지도 테스트는 필요할 때 vi.stubEnv 로 가짜 키를 넣는다.
  vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', '');
});

afterEach(() => {
  const blockedCalls = blockedFetch.mock.calls.length;
  cleanup();
  // 요청 제출이 메모리 DB 를 바꾸므로 테스트 사이에 시드 상태로 되돌린다.
  resetMockDb();
  // 네이버 지도 스크립트 상태와 가짜 SDK 를 처음 상태로 되돌린다.
  resetNaverMapScriptForTests();
  Reflect.deleteProperty(window, 'naver');
  vi.unstubAllEnvs();
  if (blockedCalls > 0) {
    throw new Error(
      `테스트가 스텁하지 않은 fetch 를 ${blockedCalls}번 호출했어요(실제 네트워크 금지).`,
    );
  }
});
