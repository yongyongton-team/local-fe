import type { MyRequest, ResidentOffer } from '@/types/domain';

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
   * 주민이 받은 제안 한 건. 단건 조회가 없어서 내 요청 목록(GET /me/requests)의 모든 요청 offers[] 에서 id 로 찾는다. 없으면 null.
   * 서버는 취소된 제안을 주지 않아 사장님이 취소하면 null 이 된다. API 는 id 가 숫자가 아니면 요청 없이 null 이다.
   */
  getResidentOffer(offerId: string): Promise<ResidentOffer | null>;
  /**
   * 내가 보낸 요청을 지운다. 이미 지워진 요청(서버 404, 목에서 없는 id)은 성공으로 본다(결과가 같다).
   * 그 밖의 실패는 던진다. api 는 데모 세션이면 서버에 보내지 않고 던진다(공유 계정 보호).
   */
  deleteRequest(requestId: string): Promise<void>;
}
