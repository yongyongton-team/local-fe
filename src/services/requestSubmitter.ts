import type { NewStoreRequest, StoreRequest } from '@/types/domain';

/**
 * 요청 제출 경계. 현재 구현은 메모리에만 저장하는 목이고 네트워크 호출은 없다.
 * 위치로는 선택된 동네 id 만 저장한다(현재 위치 권한은 요청하지 않는다).
 */
export interface RequestSubmitter {
  submit(request: NewStoreRequest): Promise<StoreRequest>;
}
