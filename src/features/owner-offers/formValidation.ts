import { parseKstInput } from '@/shared/lib/kstDate';
import { OFFER_COPY } from './copy';

export const DEFAULT_MIN_ORDERS = 20;
export const MIN_ORDERS_FLOOR = 1;

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

export interface OfferFormCheck {
  /** 비어 있거나 올바르지 않은 필수 항목(화면 순서). 마감 순서 오류는 deadlineNotBeforePickup 이 따로 알린다. */
  missing: OfferFormField[];
  /** 마감이 받는 날짜보다 같거나 늦다. */
  deadlineNotBeforePickup: boolean;
  canSubmit: boolean;
}

/** 가격 입력에서 숫자만 남긴다(선행 0 은 지운다). */
export const sanitizePrice = (raw: string): string => raw.replace(/\D/g, '').replace(/^0+/, '');

/** 최소 주문은 1 이상의 정수다. */
export const clampMinOrders = (n: number): number =>
  Number.isFinite(n) ? Math.max(MIN_ORDERS_FLOOR, Math.floor(n)) : MIN_ORDERS_FLOOR;

/** 필수값(제목·가격>0·받는 날짜·받는 곳·마감)과 마감 순서를 검사한다. */
export function checkOfferForm(values: OfferFormValues): OfferFormCheck {
  const pickupAt = parseKstInput(values.pickupAt);
  const deadlineAt = parseKstInput(values.deadlineAt);
  const missing: OfferFormField[] = [];
  if (values.title.trim() === '') missing.push('title');
  if (!(Number(values.price) > 0)) missing.push('price');
  if (!pickupAt) missing.push('pickupAt');
  if (values.pickupPlace.trim() === '') missing.push('pickupPlace');
  if (!deadlineAt) missing.push('deadlineAt');
  const deadlineNotBeforePickup =
    pickupAt !== undefined &&
    deadlineAt !== undefined &&
    deadlineAt.getTime() >= pickupAt.getTime();
  return {
    missing,
    deadlineNotBeforePickup,
    canSubmit: missing.length === 0 && !deadlineNotBeforePickup,
  };
}

/** 비활성 버튼 옆에 보여줄 첫 번째 안내 문구. 보낼 수 있으면 null. */
export function firstHint(check: OfferFormCheck): string | null {
  const field = check.missing[0];
  return field ? OFFER_COPY.missing[field] : null;
}
