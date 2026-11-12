import type { MapPosition, PublicData } from '@/types/domain';

/*
 * 예비 창업자 입지 찾기 화면의 개발용 목 데이터. 실제 위치나 통계가 아니다.
 * "[임의]" 로 표시한 값은 디자인 예시에서 가져온 개발용 값이다.
 */

/** Figma 지도 카드(362×199)의 좌상단 px 좌표를 0~1 상대좌표로 바꾼다. 네이버 지도 연동 때 위경도로 교체한다. */
const at = (x: number, y: number): MapPosition => ({ x: x / 362, y: y / 199 });

/**
 * 동네의 지도 알약 위치(좌상단 기준). 위치는 동네에 속한 값이라 업종을 바꿔 순위가 달라져도 그대로다.
 * 값은 Figma 2:1903 에서 읽은 구성동·보정동·마북동 알약 위치다.
 */
export const mockFounderMapPositions: readonly { neighborhoodId: string; position: MapPosition }[] =
  [
    { neighborhoodId: 'guseong', position: at(135, 32) },
    { neighborhoodId: 'bojeong', position: at(24, 120) },
    { neighborhoodId: 'mabuk', position: at(236, 127) },
  ];

/**
 * [임의] 입지 순위(목)의 한 줄. 서버가 이미 정한 순서대로 나열한 것이다(프론트는 다시 정렬하지 않는다).
 * - neighborhoodId 가 있으면 그 동네의 요청·같은 업종·대형마트 값은 주민 화면들과 같은 메모리 DB 의 수요 데이터에서 읽는다.
 * - sample 이 있으면 목 동네에 없는 "예시동"이다. 값은 모두 개발용이고 실제 데이터가 아니다.
 * publicData 는 실제 응답과 같은 모양의 가짜 값이다(expectedCount 는 소수). verdictLabel 문구도 이 목 안에서만 쓰는 임의 문구다.
 */
export interface MockRankEntry {
  neighborhoodId?: string;
  sample?: {
    id: string;
    name: string;
    requestCount: number;
    nearbySameCategoryCount: number;
    nearestHypermarketKm?: number;
  };
  publicData?: PublicData;
}

/** 업종별 순위 목록(서버 순서). 여기 없는 업종은 순위가 없다. */
export const mockFounderRankings: Readonly<Record<string, readonly MockRankEntry[]>> = {
  // 과일/채소: 판정 5가지, 요청 0명이 2위, 공공데이터 없음, 긴 판정 문구를 한 목록에 둔다.
  'fruit-vegetable': [
    {
      neighborhoodId: 'guseong',
      publicData: {
        population: 21000,
        expectedCount: 10.5,
        dongStoreCount: 3,
        verdict: 'SHORT',
        verdictLabel: '[임의] 가게가 많이 부족해요',
      },
    },
    {
      // 요청이 0명인데도 공공데이터로 상위에 오는 예시
      sample: { id: 'sample-a', name: '예시동 가', requestCount: 0, nearbySameCategoryCount: 0 },
      publicData: {
        population: 16500,
        expectedCount: 8,
        dongStoreCount: 5,
        verdict: 'SOME_NEARBY',
        verdictLabel: '[임의] 근처에 가게가 조금 있어요',
      },
    },
    {
      neighborhoodId: 'bojeong',
      publicData: {
        population: 14200,
        expectedCount: 6.7,
        dongStoreCount: 4,
        verdict: 'NEXT_DONG',
        verdictLabel: '[임의] 옆 동네에 가게가 있어요',
      },
    },
    // 공공데이터가 없는 항목(기존 행과 같은 모양)
    { neighborhoodId: 'mabuk' },
    {
      sample: {
        id: 'sample-b',
        name: '예시동 나',
        requestCount: 2,
        nearbySameCategoryCount: 3,
        nearestHypermarketKm: 1.2,
      },
      publicData: {
        population: 9800,
        expectedCount: 9,
        dongStoreCount: 12,
        verdict: 'NOT_SHORT',
        verdictLabel: '[임의] 부족하지 않아요',
      },
    },
    {
      // 판단하지 못한 경우: 숫자는 없거나 0
      sample: { id: 'sample-c', name: '예시동 다', requestCount: 1, nearbySameCategoryCount: 0 },
      publicData: {
        population: 0,
        expectedCount: 0,
        dongStoreCount: 0,
        verdict: 'NOT_JUDGED',
        verdictLabel: '[임의] 공공데이터가 부족해 판단하지 못했어요',
      },
    },
    {
      sample: { id: 'sample-d', name: '예시동 라', requestCount: 3, nearbySameCategoryCount: 1 },
      publicData: {
        population: 18800,
        expectedCount: 7.2,
        dongStoreCount: 2,
        verdict: 'SHORT',
        verdictLabel:
          '[임의] 인구에 비해 가게가 많이 부족하고 가까운 동네에도 같은 업종이 없어서 새로 열기 좋은 곳이에요',
      },
    },
  ],
  // 그 업종의 수요가 있는 동네만 순위에 오른다(주민이 요청을 보내면 수요가 생겨 들어온다). 순서는 아래 그대로다.
  'side-dish': [
    { neighborhoodId: 'guseong' },
    { neighborhoodId: 'bojeong' },
    { neighborhoodId: 'mabuk' },
  ],
  bakery: [
    { neighborhoodId: 'guseong' },
    { neighborhoodId: 'bojeong' },
    { neighborhoodId: 'mabuk' },
  ],
};
