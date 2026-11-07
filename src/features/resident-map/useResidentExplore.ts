import { useCallback } from 'react';
import { demandService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';

/** 주민 탐색 화면이 쓰는 데이터: 업종별 리포트(카드)와 지도 마커. */
export function useResidentExplore(neighborhoodId: string) {
  const loadReports = useCallback(
    () => demandService.listReportsByNeighborhood(neighborhoodId),
    [neighborhoodId],
  );
  const loadMarkers = useCallback(
    () => demandService.listMapMarkers(neighborhoodId),
    [neighborhoodId],
  );
  return { reports: useAsyncData(loadReports), markers: useAsyncData(loadMarkers) };
}
