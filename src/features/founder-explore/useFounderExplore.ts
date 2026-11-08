import { useCallback } from 'react';
import { demandService, founderService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';

const loadCategories = () => demandService.listCategories();

export const useCategories = () => useAsyncData(loadCategories);

/** 업종에 대한 입지 순위. 업종이 바뀌면 다시 불러온다. */
export function useLocationRanks(categoryId: string) {
  const load = useCallback(() => founderService.listLocationRanks(categoryId), [categoryId]);
  return useAsyncData(load);
}
