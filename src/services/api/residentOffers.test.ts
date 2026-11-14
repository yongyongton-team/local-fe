import { describe, expect, it } from 'vitest';
import type { OfferDto } from './dto';
import { mapMyRequests, mapResidentOffers, selectOfferResponse } from './mappers';

const offer = (over: OfferDto = {}): OfferDto => ({
  id: 101,
  shopName: '가게A',
  title: '내일 과일 상자',
  price: 9900,
  pickupAt: '2026-11-10T18:00:00+09:00',
  pickupPlace: '가게 앞',
  minOrders: 5,
  orderCount: 2,
  deadlineAt: '2026-11-10T12:00:00+09:00',
  status: 'OPEN',
  myOrder: null,
  ...over,
});
const request = (offers: OfferDto[] | null | undefined) => ({
  id: 351,
  dong: { id: 22, name: '구성동' },
  category: { id: 7, name: '과일·채소 가게' },
  count: 12,
  timeSlots: ['WEEKDAY_EVENING'],
  frequency: 'WEEKLY_PLUS',
  createdAt: '2026-11-09T10:55:54+09:00',
  offers,
});

describe('mapResidentOffers (제안 전체 매핑)', () => {
  it('정상 제안의 모든 필드를 도메인 값으로 옮기고 id 는 문자열이며 날짜는 Date 다', () => {
    expect(mapResidentOffers([offer()])).toEqual([
      {
        id: '101',
        shopName: '가게A',
        title: '내일 과일 상자',
        price: 9900,
        pickupAt: new Date('2026-11-10T18:00:00+09:00'),
        pickupPlace: '가게 앞',
        minOrders: 5,
        orderCount: 2,
        deadlineAt: new Date('2026-11-10T12:00:00+09:00'),
        status: 'OPEN',
        myOrder: null,
      },
    ]);
  });

  it('서버 순서를 그대로 두고 모든 제안을 담는다(다시 정렬하지 않는다)', () => {
    const result = mapResidentOffers([
      offer({ id: 9, status: 'DONE' }),
      offer({ id: 1, status: 'OPEN' }),
      offer({ id: 5, status: 'CONFIRMED' }),
    ]);

    expect(result.map((o) => [o.id, o.status])).toEqual([
      ['9', 'DONE'],
      ['1', 'OPEN'],
      ['5', 'CONFIRMED'],
    ]);
  });

  it('CLOSED·DONE 제안도 매핑한다(카드 한 줄에는 안 나오지만 데이터에는 있다)', () => {
    const result = mapResidentOffers([
      offer({ status: 'CLOSED' }),
      offer({ id: 2, status: 'DONE' }),
    ]);

    expect(result.map((o) => o.status)).toEqual(['CLOSED', 'DONE']);
  });

  it('myOrder 가 있으면 id 를 문자열로 바꿔 담고, null·없음이면 null 이다', () => {
    const [reserved, none, missing, pickedUp] = mapResidentOffers([
      offer({ id: 1, myOrder: { id: 77, offerId: 1, quantity: 3, status: 'RESERVED' } }),
      offer({ id: 2, myOrder: null }),
      offer({ id: 3, myOrder: undefined }),
      offer({ id: 4, myOrder: { id: 78, offerId: 4, quantity: 1, status: 'PICKED_UP' } }),
    ]);

    expect(reserved?.myOrder).toEqual({ id: '77', offerId: '1', quantity: 3, status: 'RESERVED' });
    expect(none?.myOrder).toBeNull();
    expect(missing?.myOrder).toBeNull();
    expect(pickedUp?.myOrder).toEqual({ id: '78', offerId: '4', quantity: 1, status: 'PICKED_UP' });
  });

  it.each([
    ['id 가 없음', { id: 0 }],
    ['수량이 0', { quantity: 0 }],
    ['수량이 소수', { quantity: 1.5 }],
    ['수량이 문자열', { quantity: '2' as never }],
    ['취소된 주문', { status: 'CANCELLED' }],
    ['모르는 주문 상태', { status: 'WEIRD' }],
    ['offerId 가 없음', { offerId: null }],
  ])('myOrder 형식이 틀리면(%s) 제안은 남기고 myOrder 만 null 이다', (_name, over) => {
    const myOrder = { id: 77, offerId: 1, quantity: 2, status: 'RESERVED', ...over };

    const result = mapResidentOffers([offer({ id: 1, myOrder })]);

    expect(result).toHaveLength(1);
    expect(result[0]?.myOrder).toBeNull();
  });

  it('myOrder 가 객체가 아니어도 null 이다', () => {
    expect(mapResidentOffers([offer({ myOrder: 'x' as never })])[0]?.myOrder).toBeNull();
  });

  it.each([
    ['id 가 없음', { id: null }],
    ['id 가 0 이하', { id: -1 }],
    ['id 가 문자열', { id: '3' as never }],
    ['업체 이름이 비었음', { shopName: '' }],
    ['업체 이름이 null', { shopName: null }],
    ['제목이 null', { title: null }],
    ['가격이 문자열', { price: '9900' as never }],
    ['가격이 음수', { price: -1 }],
    ['가격이 null', { price: null }],
    ['최소 주문이 null', { minOrders: null }],
    ['주문 수가 NaN', { orderCount: Number.NaN }],
    ['수령 시각이 날짜가 아님', { pickupAt: 'not-a-date' }],
    ['수령 시각이 없음', { pickupAt: null }],
    ['마감이 날짜가 아님', { deadlineAt: '??' }],
    ['마감이 없음', { deadlineAt: undefined }],
    ['받는 곳이 null', { pickupPlace: null }],
    ['모르는 상태', { status: 'EXPIRED' }],
    ['상태가 없음', { status: null }],
    ['취소된 제안', { status: 'CANCELLED' }],
  ])('형식이 틀린 제안(%s)은 그 제안만 건너뛴다', (_name, over) => {
    const result = mapResidentOffers([
      offer({ id: 1 }),
      offer({ id: 2, ...over }),
      offer({ id: 3 }),
    ]);

    expect(result.map((o) => o.id)).toEqual(['1', '3']);
  });

  it('객체가 아닌 항목이 섞여 있어도 깨지지 않고 나머지를 유지한다', () => {
    const result = mapResidentOffers([null as never, 'x' as never, offer({ id: 4 })]);

    expect(result.map((o) => o.id)).toEqual(['4']);
  });

  it('받는 곳은 비어 있어도 문자열이면 유효하다(앞뒤 공백은 자른다)', () => {
    const [empty, spaced] = mapResidentOffers([
      offer({ id: 1, pickupPlace: '' }),
      offer({ id: 2, pickupPlace: '  가게 앞  ', title: '  제목  ' }),
    ]);

    expect(empty?.pickupPlace).toBe('');
    expect(spaced).toMatchObject({ pickupPlace: '가게 앞', title: '제목' });
  });

  it.each([
    ['빈 배열', []],
    ['null', null],
    ['없음', undefined],
    ['배열이 아님', {} as never],
  ])('offers 가 %s 이면 빈 목록이다', (_name, offers) => {
    expect(mapResidentOffers(offers)).toEqual([]);
  });
});

