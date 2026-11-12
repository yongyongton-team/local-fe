import { afterEach, describe, expect, it } from 'vitest';
import type { MyRequest } from '@/types/domain';
import {
  buildMetaLine,
  describeRequestSummary,
  formatKoreanPickupTime,
  formatMerchantResponse,
  getProgress,
} from './requestProgress';

describe('getProgress', () => {
  it('기준 인원(30)보다 적으면 막대 비율을 계산한다', () => {
    const progress = getProgress(12);

    expect(progress.ratio).toBeCloseTo(0.4);
    expect(progress.valueNow).toBe(12);
    expect(progress.label).toBe('12명이 모였어요!');
    expect(progress.valueText).toBe('12명이 모였어요 (기준 30명)');
  });

  it('기준 인원에 도달하면 막대가 가득 찬다', () => {
    const progress = getProgress(30);

    expect(progress.ratio).toBe(1);
    expect(progress.label).toBe('30명이 모였어요!');
  });

  it('기준 인원을 넘어도 막대는 가득 차고 aria-valuenow 는 범위 안에 있다', () => {
    const progress = getProgress(45);

    expect(progress.ratio).toBe(1);
    expect(progress.valueNow).toBe(30);
    // 실제 인원은 문구에 그대로 보여준다.
    expect(progress.label).toBe('45명이 모였어요!');
  });

  it('음수 인원은 0 으로 본다', () => {
    expect(getProgress(-3)).toMatchObject({ ratio: 0, valueNow: 0 });
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

describe('formatKoreanPickupTime', () => {
  const kst = (iso: string) => formatKoreanPickupTime(new Date(iso));

  it('한국 요일 풀네임, 오전/오후, 12시간제 시각으로 만든다', () => {
    // 2026-11-14 는 토요일이다.
    expect(kst('2026-11-14T10:00:00+09:00')).toBe('토요일 오전 10시');
    expect(kst('2026-11-14T18:00:00+09:00')).toBe('토요일 오후 6시');
    expect(kst('2026-11-15T09:00:00+09:00')).toBe('일요일 오전 9시');
    expect(kst('2026-11-16T09:00:00+09:00')).toBe('월요일 오전 9시');
  });

  it('분이 0 이면 생략하고, 아니면 "N분"을 붙인다', () => {
    expect(kst('2026-11-14T10:00:00+09:00')).toBe('토요일 오전 10시');
    expect(kst('2026-11-14T10:30:00+09:00')).toBe('토요일 오전 10시 30분');
    expect(kst('2026-11-14T10:05:00+09:00')).toBe('토요일 오전 10시 5분');
  });

  it('오전/오후 경계: 0시는 오전 12시, 11시 59분은 오전, 12시는 오후 12시, 13시는 오후 1시', () => {
    expect(kst('2026-11-14T00:00:00+09:00')).toBe('토요일 오전 12시');
    expect(kst('2026-11-14T00:30:00+09:00')).toBe('토요일 오전 12시 30분');
    expect(kst('2026-11-14T11:59:00+09:00')).toBe('토요일 오전 11시 59분');
    expect(kst('2026-11-14T12:00:00+09:00')).toBe('토요일 오후 12시');
    expect(kst('2026-11-14T13:00:00+09:00')).toBe('토요일 오후 1시');
    expect(kst('2026-11-14T23:59:00+09:00')).toBe('토요일 오후 11시 59분');
  });

  it('다른 오프셋으로 적힌 같은 순간도 한국 시간으로 보여주고, 날짜가 넘어가면 요일도 넘어간다', () => {
    // UTC 로 적힌 금요일 23시는 한국에서 토요일 오전 8시다. UTC 토요일 15시 30분은 한국 일요일 0시 30분이다.
    expect(kst('2026-11-13T23:00:00Z')).toBe('토요일 오전 8시');
    expect(kst('2026-11-14T15:30:00Z')).toBe('일요일 오전 12시 30분');
  });

  describe('기기 시간대가 달라도 결과가 같다', () => {
    const original = process.env.TZ;
    afterEach(() => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it.each(['America/Los_Angeles', 'UTC', 'Asia/Tokyo', 'Pacific/Auckland'])('TZ=%s', (zone) => {
      process.env.TZ = zone;
      const at = new Date('2026-11-14T00:30:00+09:00');
      // 시간대 변경이 실제로 적용됐는지(그래야 이 테스트가 의미가 있다): 한국이 아닌 곳은 기기 시각이 다르다.
      if (zone !== 'Asia/Tokyo') expect(at.getHours()).not.toBe(0);

      expect(formatKoreanPickupTime(at)).toBe('토요일 오전 12시 30분');
    });
  });
});

describe('formatMerchantResponse', () => {
  const at = new Date('2026-11-14T10:00:00+09:00');

  it('"가게: 요일 오전/오후 N시, 장소에서 방문 판매해요" 로 만든다', () => {
    expect(
      formatMerchantResponse({
        merchantName: '싱싱과일',
        pickupAt: at,
        pickupPlace: '구성동 주민센터 앞',
      }),
    ).toBe('싱싱과일: 토요일 오전 10시, 구성동 주민센터 앞에서 방문 판매해요');
  });

  it('분이 있으면 분까지 보여준다', () => {
    expect(
      formatMerchantResponse({
        merchantName: '가게A',
        pickupAt: new Date('2026-11-14T14:30:00+09:00'),
        pickupPlace: '가게 앞',
      }),
    ).toBe('가게A: 토요일 오후 2시 30분, 가게 앞에서 방문 판매해요');
  });

  it('수령 시각이 없거나 해석되지 않으면 시간 부분을 뺀다', () => {
    const expected = '가게A: 구성동 주민센터 앞에서 방문 판매해요';
    expect(
      formatMerchantResponse({ merchantName: '가게A', pickupPlace: '구성동 주민센터 앞' }),
    ).toBe(expected);
    expect(
      formatMerchantResponse({
        merchantName: '가게A',
        pickupAt: new Date('invalid'),
        pickupPlace: '구성동 주민센터 앞',
      }),
    ).toBe(expected);
  });

  it('장소가 없으면 장소 부분만 뺀다', () => {
    expect(formatMerchantResponse({ merchantName: '가게A', pickupAt: at })).toBe(
      '가게A: 토요일 오전 10시 방문 판매해요',
    );
  });

  it('둘 다 없으면 가게 이름과 방문 판매 문구만 남는다(없는 값을 지어내지 않는다)', () => {
    expect(formatMerchantResponse({ merchantName: '가게A' })).toBe('가게A: 방문 판매해요');
  });
});
