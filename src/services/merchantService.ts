import type {
  AreaDemand,
  GeoBounds,
  AreaDetail,
  MapMarker,
  MapPosition,
  MerchantProfile,
} from '@/types/domain';

export interface AreaDemandQuery {
  /** 내 업종 */
  categoryId: string;
  /** 탐색 반경(km). 제한이 없으면 null */
  radiusKm: number | null;
}

export interface AreaDetailQuery {
  /** 라우트의 :areaId (동네 id) */
  areaId: string;
  /** 내 업종 */
  categoryId: string;
}

/** 사장님 지도 화면 데이터: 요청 마커와 기준점(내 가게 위치). 반경은 화면의 선택값이라 포함하지 않는다. */
export interface MerchantMapData {
  markers: MapMarker[];
  origin: {
    label: string;
    position: MapPosition;
    lat?: number;
    lng?: number;
    /** 반경 제한이 없을 때("기흥구 전체") 실제 지도에 보여줄 범위. 가게가 있는 구를 대략 감싼다. */
    areaBounds?: GeoBounds;
  };
}

/** 서버에 등록된 가게가 없을 때(API 모드의 새 사장님 계정). 화면은 오류 대신 안내를 보여준다. */
export class NoShopError extends Error {
  constructor() {
    super('등록된 가게가 없어요.');
    this.name = 'NoShopError';
  }
}

export const isNoShopError = (error: unknown): error is NoShopError => error instanceof NoShopError;

/**
 * 사장님 탐색 데이터 접근 인터페이스. 목 구현은 메모리의 목이고 네트워크 호출이 없다.
 * 이 화면은 동네와 요청 개수만 다루며 주민이 입력한 원문 문장이나 개인 정보는 돌려주지 않는다.
 * API 구현은 가게가 없으면 getProfile·getMapData 가 NoShopError 를 던진다.
 */
export interface MerchantService {
  /** 서버 데이터이면 true(요약의 "예시" 표시를 숨기고 서버가 쓴 요약을 쓴다). 목은 false. */
  readonly remote: boolean;
  getProfile(signal?: AbortSignal): Promise<MerchantProfile>;
  /**
   * 내 업종을 원하는 동네. 반경 이하만, 요청 인원 내림차순.
   * API 는 서버가 내 가게의 업종으로 계산하므로 categoryId 를 보내지 않고, 반경(radiusKm)이나 구(gu)로 걸러 서버 순서를 그대로 쓴다.
   */
  listAreaDemands(query: AreaDemandQuery, signal?: AbortSignal): Promise<AreaDemand[]>;
  getMapData(signal?: AbortSignal): Promise<MerchantMapData>;
  /**
   * 한 동네의 수요 상세. 없는 동네이거나 그 업종의 수요 데이터가 없으면 null.
   * API 는 id 가 숫자가 아니면 요청 없이 null 이고, 서버가 모르는 id 는 NOT_FOUND ApiError 로 던진다.
   */
  getAreaDetail(query: AreaDetailQuery, signal?: AbortSignal): Promise<AreaDetail | null>;
}
