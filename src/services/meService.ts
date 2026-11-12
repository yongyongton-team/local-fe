import type { Health, Me, Neighborhood, UserRole } from '@/types/domain';

/** 서버에 저장된 역할과 동네(새로고침 뒤 화면 선택 상태로 되살리는 값) */
export interface SavedSelection {
  role: UserRole;
  neighborhood: Neighborhood;
}

/** 내 가게 저장 입력. 위치는 좌표만 보낸다(동네는 서버가 좌표로 찾는다). categoryId 는 도메인의 문자열 id 다. */
export interface ShopInput {
  shopName: string;
  categoryId: string;
  lat: number;
  lng: number;
}

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
   * 새로고침 뒤 서버에 저장된 선택을 되살릴 수 있는지(동기). API 는 저장된 토큰이 있을 때만 true, mock 은 항상 false.
   * false 이면 restoreSelection 을 부르지 않는다(복원할 것이 없고 네트워크도 쓰지 않는다).
   */
  canRestoreSelection(): boolean;
  /**
   * 서버에 저장된 역할과 동네(GET /me). 둘 중 하나라도 없거나 알 수 없는 역할이면 null 이다.
   * 저장된 토큰이 없으면 요청하지 않고 null 이다. 실패하면 ApiError 로 던진다.
   */
  restoreSelection(signal?: AbortSignal): Promise<SavedSelection | null>;
  /**
   * 메인 화면의 "시작하기": 역할과 동네를 서버에 저장한다(PUT /me). 서버는 같은 계정에서 역할을 여러 번 바꿀 수 있다.
   * neighborhoodId 는 도메인의 문자열 id 이고 API 구현이 숫자로 바꿔 보낸다(숫자가 아니면 ApiError). 저장된 내 정보를 돌려준다.
   */
  saveSelection(role: UserRole, neighborhoodId: string, signal?: AbortSignal): Promise<Me>;
  /**
   * 사장님의 내 가게를 등록하거나 고친다(PUT /me/shop). 응답은 쓰지 않고, 화면은 GET /me 로 다시 읽는다.
   * api 는 데모 세션이면 서버에 보내지 않고 던진다(공유 계정 보호). mock 은 메모리 상태만 바꾼다.
   */
  saveShop(input: ShopInput, signal?: AbortSignal): Promise<void>;
  checkHealth(signal?: AbortSignal): Promise<Health>;
}
