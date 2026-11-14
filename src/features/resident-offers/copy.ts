/*
 * 주민 "사장님 제안" 상세(Figma 66:518)와 「예약을 취소할까요?」 팝업(66:558) 문구.
 * [시안] 은 Figma 에 있는 문구이고, TODO(디자인 확정 후 교체) 가 달린 것은 시안에 없거나 시안의 오타·복사 오류를 고쳐 임시로 쓴 문구다.
 */
export const RESIDENT_OFFER_COPY = {
  title: '사장님 제안', // [시안]
  loading: '불러오는 중이에요.',
  failedTitle: '제안을 가져오지 못했어요',
  /** [시안] "싱싱과일 / 제철 과일 꾸러미" = 사장님 이름 / 제안 제목 */
  heading: (shopName: string, title: string) => `${shopName} / ${title}`,

  recruitTitle: '모집 현황', // [시안]
  /** [시안] "29 / 30명 · 1명만 더 모이면 돼요" */
  recruitMore: (orderCount: number, minOrders: number, remaining: number) =>
    `${orderCount} / ${minOrders}명 · ${remaining}명만 더 모이면 돼요`,
  // TODO(디자인 확정 후 교체): 최소 인원을 채웠을 때의 문구는 시안이 없다.
  recruitFilled: (orderCount: number, minOrders: number) =>
    `${orderCount} / ${minOrders}명 · 최소 인원을 채웠어요`,

  quantityLabel: '수량', // [시안]
  // TODO(디자인 확정 후 교체): 수량 −/+ 버튼의 접근성 이름은 시안이 없다.
  quantityDecrease: '수량 줄이기',
  quantityIncrease: '수량 늘리기',
  /** [시안] "선주문하기 30.000원"(천 단위 구분은 쉼표로 고쳤다) */
  orderAction: (amount: string) => `선주문하기 ${amount}원`,
  cancelAction: '예약 취소하기', // [시안]

  // TODO(디자인 확정 후 교체): 아래 예약·상태 안내 문구는 시안이 없다.
  myOrder: (quantity: number) => `내 예약: ${quantity}개`,
  pickedUp: '받아 갔어요',
  statusNote: {
    confirmed: '확정됐어요. 이제 새로 주문할 수 없어요',
    closed: '마감됐어요',
    done: '수령이 끝난 제안이에요',
  },

  /**
   * [시안] 「예약을 취소할까요?」 팝업. 본문은 주석이 아니라 내용이다.
   * TODO(디자인 확정 후 교체): 시안의 오타("최소할까요", "빠저요")와 복사 오류(버튼 "취소"·"끝내기")를 고친 임시 문구다.
   */
  cancelDialog: {
    title: '예약을 취소할까요?',
    body: '취소하면 예약 인원에서 빠져요. 마감 전이면 다시 예약할 수 있어요.',
    cancel: '닫기',
    confirm: '예약 취소',
  },

  // TODO(디자인 확정 후 교체): 아래 문구는 시안이 없다.
  notFoundTitle: '취소되었거나 사라진 제안이에요',
  notFoundAction: '내 요청으로',
} as const;
