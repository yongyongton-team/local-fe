import type { OfferService } from '../offerService';
import type { ApiClient } from './apiClient';
import { getApiClient } from './defaultClient';
import type { CreateOfferResponseDto } from './dto';
import { buildCreateOfferBody, mapCreateOfferResponse, mapOwnerOffers } from './mappers';

/**
 * 사장님 제안의 API 구현(GET /owner/offers, POST /offers). OWNER 역할이 필요하다.
 * 시연 사장님(데모 세션)도 읽기와 쓰기(POST /offers) 모두 서버로 보낸다(백엔드가 데모 사장님의 제안 보내기를 허용했다).
 * 다른 쓰기(PUT /me, PUT /me/shop, POST·DELETE /requests)는 데모 세션에서 막는다(demoGuard).
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
  };
}
