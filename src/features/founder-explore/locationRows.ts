import { VERDICT_NOT_JUDGED } from '@/shared/lib/publicData';
import type { LocationRank, MapMarker, PublicData, StoreCategory } from '@/types/domain';
import { FOUNDER_COPY } from './copy';

export interface LocationRowText {
  /** 굵은 제목. 예: 1. 구성동 */
  title: string;
  /** 작은 둘째 줄. 예: 요청 29명 · 같은 업종 0곳 · 대형마트 2.4km */
  detail: string;
  /**
   * 공공데이터 줄. 예: 기대 7곳 · 실제 9곳 · {서버 판정 문구}. 공공데이터가 없으면 없다(기존 행과 같다).
   * 판정 문구가 길면 줄바꿈된다.
   */
  extra?: string;
  /** 링크의 접근 가능한 이름. 한 문장으로 읽힌다. */
  accessibleName: string;
}

/** 순위 표기. 예: 1. 구성동 (지도 알약과 행 제목이 같은 문구를 쓴다) */
export const rankLabel = (item: LocationRank): string => `${item.rank}. ${item.neighborhood.name}`;

/** 대형마트 거리가 없으면 그 부분을 뺀다. */
function hypermarketPart(item: LocationRank): string | null {
  return item.nearestHypermarketKm === undefined ? null : `대형마트 ${item.nearestHypermarketKm}km`;
}

const isCount = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * 공공데이터 줄. "기대 N곳 · 실제 M곳"과 서버의 판정 문구(verdictLabel)를 " · "로 잇는다.
 * - 숫자는 판정이 NOT_JUDGED 가 아니고 expectedCount·dongStoreCount 가 둘 다 유효한 숫자일 때만 보인다.
 *   expectedCount 는 소수라 가장 가까운 정수로 반올림해서 보인다(6.7 → 7, 10.5 → 11). 실제 가게 수는 그대로다.
 * - NOT_JUDGED 이면 숫자 없이 판정 문구만 보인다. 판정 문구가 없으면 그 부분을 뺀다.
 * - publicData 가 없거나 보일 것이 없으면 null 이다. 부족하지 않다는 판정(NOT_SHORT 등)도 숨기지 않는다.
 */
export function describePublicData(data: PublicData | undefined): string | null {
  if (!data) return null;
  const label = data.verdictLabel?.trim();
  const numbers =
    data.verdict !== VERDICT_NOT_JUDGED &&
    isCount(data.expectedCount) &&
    isCount(data.dongStoreCount)
      ? FOUNDER_COPY.expectedActual(Math.round(data.expectedCount), data.dongStoreCount)
      : null;
  const line = [numbers, label].filter((part): part is string => !!part).join(' · ');
  return line === '' ? null : line;
}

/** 순위 행의 문구. 수치는 모두 데이터에서 만든다. 주민이 입력한 원문 문장은 쓰지 않는다. */
export function describeLocationRow(item: LocationRank): LocationRowText {
  const parts = [
    `요청 ${item.requestCount}명`,
    `같은 업종 ${item.nearbySameCategoryCount}곳`,
    hypermarketPart(item),
  ].filter((part): part is string => part !== null);
  const extra = describePublicData(item.publicData);
  return {
    title: rankLabel(item),
    detail: parts.join(' · '),
    ...(extra !== null && { extra }),
    // 숫자와 판정 문구는 한 문장으로 읽힌다.
    accessibleName: [`${rankLabel(item)}, ${parts.join(', ')}`, extra]
      .filter((part): part is string => part !== null)
      .join(', '),
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

/**
 * 입지 찾기의 지도 카드를 보여줄지. 서버가 준 순위(API 모드)에는 좌표가 없어서 마커가 0개이면 빈 지도 카드를 숨긴다.
 * 서버가 중심 좌표를 주기 시작해 마커가 생기면 자동으로 다시 보인다. 목 모드는 항상 보인다.
 */
export function shouldShowRankMap(remote: boolean, markerCount: number): boolean {
  return !remote || markerCount > 0;
}
