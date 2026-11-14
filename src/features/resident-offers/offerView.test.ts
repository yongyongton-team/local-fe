import { describe, expect, it } from 'vitest';
import type { MerchantResponse, MyOrder, ResidentOffer } from '@/types/domain';
import {
  MAX_QUANTITY,
  MIN_QUANTITY,
  buildDeadlineText,
  buildRecruitment,
  buildResidentRows,
  clampQuantity,
  formatOrderAmount,
  linkedOfferFor,
  pickLinkedOffer,
  resolveOrderMode,
} from './offerView';

const reserved: MyOrder = { id: 'o1', offerId: 'x', quantity: 3, status: 'RESERVED' };
const pickedUp: MyOrder = { id: 'o2', offerId: 'x', quantity: 1, status: 'PICKED_UP' };

const offer = (over: Partial<ResidentOffer> = {}): ResidentOffer => ({
  id: '10',
  shopName: '싱싱과일',
  title: '제철 과일 꾸러미',
  price: 15000,
  pickupAt: new Date('2026-11-15T10:00:00+09:00'),
  pickupPlace: '구성동 주민센터 앞',
  minOrders: 20,
  orderCount: 5,
  deadlineAt: new Date('2026-11-14T18:00:00+09:00'),
  status: 'OPEN',
  myOrder: null,
  ...over,
});

describe('수량·금액', () => {
  it('수량은 1~10 의 정수로 맞춘다', () => {
    expect([MIN_QUANTITY, MAX_QUANTITY]).toEqual([1, 10]);
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-4)).toBe(1);
    expect(clampQuantity(5.9)).toBe(5);
    expect(clampQuantity(10)).toBe(10);
    expect(clampQuantity(11)).toBe(10);
    expect(clampQuantity(Number.NaN)).toBe(1);
  });

  it('금액은 가격 × 수량이고 천 단위 쉼표를 붙인다', () => {
    expect(formatOrderAmount(15000, 2)).toBe('30,000');
    expect(formatOrderAmount(900, 1)).toBe('900');
    expect(formatOrderAmount(1234567, 10)).toBe('12,345,670');
  });
});

describe('링크 대상 제안', () => {
  it('서버 순서의 첫 OPEN·CONFIRMED 제안이다(CLOSED·DONE 은 건너뛴다)', () => {
    const offers = [
      offer({ id: '1', status: 'DONE' }),
      offer({ id: '2', status: 'CLOSED' }),
      offer({ id: '3', status: 'CONFIRMED' }),
      offer({ id: '4', status: 'OPEN' }),
    ];

    expect(pickLinkedOffer(offers)?.id).toBe('3');
  });

  it('OPEN·CONFIRMED 가 없거나 빈 목록이면 없다', () => {
    expect(pickLinkedOffer([])).toBeUndefined();
    expect(
      pickLinkedOffer([offer({ status: 'DONE' }), offer({ status: 'CLOSED' })]),
    ).toBeUndefined();
  });

  const responseOf = (o: ResidentOffer): MerchantResponse => ({
    merchantName: o.shopName,
    pickupAt: o.pickupAt,
    pickupPlace: o.pickupPlace,
  });

  it('카드 문구(response)가 같은 제안이면 링크 대상이다', () => {
    const first = offer({ id: '7' });

    expect(linkedOfferFor(responseOf(first), [first])?.id).toBe('7');
  });

  it('카드 문구가 offers 에 없는 제안으로 만들어졌으면(업체·시각·장소가 다르면) 링크가 없다', () => {
    const inOffers = offer({ id: '7', shopName: '다른가게' });
    const looseResponse: MerchantResponse = { merchantName: '싱싱과일' };

    expect(linkedOfferFor(looseResponse, [inOffers])).toBeUndefined();
    expect(
      linkedOfferFor({ ...responseOf(inOffers), pickupAt: new Date('2026-01-01T00:00:00Z') }, [
        inOffers,
      ]),
    ).toBeUndefined();
    expect(
      linkedOfferFor({ ...responseOf(inOffers), pickupPlace: '다른 곳' }, [inOffers]),
    ).toBeUndefined();
  });

  it('응답이 없거나 offers 에 보여줄 제안이 없으면 링크가 없다', () => {
    const o = offer();

    expect(linkedOfferFor(undefined, [o])).toBeUndefined();
    expect(linkedOfferFor(responseOf(o), [])).toBeUndefined();
    expect(linkedOfferFor(responseOf(o), [offer({ status: 'DONE' })])).toBeUndefined();
  });

  it('받는 곳 앞뒤 공백은 같은 값으로 본다', () => {
    const o = offer({ pickupPlace: '  가게 앞  ' });

    expect(linkedOfferFor({ ...responseOf(o), pickupPlace: '가게 앞' }, [o])).toBe(o);
  });
});

