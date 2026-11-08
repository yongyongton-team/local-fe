import type { LocationRank } from '@/types/domain';

/**
 * 예비 창업자 입지 탐색 데이터 접근 인터페이스. 현재 구현은 메모리의 목이고 네트워크 호출은 없다.
 * 집계된 인원과 가게 수만 돌려주며 주민이 입력한 원문 문장이나 개인 정보는 담지 않는다.
 */
export interface FounderService {
  /** 업종에 대한 동네 입지 순위. 그 업종의 수요 데이터가 있는 동네만, 순위 순. 없으면 빈 배열 */
  listLocationRanks(categoryId: string): Promise<LocationRank[]>;
}
