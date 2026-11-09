import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// 개발·빌드·테스트(Vitest)가 이 설정을 공유하므로 '@' 별칭이 모두 동일하게 동작한다.
// 타입 검사용 별칭은 tsconfig.app.json 의 paths 와 짝을 이룬다.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // 개발자의 .env.local(API 주소, VITE_DATA_SOURCE=api 등)이 테스트에 새어 들어가지 않게 모듈이 평가되기 전에 고정한다.
    // 서비스 구현(mock | api)은 import 시점에 고르므로 beforeEach 에서 stubEnv 하면 늦다.
    env: { VITE_DATA_SOURCE: 'mock', VITE_API_BASE_URL: '', VITE_ENABLE_DEMO_LOGIN: '' },
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
