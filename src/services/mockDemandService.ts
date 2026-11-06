import { mockCategories, mockDemandSummaries, mockNeighborhoods } from '@/mocks/demand';
import type { NeighborhoodReport } from '@/types/domain';
import type { DemandService } from './demandService';

function buildReport(neighborhoodId: string, categoryId: string): NeighborhoodReport | null {
  const neighborhood = mockNeighborhoods.find((n) => n.id === neighborhoodId);
  const category = mockCategories.find((c) => c.id === categoryId);
  const demand = mockDemandSummaries.find(
    (d) => d.neighborhoodId === neighborhoodId && d.categoryId === categoryId,
  );
  return neighborhood && category && demand ? { neighborhood, category, demand } : null;
}

/** 네트워크 없이 목 데이터를 비동기로 돌려주는 구현. */
export const mockDemandService: DemandService = {
  async listNeighborhoods() {
    return mockNeighborhoods;
  },

  async listReports(categoryId) {
    return mockNeighborhoods
      .map((n) => buildReport(n.id, categoryId))
      .filter((report): report is NeighborhoodReport => report !== null)
      .sort((a, b) => b.demand.requestCount - a.demand.requestCount);
  },

  async getReport(neighborhoodId, categoryId) {
    return buildReport(neighborhoodId, categoryId);
  },
};
