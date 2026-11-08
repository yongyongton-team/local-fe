import { describe, expect, it } from 'vitest';
import { demandService, founderService, requestSubmitter } from '.';

const FRUIT = 'fruit-vegetable';
const summary = async (categoryId: string) =>
  (await founderService.listLocationRanks(categoryId)).map((r) => [
    r.rank,
    r.neighborhood.name,
    r.requestCount,
    r.nearbySameCategoryCount,
    r.nearestHypermarketKm,
  ]);

describe('입지 순위 목 서비스', () => {
  it('과일/채소: 구성동 → 보정동 → 마북동, 수요 데이터 값을 그대로 쓴다', async () => {
    expect(await summary(FRUIT)).toEqual([
      [1, '구성동', 29, 0, 2.4],
      [2, '보정동', 14, 1, 1.9],
      [3, '마북동', 9, 0, 3.1],
    ]);
  });

  it('업종별로 필터한다: 데이터가 있는 동네만 나오고 순위는 1부터 다시 매겨진다', async () => {
    expect(await summary('side-dish')).toEqual([[1, '구성동', 12, 0, undefined]]);
    expect(await summary('bakery')).toEqual([[1, '구성동', 6, 0, undefined]]);
  });

  it('대형마트 거리가 없는 항목에는 그 값이 없다', async () => {
    const [first] = await founderService.listLocationRanks('side-dish');

    expect(first).toBeDefined();
    expect('nearestHypermarketKm' in first!).toBe(false);
  });

  it('데이터가 없는 업종이면 빈 배열이다', async () => {
    expect(await founderService.listLocationRanks('unknown')).toEqual([]);
  });

  it('동네 위치는 업종이 바뀌어도 같다', async () => {
    const fruit = (await founderService.listLocationRanks(FRUIT)).find(
      (r) => r.neighborhood.id === 'guseong',
    );
    const side = (await founderService.listLocationRanks('side-dish')).find(
      (r) => r.neighborhood.id === 'guseong',
    );

    expect(side?.position).toEqual(fruit?.position);
  });

  it('주민이 과일/채소 요청을 보내면 구성동 인원이 29에서 30으로 반영된다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: FRUIT,
      detail: '과일가게요',
      conditions: [],
      visitTimes: [],
    });

    expect((await summary(FRUIT))[0]).toEqual([1, '구성동', 30, 0, 2.4]);
  });

  it('주민 요청으로 수요가 생긴 동네는 같은 서비스의 순위에 들어온다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'bojeong',
      categoryId: 'side-dish',
      detail: '반찬가게요',
      conditions: [],
      visitTimes: [],
    });

    // 구성동 12명 다음에 보정동 1명이 2위로 들어오고, 위치는 동네의 값 그대로다.
    const ranks = await founderService.listLocationRanks('side-dish');
    expect(ranks.map((r) => [r.rank, r.neighborhood.name, r.requestCount])).toEqual([
      [1, '구성동', 12],
      [2, '보정동', 1],
    ]);
  });

  it('원문 문장이나 개인 정보를 돌려주지 않는다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: FRUIT,
      detail: '비밀 문장 홍길동',
      conditions: [],
      visitTimes: [],
    });

    expect(JSON.stringify(await founderService.listLocationRanks(FRUIT))).not.toContain('비밀');
  });

  it('업종 목록은 기존 업종 데이터 전부다', async () => {
    expect((await demandService.listCategories()).map((c) => c.cardTitle)).toEqual([
      '과일 / 채소 가게',
      '반찬가게',
      '빵집',
    ]);
  });
});
