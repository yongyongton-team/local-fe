import { describe, expect, it } from 'vitest';
import { founderService } from '.';
import { mockReportDescriptionGenerator } from './mockReportDescriptionGenerator';

const sentence = async (areaId: string, categoryId = 'fruit-vegetable') =>
  mockReportDescriptionGenerator.generate(
    (await founderService.getAreaReport({ areaId, categoryId }))!,
  );

describe('mockReportDescriptionGenerator', () => {
  it('구성동: 디자인 문장과 같다', async () => {
    await expect(sentence('guseong')).resolves.toBe(
      '구성동은 주민 29명이 과일·채소 가게를 원해요. 걸어서 15분 안에 같은 업종은 0곳이고, 가장 가까운 대형마트는 2.4km 떨어져 있어요. 요청은 평일 저녁에 몰려 있어요.',
    );
  });

  it('보정동·마북동: 마침표를 일관되게 붙이고 시간대가 바뀐다', async () => {
    await expect(sentence('bojeong')).resolves.toBe(
      '보정동은 주민 14명이 과일·채소 가게를 원해요. 걸어서 15분 안에 같은 업종은 1곳이고, 가장 가까운 대형마트는 1.9km 떨어져 있어요. 요청은 주말에 몰려 있어요.',
    );
    await expect(sentence('mabuk')).resolves.toBe(
      '마북동은 주민 9명이 과일·채소 가게를 원해요. 걸어서 15분 안에 같은 업종은 0곳이고, 가장 가까운 대형마트는 3.1km 떨어져 있어요. 요청은 평일 낮에 몰려 있어요.',
    );
  });

  it('대형마트 거리가 없으면 그 부분을 빼고 문장이 자연스럽게 이어진다', async () => {
    await expect(sentence('guseong', 'side-dish')).resolves.toBe(
      '구성동은 주민 12명이 반찬 가게를 원해요. 걸어서 15분 안에 같은 업종은 0곳이에요. 요청은 평일 저녁에 몰려 있어요.',
    );
  });
});
