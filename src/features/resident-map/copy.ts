import { REQUEST_GOAL_COUNT } from '@/features/my-requests/constants';

/*
 * 주민 탐색의 간편 요청("나도 요청")과 가게 정보 문구. 이 기능들의 Figma 시안은 아직 없어서 모두 임시다.
 * TODO(디자인 확정 필요): 시안이 나오면 여기서만 바꾼다.
 */
export const QUICK_REQUEST_COPY = {
  // 카드 아이콘의 이름(아이콘만 있는 버튼이라 접근 가능한 이름이 필요하다)
  addRequestLabel: '나도 요청',
  viewMyRequestsLabel: '내 요청 보기',
  // 요청 창
  title: '나도 요청',
  send: '보내기',
  close: '닫기',
  confirm: '확인',
  timesLegend: '언제 가실 것 같아요?',
  frequencyLegend: '얼마나 자주요?',
  // 기준 인원에 도달했을 때(백엔드가 알려 준 문구). 알린 사장님 수가 없으면 앞 문장만 보인다.
  goalTitle: `${REQUEST_GOAL_COUNT}명이 모였어요!`,
  notifiedOwners: (count: number) => `근처 사장님 ${count}명에게 알렸어요`,
} as const;

export const STORE_INFO_COPY = {
  close: '가게 정보 닫기',
  /** 가게 이름도 업종도 알 수 없을 때(서버가 주지 않았을 때)의 임시 문구. TODO(디자인 확정 필요) */
  unknown: '가게 정보를 불러오지 못했어요',
} as const;
