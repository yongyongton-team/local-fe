import type { NewStoreRequest, StoreRequest, VisitFrequency, VisitTime } from '@/types/domain';

/** 간편 요청("나도 요청") 입력. 문장 입력과 AI 정리 없이 업종이 정해져 있고, 방문 시간대(1개 이상)와 빈도만 고른다. */
export interface QuickRequestInput {
  neighborhoodId: string;
  categoryId: string;
  visitTimes: VisitTime[];
  visitFrequency: VisitFrequency;
}

/** 간편 요청 결과. 기준 인원에 이 요청으로 도달했으면 reachedGoal 이고, 알린 사장님 수는 서버가 줄 때만 있다. */
export interface QuickRequestResult {
  reachedGoal: boolean;
  /** 서버가 주지 않았거나 올바른 숫자가 아니면 없음(화면은 숫자 없이 안내한다) */
  notifiedOwnerCount?: number;
}

/**
 * 요청 제출 경계. 현재 구현은 메모리에만 저장하는 목이고 네트워크 호출은 없다.
 * 위치로는 선택된 동네 id 만 저장한다(현재 위치 권한은 요청하지 않는다).
 */
export interface RequestSubmitter {
  /**
   * 서버에 저장하는 구현이면 true. 서버는 시간대(1개 이상)와 빈도를 필수로 받으므로,
   * true 이면 화면이 이 둘을 고르기 전에는 보내지 못하게 한다. 목은 false(둘 다 선택 사항).
   */
  readonly remote: boolean;
  submit(request: NewStoreRequest): Promise<StoreRequest>;
  /**
   * 간편 요청(주민 탐색 카드의 "나도 요청"). 본문은 {동, 업종, 시간대, 빈도}뿐이고 문장·조건은 보내지 않는다.
   * 같은 동네·업종을 이미 요청했으면 ALREADY_REQUESTED 로 던진다(api). 데모 세션이면 서버에 보내지 않고 던진다.
   */
  submitQuick(input: QuickRequestInput): Promise<QuickRequestResult>;
}
