import type { MyRequest } from '@/types/domain';

/**
 * 내가 보낸 요청 조회 경계. 현재 구현은 메모리의 목이고 네트워크 호출은 없다.
 * 사장님 쪽 화면과 응답 작성 기능은 없다. 응답은 목 시드로만 존재한다.
 */
export interface MyRequestService {
  /** 가장 최근에 보낸 요청이 앞에 온다. 요청이 없으면 빈 배열 */
  listMyRequests(): Promise<MyRequest[]>;
}
