import { useCallback, useMemo } from 'react';
import { demandService, myRequestService } from '@/services';
import { useAsyncData, type AsyncState } from '@/shared/lib/useAsyncData';
import type { MapMarker, RequestedStore } from '@/types/domain';

/**
 * 주민 탐색 화면이 쓰는 데이터: 업종별 리포트(카드), 지도 마커, "주민이 요청한 가게".
 * 마커와 요청한 가게는 같은 응답(지도 개요) 한 번으로 만든다. 같은 응답이라 둘의 상태(로딩·오류)도 같다.
 */
export function useResidentExplore(neighborhoodId: string) {
  const loadReports = useCallback(
    (signal: AbortSignal) => demandService.listReportsByNeighborhood(neighborhoodId, signal),
    [neighborhoodId],
  );
  const loadOverview = useCallback(
    (signal: AbortSignal) => demandService.getMapOverview(neighborhoodId, signal),
    [neighborhoodId],
  );
  const reports = useAsyncData(loadReports);
  const overview = useAsyncData(loadOverview);

  const markers: AsyncState<MapMarker[]> = useMemo(
    () =>
      overview.status === 'success' ? { status: 'success', data: overview.data.markers } : overview,
    [overview],
  );
  const requestedStores: AsyncState<RequestedStore[]> = useMemo(
    () =>
      overview.status === 'success'
        ? { status: 'success', data: overview.data.requestedStores }
        : overview,
    [overview],
  );
  return { reports, markers, requestedStores };
}

const loadMyRequests = () => myRequestService.listMyRequests();

/**
 * 내가 이미 요청한 (동네, 업종) 키 집합(GET /me/requests). 요청 목록은 ✓ 표시용 부가 정보라
 * 불러오는 중이거나 실패하거나 권한이 없으면 빈 집합이다(오류 안내를 내지 않는다).
 * 도메인 id 는 서버 id(양의 정수)의 문자열이라 문자열 그대로 비교한다.
 */
export function useMyRequestedKeys(): ReadonlySet<string> {
  const state = useAsyncData(loadMyRequests);
  return useMemo(
    () =>
      new Set(
        state.status === 'success'
          ? state.data.map((item) => requestedKey(item.neighborhood.id, item.category.id))
          : [],
      ),
    [state],
  );
}

export const requestedKey = (neighborhoodId: string, categoryId: string) =>
  `${neighborhoodId}:${categoryId}`;
