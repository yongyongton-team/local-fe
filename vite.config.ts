import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { ProxyOptions } from 'vite';
import { defineConfig } from 'vitest/config';

// 코드는 항상 상대 경로 `/api/v1/...` 로 부르고, 개발 서버(`pnpm dev`)와 미리보기(`pnpm preview`)의 proxy 가 서버로 넘긴다.
// (개발과 배포가 같은 코드로 돌고 CORS 설정이 필요 없다.) 백엔드를 로컬에 띄우면 target 만 http://localhost:8080 으로 바꾼다.
// 서버가 허용하는 출처가 5173 뿐이라 다른 포트의 Origin 헤더가 가면 403 이 되므로, 서버로 보내는 요청에서 Origin 을 지운다.
// 개발·미리보기 proxy 에만 해당하는 처리다(배포는 같은 출처라 영향이 없다).
const API_PROXY: Record<string, ProxyOptions> = {
  '/api': {
    target: 'https://yyt-demand.japaneast.cloudapp.azure.com',
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
    },
  },
};

// 개발·빌드·테스트(Vitest)가 이 설정을 공유하므로 '@' 별칭이 모두 동일하게 동작한다.
// 타입 검사용 별칭은 tsconfig.app.json 의 paths 와 짝을 이룬다.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { proxy: API_PROXY },
  // preview 가 server.proxy 를 상속하는지에 기대지 않고 명시한다.
  preview: { proxy: API_PROXY },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // 개발자의 .env.local(API 주소, VITE_DATA_SOURCE=api 등)이 테스트에 새어 들어가지 않게 모듈이 평가되기 전에 고정한다.
    // 서비스 구현(mock | api)은 import 시점에 고르므로 beforeEach 에서 stubEnv 하면 늦다.
    env: { VITE_DATA_SOURCE: 'mock', VITE_API_BASE_URL: '', VITE_ENABLE_DEMO_LOGIN: '' },
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
