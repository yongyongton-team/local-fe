import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MIN_ORDERS,
  EMPTY_OFFER_FORM,
  checkOfferForm,
  clampMinOrders,
  deadlineError,
  firstHint,
  isPriceWithinLimit,
  sanitizePrice,
  type OfferFormValues,
} from './formValidation';

/** 검증의 "지금": 2026-11-01 09:00 KST (= 2026-11-01T00:00:00Z) */
const NOW = new Date('2026-11-01T09:00:00+09:00');

const valid: OfferFormValues = {
  title: '제철 과일 꾸러미',
  description: '',
  price: '15000',
  minOrders: 20,
  pickupAt: '2026-11-15T10:00',
  pickupPlace: '구성동 주민센터 앞',
  deadlineAt: '2026-11-14T18:00',
};

afterEach(() => vi.useRealTimers());

describe('checkOfferForm', () => {
  it('처음 상태는 최소 주문 20 이고 필수 다섯 항목이 모두 비어 있다', () => {
    expect(EMPTY_OFFER_FORM.minOrders).toBe(DEFAULT_MIN_ORDERS);
    expect(checkOfferForm(EMPTY_OFFER_FORM, NOW)).toEqual({
      missing: ['title', 'price', 'pickupAt', 'pickupPlace', 'deadlineAt'],
      outOfRange: [],
      deadlineNotBeforePickup: false,
      deadlineNotAfterNow: false,
      canSubmit: false,
    });
  });

  it('설명은 비어도 되고, 모두 채우면 보낼 수 있다', () => {
    expect(checkOfferForm(valid, NOW)).toEqual({
      missing: [],
      outOfRange: [],
      deadlineNotBeforePickup: false,
      deadlineNotAfterNow: false,
      canSubmit: true,
    });
  });

  it.each([
    ['title', { title: '   ' }],
    ['price', { price: '' }],
    ['price', { price: '0' }],
    ['pickupAt', { pickupAt: '' }],
    ['pickupPlace', { pickupPlace: ' ' }],
    ['deadlineAt', { deadlineAt: '' }],
  ] as const)('%s 가 비면 보낼 수 없고 그 항목이 missing 에 있다', (field, patch) => {
    const check = checkOfferForm({ ...valid, ...patch }, NOW);

    expect(check.missing).toContain(field);
    expect(check.canSubmit).toBe(false);
  });

  it('마감이 받는 날짜와 같거나 늦으면 순서 오류이고 보낼 수 없다', () => {
    const same = checkOfferForm({ ...valid, deadlineAt: valid.pickupAt }, NOW);
    const later = checkOfferForm({ ...valid, deadlineAt: '2026-11-16T18:00' }, NOW);

    expect(same).toMatchObject({ deadlineNotBeforePickup: true, canSubmit: false, missing: [] });
    expect(later).toMatchObject({ deadlineNotBeforePickup: true, canSubmit: false });
  });

  it('둘 중 하나가 비면 순서 오류는 아니다(비어 있음으로 알린다)', () => {
    expect(checkOfferForm({ ...valid, pickupAt: '' }, NOW).deadlineNotBeforePickup).toBe(false);
  });
});

describe('마감 시각 검증(지금 < 마감)', () => {
  const withDeadline = (deadlineAt: string) => checkOfferForm({ ...valid, deadlineAt }, NOW);

  it('경계: 지금과 같은 시각이면 막힌다', () => {
    const check = withDeadline('2026-11-01T09:00');

    expect(check.deadlineNotAfterNow).toBe(true);
    expect(check.canSubmit).toBe(false);
    expect(deadlineError(check)).toBe('마감은 지금보다 늦어야 해요.');
  });

  it('경계: 지금보다 1분 이전이면 막히고, 1분 이후면 통과한다', () => {
    expect(withDeadline('2026-11-01T08:59')).toMatchObject({
      deadlineNotAfterNow: true,
      canSubmit: false,
    });
    expect(withDeadline('2026-11-01T09:01')).toMatchObject({
      deadlineNotAfterNow: false,
      canSubmit: true,
    });
  });

  it('지금보다 한참 이전(어제)이면 막힌다', () => {
    expect(withDeadline('2026-10-31T18:00')).toMatchObject({
      deadlineNotAfterNow: true,
      canSubmit: false,
    });
  });

  it('KST 로 비교한다: 같은 순간을 UTC 로 줘도 결과가 같다', () => {
    const utcNow = new Date('2026-11-01T00:00:00Z'); // 09:00 KST

    expect(checkOfferForm({ ...valid, deadlineAt: '2026-11-01T09:00' }, utcNow)).toMatchObject({
      deadlineNotAfterNow: true,
    });
    expect(checkOfferForm({ ...valid, deadlineAt: '2026-11-01T09:01' }, utcNow)).toMatchObject({
      deadlineNotAfterNow: false,
    });
  });

  it('마감이 비어 있으면 이 오류는 아니다(비어 있음으로 알린다)', () => {
    expect(withDeadline('').deadlineNotAfterNow).toBe(false);
  });

  it('둘 다 해당하면 받는 날짜 순서 오류의 문구를 먼저 보인다(기존 우선순위)', () => {
    const both = checkOfferForm(
      { ...valid, pickupAt: '2026-10-01T10:00', deadlineAt: '2026-10-02T10:00' },
      NOW,
    );

    expect(both).toMatchObject({ deadlineNotBeforePickup: true, deadlineNotAfterNow: true });
    expect(deadlineError(both)).toBe('마감은 받는 날짜보다 빨라야 해요.');
  });

  it('오류가 없으면 문구도 없다', () => {
    expect(deadlineError(checkOfferForm(valid, NOW))).toBeNull();
  });

  it('now 를 주지 않으면 기본은 지금이고 fake timer 로 고정할 수 있다', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);

    expect(checkOfferForm({ ...valid, deadlineAt: '2026-11-01T09:00' }).deadlineNotAfterNow).toBe(
      true,
    );
    expect(checkOfferForm({ ...valid, deadlineAt: '2026-11-01T09:01' }).deadlineNotAfterNow).toBe(
      false,
    );
  });
});

