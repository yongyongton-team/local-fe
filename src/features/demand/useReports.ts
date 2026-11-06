import { useCallback } from 'react';
import { DEFAULT_CATEGORY_ID, demandService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';

const loadReports = () => demandService.listReports(DEFAULT_CATEGORY_ID);

/** 요청 많은 순 동네별 리포트 목록. */
export function useReports() {
  return useAsyncData(loadReports);
}

/** 한 동네의 리포트. 존재하지 않는 동네면 data 가 null 이다. */
export function useReport(areaId: string | undefined) {
  const load = useCallback(
    () => (areaId ? demandService.getReport(areaId, DEFAULT_CATEGORY_ID) : Promise.resolve(null)),
    [areaId],
  );
  return useAsyncData(load);
}
