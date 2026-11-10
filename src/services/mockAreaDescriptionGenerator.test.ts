import { describe, expect, it } from 'vitest';
import { merchantService } from '.';
import { mockAreaDescriptionGenerator } from './mockAreaDescriptionGenerator';

describe('mockAreaDescriptionGenerator', () => {
  it('동네·업종 문구·인원·가장 많은 시간대로 템플릿 문장을 만든다', async () => {
    const detail = await merchantService.getAreaDetail({
      areaId: 'guseong',
      categoryId: 'fruit-vegetable',
    });

    await expect(mockAreaDescriptionGenerator.generate(detail!)).resolves.toBe(
      '구성동에는 과일·채소 가게를 원하는 주민이 29명 있어요. 평일 저녁 방문이 좋아 보여요.',
    );
  });

  it('시간대 분포가 비어 있으면 첫 문장만 만든다', async () => {
    const detail = await merchantService.getAreaDetail({
      areaId: 'mabuk',
      categoryId: 'fruit-vegetable',
    });

    await expect(
      mockAreaDescriptionGenerator.generate({ ...detail!, visitTimes: [] }),
    ).resolves.toBe('마북동에는 과일·채소 가게를 원하는 주민이 9명 있어요.');
  });
});
