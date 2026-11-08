import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetMockDb } from '@/mocks/memoryDb';
import { resetNaverMapScriptForTests } from '@/shared/lib/useNaverMapScript';

beforeEach(() => {
  // 개발자의 .env.local 에 실제 키가 있어도 테스트는 키가 없는 상태로 시작한다(네트워크·실제 SDK 사용 금지).
  // 지도 테스트는 필요할 때 vi.stubEnv 로 가짜 키를 넣는다.
  vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', '');
});

afterEach(() => {
  cleanup();
  // 요청 제출이 메모리 DB 를 바꾸므로 테스트 사이에 시드 상태로 되돌린다.
  resetMockDb();
  // 네이버 지도 스크립트 상태와 가짜 SDK 를 처음 상태로 되돌린다.
  resetNaverMapScriptForTests();
  Reflect.deleteProperty(window, 'naver');
  vi.unstubAllEnvs();
});
