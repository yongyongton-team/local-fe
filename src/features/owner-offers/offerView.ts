import { formatMonthDay24h, formatMonthDayMeridiem } from '@/shared/lib/kstDate';
import type { AreaCondition, AreaDetail, OwnerOffer } from '@/types/domain';
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
export function statusLabel(offer: OwnerOffer): string | null {
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
