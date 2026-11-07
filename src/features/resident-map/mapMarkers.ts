import type { MapMarker, MapMarkerKind } from '@/types/domain';

/** 지도 필터. 'all' 은 전부, 나머지는 같은 종류의 마커만 보여준다. */
export type MapFilter = 'all' | MapMarkerKind;

export const MAP_FILTER_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'missing', label: '없는 가게' },
  { value: 'request', label: '주민 요청' },
  { value: 'existing', label: '있는 가게' },
] as const satisfies readonly { value: MapFilter; label: string }[];

/**
 * 필터에 맞는 마커만 골라 돌려준다. 마커의 위치와 순서는 바꾸지 않는다.
 * 컴포넌트에 의존하지 않아 이후 네이버 지도 컴포넌트에서도 그대로 쓴다.
 */
export function getVisibleMarkers(markers: readonly MapMarker[], filter: MapFilter): MapMarker[] {
  return filter === 'all' ? [...markers] : markers.filter((marker) => marker.kind === filter);
}

/** 필터 변경을 보조 기술에 알리는 요약 문구. 예: "현재 있는 가게 3곳 표시 중" */
export function getMarkerSummary(visibleCount: number, filter: MapFilter): string {
  const label = MAP_FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? '';
  return `현재 ${label} ${visibleCount}곳 표시 중`;
}
