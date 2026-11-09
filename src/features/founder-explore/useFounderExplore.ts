import { useCallback } from 'react';
import { demandService, founderService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { StoreCategory } from '@/types/domain';

interface FounderCategories {
  categories: StoreCategory[];
  /** 업종을 고르지 않았거나 올바르지 않을 때 쓰는 기본 업종 id. API 는 FRUIT_VEG(없으면 첫 업종), 목은 기존 값 */
  defaultCategoryId: string;
}

const loadCategories = async (): Promise<FounderCategories> => {
  const [categories, defaultCategoryId] = await Promise.all([
    demandService.listCategories(),
    demandService.getDefaultCategoryId(),
  ]);
  return { categories, defaultCategoryId };
};

/** 업종 목록과 기본 업종. 둘이 모두 준비되기 전에는 loading 이다. */
export const useCategories = () => useAsyncData(loadCategories);

/** 업종에 대한 입지 순위. 업종이 바뀌면 다시 불러오고, 이전 요청은 취소한다. */
export function useLocationRanks(categoryId: string) {
  const load = useCallback(
    (signal: AbortSignal) => founderService.listLocationRanks(categoryId, signal),
    [categoryId],
  );
  return useAsyncData(load);
}
