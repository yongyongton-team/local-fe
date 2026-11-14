import type { OrderResult } from '@/types/domain';

/**
 * 주민의 선주문·예약 취소 경계.
 * - mock: 메모리 목(네트워크 없음). 서버 규칙과 같게 동작하고, 같은 메모리 DB 의 제안(내 요청 목록)을 바꾼다.
 * - api: POST /offers/{offerId}/orders, DELETE /orders/{orderId}. 데모 세션이면 서버에 보내지 않고 던진다(공유 계정 보호).
 *
 * 제안 상태는 서버가 정한다: 마감 전에는 OPEN 이고, 마감 시각이 지난 뒤에야 주문 수량 합계가 minOrders 이상이면
 * CONFIRMED, 아니면 CLOSED 가 된다. 주문과 예약 취소는 제안이 OPEN 일 때만 된다.
 */
export interface OrderService {
  /** 서버 데이터이면 true, 목은 false. */
  readonly remote: boolean;
  /**
   * 선주문한다. 수량은 1~10 이다(서버가 검증한다).
   * - 409 OFFER_CLOSED: 제안이 OPEN 이 아니다. 409 ALREADY_ORDERED: 이미 주문(취소가 아닌)이 있다.
   * - 400 VALIDATION_ERROR: 내 동네 제안이 아니거나 수량이 범위 밖이다. 404 NOT_FOUND: 없는 제안이다.
   * 취소했던 주문이면 되살아난다(다시 주문할 수 있다).
   */
  createOrder(offerId: string, quantity: number): Promise<OrderResult>;
  /**
   * 예약을 취소한다(제안이 OPEN 이고 주문이 RESERVED 일 때만). 아니면 409 OFFER_CLOSED 다.
   * 이미 취소한 주문을 다시 취소하면 성공이다. 남의 주문은 403, 없는 주문은 404 다.
   */
  cancelOrder(orderId: string): Promise<void>;
}
