import { describe, expect, it } from 'vitest';
import type { MapMarker, NeighborhoodReport } from '@/types/domain';
import { applyOverridesToMarkers, applyOverridesToReports } from './quickRequestOverrides';

const report = (categoryId: string, count: number, requestedByMe = false): NeighborhoodReport => ({
  neighborhood: { id: '1', district: '기흥구', name: '구성동' },
  category: {
    id: categoryId,
    name: categoryId,
    cardTitle: categoryId,
    requestLabel: categoryId,
    missingLabel: categoryId,
    objectPhrase: categoryId,
    titleLabel: categoryId,
  },
  demand: {
    neighborhoodId: '1',
    categoryId,
    requestCount: count,
    nearbySameCategoryCount: 0,
    requestedByMe,
  },
});
const marker = (
  id: string,
  kind: MapMarker['kind'],
  label: string,
  categoryId?: string,
): MapMarker => ({
  id,
  kind,
  label,
  position: { x: 0.5, y: 0.5 },
  ...(categoryId && { categoryId }),
});

describe('applyOverridesToReports', () => {
  it('반영할 것이 없으면 같은 배열을 돌려준다', () => {
    const reports = [report('a', 4)];
    expect(applyOverridesToReports(reports, {})).toBe(reports);
  });

  it('보낸 업종의 인원을 더하고 내가 요청함으로 바꾸며 다른 업종은 그대로 둔다', () => {
    const [a, b] = applyOverridesToReports([report('a', 29), report('b', 7)], { a: { extra: 1 } });

    expect(a!.demand).toMatchObject({ requestCount: 30, requestedByMe: true });
    expect(b!.demand).toMatchObject({ requestCount: 7, requestedByMe: false });
  });

  it('이미 요청해 둔 것(extra 0)은 인원은 그대로이고 내가 요청함만 된다', () => {
    const [a] = applyOverridesToReports([report('a', 12)], { a: { extra: 0 } });

    expect(a!.demand).toMatchObject({ requestCount: 12, requestedByMe: true });
  });

  it('원본 카드 데이터를 바꾸지 않는다', () => {
    const original = report('a', 5);
    applyOverridesToReports([original], { a: { extra: 1 } });

    expect(original.demand.requestCount).toBe(5);
  });
});

describe('applyOverridesToMarkers', () => {
  it('보낸 업종의 "요청 N" 알약 숫자만 더한다', () => {
    const markers = [
      marker('r1', 'request', '과일 요청 29', 'a'),
      marker('r2', 'request', '반찬 요청 12', 'b'),
      marker('m1', 'missing', 'X : 과일 / 채소', 'a'),
      marker('s1', 'existing', '구성 청과 2', 'a'),
    ];

    const result = applyOverridesToMarkers(markers, { a: { extra: 1 } });

    expect(result.map((m) => m.label)).toEqual([
      '과일 요청 30',
      '반찬 요청 12',
      'X : 과일 / 채소',
      '구성 청과 2', // 가게 핀은 요청 알약이 아니라 그대로다
    ]);
  });

  it('extra 가 0 이거나 라벨 끝에 숫자가 없으면 그대로 둔다', () => {
    const markers = [
      marker('r1', 'request', '과일 요청 29', 'a'),
      marker('r2', 'request', '요청', 'a'),
    ];

    expect(applyOverridesToMarkers(markers, { a: { extra: 0 } })).toEqual(markers);
    expect(applyOverridesToMarkers(markers, { a: { extra: 1 } })[1]!.label).toBe('요청');
  });
});
