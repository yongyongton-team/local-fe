import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { resetMockDb } from '@/mocks/memoryDb';

afterEach(() => {
  cleanup();
  // 요청 제출이 메모리 DB 를 바꾸므로 테스트 사이에 시드 상태로 되돌린다.
  resetMockDb();
});
