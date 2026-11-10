import { describe, expect, it } from 'vitest';
import type { MyRequest } from '@/types/domain';
import {
  buildMetaLine,
  describeRequestSummary,
  formatMerchantResponse,
  getProgress,
} from './requestProgress';

describe('getProgress', () => {
  it('기준 인원(30)보다 적으면 막대 비율을 계산하고 결정 필요가 아니다', () => {
    const progress = getProgress(12);

    expect(progress.ratio).toBeCloseTo(0.4);
    expect(progress.reached).toBe(false);
    expect(progress.valueNow).toBe(12);
    expect(progress.label).toBe('12명이 모였어요!');
    expect(progress.valueText).toBe('12명이 모였어요 (기준 30명)');
  });

  it('기준 인원에 도달하면 결정 필요이고 막대가 가득 찬다', () => {
    const progress = getProgress(30);

    expect(progress.ratio).toBe(1);
    expect(progress.reached).toBe(true);
    expect(progress.label).toBe('30명이 모였어요!');
  });

  it('기준 인원을 넘어도 막대는 가득 차고 aria-valuenow 는 범위 안에 있다', () => {
    const progress = getProgress(45);

    expect(progress.ratio).toBe(1);
    expect(progress.reached).toBe(true);
    expect(progress.valueNow).toBe(30);
    // 실제 인원은 문구에 그대로 보여준다.
    expect(progress.label).toBe('45명이 모였어요!');
  });

  it('음수 인원은 0 으로 본다', () => {
    expect(getProgress(-3)).toMatchObject({ ratio: 0, valueNow: 0, reached: false });
  });

  it('기준 인원을 바꿔 계산할 수 있다', () => {
    expect(getProgress(5, 10).ratio).toBe(0.5);
  });
});

const item = (overrides: Partial<MyRequest> = {}): MyRequest => ({
  request: {
    id: 'r',
    neighborhoodId: 'guseong',
    categoryId: 'fruit-vegetable',
    detail: '',
    conditions: [],
    visitTimes: [],
  },
  neighborhood: { id: 'guseong', district: '기흥구', name: '구성동' },
  category: {
    id: 'fruit-vegetable',
    name: '과일·채소',
    cardTitle: '과일 / 채소 가게',
    requestLabel: '과일',
    missingLabel: '과일 / 채소',
    objectPhrase: '과일·채소 가게를',
    titleLabel: '과일 가게',
  },
  requestCount: 30,
  ...overrides,
});

describe('describeRequestSummary', () => {
  it('업종 데이터의 조사가 완성된 문구를 그대로 쓴다', () => {
    expect(describeRequestSummary(item())).toBe(
      '구성동에서 과일·채소 가게를 원하는 주민이 30명이 됐어요.',
    );
  });

  it('업종마다 다른 문구와 인원을 쓴다', () => {
    const bakery = item({
      requestCount: 6,
      category: { ...item().category, objectPhrase: '빵집을' },
    });

    expect(describeRequestSummary(bakery)).toBe('구성동에서 빵집을 원하는 주민이 6명이 됐어요.');
  });
});

describe('buildMetaLine', () => {
  it('동네 · 시간대 · 빈도를 · 로 잇는다', () => {
    expect(buildMetaLine('구성동', ['weekday-evening'], 'weekly')).toBe(
      '구성동 · 평일 저녁 · 주 1번 이상',
    );
  });

  it('시간대가 여럿이면 ", "로 잇고 선택지 순서로 보여준다', () => {
    expect(buildMetaLine('구성동', ['weekend', 'weekday-day'], 'monthly')).toBe(
      '구성동 · 평일 낮, 주말 · 한 달 2~3번',
    );
  });

  it('시간대가 없으면 그 부분을 뺀다', () => {
    expect(buildMetaLine('구성동', [], 'rarely')).toBe('구성동 · 가끔');
  });

  it('빈도가 없으면 그 부분을 뺀다', () => {
    expect(buildMetaLine('구성동', ['weekend'])).toBe('구성동 · 주말');
  });

  it('둘 다 없으면 동네 이름만 남는다', () => {
    expect(buildMetaLine('구성동', [])).toBe('구성동');
  });
});

describe('formatMerchantResponse', () => {
  it('"업체(지역): 메시지" 로 만든다', () => {
    expect(
      formatMerchantResponse({
        merchantName: '싱싱과일',
        areaName: '신갈동',
        message: '안녕하세요',
      }),
    ).toBe('싱싱과일(신갈동): 안녕하세요');
  });
});
