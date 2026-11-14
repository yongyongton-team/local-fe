import { getDb } from '@/mocks/memoryDb';
import { mockNeighborhoods } from '@/mocks/demand';
import type { OwnerOffer } from '@/types/domain';
import { ApiError } from './api/apiError';
import type { OfferService } from './offerService';

const copyOffer = (offer: OwnerOffer): OwnerOffer => ({
  ...offer,
  ...(offer.pickupAt && { pickupAt: new Date(offer.pickupAt) }),
  ...(offer.deadlineAt && { deadlineAt: new Date(offer.deadlineAt) }),
});

/** 서버의 409 OFFER_CLOSED 를 재현한다(그 상태에서는 처리할 수 없다). */
const offerClosed = () =>
  new ApiError({
    kind: 'http',
    status: 409,
    code: 'OFFER_CLOSED',
    message: '지금은 처리할 수 없는 상태예요.',
  });

/** 서버의 404 NOT_FOUND 를 재현한다. */
const notFound = () =>
  new ApiError({ kind: 'http', status: 404, code: 'NOT_FOUND', message: '없는 제안이에요.' });

/**
 * 메모리 DB 에만 저장하는 목. 보낸 제안은 목록 맨 앞(최근)에 들어가고 새로고침하면 사라진다.
 *
 * 상태는 서버 규칙을 따른다. 실제 서버는 마감 시각이 지난 뒤에야 OPEN 이 CONFIRMED(주문 수량 합계 ≥ minOrders)나
 * CLOSED 로 바뀌고 조회할 때 계산한다. 목은 시각에 따라 바꾸지 않고 시드·변경이 정한 status 를 그대로 둔다.
 * - done(판매 끝): CONFIRMED 일 때만 DONE 으로 바꾼다(주문 개별 상태는 쓰지 않는다). 아니면 OFFER_CLOSED.
 * - cancel(제안 취소): OPEN·CONFIRMED 일 때만 CANCELLED 로 바꾸고 orderCount 를 0 으로 한다. 아니면 OFFER_CLOSED.
 * 없는 제안은 NOT_FOUND 다. 남의 제안(403)은 목에 다른 사장님이 없어 재현하지 않는다.
 */
export const mockOfferService: OfferService = {
  remote: false,
  async listOwnerOffers() {
    return getDb().offers.map(copyOffer);
  },
  async createOffer(input) {
    const db = getDb();
    const dongName = mockNeighborhoods.find((n) => n.id === input.neighborhoodId)?.name;
    const id = `offer-${db.nextOfferNumber++}`;
    const description = input.description?.trim() ?? '';
    db.offers.unshift({
      id,
      title: input.title.trim(),
      ...(description !== '' && { description }),
      status: 'OPEN',
      price: input.price,
      pickupAt: new Date(input.pickupAt),
      pickupPlace: input.pickupPlace.trim(),
      ...(dongName !== undefined && { dongName }),
      deadlineAt: new Date(input.deadlineAt),
      orderCount: 0,
      minOrders: input.minOrders,
    });
    // [임의] 알림을 받은 주민 수: 그 동네·업종의 요청 인원과 같다고 본다(요청이 없으면 0명).
    const demand = db.summaries.find(
      (s) => s.neighborhoodId === input.neighborhoodId && s.categoryId === input.categoryId,
    );
    return { offerId: id, notifiedResidentCount: demand?.requestCount ?? 0 };
  },
  async getOwnerOffer(offerId) {
    const offer = getDb().offers.find((o) => o.id === offerId);
    return offer ? copyOffer(offer) : null;
  },
  async completeOffer(offerId) {
    const offer = getDb().offers.find((o) => o.id === offerId);
    if (!offer) throw notFound();
    if (offer.status !== 'CONFIRMED') throw offerClosed();
    offer.status = 'DONE';
    return copyOffer(offer);
  },
  async cancelOffer(offerId) {
    const offer = getDb().offers.find((o) => o.id === offerId);
    if (!offer) throw notFound();
    if (offer.status !== 'OPEN' && offer.status !== 'CONFIRMED') throw offerClosed();
    offer.status = 'CANCELLED';
    offer.orderCount = 0;
    return copyOffer(offer);
  },
};
