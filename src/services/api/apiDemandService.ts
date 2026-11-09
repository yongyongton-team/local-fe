import type { DemandService } from '../demandService';
import type { ApiClient } from './apiClient';
import { getApiClient } from './defaultClient';
import type { CategoryDto, DongDto } from './dto';
import { mapCategories, mapDongs } from './mappers';

/**
 * 수요 서비스의 부분 API 구현. 동네 목록(GET /dongs)과 업종 목록(GET /categories)만 실제 서버이고,
 * 나머지 메서드(리포트·지도 마커 등)는 base(목) 구현을 그대로 쓴다. 3단계 이후에 하나씩 API 로 바꾼다.
 * 목 메서드는 slug id 기준이라, 여기서 만든 숫자 id 로 부르면 비어 있거나 없는 동네로 처리된다.
 */
export function createApiDemandService(
  base: DemandService,
  getClient: () => ApiClient = getApiClient,
): DemandService {
  return {
    ...base,
    async listNeighborhoods() {
      return mapDongs(await getClient().request<DongDto[]>('/dongs'));
    },
    async listCategories() {
      return mapCategories(await getClient().request<CategoryDto[]>('/categories'));
    },
  };
}
