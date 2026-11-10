import { useCallback } from 'react';
import { merchantService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';

const loadProfile = (signal: AbortSignal) => merchantService.getProfile(signal);
const loadMapData = (signal: AbortSignal) => merchantService.getMapData(signal);

export const useMerchantProfile = () => useAsyncData(loadProfile);
export const useMerchantMapData = () => useAsyncData(loadMapData);

/** 내 업종을 원하는 동네(반경 이하, 요청 많은 순). 반경이 바뀌면 다시 불러오고 이전 요청은 취소한다. */
export function useAreaDemands(categoryId: string, radiusKm: number | null) {
  const load = useCallback(
    (signal: AbortSignal) => merchantService.listAreaDemands({ categoryId, radiusKm }, signal),
    [categoryId, radiusKm],
  );
  return useAsyncData(load);
}
