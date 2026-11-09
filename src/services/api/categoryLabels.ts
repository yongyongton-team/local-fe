import type { StoreCategory } from '@/types/domain';

/** 서버 코드로 정하는 화면 문구(서버는 id·code·name 만 준다). */
type CategoryLabels = Pick<
  StoreCategory,
  'cardTitle' | 'requestLabel' | 'missingLabel' | 'objectPhrase' | 'titleLabel'
>;

/**
 * 서버 업종 code → 화면 문구 표. 실제 서버의 GET /categories(38개)에서 코드와 이름을 확인해
 * 목 업종과 이름이 명확히 대응되는 세 개만 채웠다. 값은 목 업종(mocks/demand.ts)의 문구와 같다.
 *   과일·채소 ↔ FRUIT_VEG("과일·채소 가게"), 반찬 ↔ SIDE_DISH("반찬가게"), 빵집 ↔ BAKERY("빵집")
 * 나머지 35개 업종은 추측으로 채우지 않고 서버 name 으로 대체한다(labelsFor).
 * 서버가 표시용 문구를 주게 되면 이 표를 없앤다.
 */
export const CATEGORY_LABELS_BY_CODE: Readonly<Record<string, CategoryLabels>> = {
  FRUIT_VEG: {
    cardTitle: '과일 / 채소 가게',
    requestLabel: '과일',
    missingLabel: '과일 / 채소',
    objectPhrase: '과일·채소 가게를',
    titleLabel: '과일 가게',
  },
  SIDE_DISH: {
    cardTitle: '반찬가게',
    requestLabel: '반찬',
    missingLabel: '반찬',
    objectPhrase: '반찬 가게를',
    titleLabel: '반찬 가게',
  },
  BAKERY: {
    cardTitle: '빵집',
    requestLabel: '빵',
    missingLabel: '빵집',
    objectPhrase: '빵집을',
    titleLabel: '빵집',
  },
};

/**
 * 업종의 화면 문구. 표에 없는 code 는 서버 name 으로 대체한다.
 * 조사(을/를)를 코드로 계산하지 않으므로 objectPhrase 가 어색할 수 있다(예: "꽃집 원해요"). 화면이 깨지지는 않는다.
 */
export function labelsFor(code: string, name: string): CategoryLabels {
  return (
    CATEGORY_LABELS_BY_CODE[code] ?? {
      cardTitle: name,
      requestLabel: name,
      missingLabel: name,
      objectPhrase: name,
      titleLabel: name,
    }
  );
}
