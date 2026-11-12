import { useCallback } from 'react';
import { merchantService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { AreaDetail, MerchantProfile } from '@/types/domain';

export interface OfferContext {
  profile: MerchantProfile;
  /** 제안의 대상 동네 id. 주소의 ?area= 가 우선이고 없으면 가게가 있는 동네다. */
  areaId: string;
  /** 그 동네의 내 업종 수요(요청 수·조건). 요약 카드에 쓴다. */
  detail: AreaDetail;
}

/** 대상 동네를 알 수 없을 때(주소에도, 가게 정보에도 동네가 없다). */
export class NoAreaError extends Error {
  constructor() {
    super('제안을 보낼 동네를 알 수 없어요.');
    this.name = 'NoAreaError';
  }
}

export const isNoAreaError = (error: unknown): error is NoAreaError => error instanceof NoAreaError;

/** 동네가 요청 데이터에 없어 상세가 비었을 때 */
class NoDetailError extends NoAreaError {}

/**
 * 제안 화면의 "현재 동네·업종"과 요약 카드 데이터.
 * 업종은 내 가게의 업종이고, 동네는 주소의 ?area= (동네 상세에서 들어올 때), 없으면 가게가 있는 동네다.
 * 가게가 없으면 NoShopError, 동네를 알 수 없으면 NoAreaError 로 실패한다. 동네가 바뀌면 이전 요청은 취소한다.
 */
export function useOfferContext(areaParam: string | null) {
  const load = useCallback(
    async (signal: AbortSignal): Promise<OfferContext> => {
      const profile = await merchantService.getProfile(signal);
      const areaId = areaParam ?? profile.dongId;
      if (!areaId) throw new NoAreaError();
      const detail = await merchantService.getAreaDetail(
        { areaId, categoryId: profile.categoryId },
        signal,
      );
      if (!detail) throw new NoDetailError();
      return { profile, areaId, detail };
    },
    [areaParam],
  );
  return useAsyncData(load);
}
