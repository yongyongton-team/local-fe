import {
  OFFER_DESCRIPTION_MAX,
  OFFER_MIN_ORDERS_MAX,
  OFFER_MIN_ORDERS_MIN,
  OFFER_PICKUP_PLACE_MAX,
  OFFER_PRICE_MAX,
  OFFER_TITLE_MAX,
} from '@/shared/lib/inputLimits';
import type { OfferStatus } from '@/types/domain';

/*
 * 사장님 "내 가게(제안 목록)"와 "방문 판매 제안" 화면 문구.
 * [시안] 은 Figma(45:584, 45:542)에 있는 문구이고, TODO(디자인 확정 후 교체) 가 달린 것은 시안에 없어 임시로 쓴 문구다.
 * 시안의 라벨 "받은 날짜 / 시간", "받은 곳"은 오타로 보여 "받는 날짜 / 시간", "받는 곳"으로 썼다.
 */
export const OFFER_COPY = {
  // ── 내 가게(제안 목록) ──
  listTitle: '내 가게', // [시안]
  sendOffer: '내 제안 보내기', // [시안]
  backToRequests: '요청 모아 보기로', // [시안]
  rowPrice: '가격', // [시안]
  rowPickup: '받는 날', // [시안]
  rowDeadline: '마감', // [시안]
  /** [시안] "0 / 20명 예약" */
  reserved: (orderCount: number, minOrders: number) => `${orderCount} / ${minOrders}명 예약`,
  loading: '불러오는 중이에요.',
  listFailedTitle: '제안을 가져오지 못했어요',
  summaryFailedTitle: '동네 정보를 가져오지 못했어요',
  // TODO(디자인 확정 후 교체): 시안에 빈 목록이 없다.
  emptyTitle: '아직 보낸 제안이 없어요',
  emptyBody: '내 제안 보내기를 눌러 주민들에게 방문 판매를 제안해 보세요.',
  // TODO(디자인 확정 후 교체): 동네를 알 수 없을 때(서버가 가게의 동을 주지 않았고 주소에도 없을 때)
  noAreaTitle: '제안을 보낼 동네를 알 수 없어요',
  noAreaBody: '요청 모아 보기에서 동네를 고른 뒤 방문 판매 제안하기를 눌러 주세요.',
  // TODO(디자인 확정 후 교체): 요약 카드에 요청 수만 있고 조건이 없을 때는 조건 문구를 뺀다.
  /** 요약 카드 둘째 줄. 시안: "요청 30명 · 늦게까지 영업, 낱개 구매가 많아요" */
  summaryLine: (requestCount: number, conditionSummary: string | null) =>
    conditionSummary === null
      ? `요청 ${requestCount}명`
      : `요청 ${requestCount}명 · ${conditionSummary}`,
  // TODO(디자인 확정 후 교체): 시안 예시는 "늦게까지 영업, 낱개 구매가 많아요" 이다. 조사(이/가)를 코드로 맞추지 않아 "…조건이 많아요"로 썼다.
  conditionSummary: (labels: readonly string[]) => `${labels.join(', ')} 조건이 많아요`,
  /** [시안] "{동} · {업종} 가게" */
  summaryTitle: (dongName: string, categoryLabel: string) => `${dongName} · ${categoryLabel}`,

  // ── 제안 상세(Figma 66:472) ──
  detailTitle: '제안 상세', // [시안]
  detailRegionLabel: '예약 현황', // [시안] 카드 이름(접근성)
  /** [시안] "마감 11/12(목) 18:00" */
  deadlineText: (date: string) => `마감 ${date}`,
  /** [시안] "예약 22명 · 최소 20명" */
  reservedSummary: (orderCount: number, minOrders: number) =>
    `예약 ${orderCount}명 · 최소 ${minOrders}명`,
  rowPickupPlace: '받는 곳', // [시안]
  completeAction: '판매 끝 (모두 받아 갔어요)', // [시안]
  cancelAction: '제안 취소', // [시안]
  /** [시안] 「판매를 끝낼까요?」 팝업. 본문은 주석이 아니라 내용이다. */
  completeDialog: {
    title: '판매를 끝낼까요?',
    body: '모두 받아 갔다면 "수령 끝"으로 바꿔요. 이 기록은 창업자 리포트의 실제 수령 숫자에 들어가요.',
    cancel: '취소',
    confirm: '끝내기',
  },
  // TODO(디자인 확정 후 교체): 「제안 취소」 팝업은 시안이 없다.
  cancelDialog: {
    title: '제안을 취소할까요?',
    body: '취소한 제안은 되돌릴 수 없고, 예약한 주문도 모두 취소돼요.',
    cancel: '아니요',
    confirm: '제안 취소',
  },
  /**
   * 상태별 안내 문구(예약 현황 카드 안). 서버는 마감 시각이 지난 뒤에야 확정(CONFIRMED)·마감(CLOSED)을 정하므로
   * 모집 중(OPEN)에서는 "확정됐어요"라고 쓰지 않는다.
   */
  statusNote: {
    // TODO(디자인 확정 후 교체): OPEN·CLOSED·CANCELLED·DONE 문구는 시안이 없다.
    open: (minOrders: number, deadline: string | null) =>
      deadline === null
        ? `${minOrders}명이 모이면 확정돼요`
        : `마감(${deadline})까지 ${minOrders}명이 모이면 확정돼요`,
    openFilled: '최소 인원을 채웠어요. 마감 시각이 지나면 확정돼요',
    confirmed: '최소 주문을 채워서 확정됐어요', // [시안]
    closed: '마감됐지만 최소 인원을 채우지 못했어요',
    cancelled: '취소한 제안이에요',
    done: '수령이 끝난 제안이에요',
  },
  // TODO(디자인 확정 후 교체): 아래 오류·찾을 수 없음 문구는 시안이 없다.
  actionClosed: '지금은 처리할 수 없는 상태예요. 최신 상태로 다시 보여드릴게요.',
  actionForbidden: '내 제안이 아니라서 처리할 수 없어요.',
  detailNotFoundTitle: '찾을 수 없는 제안이에요',
  detailNotFoundBody: '이미 지워졌거나 주소가 잘못된 제안이에요.',
  detailNotFoundAction: '제안 목록으로',
  detailFailedTitle: '제안을 가져오지 못했어요',

  // ── 방문 판매 제안(작성) ──
  formTitle: '방문 판매 제안', // [시안]
  fieldTitle: '제목', // [시안]
  fieldDescription: '설명 (선택)', // [시안]
  fieldPrice: '가격', // [시안]
  fieldMinOrders: '최소 주문', // [시안]
  fieldPickupAt: '받는 날짜 / 시간', // [시안] 오타 수정: 받은 → 받는
  fieldPickupPlace: '받는 곳', // [시안] 오타 수정: 받은 → 받는
  fieldDeadlineAt: '주문 마감', // [시안]
  submit: '제안 보내기', // [시안]
  /** [시안] 마감이 받는 날짜보다 같거나 늦을 때 */
  deadlineAfterPickup: '마감은 받는 날짜보다 빨라야 해요.',
  // TODO(디자인 확정 후 교체): 아래 입력 보조 문구는 시안에 없다.
  titlePlaceholder: '예: 제철 과일 꾸러미',
  descriptionPlaceholder: '어떤 물건을 어떻게 파는지 적어 주세요',
  pickupPlacePlaceholder: '예: 구성동 주민센터 앞',
  pricePlaceholder: '예: 15,000',
  priceUnit: '원',
  minOrdersUnit: '명',
  pickPlaceholder: '날짜와 시간을 골라 주세요',
  minOrdersDecrease: '최소 주문 줄이기',
  minOrdersIncrease: '최소 주문 늘리기',
  /** 버튼이 비활성일 때 어떤 항목이 비었는지 알리는 임시 안내 */
  missing: {
    title: '제목을 입력해 주세요.',
    price: '가격을 1원 이상으로 입력해 주세요.',
    pickupAt: '받는 날짜와 시간을 골라 주세요.',
    pickupPlace: '받는 곳을 입력해 주세요.',
    deadlineAt: '주문 마감 날짜와 시간을 골라 주세요.',
  },
  // TODO(디자인 확정 후 교체): 시안에 없는 임시 안내. 서버 규칙 `지금 < 마감 < 받는 시각` 중 앞부분이다.
  deadlineBeforeNow: '마감은 지금보다 늦어야 해요.',
  // TODO(디자인 확정 후 교체): 서버 제약(길이·범위)을 넘었을 때의 임시 안내. 입력 칸이 먼저 막아 주므로 드물게 보인다.
  outOfRange: {
    title: `제목은 ${OFFER_TITLE_MAX}자 이하로 입력해 주세요.`,
    description: `설명은 ${OFFER_DESCRIPTION_MAX}자 이하로 입력해 주세요.`,
    price: `가격은 ${OFFER_PRICE_MAX.toLocaleString('ko-KR')}원 이하로 입력해 주세요.`,
    pickupPlace: `받는 곳은 ${OFFER_PICKUP_PLACE_MAX}자 이하로 입력해 주세요.`,
    minOrders: `최소 주문은 ${OFFER_MIN_ORDERS_MIN}~${OFFER_MIN_ORDERS_MAX}명으로 정해 주세요.`,
  },
  // TODO(디자인 확정 후 교체): 시안에 없는 성공 안내
  sentTitle: '제안을 보냈어요',
  sentBody: (notifiedResidentCount: number | undefined) =>
    notifiedResidentCount === undefined
      ? '요청한 주민에게 알림을 보냈어요.'
      : `알림 보낸 주민 ${notifiedResidentCount}명`,
  sentConfirm: '확인',
} as const;

/**
 * 제안 상태 배지 문구. 시안의 상태 배지 컴포넌트 설명("모집 중, 확정, 마감, 취소, 수령 끝")을 따른 임시 문구다.
 * OPEN 만 시안 화면에 그려져 있다. 배지 색은 디자인에서 상태별로 정한다고 해서(Figma 컴포넌트 설명) 아직 한 가지 모양만 쓴다.
 */
// TODO(디자인 확정 후 교체): 색과 OPEN 외 상태의 문구는 시안이 확정되면 바꾼다.
export const OFFER_STATUS_LABELS: Readonly<Record<OfferStatus, string>> = {
  OPEN: '모집 중',
  CONFIRMED: '확정',
  CLOSED: '마감',
  CANCELLED: '취소',
  DONE: '수령 끝',
};
