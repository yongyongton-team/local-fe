import type { MapOverview, StoreCategory } from '@/types/domain';
import type { DemandService } from '../demandService';
import type { ApiClient } from './apiClient';
import { getApiClient } from './defaultClient';
import type { CategoryDto, DongDto, DongMapDto, GapDto } from './dto';
import { toServerId } from './ids';
import {
  mapCategories,
  mapDongs,
  mapGaps,
  mapMapMarkers,
  mapRequestedStores,
  pickDefaultCategoryId,
} from './mappers';
import { ApiError } from './apiError';

/**
 * 성공할 때까지만 결과(Promise)를 기억하는 함수. 같은 호출이 겹치면 요청 하나를 나눠 쓰고,
 * 실패하면 기억을 지워 다음 호출이 다시 요청하게 한다. 기억은 만든 서비스 인스턴스 안에만 있다.
 */
function memoizeUntilFailure<T>(load: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null;
  return () => {
    if (cached === null) {
      const attempt: Promise<T> = load().catch((error: unknown) => {
        if (cached === attempt) cached = null;
        throw error;
      });
      cached = attempt;
    }
    return cached;
  };
}

/**
 * 수요 서비스의 API 구현. 동네 목록(GET /dongs), 업종 목록(GET /categories)과 주민 조회
 * (GET /dongs/{id}/gaps, GET /dongs/{id}/map)와 기본 업종이며 DemandService 의 모든 메서드가 서버를 쓴다.
 * base(목)는 시그니처를 맞추려고 받을 뿐 지금은 어떤 메서드도 base 로 대체되지 않는다.
 * 동네·업종 목록은 바뀌지 않는 참조 데이터라 세션 동안 한 번만 불러 나눠 쓴다(실패하면 다음 호출에서 다시).
 */
export function createApiDemandService(
  base: DemandService,
  getClient: () => ApiClient = getApiClient,
): DemandService {
  const loadNeighborhoods = memoizeUntilFailure(async () =>
    mapDongs(await getClient().request<DongDto[]>('/dongs')),
  );
  const loadCategories = memoizeUntilFailure(async () => {
    const dtos = await getClient().request<CategoryDto[]>('/categories');
    return { categories: mapCategories(dtos), defaultCategoryId: pickDefaultCategoryId(dtos) };
  });

  async function getMapOverview(
    neighborhoodId: string,
    signal?: AbortSignal,
  ): Promise<MapOverview> {
    const dongId = toServerId(neighborhoodId);
    const request = getClient().request<DongMapDto>(`/dongs/${dongId}/map`, { signal });
    // 알약·목록의 업종 문구용이다. 업종 목록을 못 불러와도 가게 핀과 알약(항목의 이름 사용)은 그린다.
    const categories = loadCategories().then(
      (loaded) => loaded.categories,
      (): StoreCategory[] => [],
    );
    // 둘을 함께 기다린다: 한쪽을 기다리는 동안 다른 쪽이 취소(abort)로 거부돼도 처리되지 않은 거부로 남지 않는다.
    const [dto, loaded] = await Promise.all([request, categories]);
    // 같은 응답 한 번으로 마커와 "주민이 요청한 가게"를 만든다(요청을 한 번 더 보내지 않는다).
    return {
      markers: mapMapMarkers(dto, loaded),
      requestedStores: mapRequestedStores(dto, loaded),
    };
  }

  return {
    ...base,
    listNeighborhoods: loadNeighborhoods,
    async listCategories() {
      return (await loadCategories()).categories;
    },
    async getDefaultCategoryId() {
      const { defaultCategoryId } = await loadCategories();
      if (defaultCategoryId === undefined) {
        throw new ApiError({ kind: 'parse', message: '업종 목록이 비어 있어요.' });
      }
      return defaultCategoryId;
    },
    async listReportsByNeighborhood(neighborhoodId, signal) {
      const dongId = toServerId(neighborhoodId);
      const gapsRequest = getClient().request<GapDto[]>(`/dongs/${dongId}/gaps`, { signal });
      const referenceRequest = Promise.all([loadCategories(), loadNeighborhoods()]);
      // gaps 가 먼저 실패해도(예: 404) 참조 데이터의 거부가 처리되지 않은 채 남지 않게 한다.
      referenceRequest.catch(() => undefined);

      const gaps = await gapsRequest;
      const [{ categories }, neighborhoods] = await referenceRequest;
      // 서버가 아는 동네가 목록에 없는 경우는 없어야 하지만, 이름을 지어내지 않고 비워 둔다.
      const neighborhood = neighborhoods.find((n) => n.id === neighborhoodId) ?? {
        id: neighborhoodId,
        district: '',
        name: '',
      };
      return mapGaps(gaps, { neighborhood, categories });
    },
    getMapOverview,
    async listMapMarkers(neighborhoodId, signal) {
      return (await getMapOverview(neighborhoodId, signal)).markers;
    },
  };
}
