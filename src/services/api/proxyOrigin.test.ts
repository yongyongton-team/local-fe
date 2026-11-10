import { describe, expect, it, vi } from 'vitest';
import config from '../../../vite.config';

// jsdom 환경에서는 vite.config.ts 의 `new URL('./src', import.meta.url)` 가 fileURLToPath 에서 거부된다.
// 이 테스트가 보는 것은 proxy 설정뿐이라 별칭 경로 계산만 대체한다(설정 파일 구조는 그대로다).
vi.mock('node:url', () => ({ fileURLToPath: () => '/src' }));

/**
 * 개발·미리보기 proxy 가 서버로 보내는 요청에서 Origin 만 지우는지 본다.
 * 서버가 허용하는 출처가 5173 뿐이라 다른 포트의 Origin 이 가면 403 이 된다.
 */
type ProxyReqHandler = (proxyReq: { removeHeader: (name: string) => void }) => void;

function runConfigure(options: unknown) {
  const { configure } = options as { configure: (proxy: unknown) => void };
  const handlers: Record<string, ProxyReqHandler> = {};
  configure({
    on: (event: string, handler: ProxyReqHandler) => {
      handlers[event] = handler;
    },
  });
  return handlers;
}

describe('proxy 설정의 Origin 제거', () => {
  it('server.proxy 와 preview.proxy 가 같은 /api 설정을 쓴다', () => {
    const server = config.server?.proxy?.['/api'];
    const preview = config.preview?.proxy?.['/api'];
    expect(server).toBeDefined();
    expect(preview).toBe(server);
  });

  it('proxyReq 에서 origin 헤더만 지운다', () => {
    const handlers = runConfigure(config.server?.proxy?.['/api']);
    const removeHeader = vi.fn();
    handlers.proxyReq!({ removeHeader });

    expect(removeHeader).toHaveBeenCalledTimes(1);
    expect(removeHeader).toHaveBeenCalledWith('origin');
    // Referer·Authorization 등 다른 헤더는 지우지 않는다.
    expect(removeHeader).not.toHaveBeenCalledWith('referer');
    expect(removeHeader).not.toHaveBeenCalledWith('authorization');
  });
});
