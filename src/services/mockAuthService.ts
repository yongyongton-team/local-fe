import { ApiError } from './api/apiError';
import type { AuthService } from './authService';

/** 목 인증: 아무것도 하지 않는다. 네트워크와 로그인이 전혀 일어나지 않는다. 데모 로그인은 없다. */
export const mockAuthService: AuthService = {
  async ensureSession() {},
  clearSession() {},
  demoLoginEnabled: false,
  async startDemoSession() {
    throw new ApiError({
      kind: 'parse',
      code: 'DEMO_DISABLED',
      message: '데모 로그인을 쓸 수 없어요.',
    });
  },
  endDemoSession() {},
  isDemoSession() {
    return false;
  },
};
