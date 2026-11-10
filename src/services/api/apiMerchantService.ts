import { mockDistrictBounds } from '@/mocks/demand';
import type { MeShop, MerchantProfile, Neighborhood, StoreCategory } from '@/types/domain';
import type { AreaDescriptionGenerator } from '../reportDescription';
import { NoShopError, type MerchantService } from '../merchantService';
import type { ApiClient } from './apiClient';
import { ApiError } from './apiError';
import { getApiClient } from './defaultClient';
import type { MeResponseDto, OwnerDemandDto, OwnerDetailDto } from './dto';
import { tryToServerId } from './ids';
import {
  mapMe,
  mapMerchantProfile,
  mapOwnerAreas,
  mapOwnerDetail,
  mapOwnerMapData,
} from './mappers';

interface Options {
  /** 서버 업종 목록(세션 캐시) */
  listCategories: () => Promise<StoreCategory[]>;
  /** 서버 동네 목록(세션 캐시). 가게의 구(gu)와 동네의 구를 찾는 데 쓴다. */
  listNeighborhoods: () => Promise<Neighborhood[]>;
  getClient?: () => ApiClient;
}

/** 같은 호출이 겹쳐 있는 동안은 요청 하나를 나눠 쓰고, 끝나면(성공·실패) 다시 새로 요청한다. */
function shareWhilePending<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (pending === null) {
      const attempt: Promise<T> = load().finally(() => {
        if (pending === attempt) pending = null;
      });
      pending = attempt;
    }
    return pending;
  };
}

/**
 * 사장님 가게 정보·동네 수요·동네 상세의 API 구현(GET /me 의 shop, GET /owner/demand, GET /owner/demand/{dongId}).
 * OWNER 역할이 필요하다. 가게가 없으면(새 OWNER) /owner/demand 는 400 이라 요청하지 않고 NoShopError 를 던진다.
 * 가게 정보는 GET /me 로 따로 읽는다(선택 복원과 호출을 공유하지 않는다: 복원은 앱 시작 때 한 번이고 화면은 열 때마다 새 값이 필요하다).
 */
export function createApiMerchantService({
  listCategories,
  listNeighborhoods,
  getClient = getApiClient,
}: Options): {
  merchantService: MerchantService;
  areaDescriptionGenerator: AreaDescriptionGenerator;
} {
  // 프로필과 지도 데이터가 같은 화면에서 동시에 요청하므로 GET /me 는 겹치는 동안 하나로 합친다.
  const loadShop = shareWhilePending(
    async (): Promise<{
      shop: MeShop;
      profile: MerchantProfile;
    }> => {
      const [dto, neighborhoods] = await Promise.all([
        getClient().request<MeResponseDto>('/me'),
        listNeighborhoods(),
      ]);
      const { shop } = mapMe(dto);
      const profile = mapMerchantProfile(shop, neighborhoods);
      if (shop === null || profile === null) throw new NoShopError();
      return { shop, profile };
    },
  );

  const merchantService: MerchantService = {
    remote: true,
    async getProfile() {
      return (await loadShop()).profile;
    },

    async listAreaDemands({ radiusKm }, signal) {
      const { profile } = await loadShop();
      // 반경은 서버 파라미터다(radiusKm). 제한이 없으면("기흥구 전체") 가게가 있는 구(gu)로 요청한다.
      if (radiusKm === null && profile.district === '') {
        throw new ApiError({ kind: 'parse', message: '가게가 있는 구를 알 수 없어요.' });
      }
      const [dto, neighborhoods] = await Promise.all([
        getClient().request<OwnerDemandDto>('/owner/demand', {
          query: radiusKm === null ? { gu: profile.district } : { radiusKm },
          signal,
        }),
        listNeighborhoods(),
      ]);
      return mapOwnerAreas(dto, neighborhoods);
    },

    async getMapData(signal) {
      const { shop, profile } = await loadShop();
      // 알약은 가게가 있는 구의 수요 동네 전부다(반경 칩과 무관하게 지도는 그대로). 구를 모르면 서버 기본 반경이다.
      const [dto, categories] = await Promise.all([
        getClient().request<OwnerDemandDto>('/owner/demand', {
          query: profile.district === '' ? {} : { gu: profile.district },
          signal,
        }),
        listCategories(),
      ]);
      const category =
        categories.find((c) => c.id === profile.categoryId) ?? fallbackCategory(profile);
      const district = mockDistrictBounds.find((d) => d.district === profile.district);
      return mapOwnerMapData(dto, {
        shop: { lat: shop.lat, lng: shop.lng },
        category,
        ...(district && { areaBounds: district.bounds }),
      });
    },

    async getAreaDetail({ areaId, categoryId }, signal) {
      // 라우트에서 온 값이라 숫자가 아닐 수 있다. 요청 없이 "찾을 수 없음"(null)으로 처리한다.
      const dongId = tryToServerId(areaId);
      const serverCategoryId = tryToServerId(categoryId);
      if (dongId === null || serverCategoryId === null) return null;

      const [dto, categories, neighborhoods] = await Promise.all([
        getClient().request<OwnerDetailDto>(`/owner/demand/${dongId}`, {
          query: { categoryId: serverCategoryId },
          signal,
        }),
        listCategories(),
        listNeighborhoods(),
      ]);
      return mapOwnerDetail(dto, { neighborhoodId: areaId, categoryId, categories, neighborhoods });
    },
  };

  // 한 줄 요약은 상세 응답(summary)에 이미 들어 있다. 별도 호출 없이 그 문장을 돌려준다.
  const areaDescriptionGenerator: AreaDescriptionGenerator = {
    async generate(detail) {
      if (!detail.summary) {
        throw new ApiError({ kind: 'parse', message: '상세 응답에 요약 문장이 없어요.' });
      }
      return detail.summary.text;
    },
  };

  return { merchantService, areaDescriptionGenerator };
}

/** 업종 목록에 내 업종이 없을 때 쓰는 표시(서버가 준 이름 그대로). */
function fallbackCategory(profile: MerchantProfile): StoreCategory {
  return {
    id: profile.categoryId,
    name: profile.categoryName,
    cardTitle: profile.categoryName,
    requestLabel: profile.categoryName,
    missingLabel: profile.categoryName,
    objectPhrase: profile.categoryName,
    titleLabel: profile.categoryName,
  };
}
