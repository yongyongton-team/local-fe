import { describe, expect, it } from 'vitest';
import type { LocationRank } from '@/types/domain';
import { NO_PEAK_TIME_VALUE } from '@/features/founder-report/constants';
import { buildReportStats } from '@/features/founder-report/reportView';
import { mockReportDescriptionGenerator } from '@/services/mockReportDescriptionGenerator';
import type { AreaReport } from '@/types/domain';
import { buildRankMarkers, describeLocationRow } from './locationRows';

const rank = (over: Partial<LocationRank> = {}): LocationRank => ({
  rank: 1,
  neighborhood: { id: '22', district: '', name: '구성동' },
  requestCount: 29,
  nearbySameCategoryCount: 0,
  ...over,
});

describe('buildRankMarkers: 좌표 없는 순위', () => {
  it('위치 정보(position·lat·lng)가 없는 항목은 마커를 만들지 않고, 목록 문구는 정상이다', () => {
    const items = [
      rank(),
      rank({ rank: 2, neighborhood: { id: '28', district: '', name: '보정동' } }),
    ];

    expect(buildRankMarkers(items, '7')).toEqual([]);
    expect(describeLocationRow(items[0]!).title).toBe('1. 구성동');
  });

  it('좌표가 있는 항목만 마커가 되고 좌표는 그대로다(position 이 없어도 마커는 만들어진다)', () => {
    const items = [
      rank({ lat: 37.3, lng: 127.1 }),
      rank({ rank: 2, neighborhood: { id: '28', district: '', name: '보정동' } }),
    ];

    const markers = buildRankMarkers(items, '7');

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      id: 'founder-22-7',
      lat: 37.3,
      lng: 127.1,
      label: '1. 구성동',
    });
  });

  it('position 만 있는(목) 항목은 기존처럼 자리표시자 마커가 된다', () => {
    const [marker] = buildRankMarkers([rank({ position: { x: 0.4, y: 0.2 } })], '7');

    expect(marker?.position).toEqual({ x: 0.4, y: 0.2 });
    expect(marker).not.toHaveProperty('lat');
  });
});

describe('많이 원하는 시간대가 없는 리포트', () => {
  const report: AreaReport = {
    neighborhood: { id: '16', district: '기흥구', name: '영덕2동' },
    category: {
      id: '18',
      name: '반찬가게',
      cardTitle: '반찬가게',
      requestLabel: '반찬',
      missingLabel: '반찬',
      objectPhrase: '반찬 가게를',
      titleLabel: '반찬 가게',
    },
    demand: { neighborhoodId: '16', categoryId: '18', requestCount: 0, nearbySameCategoryCount: 0 },
  };

  it('수치 카드는 "정보 없음"을 보여준다', () => {
    const stats = buildReportStats(report);

    expect(stats.find((s) => s.label === '많이 원하는 시간')?.value).toBe(NO_PEAK_TIME_VALUE);
  });

  it('목 설명 생성기는 시간대 문장을 뺀다', async () => {
    const text = await mockReportDescriptionGenerator.generate(report);

    expect(text).toContain('주민 0명이');
    expect(text).not.toContain('몰려 있어요');
  });
});
