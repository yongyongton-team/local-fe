import type { DemandSummary, Neighborhood, StoreCategory } from '@/types/domain';

/*
 * 개발용 목 데이터. 실제로 검증된 통계가 아니다.
 * 이 데이터를 보여주는 화면에는 "예시 데이터" 표시를 둔다.
 */

export const mockNeighborhoods: Neighborhood[] = [
  { id: 'guseong', district: '기흥구', name: '구성동' },
  { id: 'bojeong', district: '기흥구', name: '보정동' },
  { id: 'mabuk', district: '기흥구', name: '마북동' },
];

export const mockCategories: StoreCategory[] = [{ id: 'fruit-vegetable', name: '과일·채소' }];

export const mockDemandSummaries: DemandSummary[] = [
  {
    neighborhoodId: 'guseong',
    categoryId: 'fruit-vegetable',
    requestCount: 29,
    nearbySameCategoryCount: 0,
    nearestHypermarketKm: 2.4,
  },
  {
    neighborhoodId: 'bojeong',
    categoryId: 'fruit-vegetable',
    requestCount: 14,
    nearbySameCategoryCount: 1,
    nearestHypermarketKm: 1.9,
  },
  {
    neighborhoodId: 'mabuk',
    categoryId: 'fruit-vegetable',
    requestCount: 9,
    nearbySameCategoryCount: 0,
    nearestHypermarketKm: 3.1,
  },
];
