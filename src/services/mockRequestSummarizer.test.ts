import { describe, expect, it } from 'vitest';
import { mockRequestSummarizer, summarizeByKeywords } from './mockRequestSummarizer';

describe('summarizeByKeywords', () => {
  it('예시 문장은 과일/채소 + [늦게까지 영업, 낱개 구매] 로 정리된다', () => {
    expect(
      summarizeByKeywords('밤 10시까지 하는 과일가게요. 낱개로 살 수 있으면 좋겠어요.'),
    ).toEqual({
      categoryId: 'fruit-vegetable',
      conditions: ['늦게까지 영업', '낱개 구매'],
    });
  });

  it.each([
    ['과일이 있으면 좋겠어요', 'fruit-vegetable'],
    ['채소 가게', 'fruit-vegetable'],
    ['야채를 팔면', 'fruit-vegetable'],
    ['반찬가게가 생기면', 'side-dish'],
    ['빵집이 필요해요', 'bakery'],
    ['베이커리 카페', 'bakery'],
  ])('"%s" 은 업종 %s 로 정해진다', (text, categoryId) => {
    expect(summarizeByKeywords(text).categoryId).toBe(categoryId);
  });

  it('업종 키워드가 없으면 업종 미정(null)이다', () => {
    expect(summarizeByKeywords('맛있는 가게가 생기면 좋겠어요').categoryId).toBeNull();
  });

  it('업종 키워드가 둘 이상이면 모호하므로 업종 미정(null)이다', () => {
    expect(summarizeByKeywords('과일이랑 빵을 같이 파는 곳').categoryId).toBeNull();
  });

  it.each([
    ['늦게까지 열면 좋겠어요', ['늦게까지 영업']],
    ['밤에도 열었으면', ['늦게까지 영업']],
    ['9시까지 해요', ['늦게까지 영업']],
    ['낱개로 팔아요', ['낱개 구매']],
    ['소량으로 살 수 있게', ['낱개 구매']],
    ['그냥 가까우면 좋아요', []],
  ])('"%s" 의 조건은 %j', (text, conditions) => {
    expect(summarizeByKeywords(text).conditions).toEqual(conditions);
  });

  it('같은 조건이 여러 키워드로 걸려도 한 번만 나온다', () => {
    expect(summarizeByKeywords('늦게까지, 밤 10시까지').conditions).toEqual(['늦게까지 영업']);
  });
});

describe('mockRequestSummarizer', () => {
  it('비동기로 같은 결과를 돌려준다', async () => {
    await expect(mockRequestSummarizer.summarize('빵집 낱개')).resolves.toEqual({
      categoryId: 'bakery',
      conditions: ['낱개 구매'],
    });
  });
});
