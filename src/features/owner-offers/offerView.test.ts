import { describe, expect, it } from 'vitest';
import type { AreaDetail, OwnerOffer } from '@/types/domain';
import { OFFER_STATUS_LABELS } from './copy';
import {
  buildConditionSummary,
  buildOfferRows,
  buildProgress,
  buildSummaryText,
  statusLabel,
} from './offerView';

const offer = (overrides: Partial<OwnerOffer> = {}): OwnerOffer => ({
  id: '1',
  title: '제철 과일 꾸러미',
  status: 'OPEN',
  price: 15000,
  pickupAt: new Date('2026-11-15T10:00:00+09:00'),
  deadlineAt: new Date('2026-11-14T18:00:00+09:00'),
  orderCount: 0,
  minOrders: 20,
  ...overrides,
});

describe('buildConditionSummary', () => {
  it('인원이 많은 조건 두 개를 쓴다(같으면 서버 순서)', () => {
    expect(
      buildConditionSummary([
        { label: 'A', count: 3 },
        { label: 'B', count: 9 },
        { label: 'C', count: 9 },
        { label: 'D', count: 1 },
      ]),
    ).toBe('B, C 조건이 많아요');
  });

  it('0명인 조건과 이름이 빈 조건은 빼고, 남는 게 없으면 null 이다', () => {
    expect(buildConditionSummary([{ label: 'A', count: 0 }])).toBeNull();
    expect(buildConditionSummary([{ label: '', count: 4 }])).toBeNull();
    expect(buildConditionSummary([])).toBeNull();
    expect(buildConditionSummary([{ label: 'A', count: 2 }])).toBe('A 조건이 많아요');
  });
});

describe('buildSummaryText', () => {
  const detail = {
    neighborhood: { id: 'guseong', district: '기흥구', name: '구성동' },
    category: { titleLabel: '과일 가게' },
    requestCount: 30,
    conditions: [{ label: '늦게까지 영업', count: 5 }],
  } as unknown as AreaDetail;

  it('제목은 "{동} · {업종}", 둘째 줄은 "요청 N명 · 조건"이다', () => {
    expect(buildSummaryText(detail)).toEqual({
      title: '구성동 · 과일 가게',
      line: '요청 30명 · 늦게까지 영업 조건이 많아요',
    });
  });

  it('조건이 없으면 요청 수만 있다', () => {
    expect(buildSummaryText({ ...detail, conditions: [] }).line).toBe('요청 30명');
  });
});

describe('buildOfferRows', () => {
  it('가격·받는 날·마감 행을 시안 형식으로 만든다', () => {
    expect(buildOfferRows(offer())).toEqual([
      { key: 'price', label: '가격', value: '15,000원' },
      { key: 'pickupAt', label: '받는 날', value: '11/15(일) 오전 10:00' },
      { key: 'deadlineAt', label: '마감', value: '11/14(토) 18:00' },
    ]);
  });

  it('가격이나 받는 날이 없으면 그 행만 없다', () => {
    const noPrice = { ...offer(), price: undefined };
    const noPickup = { ...offer(), pickupAt: undefined };

    expect(buildOfferRows(noPrice).map((r) => r.key)).toEqual(['pickupAt', 'deadlineAt']);
    expect(buildOfferRows(noPickup).map((r) => r.key)).toEqual(['price', 'deadlineAt']);
    expect(buildOfferRows({ id: '1', title: 't', orderCount: 0, minOrders: 1 })).toEqual([]);
  });

  it('가격 0원은 숨기지 않고 그대로 보인다', () => {
    expect(buildOfferRows(offer({ price: 0 }))[0]).toEqual({
      key: 'price',
      label: '가격',
      value: '0원',
    });
  });
});

describe('statusLabel', () => {
  it('OPEN 은 시안의 "모집 중"이고 다섯 상태 모두 문구가 있다', () => {
    expect(statusLabel(offer({ status: 'OPEN' }))).toBe('모집 중');
    for (const status of ['OPEN', 'CONFIRMED', 'CLOSED', 'CANCELLED', 'DONE'] as const) {
      expect(statusLabel(offer({ status }))).toBe(OFFER_STATUS_LABELS[status]);
      expect(OFFER_STATUS_LABELS[status]).not.toBe('');
    }
  });

  it('상태를 모르면 null 이다', () => {
    expect(statusLabel({ ...offer(), status: undefined })).toBeNull();
  });
});

describe('buildProgress', () => {
  it('예약 인원 ÷ 최소 주문 수와 "N / M명 예약" 문구', () => {
    expect(buildProgress({ orderCount: 5, minOrders: 20 })).toMatchObject({
      ratio: 0.25,
      label: '5 / 20명 예약',
      valueNow: 5,
      valueMax: 20,
    });
    expect(buildProgress({ orderCount: 0, minOrders: 20 }).ratio).toBe(0);
  });

  it('최소 주문을 넘으면 1 에서 멈추고, 최소 주문이 0 이면 0 이다', () => {
    expect(buildProgress({ orderCount: 30, minOrders: 20 }).ratio).toBe(1);
    expect(buildProgress({ orderCount: 3, minOrders: 0 }).ratio).toBe(0);
  });
});
