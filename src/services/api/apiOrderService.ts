import type { OrderService } from '../orderService';
import type { ApiClient } from './apiClient';
import { getApiClient } from './defaultClient';
import type { CreateOrderResponseDto } from './dto';
import { assertNotDemoSession } from './demoGuard';
import { toServerId } from './ids';
import { mapOrderResult } from './mappers';

/**
 * 주민의 선주문·예약 취소 API 구현. 두 호출 모두 공유 데이터를 바꾸므로 데모 세션에서는 서버에 보내지 않는다(demoGuard).
 * 오류(409 ALREADY_ORDERED·OFFER_CLOSED, 400, 403, 404)는 그대로 던지고 화면이 코드별 문구로 바꾼다.
 */
export function createApiOrderService(getClient: () => ApiClient = getApiClient): OrderService {
  return {
    remote: true,
    async createOrder(offerId, quantity) {
      // 공유 데모 계정으로 주문하지 않는다. id 가 숫자가 아니면 요청 없이 INVALID_ID 다.
      assertNotDemoSession(getClient().session);
      const id = toServerId(offerId);
      const dto = await getClient().request<CreateOrderResponseDto>(`/offers/${id}/orders`, {
        method: 'POST',
        body: { quantity },
      });
      return mapOrderResult(dto);
    },
    async cancelOrder(orderId) {
      // 공유 데모 계정의 주문을 취소하지 않는다. 성공은 204(본문 없음)이다.
      assertNotDemoSession(getClient().session);
      const id = toServerId(orderId);
      await getClient().request<undefined>(`/orders/${id}`, { method: 'DELETE' });
    },
  };
}
