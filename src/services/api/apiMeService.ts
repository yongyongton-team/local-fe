import type { MeService } from '../meService';
import type { ApiClient } from './apiClient';
import { getApiClient } from './defaultClient';
import type { HealthResponseDto, MeResponseDto } from './dto';
import { mapHealth, mapMe } from './mappers';

/** GET /me, GET /health 의 실제 API 구현. 화면에는 아직 연결하지 않았다. */
export function createApiMeService(getClient: () => ApiClient = getApiClient): MeService {
  return {
    async getMe(signal) {
      return mapMe(await getClient().request<MeResponseDto>('/me', { signal }));
    },
    async checkHealth(signal) {
      // 상태 확인은 인증이 필요 없다고 보고 토큰을 붙이지 않는다(로그인도 일으키지 않는다).
      return mapHealth(
        await getClient().request<HealthResponseDto>('/health', { signal, auth: false }),
      );
    },
  };
}