describe('행과 마감 문구', () => {
  it('가격·받는 날·마감·받는 곳 행을 이 순서로 만든다', () => {
    expect(buildResidentRows(offer()).map((r) => [r.key, r.label, r.value])).toEqual([
      ['price', '가격', '15,000원'],
      ['pickupAt', '받는 날', '11/15(일) 오전 10:00'],
      ['deadlineAt', '마감', '11/14(토) 18:00'],
      ['pickupPlace', '받는 곳', '구성동 주민센터 앞'],
    ]);
  });

  it('받는 곳이 비어 있으면 그 행만 숨긴다', () => {
    const keys = buildResidentRows(offer({ pickupPlace: '' })).map((r) => r.key);

    expect(keys).toEqual(['price', 'pickupAt', 'deadlineAt']);
  });

  it('상태 줄의 마감 문구', () => {
    expect(buildDeadlineText(offer())).toBe('마감 11/14(토) 18:00');
  });
});

describe('buildRecruitment (모집 현황)', () => {
  it('예약 수 ÷ 최소 주문이 비율이고, 모자라면 "N / M명 · K명만 더 모이면 돼요"다', () => {
    const r = buildRecruitment({ orderCount: 5, minOrders: 20 });

    expect(r).toMatchObject({ ratio: 0.25, valueNow: 5, valueMax: 20, filled: false });
    expect(r.text).toBe('5 / 20명 · 15명만 더 모이면 돼요');
  });

  it('1명 남았을 때 "1명만 더 모이면 돼요"', () => {
    expect(buildRecruitment({ orderCount: 29, minOrders: 30 }).text).toBe(
      '29 / 30명 · 1명만 더 모이면 돼요',
    );
  });

  it('최소 인원 이상이면 가득 차고 "최소 인원을 채웠어요"다(초과해도 비율은 1)', () => {
    const exact = buildRecruitment({ orderCount: 20, minOrders: 20 });
    const over = buildRecruitment({ orderCount: 35, minOrders: 20 });

    expect(exact).toMatchObject({ ratio: 1, filled: true });
    expect(exact.text).toBe('20 / 20명 · 최소 인원을 채웠어요');
    expect(over).toMatchObject({ ratio: 1, filled: true });
    expect(over.text).toBe('35 / 20명 · 최소 인원을 채웠어요');
  });

  it('예약이 0명이면 비율 0', () => {
    expect(buildRecruitment({ orderCount: 0, minOrders: 20 }).ratio).toBe(0);
  });
});

describe('resolveOrderMode (상태별 버튼·문구)', () => {
  it('OPEN + 주문 없음 → 수량 선택과 선주문', () => {
    expect(resolveOrderMode(offer({ status: 'OPEN', myOrder: null }))).toEqual({ kind: 'order' });
  });

  it('OPEN + RESERVED → 예약 취소', () => {
    expect(resolveOrderMode(offer({ status: 'OPEN', myOrder: reserved }))).toEqual({
      kind: 'reserved',
      order: reserved,
    });
  });

  it('PICKED_UP 이면 버튼 없이 "받아 갔어요"', () => {
    expect(resolveOrderMode(offer({ status: 'DONE', myOrder: pickedUp }))).toEqual({
      kind: 'readOnly',
      note: '받아 갔어요',
    });
  });

  it.each([
    ['CONFIRMED', '확정됐어요. 이제 새로 주문할 수 없어요'],
    ['CLOSED', '마감됐어요'],
    ['DONE', '수령이 끝난 제안이에요'],
  ] as const)('%s → 버튼 없이 안내 문구', (status, note) => {
    expect(resolveOrderMode(offer({ status }))).toEqual({ kind: 'readOnly', note });
  });

  it('OPEN 이 아니어도 예약(RESERVED)이 있으면 "내 예약" 수량을 알려 준다', () => {
    expect(resolveOrderMode(offer({ status: 'CONFIRMED', myOrder: reserved }))).toEqual({
      kind: 'readOnly',
      note: '확정됐어요. 이제 새로 주문할 수 없어요',
      reservedQuantity: 3,
    });
  });
});
