import type { LocationRank, MapMarker, StoreCategory } from '@/types/domain';

export interface LocationRowText {
  /** 굵은 제목. 예: 1. 구성동 */
  title: string;
  /** 작은 둘째 줄. 예: 요청 29명 · 같은 업종 0곳 · 대형마트 2.4km */
  detail: string;
  /** 링크의 접근 가능한 이름. 한 문장으로 읽힌다. */
  accessibleName: string;
}

/** 순위 표기. 예: 1. 구성동 (지도 알약과 행 제목이 같은 문구를 쓴다) */
export const rankLabel = (item: LocationRank): string => `${item.rank}. ${item.neighborhood.name}`;

/** 대형마트 거리가 없으면 그 부분을 뺀다. */
function hypermarketPart(item: LocationRank): string | null {
  return item.nearestHypermarketKm === undefined ? null : `대형마트 ${item.nearestHypermarketKm}km`;
}

/** 순위 행의 문구. 수치는 모두 데이터에서 만든다. 주민이 입력한 원문 문장은 쓰지 않는다. */
export function describeLocationRow(item: LocationRank): LocationRowText {
  const parts = [
    `요청 ${item.requestCount}명`,
    `같은 업종 ${item.nearbySameCategoryCount}곳`,
    hypermarketPart(item),
  ].filter((part): part is string => part !== null);
  return {
    title: rankLabel(item),
    detail: parts.join(' · '),
    accessibleName: `${rankLabel(item)}, ${parts.join(', ')}`,
  };
}

/**
 * 지도 알약. 새 마커 종류 없이 어두운 알약 모양의 기존 "요청" 마커를 쓴다. 라벨과 위치·좌표는 순위 데이터에서 온다.
 * 위치 정보(상대좌표 position 도 위경도 lat·lng 도)가 전혀 없는 항목은 마커를 만들지 않는다
 * (서버 순위에는 좌표가 없다. 순위 목록은 마커와 무관하게 보여준다). 좌표를 만들어 넣지 않는다.
 */
export function buildRankMarkers(items: readonly LocationRank[], categoryId: string): MapMarker[] {
  return items.flatMap((item): MapMarker[] => {
    const hasGeo = item.lat !== undefined && item.lng !== undefined;
    // 자리표시자 지도용 상대좌표. 좌표만 있고 position 이 없으면 실제 지도만 이 마커를 그린다(자리표시자에서는 가운데).
    const position = item.position ?? (hasGeo ? PLACEHOLDER_CENTER : undefined);
    if (position === undefined) return [];
    return [
      {
        id: `founder-${item.neighborhood.id}-${categoryId}`,
        kind: 'request',
        categoryId,
        label: rankLabel(item),
        position,
        // 실제 지도용 좌표(서비스 계층이 준 값). 없으면 자리표시자 지도만 이 마커를 그린다.
        ...(hasGeo && { lat: item.lat, lng: item.lng }),
      },
    ];
  });
}

/** position 없이 좌표만 있는 항목의 자리표시자 지도 위치. 실제 지도에서는 쓰이지 않는다. */
const PLACEHOLDER_CENTER = { x: 0.5, y: 0.5 } as const;

/** 업종이 바뀔 때 보조 기술에 알리는 요약. 예: 과일 / 채소 가게 기준 동네 3곳 표시 중 */
export function buildMapSummary(category: StoreCategory, count: number): string {
  return `${category.cardTitle} 기준 동네 ${count}곳 표시 중`;
}

/** URL 쿼리의 업종 값을 검증한다. 없거나 목록에 없는 값이면 기본 업종이다. */
export function resolveCategoryId(
  param: string | null,
  categories: readonly StoreCategory[],
  defaultId: string,
): string {
  return param !== null && categories.some((c) => c.id === param) ? param : defaultId;
}
