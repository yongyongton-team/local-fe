import { mockCategories, mockNeighborhoods } from '@/mocks/demand';
import { getDb } from '@/mocks/memoryDb';
import type { MyRequest } from '@/types/domain';
import type { MyRequestService } from './myRequestService';

export const mockMyRequestService: MyRequestService = {
  remote: false,
  async listMyRequests() {
    const db = getDb();
    const items: MyRequest[] = [];

    // 배열 끝이 가장 최근이므로 뒤에서부터 읽어 최근 순으로 만든다.
    for (const { request, response } of [...db.requests].reverse()) {
      const neighborhood = mockNeighborhoods.find((n) => n.id === request.neighborhoodId);
      const category = mockCategories.find((c) => c.id === request.categoryId);
      if (!neighborhood || !category) continue;

      // 요청 인원은 수요 데이터에서 계산한 해당 동네·업종의 전체 인원이다.
      const demand = db.summaries.find(
        (s) => s.neighborhoodId === request.neighborhoodId && s.categoryId === request.categoryId,
      );
      items.push({
        request: { ...request },
        neighborhood,
        category,
        requestCount: demand?.requestCount ?? 0,
        response: response && { ...response },
      });
    }
    return items;
  },
  async deleteRequest(requestId) {
    const db = getDb();
    const index = db.requests.findIndex(({ request }) => request.id === requestId);
    // 이미 없으면 지워진 것과 같다.
    if (index < 0) return;

    const [removed] = db.requests.splice(index, 1);
    if (!removed) return;
    // 제출(mockRequestSubmitter)이 올린 인원을 되돌린다. 내 요청은 동네·업종마다 하나라 "내가 요청함"도 해제한다.
    const { neighborhoodId, categoryId } = removed.request;
    const summary = db.summaries.find(
      (s) => s.neighborhoodId === neighborhoodId && s.categoryId === categoryId,
    );
    if (summary) {
      summary.requestCount = Math.max(0, summary.requestCount - 1);
      summary.requestedByMe = false;
    }
  },
};
