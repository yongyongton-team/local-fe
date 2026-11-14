import { useCallback } from 'react';
import { demandService, merchantService, offerService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { OwnerOffer } from '@/types/domain';

export interface OfferDetailData {
  offer: OwnerOffer;
  /** 내 가게의 업종 표기(제안에는 업종이 없다). 가게나 업종을 못 불러오면 없다. */
  categoryLabel?: string;
}

/** 내 가게의 업종 표기(titleLabel). 실패하면 undefined 라 상세는 업종 없이 보인다(제안 자체는 보인다). */
async function loadCategoryLabel(signal: AbortSignal): Promise<string | undefined> {
  try {
    const profile = await merchantService.getProfile(signal);
    const categories = await demandService.listCategories();
    return categories.find((c) => c.id === profile.categoryId)?.titleLabel;
  } catch {
    return undefined;
  }
}

/**
 * 제안 상세 데이터. 제안은 목록에서 id 로 찾는다(단건 조회가 없다). 없으면 data 가 null 이다.
 * offerId 가 바뀌면 이전 요청은 취소한다.
 */
export function useOfferDetail(offerId: string | undefined) {
  const load = useCallback(
    async (signal: AbortSignal): Promise<OfferDetailData | null> => {
      if (!offerId) return null;
      const offer = await offerService.getOwnerOffer(offerId, signal);
      if (!offer) return null;
      const categoryLabel = await loadCategoryLabel(signal);
      return { offer, ...(categoryLabel !== undefined && { categoryLabel }) };
    },
    [offerId],
  );
  return useAsyncData(load);
}
