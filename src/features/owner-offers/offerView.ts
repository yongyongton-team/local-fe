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
export function buildOfferRows(
  offer: Pick<OwnerOffer, 'price' | 'pickupAt' | 'deadlineAt'>,
): OfferRowData[] {
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

export interface DetailRowData {
  key: 'price' | 'pickupAt' | 'deadlineAt' | 'pickupPlace';
  label: string;
  value: string;
}

/**
 * 상세의 값 행: 가격·받는 날·마감·받는 곳(이 순서). 값이 없는 행은 만들지 않는다.
 * 받는 곳은 시안(79:2449)에 있어서 유지한다.
 */
export function buildDetailRows(
  offer: Pick<OwnerOffer, 'price' | 'pickupAt' | 'pickupPlace' | 'deadlineAt'>,
): DetailRowData[] {
  const rows: DetailRowData[] = buildOfferRows(offer);
  if (offer.pickupPlace) {
    rows.push({ key: 'pickupPlace', label: OFFER_COPY.rowPickupPlace, value: offer.pickupPlace });
  }
  return rows;
}

/**
 * 제목 아래 부제 한 줄. 마감·완료·취소는 상태 문구가 설명 자리를 대신하고, 그 밖에는 제안 설명(description)이다.
 * 설명이 없으면 null 이라 줄 자체를 그리지 않는다.
 */
export function buildSubtitle(offer: Pick<OwnerOffer, 'status' | 'description'>): string | null {
  switch (offer.status) {
    case 'CLOSED':
      return OFFER_COPY.subtitle.closed;
    case 'DONE':
      return OFFER_COPY.subtitle.done;
    case 'CANCELLED':
      return OFFER_COPY.subtitle.cancelled;
    default:
      return offer.description ? offer.description : null;
  }
}

export interface StatusCardData {
  title: string;
  note: string;
}

/**
 * 상태 카드(연한 라임 카드): 모집 중·확정에서만 있다. 제목은 "현재 N명 / 최소 M명"이고 숫자는 orderCount 하나만 쓴다.
 * 마감 시각이 지나야 확정·마감이 정해지므로 모집 중에는 인원이 차도 "확정됐어요"라고 쓰지 않는다.
 */
export function buildStatusCard(
  offer: Pick<OwnerOffer, 'status' | 'orderCount' | 'minOrders'>,
): StatusCardData | null {
  if (offer.status !== 'OPEN' && offer.status !== 'CONFIRMED') return null;
  return {
    title: OFFER_COPY.statusCardTitle(offer.orderCount, offer.minOrders),
    note:
      offer.status === 'OPEN'
        ? OFFER_COPY.statusCardNote.open
        : OFFER_COPY.statusCardNote.confirmed,
  };
}

export interface OfferActions {
  /** 「수령 완료 처리」: 서버가 CONFIRMED 일 때만 받는다 */
  complete: boolean;
  /** 「제안 취소」: 서버가 OPEN·CONFIRMED 일 때만 받는다 */
  cancel: boolean;
  /** 「보낸 제안으로」: 처리할 수 없는 상태(마감·완료·취소, 모르는 상태)의 읽기 전용 화면에서 목록으로 돌아가는 버튼 */
  toList: boolean;
}

/**
 * 상태별 버튼 노출 규칙(서버 규칙과 같다): OPEN 은 「제안 취소」만, CONFIRMED 는 「수령 완료 처리」+「제안 취소」,
 * CLOSED·CANCELLED·DONE 과 모르는 상태는 처리 버튼 없이 읽기 전용이고 「보낸 제안으로」만 있다.
 */
export function availableActions(status: OfferStatus | undefined): OfferActions {
  const complete = status === 'CONFIRMED';
  const cancel = status === 'OPEN' || status === 'CONFIRMED';
  return { complete, cancel, toList: !cancel };
}
