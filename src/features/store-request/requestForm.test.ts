import { describe, expect, it } from 'vitest';
import { canSubmitRequest, describeSummary, getCategoryLabel, isBlank } from './requestForm';

describe('isBlank', () => {
  it('빈 문자열과 공백·줄바꿈뿐인 입력은 비어 있다', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank('   ')).toBe(true);
    expect(isBlank('\n \t')).toBe(true);
    expect(isBlank(' 과일 ')).toBe(false);
  });
});

describe('getCategoryLabel', () => {
  it('업종 id 를 이 화면의 표기로 바꾼다', () => {
    expect(getCategoryLabel('fruit-vegetable')).toBe('과일 / 채소 가게');
    expect(getCategoryLabel('side-dish')).toBe('반찬 가게');
    expect(getCategoryLabel('bakery')).toBe('빵집');
    expect(getCategoryLabel(null)).toBeNull();
    expect(getCategoryLabel('unknown')).toBeNull();
  });
});

describe('canSubmitRequest', () => {
  const ok = { text: '과일가게요', categoryId: 'fruit-vegetable', summaryIsCurrent: true };

  it('문장이 있고 업종이 정해졌고 정리 결과가 최신이면 보낼 수 있다', () => {
    expect(canSubmitRequest(ok)).toBe(true);
  });

  it('공백뿐인 문장은 보낼 수 없다', () => {
    expect(canSubmitRequest({ ...ok, text: '   ' })).toBe(false);
  });

  it('업종이 정해지지 않았으면 보낼 수 없다', () => {
    expect(canSubmitRequest({ ...ok, categoryId: null })).toBe(false);
  });

  it('정리 결과가 최신이 아니면 보낼 수 없다', () => {
    expect(canSubmitRequest({ ...ok, summaryIsCurrent: false })).toBe(false);
  });
});

describe('describeSummary', () => {
  it('업종과 조건을 문장으로 알린다', () => {
    expect(describeSummary('과일 / 채소 가게', ['늦게까지 영업', '낱개 구매'])).toBe(
      '요청 정리 결과: 업종 과일 / 채소 가게, 조건 늦게까지 영업, 낱개 구매',
    );
  });

  it('업종이 없으면 선택을 안내하고, 조건이 없으면 조건을 생략한다', () => {
    expect(describeSummary(null, [])).toBe('요청 정리 결과: 업종을 선택해 주세요');
  });
});
