import { describe, expect, it } from 'vitest';
import { isApiError } from './apiError';
import {
  mapCategories,
  mapDongs,
  mapHealth,
  mapMe,
  mapRole,
  mapShop,
  toServerRole,
} from './mappers';

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

describe('toServerRole (화면 역할 → 서버 역할 코드)', () => {
  it('세 역할을 서버 코드로 바꾼다', () => {
    expect(toServerRole('resident')).toBe('RESIDENT');
    expect(toServerRole('merchant')).toBe('OWNER');
    expect(toServerRole('founder')).toBe('FOUNDER');
  });

  it('알 수 없는 값은 null 이다', () => {
    expect(toServerRole('owner')).toBeNull();
    expect(toServerRole('RESIDENT')).toBeNull();
    expect(toServerRole('')).toBeNull();
    expect(toServerRole(undefined)).toBeNull();
    expect(toServerRole(null)).toBeNull();
  });

  it('mapRole 과 왕복하면 같은 값이다(양방향)', () => {
    for (const role of ['resident', 'merchant', 'founder'] as const) {
      expect(mapRole(toServerRole(role))).toBe(role);
    }
    for (const code of ['RESIDENT', 'OWNER', 'FOUNDER'] as const) {
      expect(toServerRole(mapRole(code))).toBe(code);
    }
  });
});

describe('mapDongs', () => {
  it('숫자 id 를 문자열로, gu 를 district 로 바꾸고 서버 순서를 그대로 둔다', () => {
    expect(
      mapDongs([
        { id: 22, name: '구성동', gu: '기흥구' },
        { id: 28, name: '보정동', gu: '기흥구' },
        { id: 4, name: '남사읍', gu: '처인구' },
      ]),
    ).toEqual([
      { id: '22', district: '기흥구', name: '구성동' },
      { id: '28', district: '기흥구', name: '보정동' },
      { id: '4', district: '처인구', name: '남사읍' },
    ]);
  });

  it('빈 목록은 빈 배열이다', () => {
    expect(mapDongs([])).toEqual([]);
  });

  it('구(gu)가 없으면 district 는 빈 문자열이다', () => {
    expect(mapDongs([{ id: 1, name: '포곡읍' }])).toEqual([
      { id: '1', district: '', name: '포곡읍' },
    ]);
    expect(mapDongs([{ id: 1, name: '포곡읍', gu: null }])[0]?.district).toBe('');
  });

  it.each([
    ['숫자가 아닌 id', [{ id: 'abc', name: '동', gu: '구' }]],
    ['문자열 숫자 id', [{ id: '22', name: '동', gu: '구' }]],
    ['id 없음', [{ name: '동', gu: '구' }]],
    ['0 이하 id', [{ id: 0, name: '동', gu: '구' }]],
    ['소수 id', [{ id: 1.5, name: '동', gu: '구' }]],
  ])('%s 가 하나라도 있으면 INVALID_ID parse 오류다', (_name, dtos) => {
    try {
      mapDongs(dtos as never);
    } catch (error) {
      expect(error).toMatchObject({ kind: 'parse', code: 'INVALID_ID' });
      return;
    }
    throw new Error('오류여야 해요');
  });

  it('이름이 없는 항목이나 배열이 아닌 응답은 parse 오류다', () => {
    parseFailure(() => mapDongs([{ id: 1, gu: '기흥구' }]));
    parseFailure(() => mapDongs([{ id: 1, name: '', gu: '기흥구' }]));
    parseFailure(() => mapDongs(undefined));
    parseFailure(() => mapDongs({} as never));
    parseFailure(() => mapDongs([null as never]));
  });
});

describe('mapCategories', () => {
  it('표에 있는 code 는 목 업종과 같은 문구를 채운다(과일·채소, 반찬, 빵집)', () => {
    const [fruit, side, bakery] = mapCategories([
      { id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true },
      { id: 18, code: 'SIDE_DISH', name: '반찬가게', martCheck: true },
      { id: 28, code: 'BAKERY', name: '빵집', martCheck: false },
    ]);

    expect(fruit).toEqual({
      id: '7',
      name: '과일·채소 가게',
      cardTitle: '과일 / 채소 가게',
      requestLabel: '과일',
      missingLabel: '과일 / 채소',
      objectPhrase: '과일·채소 가게를',
      titleLabel: '과일 가게',
      martCheck: true,
    });
    expect(side).toMatchObject({
      id: '18',
      cardTitle: '반찬가게',
      requestLabel: '반찬',
      missingLabel: '반찬',
      objectPhrase: '반찬 가게를',
      titleLabel: '반찬 가게',
    });
    expect(bakery).toMatchObject({
      id: '28',
      cardTitle: '빵집',
      requestLabel: '빵',
      missingLabel: '빵집',
      objectPhrase: '빵집을',
      titleLabel: '빵집',
      martCheck: false,
    });
  });

  it('표에 없는 code 는 서버 name 으로 모든 문구를 대체한다', () => {
    expect(
      mapCategories([{ id: 30, code: 'FLOWER_SHOP', name: '꽃집', martCheck: false }]),
    ).toEqual([
      {
        id: '30',
        name: '꽃집',
        cardTitle: '꽃집',
        requestLabel: '꽃집',
        missingLabel: '꽃집',
        objectPhrase: '꽃집',
        titleLabel: '꽃집',
        martCheck: false,
      },
    ]);
  });

  it('code 가 없어도(알 수 없는 업종) name 으로 대체한다', () => {
    expect(mapCategories([{ id: 31, name: '문구점' }])[0]).toMatchObject({
      id: '31',
      cardTitle: '문구점',
      titleLabel: '문구점',
    });
  });

  it('name 이 없으면 code 로, 둘 다 없으면 parse 오류다', () => {
    expect(mapCategories([{ id: 5, code: 'CHINESE_RESTAURANT' }])[0]?.name).toBe(
      'CHINESE_RESTAURANT',
    );
    parseFailure(() => mapCategories([{ id: 5 }]));
  });

  it('martCheck 가 없거나 true 가 아니면 false 다', () => {
    expect(mapCategories([{ id: 1, name: '슈퍼마켓' }])[0]?.martCheck).toBe(false);
    expect(mapCategories([{ id: 1, name: '슈퍼마켓', martCheck: null }])[0]?.martCheck).toBe(false);
    expect(mapCategories([{ id: 1, name: '슈퍼마켓', martCheck: true }])[0]?.martCheck).toBe(true);
  });

  it('숫자가 아닌 id 는 INVALID_ID parse 오류이고 배열이 아니면 parse 오류다', () => {
    try {
      mapCategories([{ id: 'x' as never, name: '꽃집' }]);
    } catch (error) {
      expect(error).toMatchObject({ kind: 'parse', code: 'INVALID_ID' });
    }
    parseFailure(() => mapCategories(undefined));
    parseFailure(() => mapCategories(null as never));
  });
});