describe('서버 제약(길이·범위)', () => {
  const check = (patch: Partial<OfferFormValues>) => checkOfferForm({ ...valid, ...patch }, NOW);

  it('제목은 50자까지, 설명은 500자까지, 받는 곳은 100자까지다(경계)', () => {
    expect(check({ title: 'a'.repeat(50) }).outOfRange).toEqual([]);
    expect(check({ title: 'a'.repeat(51) }).outOfRange).toEqual(['title']);
    expect(check({ description: 'a'.repeat(500) }).outOfRange).toEqual([]);
    expect(check({ description: 'a'.repeat(501) }).outOfRange).toEqual(['description']);
    expect(check({ pickupPlace: 'a'.repeat(100) }).outOfRange).toEqual([]);
    expect(check({ pickupPlace: 'a'.repeat(101) }).outOfRange).toEqual(['pickupPlace']);
  });

  it('앞뒤 공백은 길이에 세지 않는다(서버로 trim 해서 보낸다)', () => {
    expect(check({ title: `  ${'a'.repeat(50)}  ` }).outOfRange).toEqual([]);
  });

  it('가격은 int32 최댓값(2,147,483,647)까지다(경계)', () => {
    expect(check({ price: '2147483647' }).outOfRange).toEqual([]);
    expect(check({ price: '2147483648' }).outOfRange).toEqual(['price']);
    expect(isPriceWithinLimit('2147483647')).toBe(true);
    expect(isPriceWithinLimit('2147483648')).toBe(false);
    expect(isPriceWithinLimit('')).toBe(true);
  });

  it('최소 주문은 1~100 이다(경계)', () => {
    expect(check({ minOrders: 1 }).outOfRange).toEqual([]);
    expect(check({ minOrders: 100 }).outOfRange).toEqual([]);
    expect(check({ minOrders: 0 }).outOfRange).toEqual(['minOrders']);
    expect(check({ minOrders: 101 }).outOfRange).toEqual(['minOrders']);
  });

  it('범위를 넘으면 보낼 수 없다', () => {
    expect(check({ title: 'a'.repeat(51) }).canSubmit).toBe(false);
    expect(check({ price: '2147483648' }).canSubmit).toBe(false);
    expect(check({ minOrders: 101 }).canSubmit).toBe(false);
  });
});

describe('입력 정리', () => {
  it('가격은 숫자만 남기고 선행 0 을 지운다', () => {
    expect(sanitizePrice('15,000원')).toBe('15000');
    expect(sanitizePrice('007')).toBe('7');
    expect(sanitizePrice('abc')).toBe('');
  });

  it('최소 주문은 1~100 의 정수로 맞춘다', () => {
    expect(clampMinOrders(0)).toBe(1);
    expect(clampMinOrders(-3)).toBe(1);
    expect(clampMinOrders(1)).toBe(1);
    expect(clampMinOrders(7.9)).toBe(7);
    expect(clampMinOrders(100)).toBe(100);
    expect(clampMinOrders(101)).toBe(100);
    expect(clampMinOrders(9999)).toBe(100);
    expect(clampMinOrders(Number.NaN)).toBe(1);
  });

  it('첫 번째 비어 있는 항목의 안내를 먼저, 그다음 범위를 넘은 항목의 안내를 주고, 다 괜찮으면 null 이다', () => {
    expect(firstHint(checkOfferForm(EMPTY_OFFER_FORM, NOW))).toBe('제목을 입력해 주세요.');
    expect(firstHint(checkOfferForm(valid, NOW))).toBeNull();
    expect(firstHint(checkOfferForm({ ...valid, price: '2147483648' }, NOW))).toBe(
      '가격은 2,147,483,647원 이하로 입력해 주세요.',
    );
    expect(firstHint(checkOfferForm({ ...valid, minOrders: 101 }, NOW))).toBe(
      '최소 주문은 1~100명으로 정해 주세요.',
    );
    // 비어 있는 항목이 있으면 그 안내가 먼저다.
    expect(firstHint(checkOfferForm({ ...valid, title: '', minOrders: 101 }, NOW))).toBe(
      '제목을 입력해 주세요.',
    );
  });
});
