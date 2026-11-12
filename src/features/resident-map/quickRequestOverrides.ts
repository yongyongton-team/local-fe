import type { MapMarker, NeighborhoodReport, RequestedStore } from '@/types/domain';

/**
 * 이 화면에서 보낸 간편 요청의 반영. 서버·메모리를 다시 읽지 않고 화면의 카드와 요청 알약을 바로 고친다.
 * extra 는 인원에 더할 값이다: 보내서 늘었으면 1, 이미 요청해 둔 것(ALREADY_REQUESTED)이면 0 이다.
 * 어느 쪽이든 "내가 요청함"이 된다.
 */
export interface RequestOverride {
  extra: number;
}

/** 업종 id → 반영 값 */
export type RequestOverrides = Readonly<Record<string, RequestOverride>>;

/** 카드 데이터에 반영한다: 인원을 더하고 내가 요청함으로 바꾼다. 반영할 것이 없으면 같은 배열을 돌려준다. */
export function applyOverridesToReports(
  reports: readonly NeighborhoodReport[],
  overrides: RequestOverrides,
): readonly NeighborhoodReport[] {
  if (Object.keys(overrides).length === 0) return reports;
  return reports.map((report) => {
    const override = overrides[report.category.id];
    if (!override) return report;
    return {
      ...report,
      demand: {
        ...report.demand,
        requestCount: report.demand.requestCount + override.extra,
        requestedByMe: true,
      },
    };
  });
}

/**
 * "주민이 요청한 가게" 목록에 반영한다: 인원에 extra 를 더하고(없는 가게 카드와 같은 규칙) 요청 많은 순을 유지한다(같으면 원래 순서).
 * ✓ 는 이 데이터가 아니라 화면이 overrides 에 그 업종이 있는지로 정한다. 반영할 것이 없으면 같은 배열을 돌려준다.
 */
export function applyOverridesToRequestedStores(
  stores: readonly RequestedStore[],
  overrides: RequestOverrides,
): readonly RequestedStore[] {
  if (Object.keys(overrides).length === 0) return stores;
  return stores
    .map((store, index) => {
      const override = overrides[store.category.id];
      return {
        store: override ? { ...store, requestCount: store.requestCount + override.extra } : store,
        index,
      };
    })
    .sort((a, b) => b.store.requestCount - a.store.requestCount || a.index - b.index)
    .map(({ store }) => store);
}

/**
 * 지도의 "요청 N" 알약에 반영한다. 라벨 끝의 숫자에 더한다(예: "과일 요청 29" → "과일 요청 30").
 * 다른 종류의 마커나 업종이 다른 알약, 끝에 숫자가 없는 라벨은 그대로 둔다.
 */
export function applyOverridesToMarkers(
  markers: readonly MapMarker[],
  overrides: RequestOverrides,
): readonly MapMarker[] {
  if (Object.keys(overrides).length === 0) return markers;
  return markers.map((marker) => {
    const override =
      marker.kind === 'request' && marker.categoryId ? overrides[marker.categoryId] : undefined;
    if (!override || override.extra === 0) return marker;
    return {
      ...marker,
      label: marker.label.replace(/\d+$/, (count) => String(Number(count) + override.extra)),
    };
  });
}
