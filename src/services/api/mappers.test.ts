import { describe, expect, it } from 'vitest';
import { isApiError } from './apiError';
import { mapHealth, mapMe, mapRole, mapShop } from './mappers';

const parseFailure = (action: () => unknown) => {
  try {
    action();
  } catch (error) {
    expect(isApiError(error)).toBe(true);
    expect((error as { kind: string }).kind).toBe('parse');
    return;
  }
  throw new Error('parse 오류여야 해요');
};

describe('mapRole', () => {
  it('서버 역할을 화면 역할로 바꾸고, 모르는 값이나 없으면 null 이다', () => {
    expect(mapRole('RESIDENT')).toBe('resident');
    expect(mapRole('OWNER')).toBe('merchant');
    expect(mapRole('FOUNDER')).toBe('founder');
    expect(mapRole('ADMIN')).toBeNull();
    expect(mapRole(undefined)).toBeNull();
    expect(mapRole(null)).toBeNull();
  });
});

describe('mapMe', () => {
  it('전체 필드가 있으면 도메인 값으로 바꾼다', () => {
    expect(
      mapMe({
        id: 5,
        nickname: '게스트1',
        role: 'OWNER',
        dong: { id: 12, name: '구성동', gu: '기흥구' },
        shop: {
          shopName: '싱싱과일',
          category: { id: 3, name: '과일' },
          dong: { id: 12, name: '구성동' },
          lat: 37.29,
          lon: 127.1,
        },
      }),
    ).toEqual({
      id: 5,
      nickname: '게스트1',
      role: 'merchant',
      dong: { id: 12, name: '구성동', district: '기흥구' },
      shop: {
        shopName: '싱싱과일',
        categoryId: 3,
        categoryName: '과일',
        dongId: 12,
        dongName: '구성동',
        lat: 37.29,
        lng: 127.1,
      },
    });
  });

  it('role·dong·shop 이 없거나 null 이면 null 로, nickname 은 빈 문자열로 처리한다', () => {
    expect(mapMe({ id: 1 })).toEqual({ id: 1, nickname: '', role: null, dong: null, shop: null });
    expect(mapMe({ id: 1, nickname: null, role: null, dong: null, shop: null })).toEqual({
      id: 1,
      nickname: '',
      role: null,
      dong: null,
      shop: null,
    });
  });

  it('동네에 id 가 없으면 dong 은 null 이다(이름만으로 동네를 식별하지 않는다)', () => {
    expect(mapMe({ id: 1, dong: { name: '구성동', gu: '기흥구' } }).dong).toBeNull();
  });

  it('동네의 이름·구가 없으면 빈 문자열로 처리한다', () => {
    expect(mapMe({ id: 1, dong: { id: 4 } }).dong).toEqual({ id: 4, name: '', district: '' });
  });

  it.each([undefined, null, 'x', 3, []])('응답이 %j 이면 parse 오류다', (value) => {
    parseFailure(() => mapMe(value as never));
  });

  it.each([{}, { id: null }, { id: 'abc' }, { id: Number.NaN }])(
    '사용자 id 가 없거나 숫자가 아니면(%j) parse 오류다',
    (dto) => {
      parseFailure(() => mapMe(dto as never));
    },
  );
});

describe('mapShop', () => {
  it('가게가 없으면(null·undefined·빈 객체·이름 없음) null 이다', () => {
    expect(mapShop(undefined)).toBeNull();
    expect(mapShop(null)).toBeNull();
    expect(mapShop({})).toBeNull();
    expect(mapShop({ shopName: '' })).toBeNull();
  });

  it('좌표·id 가 없으면 그 필드만 비우고 나머지는 보존한다', () => {
    expect(mapShop({ shopName: '가게', category: { name: '빵' } })).toEqual({
      shopName: '가게',
      categoryName: '빵',
      dongName: '',
    });
  });

  it('좌표가 숫자가 아니면 버린다', () => {
    const shop = mapShop({ shopName: '가게', lat: 'x' as never, lon: Number.NaN });

    expect(shop).not.toHaveProperty('lat');
    expect(shop).not.toHaveProperty('lng');
  });
});

describe('mapHealth', () => {
  it('문자열 값만 남긴다', () => {
    expect(mapHealth({ status: 'UP', version: 3, nested: { a: 1 }, none: null })).toEqual({
      details: { status: 'UP' },
    });
  });

  it('객체가 아니거나 비어 있어도 빈 details 다', () => {
    expect(mapHealth(undefined)).toEqual({ details: {} });
    expect(mapHealth([] as never)).toEqual({ details: {} });
    expect(mapHealth({})).toEqual({ details: {} });
  });
});
