import { useCallback } from 'react';
import { areaDescriptionGenerator, merchantService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { AreaDetail } from '@/types/domain';

export interface AreaDetailView {
  detail: AreaDetail;
  /** 한 줄 요약 문장. 생성에 실패하면 null(수치 화면은 그대로 보여준다) */
  summary: string | null;
}

/** 내 업종 기준 동네 상세와 한 줄 요약. 없는 동네면 data 가 null 이다. */
export function useAreaDetail(areaId: string | undefined) {
  const load = useCallback(async (): Promise<AreaDetailView | null> => {
    if (!areaId) return null;
    const profile = await merchantService.getProfile();
    const detail = await merchantService.getAreaDetail({ areaId, categoryId: profile.categoryId });
    if (!detail) return null;
    const summary = await areaDescriptionGenerator.generate(detail).catch(() => null);
    return { detail, summary };
  }, [areaId]);
  return useAsyncData(load);
}
