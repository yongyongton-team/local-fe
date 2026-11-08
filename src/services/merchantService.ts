import type { AreaDemand, MapMarker, MapPosition, MerchantProfile } from '@/types/domain';

export interface AreaDemandQuery {
  /** 내 업종 */
  categoryId: string;
  /** 탐색 반경(km). 제한이 없으면 null */
  radiusKm: number | null;
}

/** 사장님 지도 화면 데이터: 요청 마커와 기준점(내 가게 위치). 반경은 화면의 선택값이라 포함하지 않는다. */
export interface MerchantMapData {
  markers: MapMarker[];
  origin: { label: string; position: MapPosition };
}

/**
 * 사장님 탐색 데이터 접근 인터페이스. 현재 구현은 메모리의 목이고 네트워크 호출은 없다.
 * 이 화면은 동네와 요청 개수만 다루며 주민이 입력한 원문 문장이나 개인 정보는 돌려주지 않는다.
 */
export interface MerchantService {
  getProfile(): Promise<MerchantProfile>;
  /** 내 업종을 원하는 동네. 반경 이하만, 요청 인원 내림차순 */
  listAreaDemands(query: AreaDemandQuery): Promise<AreaDemand[]>;
  getMapData(): Promise<MerchantMapData>;
}
