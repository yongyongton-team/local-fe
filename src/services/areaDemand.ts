import type { AreaDemand } from '@/types/domain';

/**
 * 반경에 맞는 동네만 골라 요청 인원 내림차순으로 정렬한다.
 * - 거리가 반경 이하(경계 포함)인 동네만 남긴다. radiusKm 이 null 이면 거리 제한이 없다("기흥구 전체").
 * - 인원이 같으면 가까운 동네가 앞에 온다.
 * 서비스 구현과 테스트가 함께 쓰는 순수 함수다. 입력 배열은 바꾸지 않는다.
 */
export function selectAreaDemands(
  areas: readonly AreaDemand[],
  radiusKm: number | null,
): AreaDemand[] {
  return areas
    .filter((area) => radiusKm === null || area.distanceKm <= radiusKm)
    .sort((a, b) => b.requestCount - a.requestCount || a.distanceKm - b.distanceKm);
}
