import { useCallback } from 'react';
import { demandService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';

/** 주민 탐색 화면이 쓰는 데이터: 업종별 리포트(카드)와 지도 마커. */
export function useResidentExplore(neighborhoodId: string) {
  const loadReports = useCallback(
    (signal: AbortSignal) => demandService.listReportsByNeighborhood(neighborhoodId, signal),
    [neighborhoodId],
  );
  const loadMarkers = useCallback(
    (signal: AbortSignal) => demandService.listMapMarkers(neighborhoodId, signal),
    [neighborhoodId],
  );
  return { reports: useAsyncData(loadReports), markers: useAsyncData(loadMarkers) };
}
