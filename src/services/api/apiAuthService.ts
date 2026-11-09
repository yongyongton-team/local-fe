import type { AuthService } from '../authService';
import type { ApiClient } from './apiClient';
import { getApiClient } from './defaultClient';

/** 실제 API 인증 구현. client 를 넘기지 않으면 앱의 기본 클라이언트를 처음 쓸 때 만든다. */
export function createApiAuthService(getClient: () => ApiClient = getApiClient): AuthService {
  return {
    async ensureSession() {
      await getClient().session.ensureSession();
    },
    clearSession() {
      getClient().session.clear();
    },
  };
}
