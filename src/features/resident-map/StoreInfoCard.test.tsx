import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mapMapMarkers } from '@/services/api/mappers';
import { describeStore, StoreInfoCard } from './StoreInfoCard';

describe('describeStore (카드에 보여줄 글자)', () => {
  it('이름과 업종이 모두 있으면 "이름 · 업종"', () => {
    expect(describeStore('구성 청과', '과일·채소 가게')).toBe('구성 청과 · 과일·채소 가게');
  });

  it('이름이 비었거나 공백뿐이면 업종만, 업종이 없으면 이름만 보인다(구분점이 남지 않는다)', () => {
    expect(describeStore('', '과일·채소 가게')).toBe('과일·채소 가게');
    expect(describeStore('   ', '과일·채소 가게')).toBe('과일·채소 가게');
    expect(describeStore(undefined, '과일·채소 가게')).toBe('과일·채소 가게');
    expect(describeStore('구성 청과', undefined)).toBe('구성 청과');
    expect(describeStore('구성 청과', '')).toBe('구성 청과');
  });

  it('앞뒤 공백은 뺀다', () => {
    expect(describeStore('  구성 청과 ', ' 과일 ')).toBe('구성 청과 · 과일');
  });

  it('둘 다 없으면 기본 문구이고 "있는 가게 위치" 같은 패널 제목이 아니다', () => {
    expect(describeStore()).toBe('가게 정보를 불러오지 못했어요');
    expect(describeStore('', '  ')).toBe('가게 정보를 불러오지 못했어요');
    expect(describeStore()).not.toContain('있는 가게 위치');
  });
});

describe('StoreInfoCard', () => {
  it('글자는 role="status" 로 알리고 닫기 버튼이 있다', async () => {
    const onClose = vi.fn();
    render(<StoreInfoCard name="구성 청과" categoryName="과일" onClose={onClose} />);

    expect(screen.getByRole('status')).toHaveTextContent('구성 청과 · 과일');
    await userEvent.setup().click(screen.getByRole('button', { name: '가게 정보 닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('가게 마커의 이름(storeName)', () => {
  const dto = (stores: unknown[]) =>
    mapMapMarkers({ stores } as never, []).filter((m) => m.kind === 'existing');

  it('서버의 가게 이름을 storeName 으로 담고, 이름이 비었으면 빈 문자열이다', () => {
    const markers = dto([
      { id: 1, name: '구성 청과', categoryId: 7, lat: 37.3, lon: 127.1 },
      { id: 2, categoryId: 7, lat: 37.31, lon: 127.11 },
    ]);

    expect(markers.map((m) => m.storeName)).toEqual(['구성 청과', '']);
    // label 은 지도 마커의 보조 기술용 문구이고 가게 정보 카드는 storeName 만 쓴다.
    expect(markers[0]).toMatchObject({ label: '구성 청과', categoryId: '7' });
  });
});
