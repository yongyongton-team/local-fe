import { useCallback } from 'react';
import { merchantService, offerService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { OwnerOffer } from '@/types/domain';

export interface OfferDetailData {
  offer: OwnerOffer;
  /** 내 가게 이름(제목 줄 "가게 이름 / 제안 제목"). 가게 정보를 못 불러오거나 이름이 비면 없다. */
  shopName?: string;
}

/** 내 가게 이름. 실패하면 undefined 라 상세는 제안 제목만 보인다(제안 자체는 보인다). */
async function loadShopName(signal: AbortSignal): Promise<string | undefined> {
  try {
    const profile = await merchantService.getProfile(signal);
    const name = profile.shopName.trim();
    return name === '' ? undefined : name;
  } catch {
    return undefined;
  }
}

/**
 * 제안 상세 데이터. 제안은 목록에서 id 로 찾는다(단건 조회가 없다). 없으면 data 가 null 이다.
 * retryIfMissing 은 제안을 막 보낸 직후의 진입이다: 목록에 아직 없으면(목록 갱신 지연) 한 번 다시 조회한다.
 * offerId 가 바뀌면 이전 요청은 취소한다.
 */
export function useOfferDetail(offerId: string | undefined, retryIfMissing = false) {
  const load = useCallback(
    async (signal: AbortSignal): Promise<OfferDetailData | null> => {
      if (!offerId) return null;
      let offer = await offerService.getOwnerOffer(offerId, signal);
      if (!offer && retryIfMissing) offer = await offerService.getOwnerOffer(offerId, signal);
      if (!offer) return null;
      const shopName = await loadShopName(signal);
      return { offer, ...(shopName !== undefined && { shopName }) };
    },
    [offerId, retryIfMissing],
  );
  return useAsyncData(load);
}
