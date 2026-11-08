import { useCallback } from 'react';
import { founderService, reportDescriptionGenerator } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { AreaReport } from '@/types/domain';

/** 한 동네·업종의 리포트 수치. 없는 동네·업종이면 data 가 null 이다. */
export function useAreaReport(areaId: string | undefined, categoryId: string) {
  const load = useCallback(
    () => (areaId ? founderService.getAreaReport({ areaId, categoryId }) : Promise.resolve(null)),
    [areaId, categoryId],
  );
  return useAsyncData(load);
}

/** "왜 이 동네인가요?" 문장. 수치와 따로 불러와, 생성이 실패해도 수치 카드는 그대로 보인다. */
export function useReportSentence(report: AreaReport) {
  const load = useCallback(() => reportDescriptionGenerator.generate(report), [report]);
  return useAsyncData(load);
}
