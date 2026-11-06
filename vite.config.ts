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
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
