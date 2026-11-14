/*
 * 입지 찾기(창업자 순위)의 문구. 공공데이터 지표 문구의 형식은 여기 한 곳에서 정한다.
 * 판정 문구(verdictLabel)는 서버가 쓴 문구를 그대로 보여주므로 여기에 두지 않는다.
 */
export const FOUNDER_COPY = {
  /** 순위 섹션 제목. 서버 정렬이 요청 수가 아니라 인구 대비 가게 부족을 기준으로 바뀌어 "요청은 많고…"에서 바꿨다. */
  rankSectionTitle: '인구에 비해 가게가 부족한 동네',
  /** 인구로 기대하는 가게 수와 실제 가게 수. expected 는 이미 반올림한 정수다. */
  expectedActual: (expected: number, actual: number) => `기대 ${expected}곳 · 실제 ${actual}곳`,
  // TODO(디자인 확정 후 교체): 아래 세 문구는 임시다(시안에는 접기 동작이 없다).
  /** 접힌 "부족하지 않은 동네"를 펼치는 버튼 */
  showNotShort: (count: number) => `부족하지 않은 동네 ${count}곳 더 보기`,
  /** 펼친 "부족하지 않은 동네"를 다시 접는 버튼 */
  hideNotShort: '접기',
  /** 보이는 행이 하나도 없을 때(전부 부족하지 않은 동네) 목록 자리의 안내 */
  noShortNotice: '인구에 비해 가게가 부족한 동네가 아직 없어요.',
} as const;
