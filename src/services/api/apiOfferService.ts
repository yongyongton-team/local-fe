import type { OfferService } from '../offerService';
import type { ApiClient } from './apiClient';
import { getApiClient } from './defaultClient';
import type { CreateOfferResponseDto } from './dto';
import { toServerId, tryToServerId } from './ids';
import {
  buildCreateOfferBody,
  mapCreateOfferResponse,
  mapOwnerOfferResponse,
  mapOwnerOffers,
} from './mappers';

/**
 * 사장님 제안의 API 구현(GET /owner/offers, POST /offers, POST /offers/{id}/done, POST /offers/{id}/cancel). OWNER 역할이 필요하다.
 * 시연 사장님(데모 세션)도 읽기와 쓰기(제안 보내기·판매 끝·제안 취소) 모두 서버로 보낸다(백엔드가 데모 사장님에게 허용했다).
 * 다른 쓰기(PUT /me, PUT /me/shop, POST·DELETE /requests)는 데모 세션에서 막는다(demoGuard).
 * 판매 끝·제안 취소는 본문이 없고 갱신된 OwnerOfferItem 을 돌려준다.
 */
export function createApiOfferService(getClient: () => ApiClient = getApiClient): OfferService {
  return {
    remote: true,
    async listOwnerOffers(signal) {
      const dto = await getClient().request<unknown>('/owner/offers', { signal });
      return mapOwnerOffers(dto);
    },
    async createOffer(input) {
      // 데모 세션을 막지 않는다. 데모 주민·창업자 등 허용되지 않는 경우는 서버가 판단하고 오류 문구로 보여준다.
      const body = buildCreateOfferBody(input);
      const dto = await getClient().request<CreateOfferResponseDto>('/offers', {
        method: 'POST',
        body,
      });
      return mapCreateOfferResponse(dto);
    },
    async getOwnerOffer(offerId, signal) {
      // 라우트에서 온 값이라 숫자가 아닐 수 있다. 요청 없이 "찾을 수 없음"(null)으로 처리한다.
      if (tryToServerId(offerId) === null) return null;
      const dto = await getClient().request<unknown>('/owner/offers', { signal });
      return mapOwnerOffers(dto).find((offer) => offer.id === offerId) ?? null;
    },
    async completeOffer(offerId) {
      // 데모 세션을 막지 않는다(assertNotDemoSession 없음). 서버가 CONFIRMED 가 아니면 409 OFFER_CLOSED 를 준다.
      const dto = await getClient().request<unknown>(`/offers/${toServerId(offerId)}/done`, {
        method: 'POST',
      });
      return mapOwnerOfferResponse(dto);
    },
    async cancelOffer(offerId) {
      // 데모 세션을 막지 않는다(assertNotDemoSession 없음). 서버가 OPEN·CONFIRMED 가 아니면 409 OFFER_CLOSED 를 준다.
      const dto = await getClient().request<unknown>(`/offers/${toServerId(offerId)}/cancel`, {
        method: 'POST',
      });
      return mapOwnerOfferResponse(dto);
    },
  };
}
