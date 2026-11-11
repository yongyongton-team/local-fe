import type { MyRequest } from '@/types/domain';

/**
 * 내가 보낸 요청 조회·삭제 경계.
 * - mock: 메모리 목(네트워크 없음). 사장님 응답은 목 시드로만 존재한다.
 * - api: GET /me/requests, DELETE /requests/{id}.
 */
export interface MyRequestService {
  /** 서버 데이터이면 true("예시 데이터" 표시를 숨긴다). 목은 false. */
  readonly remote: boolean;
  /** 가장 최근에 보낸 요청이 앞에 온다. 요청이 없으면 빈 배열 */
  listMyRequests(): Promise<MyRequest[]>;
  /**
   * 내가 보낸 요청을 지운다. 이미 지워진 요청(서버 404, 목에서 없는 id)은 성공으로 본다(결과가 같다).
   * 그 밖의 실패는 던진다. api 는 데모 세션이면 서버에 보내지 않고 던진다(공유 계정 보호).
   */
  deleteRequest(requestId: string): Promise<void>;
}
