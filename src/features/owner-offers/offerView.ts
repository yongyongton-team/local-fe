import { formatMonthDay24h, formatMonthDayMeridiem } from '@/shared/lib/kstDate';
import type { AreaCondition, AreaDetail, OfferStatus, OwnerOffer } from '@/types/domain';
import { OFFER_COPY, OFFER_STATUS_LABELS } from './copy';

/** 요약 카드에 쓸 조건 문구에 올리는 조건 수 */
const SUMMARY_CONDITION_COUNT = 2;

/**
 * 요약 카드의 조건 문구. 인원이 많은 조건 두 개(같으면 서버 순서대로)를 쓰고, 인원이 0명인 조건은 뺀다.
 * 조건이 없으면 null 이라 문구 자체를 그리지 않는다.
 */
export function buildConditionSummary(conditions: readonly AreaCondition[]): string | null {
  const labels = conditions
    .map((condition, index) => ({ ...condition, index }))
    .filter((condition) => condition.count > 0 && condition.label !== '')
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, SUMMARY_CONDITION_COUNT)
    .map((condition) => condition.label);
  return labels.length === 0 ? null : OFFER_COPY.conditionSummary(labels);
}

/** 요약 카드 문구. 제목은 "{동} · {업종} 가게", 둘째 줄은 "요청 N명 · 조건 문구". */
export function buildSummaryText(detail: AreaDetail): { title: string; line: string } {
  return {
    title: OFFER_COPY.summaryTitle(detail.neighborhood.name, detail.category.titleLabel),
    line: OFFER_COPY.summaryLine(detail.requestCount, buildConditionSummary(detail.conditions)),
  };
}

export interface OfferRowData {
  key: 'price' | 'pickupAt' | 'deadlineAt';
  label: string;
  value: string;
}

/** 제안 카드의 행. 값이 없는 행(가격·받는 날은 서버가 아직 주지 않을 수 있다)은 만들지 않는다. */
export function buildOfferRows(offer: OwnerOffer): OfferRowData[] {
  const rows: OfferRowData[] = [];
  if (offer.price !== undefined) {
    rows.push({
      key: 'price',
      label: OFFER_COPY.rowPrice,
      value: `${offer.price.toLocaleString('ko-KR')}원`,
    });
  }
  if (offer.pickupAt) {
    rows.push({
      key: 'pickupAt',
      label: OFFER_COPY.rowPickup,
      value: formatMonthDayMeridiem(offer.pickupAt),
    });
  }
  if (offer.deadlineAt) {
    rows.push({
      key: 'deadlineAt',
      label: OFFER_COPY.rowDeadline,
      value: formatMonthDay24h(offer.deadlineAt),
    });
  }
  return rows;
}

/** 상태 배지 문구. 상태를 모르면 배지를 그리지 않는다(null). */
export function statusLabel(offer: Pick<OwnerOffer, 'status'>): string | null {
  return offer.status ? OFFER_STATUS_LABELS[offer.status] : null;
}

export interface OfferProgress {
  /** 0~1. 최소 주문 수가 0 이면 0 */
  ratio: number;
  label: string;
  valueNow: number;
  valueMax: number;
}

/** 진행 막대: 예약 인원 ÷ 최소 주문 수(1 을 넘지 않는다). 문구는 "{예약} / {최소}명 예약". */
export function buildProgress(offer: Pick<OwnerOffer, 'orderCount' | 'minOrders'>): OfferProgress {
  const { orderCount, minOrders } = offer;
  const ratio = minOrders > 0 ? Math.min(1, Math.max(0, orderCount / minOrders)) : 0;
  return {
    ratio,
    label: OFFER_COPY.reserved(orderCount, minOrders),
    valueNow: orderCount,
    valueMax: minOrders,
  };
}

/** 상태 줄의 마감 문구. 예: 마감 11/14(토) 18:00. 마감 시각이 없으면 null. */
export function buildDeadlineText(offer: Pick<OwnerOffer, 'deadlineAt'>): string | null {
  return offer.deadlineAt ? OFFER_COPY.deadlineText(formatMonthDay24h(offer.deadlineAt)) : null;
}

/** 제목 아래 줄. "{동네} · {업종}"이고 둘 중 없는 쪽은 뺀다. 둘 다 없으면 null. */
export function buildDetailPlace(
  offer: Pick<OwnerOffer, 'dongName'>,
  categoryLabel: string | undefined,
): string | null {
  const parts = [offer.dongName, categoryLabel].filter(
    (part): part is string => part !== undefined && part !== '',
  );
  return parts.length === 0 ? null : parts.join(' · ');
}

export interface DetailRowData {
  key: 'pickupAt' | 'pickupPlace';
  label: string;
  value: string;
}

/** 예약 현황 카드의 행(받는 날·받는 곳). 값이 없으면 그 행을 만들지 않는다. */
export function buildDetailRows(
  offer: Pick<OwnerOffer, 'pickupAt' | 'pickupPlace'>,
): DetailRowData[] {
  const rows: DetailRowData[] = [];
  if (offer.pickupAt) {
    rows.push({
      key: 'pickupAt',
      label: OFFER_COPY.rowPickup,
      value: formatMonthDayMeridiem(offer.pickupAt),
    });
  }
  if (offer.pickupPlace) {
    rows.push({ key: 'pickupPlace', label: OFFER_COPY.rowPickupPlace, value: offer.pickupPlace });
  }
  return rows;
}

/**
 * 상태별 안내 문구. 상태를 모르면 null 이다.
 * OPEN 은 서버가 마감 전에는 항상 OPEN 이라 인원이 이미 찼어도 "확정됐어요"라고 쓰지 않는다.
 */
export function buildStatusNote(
  offer: Pick<OwnerOffer, 'status' | 'orderCount' | 'minOrders' | 'deadlineAt'>,
): string | null {
  const note = OFFER_COPY.statusNote;
  switch (offer.status) {
    case 'OPEN':
      return offer.orderCount >= offer.minOrders && offer.minOrders > 0
        ? note.openFilled
        : note.open(offer.minOrders, offer.deadlineAt ? formatMonthDay24h(offer.deadlineAt) : null);
    case 'CONFIRMED':
      return note.confirmed;
    case 'CLOSED':
      return note.closed;
    case 'CANCELLED':
      return note.cancelled;
    case 'DONE':
      return note.done;
    default:
      return null;
  }
}

export interface OfferActions {
  /** 「판매 끝」: 서버가 CONFIRMED 일 때만 받는다 */
  complete: boolean;
  /** 「제안 취소」: 서버가 OPEN·CONFIRMED 일 때만 받는다 */
  cancel: boolean;
}

/**
 * 상태별 버튼 노출 규칙(서버 규칙과 같다): OPEN 은 「제안 취소」만, CONFIRMED 는 「판매 끝」+「제안 취소」,
 * CLOSED·CANCELLED·DONE 과 모르는 상태는 버튼 없이 읽기 전용이다.
 */
export function availableActions(status: OfferStatus | undefined): OfferActions {
  return {
    complete: status === 'CONFIRMED',
    cancel: status === 'OPEN' || status === 'CONFIRMED',
  };
}
