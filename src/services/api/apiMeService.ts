import type { MeService } from '../meService';
import type { ApiClient } from './apiClient';
import { getApiClient } from './defaultClient';
import type { HealthResponseDto, MeResponseDto } from './dto';
import { ApiError } from './apiError';
import { toServerId } from './ids';
import { mapHealth, mapMe, toServerRole } from './mappers';

/** GET /me, PUT /me(역할·동네 저장), GET /health 의 실제 API 구현. */
export function createApiMeService(getClient: () => ApiClient = getApiClient): MeService {
  return {
    savesRemotely: true,
    async getMe(signal) {
      return mapMe(await getClient().request<MeResponseDto>('/me', { signal }));
    },
    async saveSelection(role, neighborhoodId, signal) {
      const serverRole = toServerRole(role);
      if (serverRole === null) {
        throw new ApiError({
          kind: 'parse',
          code: 'INVALID_ROLE',
          message: '알 수 없는 역할이에요.',
        });
      }
      const dongId = toServerId(neighborhoodId);
      return mapMe(
        await getClient().request<MeResponseDto>('/me', {
          method: 'PUT',
          body: { role: serverRole, dongId },
          signal,
        }),
      );
    },
    async checkHealth(signal) {
      // 상태 확인은 인증이 필요 없다고 보고 토큰을 붙이지 않는다(로그인도 일으키지 않는다).
      return mapHealth(
        await getClient().request<HealthResponseDto>('/health', { signal, auth: false }),
      );
    },
  };
}
