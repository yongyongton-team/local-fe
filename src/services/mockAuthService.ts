import type { AuthService } from './authService';

/** 목 인증: 아무것도 하지 않는다. 네트워크와 로그인이 전혀 일어나지 않는다. */
export const mockAuthService: AuthService = {
  async ensureSession() {},
  clearSession() {},
};