describe('mapMyRequests 의 offers', () => {
  it('요청마다 자기 offers 전체를 담고, 없거나 빈 배열이면 빈 배열이다', () => {
    const [withOffers, empty, nullOffers, missing] = mapMyRequests(
      [
        request([offer({ id: 1 }), offer({ id: 2, status: 'DONE' })]),
        { ...request([]), id: 352 },
        { ...request(null), id: 353 },
        { ...request(undefined), id: 354 },
      ],
      [],
    );

    expect(withOffers?.offers.map((o) => o.id)).toEqual(['1', '2']);
    expect(empty?.offers).toEqual([]);
    expect(nullOffers?.offers).toEqual([]);
    expect(missing?.offers).toEqual([]);
  });

  it('형식이 틀린 제안이 있어도 요청 목록 전체는 실패하지 않고 그 제안만 빠진다', () => {
    const items = mapMyRequests(
      [
        request([offer({ id: 1, price: null }), offer({ id: 2 })]),
        { ...request([offer({ id: 3 })]), id: 352 },
      ],
      [],
    );

    expect(items).toHaveLength(2);
    expect(items[0]?.offers.map((o) => o.id)).toEqual(['2']);
    expect(items[1]?.offers.map((o) => o.id)).toEqual(['3']);
  });

  it('response 선택 규칙은 그대로다: 서버 순서의 첫 OPEN·CONFIRMED 제안이고, 형식이 틀려도 그 제안으로 한 줄은 만든다', () => {
    const offers = [
      offer({ id: 1, shopName: '마감가게', status: 'CLOSED' }),
      // 가격이 틀려 offers 에서는 빠지지만 한 줄 응답 규칙은 예전과 같아 이 제안을 쓴다.
      offer({ id: 2, shopName: '첫번째', status: 'CONFIRMED', price: null, pickupAt: 'bad' }),
      offer({ id: 3, shopName: '두번째', status: 'OPEN' }),
    ];

    const [item] = mapMyRequests([request(offers)], []);

    expect(item?.response).toEqual({ merchantName: '첫번째', pickupPlace: '가게 앞' });
    expect(item?.response).toEqual(selectOfferResponse(offers));
    expect(item?.offers.map((o) => o.id)).toEqual(['1', '3']);
  });

  it('response 는 제안 전체에서 만든 값과 같은 모양이다(제목·가격·주문은 담지 않는다)', () => {
    const [item] = mapMyRequests(
      [request([offer({ myOrder: { id: 7, offerId: 101, quantity: 1, status: 'RESERVED' } })])],
      [],
    );

    expect(Object.keys(item?.response ?? {}).sort()).toEqual([
      'merchantName',
      'pickupAt',
      'pickupPlace',
    ]);
  });
});
