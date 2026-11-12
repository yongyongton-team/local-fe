import { describe, expect, it } from 'vitest';
import type { OfferDto } from './dto';
import { mapMyRequests, selectOfferResponse } from './mappers';
import {
  HIDDEN_OFFER_STATUSES,
  KNOWN_OFFER_STATUSES,
  KNOWN_ORDER_STATUSES,
  isShownOfferStatus,
  toOfferStatus,
  toOrderStatus,
} from './offerStatus';

const offer = (over: OfferDto = {}): OfferDto => ({
  id: 1,
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

describe('offerStatus (제안·주문 상태 규칙)', () => {
  it('toOfferStatus: 명세의 알려진 값만 돌려주고 모르는 값·비문자열은 null 이다', () => {
    expect([...KNOWN_OFFER_STATUSES]).toEqual(['OPEN', 'CONFIRMED', 'CLOSED', 'CANCELLED', 'DONE']);
    for (const status of KNOWN_OFFER_STATUSES) expect(toOfferStatus(status)).toBe(status);
    for (const bad of ['open', 'EXPIRED', '', null, undefined, 1, {}]) {
      expect(toOfferStatus(bad)).toBeNull();
    }
  });

  it('toOrderStatus: 명세의 알려진 주문 상태만 돌려준다', () => {
    expect([...KNOWN_ORDER_STATUSES]).toEqual(['RESERVED', 'CANCELLED', 'PICKED_UP']);
    for (const status of KNOWN_ORDER_STATUSES) expect(toOrderStatus(status)).toBe(status);
    expect(toOrderStatus('PAID')).toBeNull();
    expect(toOrderStatus(undefined)).toBeNull();
  });

  it('isShownOfferStatus: OPEN·CONFIRMED 만 보이고 CLOSED·DONE·CANCELLED·모르는 값은 보이지 않는다(명세 기준)', () => {
    expect([...HIDDEN_OFFER_STATUSES]).toEqual(['CLOSED', 'CANCELLED', 'DONE']);
    for (const shown of ['OPEN', 'CONFIRMED']) {
      expect(isShownOfferStatus(shown)).toBe(true);
    }
    for (const hidden of ['CLOSED', 'DONE', 'CANCELLED', 'SOMETHING', '', null, undefined, 3]) {
      expect(isShownOfferStatus(hidden)).toBe(false);
    }
  });
});

describe('selectOfferResponse', () => {
  it('shopName → merchantName, pickupAt → pickupAt(Date), pickupPlace → pickupPlace 로 옮긴다', () => {
    const response = selectOfferResponse([offer()]);

    expect(response).toEqual({
      merchantName: '가게A',
      pickupAt: new Date('2026-11-10T18:00:00+09:00'),
      pickupPlace: '가게 앞',
    });
  });

  it('수령 시각이 없거나 날짜로 해석되지 않으면 pickupAt 을, 장소가 비면 pickupPlace 를 비운다', () => {
    for (const over of [
      { pickupAt: null },
      { pickupAt: undefined },
      { pickupAt: 'not-a-date' },
      { pickupAt: '' },
    ]) {
      expect(selectOfferResponse([offer(over)])).not.toHaveProperty('pickupAt');
    }
    for (const place of [null, undefined, '', '   ']) {
      expect(selectOfferResponse([offer({ pickupPlace: place })])).not.toHaveProperty(
        'pickupPlace',
      );
    }
    expect(selectOfferResponse([offer({ pickupPlace: '  가게 앞  ' })])?.pickupPlace).toBe(
      '가게 앞',
    );
  });

  it('취소된 제안과 알 수 없는 상태의 제안은 건너뛰고 서버 순서의 첫 번째 보여줄 제안을 쓴다', () => {
    const response = selectOfferResponse([
      offer({ shopName: '취소됨', status: 'CANCELLED' }),
      offer({ shopName: '모르는상태', status: 'EXPIRED' }),
      offer({ shopName: '상태없음', status: null }),
      offer({ shopName: '첫번째', status: 'CONFIRMED' }),
      offer({ shopName: '두번째', status: 'OPEN' }),
    ]);

    expect(response?.merchantName).toBe('첫번째');
  });

  it('여러 개면 id·마감·가격으로 다시 정렬하지 않고 서버 순서의 첫 번째다', () => {
    const response = selectOfferResponse([
      offer({ id: 9, shopName: 'A', price: 99999, deadlineAt: '2030-01-01T00:00:00+09:00' }),
      offer({ id: 1, shopName: 'B', price: 100, deadlineAt: '2020-01-01T00:00:00+09:00' }),
    ]);

    expect(response?.merchantName).toBe('A');
  });

  it('취소된 제안만 있으면 응답이 없다', () => {
    expect(selectOfferResponse([offer({ status: 'CANCELLED' })])).toBeUndefined();
  });

  it.each([
    ['빈 배열', []],
    ['null', null],
    ['없음', undefined],
    ['배열이 아님', {} as never],
  ])('offers 가 %s 이면 응답이 없다', (_name, offers) => {
    expect(selectOfferResponse(offers)).toBeUndefined();
  });

  it('업체 이름이 없으면(null·빈 값) 그 제안은 건너뛰고 깨지지 않는다', () => {
    const response = selectOfferResponse([
      offer({ shopName: null }),
      offer({ shopName: '', title: '제목' }),
      null as never,
      'x' as never,
      offer({ shopName: '쓸 수 있는 제안', title: null }),
    ]);

    // 제목(title)은 이 화면이 쓰지 않으므로 없어도 제안을 보여준다.
    expect(response?.merchantName).toBe('쓸 수 있는 제안');
  });

  it('가격·시각·주문 등 다른 필드가 null 이거나 이상해도 영향이 없다', () => {
    const response = selectOfferResponse([
      offer({
        price: null,
        pickupAt: 'not-a-date',
        pickupPlace: null,
        minOrders: null,
        orderCount: null,
        deadlineAt: null,
        myOrder: { status: 'WEIRD' },
      }),
    ]);

    expect(response?.merchantName).toBe('가게A');
  });

  it('응답에는 이 화면이 쓰는 값만 있다(제목·가격·주문 등을 담지 않는다)', () => {
    expect(Object.keys(selectOfferResponse([offer()]) ?? {}).sort()).toEqual([
      'merchantName',
      'pickupAt',
      'pickupPlace',
    ]);
  });
});

describe('제안 상태별 표시(명세 기준)', () => {
  it.each([
    ['OPEN', true],
    ['CONFIRMED', true],
    ['CLOSED', false],
    ['DONE', false],
    ['CANCELLED', false],
    ['UNKNOWN', false],
  ])('상태 %s 의 제안은 보임=%s', (status, shown) => {
    expect(selectOfferResponse([offer({ status })]) !== undefined).toBe(shown);
  });

  it('[CLOSED, CONFIRMED] 면 CONFIRMED 제안을 쓴다(서버 순서에서 첫 번째로 보이는 제안)', () => {
    const response = selectOfferResponse([
      offer({ shopName: '마감가게', status: 'CLOSED' }),
      offer({ shopName: '확정가게', status: 'CONFIRMED' }),
      offer({ shopName: '진행가게', status: 'OPEN' }),
    ]);

    expect(response?.merchantName).toBe('확정가게');
  });

  it('모두 숨김 상태(CLOSED·DONE·CANCELLED)면 제안이 없다', () => {
    expect(
      selectOfferResponse([
        offer({ status: 'CLOSED' }),
        offer({ status: 'DONE' }),
        offer({ status: 'CANCELLED' }),
      ]),
    ).toBeUndefined();
  });
});

describe('mapMyRequests 의 사장님 응답', () => {
  it('요청마다 자기 offers 에서 응답을 만들고, 제안이 없는 요청은 response 가 없다', () => {
    const [withOffer, without, onlyCancelled] = mapMyRequests(
      [
        request([offer()]),
        { ...request([]), id: 352 },
        { ...request([offer({ status: 'CANCELLED' })]), id: 353 },
      ],
      [],
    );

    expect(withOffer?.response).toEqual({
      merchantName: '가게A',
      pickupAt: new Date('2026-11-10T18:00:00+09:00'),
      pickupPlace: '가게 앞',
    });
    expect(without).not.toHaveProperty('response');
    expect(onlyCancelled).not.toHaveProperty('response');
  });

  it('offers 가 없거나 null 이어도 다른 필드는 그대로 매핑된다', () => {
    const items = mapMyRequests([request(undefined), request(null)], []);

    items.forEach((item) => {
      expect(item).not.toHaveProperty('response');
      expect(item).toMatchObject({
        request: { id: '351', visitFrequency: 'weekly' },
        requestCount: 12,
      });
    });
  });
});
