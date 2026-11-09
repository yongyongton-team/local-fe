import type { Health, Me } from '@/types/domain';

/**
 * 내 정보와 서버 상태 경계.
 * - mock: 고정된 예시 값(네트워크 없음).
 * - api: GET /me, GET /health. 호출하면 필요할 때 게스트 로그인을 먼저 한다(/health 는 토큰 없이 부른다).
 */
export interface MeService {
  getMe(signal?: AbortSignal): Promise<Me>;
  checkHealth(signal?: AbortSignal): Promise<Health>;
}
