import type { NewStoreRequest, StoreRequest } from '@/types/domain';

/**
 * 요청 제출 경계. 현재 구현은 메모리에만 저장하는 목이고 네트워크 호출은 없다.
 * 위치로는 선택된 동네 id 만 저장한다(현재 위치 권한은 요청하지 않는다).
 */
export interface RequestSubmitter {
  /**
   * 서버에 저장하는 구현이면 true. 서버는 시간대(1개 이상)와 빈도를 필수로 받으므로,
   * true 이면 화면이 이 둘을 고르기 전에는 보내지 못하게 한다. 목은 false(둘 다 선택 사항).
   */
  readonly remote: boolean;
  submit(request: NewStoreRequest): Promise<StoreRequest>;
}
