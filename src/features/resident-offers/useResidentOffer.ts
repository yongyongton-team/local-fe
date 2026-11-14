import { useCallback } from 'react';
import { myRequestService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { ResidentOffer } from '@/types/domain';

/**
 * 주민 제안 상세 데이터. 단건 조회가 없어서 내 요청 목록의 offers[] 에서 id 로 찾는다. 없으면 data 가 null 이다.
 * offerId 가 바뀌면 이전 결과는 버리고 다시 불러온다.
 */
export function useResidentOffer(offerId: string | undefined) {
  const load = useCallback(
    async (): Promise<ResidentOffer | null> =>
      offerId ? myRequestService.getResidentOffer(offerId) : null,
    [offerId],
  );
  return useAsyncData(load);
}
