import {
  OFFER_DESCRIPTION_MAX,
  OFFER_MIN_ORDERS_MAX,
  OFFER_MIN_ORDERS_MIN,
  OFFER_PICKUP_PLACE_MAX,
  OFFER_PRICE_MAX,
  OFFER_TITLE_MAX,
} from '@/shared/lib/inputLimits';
import { parseKstInput } from '@/shared/lib/kstDate';
import { OFFER_COPY } from './copy';

export const DEFAULT_MIN_ORDERS = 20;

/** 작성 화면의 입력값. 날짜는 datetime-local 문자열("2026-11-15T10:00")이고 KST 로 읽는다. */
export interface OfferFormValues {
  title: string;
  description: string;
  /** 숫자만 있는 문자열 */
  price: string;
  minOrders: number;
  pickupAt: string;
  pickupPlace: string;
  deadlineAt: string;
}

export const EMPTY_OFFER_FORM: OfferFormValues = {
  title: '',
  description: '',
  price: '',
  minOrders: DEFAULT_MIN_ORDERS,
  pickupAt: '',
  pickupPlace: '',
  deadlineAt: '',
};

export type OfferFormField = 'title' | 'price' | 'pickupAt' | 'pickupPlace' | 'deadlineAt';

/** 서버 제약(길이·범위)을 넘은 항목 */
export type OfferRangeField = 'title' | 'description' | 'price' | 'pickupPlace' | 'minOrders';

export interface OfferFormCheck {
  /** 비어 있거나 올바르지 않은 필수 항목(화면 순서). 마감 순서 오류는 deadlineNotBeforePickup 이 따로 알린다. */
  missing: OfferFormField[];
  /** 서버 제약(길이·범위)을 넘은 항목(화면 순서). 입력 칸이 막아 주지만 붙여넣기·직접 호출 경로를 위해 검증에도 쓴다. */
  outOfRange: OfferRangeField[];
  /** 마감이 받는 날짜보다 같거나 늦다. */
  deadlineNotBeforePickup: boolean;
  /** 마감이 지금보다 이전이거나 같다(서버 규칙 `지금 < 마감`). */
  deadlineNotAfterNow: boolean;
  canSubmit: boolean;
}

/** 가격 입력에서 숫자만 남긴다(선행 0 은 지운다). */
export const sanitizePrice = (raw: string): string => raw.replace(/\D/g, '').replace(/^0+/, '');

/** 숫자만 있는 가격 문자열이 int32 범위(최댓값 이하)인지. 빈 문자열은 범위 안이다. */
export const isPriceWithinLimit = (digits: string): boolean => Number(digits) <= OFFER_PRICE_MAX;

/** 최소 주문은 1~100 의 정수다. */
export const clampMinOrders = (n: number): number =>
  Number.isFinite(n)
    ? Math.min(OFFER_MIN_ORDERS_MAX, Math.max(OFFER_MIN_ORDERS_MIN, Math.floor(n)))
    : OFFER_MIN_ORDERS_MIN;

/**
 * 필수값(제목·가격>0·받는 날짜·받는 곳·마감), 서버 제약(길이·범위), 마감 순서(마감 < 받는 날짜)와 마감 시각(지금 < 마감)을 검사한다.
 * 날짜는 KST 로 읽고(parseKstInput) 현재 시각은 now 로 받는다(기본은 지금, 테스트에서 고정할 수 있다).
 */
export function checkOfferForm(values: OfferFormValues, now: Date = new Date()): OfferFormCheck {
  const pickupAt = parseKstInput(values.pickupAt);
  const deadlineAt = parseKstInput(values.deadlineAt);
  const missing: OfferFormField[] = [];
  if (values.title.trim() === '') missing.push('title');
  if (!(Number(values.price) > 0)) missing.push('price');
  if (!pickupAt) missing.push('pickupAt');
  if (values.pickupPlace.trim() === '') missing.push('pickupPlace');
  if (!deadlineAt) missing.push('deadlineAt');
  const outOfRange: OfferRangeField[] = [];
  if (values.title.trim().length > OFFER_TITLE_MAX) outOfRange.push('title');
  if (values.description.trim().length > OFFER_DESCRIPTION_MAX) outOfRange.push('description');
  if (!isPriceWithinLimit(values.price)) outOfRange.push('price');
  if (values.minOrders < OFFER_MIN_ORDERS_MIN || values.minOrders > OFFER_MIN_ORDERS_MAX) {
    outOfRange.push('minOrders');
  }
  if (values.pickupPlace.trim().length > OFFER_PICKUP_PLACE_MAX) outOfRange.push('pickupPlace');
  const deadlineNotBeforePickup =
    pickupAt !== undefined &&
    deadlineAt !== undefined &&
    deadlineAt.getTime() >= pickupAt.getTime();
  const deadlineNotAfterNow = deadlineAt !== undefined && deadlineAt.getTime() <= now.getTime();
  return {
    missing,
    outOfRange,
    deadlineNotBeforePickup,
    deadlineNotAfterNow,
    canSubmit:
      missing.length === 0 &&
      outOfRange.length === 0 &&
      !deadlineNotBeforePickup &&
      !deadlineNotAfterNow,
  };
}

/**
 * 마감 칸 아래에 보여줄 오류 문구. 둘 다 해당하면 받는 날짜 순서 오류를 먼저 알린다(기존 순서). 없으면 null.
 */
export function deadlineError(check: OfferFormCheck): string | null {
  if (check.deadlineNotBeforePickup) return OFFER_COPY.deadlineAfterPickup;
  if (check.deadlineNotAfterNow) return OFFER_COPY.deadlineBeforeNow;
  return null;
}

/** 비활성 버튼 옆에 보여줄 첫 번째 안내 문구. 비어 있는 항목을 먼저, 그다음 범위를 넘은 항목을 안내한다. 보낼 수 있으면 null. */
export function firstHint(check: OfferFormCheck): string | null {
  const field = check.missing[0];
  if (field) return OFFER_COPY.missing[field];
  const range = check.outOfRange[0];
  return range ? OFFER_COPY.outOfRange[range] : null;
}
