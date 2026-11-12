import { MOCK_GOAL_COUNT, MOCK_NOTIFIED_OWNER_COUNT } from '@/mocks/demand';
import { getDb } from '@/mocks/memoryDb';
import type { NewStoreRequest, StoreRequest } from '@/types/domain';
import type { RequestSubmitter } from './requestSubmitter';

/**
 * 메모리 DB 에 요청을 저장한다. 서버에는 보내지 않는다.
 * - 같은 동네·같은 업종 요청이 이미 있으면 새 요청을 만들지 않고 그 요청의 내용만 갱신한다.
 *   인원은 올리지 않고, 방금 보낸 요청이므로 가장 최근 요청으로 옮긴다. (추정)
 * - 처음 보내는 요청이면 해당 동네·업종의 수요 인원을 1 올리고 "내가 요청함"을 true 로 한다.
 *   인원 계산은 여기 한 곳에서만 한다.
 * 돌려주는 created 는 이번에 인원이 올랐는지, count 는 그 뒤의 인원이다.
 */
function save(input: NewStoreRequest): { saved: StoreRequest; created: boolean; count: number } {
  const db = getDb();

  const index = db.requests.findIndex(
    ({ request }) =>
      request.neighborhoodId === input.neighborhoodId && request.categoryId === input.categoryId,
  );
  if (index >= 0) {
    const [existing] = db.requests.splice(index, 1);
    if (!existing) throw new Error('요청을 찾을 수 없어요.');
    const updated: StoreRequest = { ...existing.request, ...input, id: existing.request.id };
    db.requests.push({ ...existing, request: updated });
    const summary = db.summaries.find(
      (s) => s.neighborhoodId === input.neighborhoodId && s.categoryId === input.categoryId,
    );
    return { saved: updated, created: false, count: summary?.requestCount ?? 0 };
  }

  const saved: StoreRequest = { ...input, id: `mock-request-${db.nextRequestNumber++}` };
  db.requests.push({ request: saved });

  const summary = db.summaries.find(
    (s) => s.neighborhoodId === input.neighborhoodId && s.categoryId === input.categoryId,
  );
  if (summary) {
    summary.requestCount += 1;
    summary.requestedByMe = true;
    return { saved, created: true, count: summary.requestCount };
  }
  // [임의] 수요 데이터가 아직 없는 동네·업종이면 새로 만든다. 주변 같은 업종 수는 알 수 없어 0 으로 둔다.
  db.summaries.push({
    neighborhoodId: input.neighborhoodId,
    categoryId: input.categoryId,
    requestCount: 1,
    nearbySameCategoryCount: 0,
    requestedByMe: true,
  });
  return { saved, created: true, count: 1 };
}

export const mockRequestSubmitter: RequestSubmitter = {
  remote: false,
  async submit(input) {
    return save(input).saved;
  },
  async submitQuick({ neighborhoodId, categoryId, visitTimes, visitFrequency }) {
    // 간편 요청은 문장·조건이 없다(빈 값으로 저장한다).
    const { created, count } = save({
      neighborhoodId,
      categoryId,
      detail: '',
      conditions: [],
      visitTimes,
      visitFrequency,
    });
    // 이번 요청으로 기준 인원에 도달했을 때만 도달이다(이미 넘은 뒤의 요청은 아니다).
    const reachedGoal = created && count === MOCK_GOAL_COUNT;
    return reachedGoal
      ? { reachedGoal, notifiedOwnerCount: MOCK_NOTIFIED_OWNER_COUNT }
      : { reachedGoal };
  },
};
