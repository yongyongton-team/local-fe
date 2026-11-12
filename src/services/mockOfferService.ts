import { getDb } from '@/mocks/memoryDb';
import type { OwnerOffer } from '@/types/domain';
import type { OfferService } from './offerService';

const copyOffer = (offer: OwnerOffer): OwnerOffer => ({
  ...offer,
  ...(offer.pickupAt && { pickupAt: new Date(offer.pickupAt) }),
  ...(offer.deadlineAt && { deadlineAt: new Date(offer.deadlineAt) }),
});

/** 메모리 DB 에만 저장하는 목. 보낸 제안은 목록 맨 앞(최근)에 들어가고 새로고침하면 사라진다. */
export const mockOfferService: OfferService = {
  remote: false,
  async listOwnerOffers() {
    return getDb().offers.map(copyOffer);
  },
  async createOffer(input) {
    const db = getDb();
    db.offers.unshift({
      id: `offer-${db.nextOfferNumber++}`,
      title: input.title.trim(),
      status: 'OPEN',
      price: input.price,
      pickupAt: new Date(input.pickupAt),
      deadlineAt: new Date(input.deadlineAt),
      orderCount: 0,
      minOrders: input.minOrders,
    });
    // [임의] 알림을 받은 주민 수: 그 동네·업종의 요청 인원과 같다고 본다(요청이 없으면 0명).
    const demand = db.summaries.find(
      (s) => s.neighborhoodId === input.neighborhoodId && s.categoryId === input.categoryId,
    );
    return { notifiedResidentCount: demand?.requestCount ?? 0 };
  },
};
