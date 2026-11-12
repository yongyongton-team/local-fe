import type { OfferService } from '../offerService';
import type { ApiClient } from './apiClient';
import { assertNotDemoSession } from './demoGuard';
import { getApiClient } from './defaultClient';
import type { CreateOfferResponseDto } from './dto';
import { buildCreateOfferBody, mapCreateOfferResponse, mapOwnerOffers } from './mappers';

/**
 * 사장님 제안의 API 구현(GET /owner/offers, POST /offers). OWNER 역할이 필요하다.
 * 읽기는 데모 세션에서도 된다. 쓰기(POST /offers)는 공유 데모 계정으로 보내지 않고 막는다.
 */
export function createApiOfferService(getClient: () => ApiClient = getApiClient): OfferService {
  return {
    remote: true,
    async listOwnerOffers(signal) {
      const dto = await getClient().request<unknown>('/owner/offers', { signal });
      return mapOwnerOffers(dto);
    },
    async createOffer(input) {
      // 공유 데모 계정으로 제안을 만들지 않는다. POST /offers 는 이 한 곳에서만 부른다.
      assertNotDemoSession(getClient().session);
      const body = buildCreateOfferBody(input);
      const dto = await getClient().request<CreateOfferResponseDto>('/offers', {
        method: 'POST',
        body,
      });
      return mapCreateOfferResponse(dto);
    },
  };
}
