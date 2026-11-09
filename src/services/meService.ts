import type { Health, Me, UserRole } from '@/types/domain';

/**
 * 내 정보와 서버 상태 경계.
 * - mock: 고정된 예시 값(네트워크 없음).
 * - api: GET /me, GET /health. 호출하면 필요할 때 게스트 로그인을 먼저 한다(/health 는 토큰 없이 부른다).
 */
export interface MeService {
  /**
   * saveSelection 이 서버에 저장하는지. false(mock)이면 화면은 저장을 기다리지 않고 기존처럼 바로 이동한다
   * (네트워크가 없고, 목 모드의 동작을 그대로 유지하기 위해서다).
   */
  readonly savesRemotely: boolean;
  getMe(signal?: AbortSignal): Promise<Me>;
  /**
   * 메인 화면의 "시작하기": 역할과 동네를 서버에 저장한다(PUT /me). 서버는 같은 계정에서 역할을 여러 번 바꿀 수 있다.
   * neighborhoodId 는 도메인의 문자열 id 이고 API 구현이 숫자로 바꿔 보낸다(숫자가 아니면 ApiError). 저장된 내 정보를 돌려준다.
   */
  saveSelection(role: UserRole, neighborhoodId: string, signal?: AbortSignal): Promise<Me>;
  checkHealth(signal?: AbortSignal): Promise<Health>;
}
