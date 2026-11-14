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

  // ── 보낸 제안 상세(Figma 79:2488 모집 중·79:2449 확정·79:2418 완료·79:2354 전송 결과) ──
  detailTitle: '보낸 제안 상세', // [시안]
  /** [시안] "마감 11/12(목) 18:00" */
  deadlineText: (date: string) => `마감 ${date}`,
  /** [시안] "싱싱과일 / 제철 과일 꾸러미" = 가게 이름 / 제안 제목. 가게 이름을 모르면 제안 제목만 쓴다. */
  heading: (shopName: string | undefined, title: string) =>
    shopName === undefined ? title : `${shopName} / ${title}`,
  rowPickupPlace: '받는 곳', // [시안]
  /**
   * 부제 한 줄: 기본은 제안 설명이고, 상태별 문구가 설명 자리를 대신한다.
   * [시안] 완료 "수량이 완료된 제안이에요".
   */
  subtitle: {
    // TODO(디자인 확정 후 교체): 마감(CLOSED)·취소(CANCELLED) 문구는 시안이 없다.
    closed: '최소 인원 모집을 채우지 못했어요',
    done: '수량이 완료된 제안이에요',
    cancelled: '취소한 제안이에요',
  },
  /** 상태 카드(모집 중·확정에서만). [시안] "현재 12명 / 최소 20명"(시안의 "20면"은 오타) */
  statusCardTitle: (orderCount: number, minOrders: number) =>
    `현재 ${orderCount}명 / 최소 ${minOrders}명`,
  statusCardNote: {
    open: '주문 마감 후 확정 여부가 정해져요', // [시안] 오타("마감후 상세", "정해저요") 수정
    confirmed: '최소 인원이 채워져 제안이 확정됐어요', // [시안] 오타("채워 제안이 확정 됬어요") 수정
  },
  completeAction: '수령 완료 처리', // [시안]
  cancelAction: '제안 취소', // [시안]
  backToList: '보낸 제안으로', // [시안]
  /** [시안] 「판매를 끝낼까요?」 팝업. 본문은 주석이 아니라 내용이다. */
  completeDialog: {
    title: '판매를 끝낼까요?',
    body: '모두 받아 갔다면 "수령 끝"으로 바꿔요. 이 기록은 창업자 리포트의 실제 수령 숫자에 들어가요.',
    cancel: '취소',
    confirm: '끝내기',
  },
  /**
   * [시안] 「제안을 취소할까요?」 팝업(79:2523). 시안의 오타("최소할까요", "쥐소하기")를 고쳤고 취소 사유 입력칸은 없다(서버가 사유를 받지 않는다).
   * TODO(디자인 확정 후 교체): 시안 본문("예약 인원에서 빠져요…")은 주민용 문구라 쓰지 않고 서버 동작에 맞게 임시로 썼다.
   */
  cancelDialog: {
    title: '제안을 취소할까요?',
    body: '취소한 제안은 되돌릴 수 없고, 예약한 주문도 모두 취소돼요.',
    cancel: '돌아가기',
    confirm: '취소하기',
  },
  /** 제안 전송 결과(79:2354): 큰 라임 배너와 "모집 현황" */
  sentBanner: '제안을 보냈어요!', // [시안]
  recruitTitle: '모집 현황', // [시안]
  // TODO(디자인 확정 후 교체): 시안은 "30명"만 있다. 알린 주민 수 문구는 임시다.
  notifiedResidents: (count: number) => `${count}명의 주민에게 알렸어요`,
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
} as const;

/**
 * 제안 상태 배지 문구. 모집 중·확정·완료는 시안(79:2488, 79:2449, 79:2418)에 있고 마감·취소는 시안 컴포넌트 설명을 따른 임시 문구다.
 * 완료(DONE)는 예전 "수령 끝"에서 최신 시안에 맞춰 바꿨다. 배지 색은 디자인에서 상태별로 정한다고 해서(Figma 컴포넌트 설명) 아직 한 가지 모양만 쓴다.
 */
// TODO(디자인 확정 후 교체): 색과 마감·취소의 문구는 시안이 확정되면 바꾼다.
export const OFFER_STATUS_LABELS: Readonly<Record<OfferStatus, string>> = {
  OPEN: '모집 중',
  CONFIRMED: '확정',
  CLOSED: '마감',
  CANCELLED: '취소',
  DONE: '완료',
};
