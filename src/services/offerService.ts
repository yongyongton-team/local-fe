import type { NewOffer, OfferSent, OwnerOffer } from '@/types/domain';

/**
 * 사장님의 방문 판매 제안 접근 인터페이스. 목 구현은 메모리의 목이고 네트워크 호출이 없다.
 * 제안 상세·완료·취소와 주민의 제안 보기·예약은 이 인터페이스에 없다(이후 작업).
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
}
