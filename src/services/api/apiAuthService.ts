import type { AuthService } from '../authService';
import type { ApiClient } from './apiClient';
import { ApiError } from './apiError';
import { getApiClient } from './defaultClient';

/**
 * 실제 API 인증 구현. client 를 넘기지 않으면 앱의 기본 클라이언트를 처음 쓸 때 만든다.
 * demoLoginEnabled 가 false 이면 데모 로그인은 호출하지 않고 던진다.
 */
export function createApiAuthService(
  getClient: () => ApiClient = getApiClient,
  demoLoginEnabled = false,
): AuthService {
  return {
    async ensureSession() {
      await getClient().session.ensureSession();
    },
    clearSession() {
      getClient().session.clear();
    },
    demoLoginEnabled,
    async startDemoSession() {
      if (!demoLoginEnabled) {
        throw new ApiError({
          kind: 'parse',
          code: 'DEMO_DISABLED',
          message: '데모 로그인을 쓸 수 없어요.',
        });
      }
      await getClient().session.loginDemo('OWNER');
    },
    endDemoSession() {
      getClient().session.clear();
    },
    isDemoSession() {
      try {
        return getClient().session.isDemo();
      } catch {
        return false;
      }
    },
  };
}
