import { useCallback } from 'react';
import { merchantService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';

const loadProfile = () => merchantService.getProfile();
const loadMapData = () => merchantService.getMapData();

export const useMerchantProfile = () => useAsyncData(loadProfile);
export const useMerchantMapData = () => useAsyncData(loadMapData);

/** 내 업종을 원하는 동네(반경 이하, 요청 많은 순). 반경이 바뀌면 다시 불러온다. */
export function useAreaDemands(categoryId: string, radiusKm: number | null) {
  const load = useCallback(
    () => merchantService.listAreaDemands({ categoryId, radiusKm }),
    [categoryId, radiusKm],
  );
  return useAsyncData(load);
}
