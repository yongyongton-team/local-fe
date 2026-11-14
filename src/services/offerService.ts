import type { NewOffer, OfferSent, OwnerOffer } from '@/types/domain';

/**
 * 사장님의 방문 판매 제안 접근 인터페이스. 목 구현은 메모리의 목이고 네트워크 호출이 없다.
 * 주민의 제안 보기·예약은 이 인터페이스에 없다(이후 작업).
 *
 * 제안 상태는 서버가 정한다: 마감 전에는 OPEN 이고, 마감 시각이 지난 뒤에야 주문 수량 합계가 minOrders 이상이면
 * CONFIRMED, 아니면 CLOSED 가 된다(조회할 때 계산). 사장님이 취소하면 CANCELLED, 수령이 끝나면 DONE 이다.
 */
export interface OfferService {
  /** 서버 데이터이면 true, 목은 false. */
  readonly remote: boolean;
  /** 내가 보낸 제안. 서버(목은 최근 보낸 순) 순서 그대로다. 사장님만 부를 수 있다. */
  listOwnerOffers(signal?: AbortSignal): Promise<OwnerOffer[]>;
  /**
   * 제안을 보낸다. 데모 세션도 막지 않는다(서버가 판단한다).
   * 알림을 받은 주민 수(notifiedResidentCount)는 서버가 주지 않았거나 올바르지 않으면 없다.
   */
  createOffer(input: NewOffer): Promise<OfferSent>;
  /**
   * 내 제안 한 건. 단건 조회 엔드포인트가 없어서 목록(GET /owner/offers)에서 id 로 찾는다. 없으면 null.
   * API 는 id 가 숫자가 아니면 요청 없이 null 이다.
   */
  getOwnerOffer(offerId: string, signal?: AbortSignal): Promise<OwnerOffer | null>;
  /**
   * 판매 끝: 수령이 끝난 제안으로 바꾼다(DONE). 확정(CONFIRMED)일 때만 되고 아니면 409 OFFER_CLOSED 다.
   * 갱신된 제안을 돌려준다. 남의 제안은 403, 없는 제안은 404. 데모 세션도 막지 않는다(서버가 판단한다).
   */
  completeOffer(offerId: string): Promise<OwnerOffer>;
  /**
   * 제안 취소(CANCELLED): 그 제안의 예약 주문이 모두 취소되어 orderCount 가 0 이 된다.
   * 모집 중(OPEN)·확정(CONFIRMED)일 때만 되고 아니면 409 OFFER_CLOSED 다. 갱신된 제안을 돌려준다.
   * 남의 제안은 403, 없는 제안은 404. 데모 세션도 막지 않는다(서버가 판단한다).
   */
  cancelOffer(offerId: string): Promise<OwnerOffer>;
}
