import { getDb } from '@/mocks/memoryDb';
import type { ResidentOffer } from '@/types/domain';
import { ApiError } from './api/apiError';
import type { OrderService } from './orderService';

/** 서버가 받는 수량 범위(POST /offers/{id}/orders 의 quantity) */
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10;

const httpError = (status: number, code: string) =>
  new ApiError({ kind: 'http', status, code, message: `mock ${code}` });

/** 메모리 DB 의 모든 요청에서 제안을 찾는다(요청마다 자기 동네·업종의 제안을 가진다). */
function findOffer(offerId: string): ResidentOffer | undefined {
  for (const { offers = [] } of getDb().requests) {
    const found = offers.find((offer) => offer.id === offerId);
    if (found) return found;
  }
  return undefined;
}

/**
 * 선주문·예약 취소 목. 서버 규칙과 같게 동작하고 메모리 DB 의 제안(내 요청 목록)을 직접 바꾼다.
 * - 제안 상태는 서버가 조회할 때 계산한다: 마감 전에는 OPEN 이고, 마감 시각이 지난 뒤에야 주문 수량 합계가 minOrders 이상이면
 *   CONFIRMED, 아니면 CLOSED 가 된다. 목은 시각을 흘려보내지 않으므로 시드의 상태를 그대로 쓰고 주문으로 상태를 바꾸지 않는다
 *   (인원이 차도 마감 전에는 OPEN 이다).
 * - 주문·예약 취소는 OPEN 일 때만 된다. 아니면 409 OFFER_CLOSED.
 * - orderCount 는 주문 수량의 합계(취소 제외)다. 시드의 값에는 다른 주민의 주문이 들어 있다.
 * 목에는 "내 동네" 개념이 없어 "내 동네 제안에만 주문할 수 있다"(400)는 검사하지 않는다.
 */
export const mockOrderService: OrderService = {
  remote: false,
  async createOrder(offerId, quantity) {
    if (!Number.isInteger(quantity) || quantity < MIN_QUANTITY || quantity > MAX_QUANTITY) {
      throw httpError(400, 'VALIDATION_ERROR');
    }
    const offer = findOffer(offerId);
    if (!offer) throw httpError(404, 'NOT_FOUND');
    if (offer.status !== 'OPEN') throw httpError(409, 'OFFER_CLOSED');
    // 취소가 아닌 주문(RESERVED·PICKED_UP)이 이미 있다.
    if (offer.myOrder) throw httpError(409, 'ALREADY_ORDERED');

    const db = getDb();
    // 취소했던 주문은 같은 주문이 되살아난다(id 유지).
    const revivedId = db.cancelledOrderIds[offer.id];
    const id = revivedId ?? `mock-order-${db.nextOrderNumber++}`;
    delete db.cancelledOrderIds[offer.id];

    offer.myOrder = { id, offerId: offer.id, quantity, status: 'RESERVED' };
    offer.orderCount += quantity;
    return {
      order: { ...offer.myOrder },
      orderCount: offer.orderCount,
      minOrders: offer.minOrders,
    };
  },
  async cancelOrder(orderId) {
    const db = getDb();
    for (const { offers = [] } of db.requests) {
      const offer = offers.find((candidate) => candidate.myOrder?.id === orderId);
      const order = offer?.myOrder;
      if (!offer || !order) continue;
      // OPEN 이고 주문이 RESERVED 일 때만 취소할 수 있다(받아 간 주문, 마감·완료된 제안은 409).
      if (offer.status !== 'OPEN' || order.status !== 'RESERVED') {
        throw httpError(409, 'OFFER_CLOSED');
      }
      offer.orderCount = Math.max(0, offer.orderCount - order.quantity);
      offer.myOrder = null;
      db.cancelledOrderIds[offer.id] = order.id;
      return;
    }
    // 이미 취소한 주문을 다시 취소하면 그냥 성공(204)이다.
    if (Object.values(db.cancelledOrderIds).includes(orderId)) return;
    throw httpError(404, 'NOT_FOUND');
  },
};
