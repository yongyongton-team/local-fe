import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIN_ORDERS,
  EMPTY_OFFER_FORM,
  checkOfferForm,
  clampMinOrders,
  firstHint,
  sanitizePrice,
  type OfferFormValues,
} from './formValidation';

const valid: OfferFormValues = {
  title: '제철 과일 꾸러미',
  description: '',
  price: '15000',
  minOrders: 20,
  pickupAt: '2026-11-15T10:00',
  pickupPlace: '구성동 주민센터 앞',
  deadlineAt: '2026-11-14T18:00',
};

describe('checkOfferForm', () => {
  it('처음 상태는 최소 주문 20 이고 필수 다섯 항목이 모두 비어 있다', () => {
    expect(EMPTY_OFFER_FORM.minOrders).toBe(DEFAULT_MIN_ORDERS);
    expect(checkOfferForm(EMPTY_OFFER_FORM)).toEqual({
      missing: ['title', 'price', 'pickupAt', 'pickupPlace', 'deadlineAt'],
      deadlineNotBeforePickup: false,
      canSubmit: false,
    });
  });

  it('설명은 비어도 되고, 모두 채우면 보낼 수 있다', () => {
    expect(checkOfferForm(valid)).toEqual({
      missing: [],
      deadlineNotBeforePickup: false,
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
    const check = checkOfferForm({ ...valid, ...patch });

    expect(check.missing).toContain(field);
    expect(check.canSubmit).toBe(false);
  });

  it('마감이 받는 날짜와 같거나 늦으면 순서 오류이고 보낼 수 없다', () => {
    const same = checkOfferForm({ ...valid, deadlineAt: valid.pickupAt });
    const later = checkOfferForm({ ...valid, deadlineAt: '2026-11-16T18:00' });

    expect(same).toMatchObject({ deadlineNotBeforePickup: true, canSubmit: false, missing: [] });
    expect(later).toMatchObject({ deadlineNotBeforePickup: true, canSubmit: false });
  });

  it('둘 중 하나가 비면 순서 오류는 아니다(비어 있음으로 알린다)', () => {
    expect(checkOfferForm({ ...valid, pickupAt: '' }).deadlineNotBeforePickup).toBe(false);
  });
});

describe('입력 정리', () => {
  it('가격은 숫자만 남기고 선행 0 을 지운다', () => {
    expect(sanitizePrice('15,000원')).toBe('15000');
    expect(sanitizePrice('007')).toBe('7');
    expect(sanitizePrice('abc')).toBe('');
  });

  it('최소 주문은 1 아래로 내려가지 않고 정수다', () => {
    expect(clampMinOrders(0)).toBe(1);
    expect(clampMinOrders(-3)).toBe(1);
    expect(clampMinOrders(1)).toBe(1);
    expect(clampMinOrders(7.9)).toBe(7);
    expect(clampMinOrders(Number.NaN)).toBe(1);
  });

  it('첫 번째 비어 있는 항목의 안내를 돌려주고, 다 채웠으면 null 이다', () => {
    expect(firstHint(checkOfferForm(EMPTY_OFFER_FORM))).toBe('제목을 입력해 주세요.');
    expect(firstHint(checkOfferForm(valid))).toBeNull();
  });
});
