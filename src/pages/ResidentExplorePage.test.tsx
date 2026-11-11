import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';

/** 첫 화면에서 주민 역할과 동네를 고르고 시작해 /resident 로 들어간다. (목 서비스만 사용) */
async function openResident(neighborhoodId = 'guseong') {
  const user = userEvent.setup();
  renderApp();
  await screen.findByRole('option', { name: '기흥구 구성동' });
  await user.selectOptions(screen.getByLabelText('내 동네'), neighborhoodId);
  await user.click(screen.getByRole('radio', { name: /^주민/ }));
  await user.click(screen.getByRole('button', { name: '시작하기' }));
  await screen.findByRole('region', { name: '동네 지도(예시)' });
  // 마커 데이터가 도착할 때까지 기다린다.
  await waitFor(() => expect(markerItems().length).toBeGreaterThan(0));
  return user;
}

const mapRegion = () => screen.getByRole('region', { name: '동네 지도(예시)' });
const markerItems = () => within(mapRegion()).queryAllByRole('listitem');
const markerTexts = () => markerItems().map((item) => item.textContent ?? '');

const cardList = () =>
  within(
    screen.getByRole('heading', { level: 2, name: '우리 동네에 없는 가게' }).closest('section')!,
  );
const cardItems = () => cardList().queryAllByRole('listitem');

const filterChip = (name: string) => screen.getByRole('radio', { name });

describe('주민 탐색 화면 렌더링', () => {
  it('동네 이름, 칩 4개, 섹션 제목, 카드 목록을 보여준다', async () => {
    await openResident();

    expect(screen.getByRole('heading', { level: 1, name: '동네 탐색' })).toBeInTheDocument();
    const neighborhood = screen.getByRole('link', { name: /기흥구 구성동/ });
    // 동네 변경 동작이 정해지지 않아 임시로 첫 화면으로 이동한다.
    expect(neighborhood).toHaveAttribute('href', '/');

    const chips = within(screen.getByRole('radiogroup', { name: '지도 필터' })).getAllByRole(
      'radio',
    );
    expect(chips.map((chip) => chip.getAttribute('value'))).toEqual([
      'all',
      'missing',
      'request',
      'existing',
    ]);
    expect(filterChip('전체')).toBeChecked();

    expect(
      screen.getByText('걸어서 15분 안에 같은 업종 가게가 없어요 · 요청 많은 순'),
    ).toBeInTheDocument();
    await waitFor(() => expect(cardItems()).toHaveLength(3));
    expect(screen.getByText(/지도 연동 예정 · 예시 데이터/)).toBeInTheDocument();
  });

  it('검색 버튼은 접근 가능한 이름을 가지고, 우측 상단에 사람들(이웃 보기) 아이콘은 없다', async () => {
    await openResident();

    expect(screen.getByRole('button', { name: '검색' })).toBeInTheDocument();
    // 사람들 아이콘은 내 정보 아이콘과 같은 그림이라 주민 화면에서 뺐다(주민의 진입점은 하단 내비).
    expect(screen.queryByRole('button', { name: '이웃 보기' })).not.toBeInTheDocument();
    expect(document.querySelector('path[d^="M6.45117 10.415"]')).toBeNull(); // 이전 사람들+소리 물결 SVG
  });

  it('+가게 요청하기 는 /resident/requests/new 로 연결된다', async () => {
    await openResident();

    expect(screen.getByRole('link', { name: '+가게 요청하기' })).toHaveAttribute(
      'href',
      '/resident/requests/new',
    );
  });
});

describe('칩별 지도 마커', () => {
  it('전체: 요청 3 + 없는 가게 3 + 핀 3 = 9개', async () => {
    await openResident();

    expect(markerItems()).toHaveLength(9);
    const texts = markerTexts();
    // 문구와 수치는 데이터에서 파생된다(반찬은 카드 기준 12명).
    expect(texts).toEqual(
      expect.arrayContaining([
        '과일 요청 29',
        '반찬 요청 12',
        '빵 요청 6',
        'X : 과일 / 채소',
        'X : 반찬',
        'X : 빵집',
      ]),
    );
    expect(texts.filter((text) => text === '있는 가게 위치')).toHaveLength(3);
  });

  it('없는 가게: "X :" 마커 3개만', async () => {
    const user = await openResident();

    await user.click(filterChip('없는 가게'));

    expect(markerItems()).toHaveLength(3);
    markerTexts().forEach((text) => expect(text).toMatch(/^X : /));
  });

  it('주민 요청: 요청 마커 3개만', async () => {
    const user = await openResident();

    await user.click(filterChip('주민 요청'));

    expect(markerItems()).toHaveLength(3);
    markerTexts().forEach((text) => expect(text).toMatch(/ 요청 \d+$/));
  });

  it('있는 가게: 핀 3개만 (보이지 않는 텍스트로 읽힌다)', async () => {
    const user = await openResident();

    await user.click(filterChip('있는 가게'));

    expect(markerItems()).toHaveLength(3);
    expect(within(mapRegion()).getAllByText('있는 가게 위치')).toHaveLength(3);
  });

  it('칩을 바꾸면 선택 상태가 바뀌고 aria-live 요약이 갱신된다', async () => {
    const user = await openResident();
    expect(screen.getByText('현재 전체 9곳 표시 중')).toBeInTheDocument();

    await user.click(filterChip('있는 가게'));

    expect(filterChip('있는 가게')).toBeChecked();
    expect(filterChip('전체')).not.toBeChecked();
    const summary = screen.getByText('현재 있는 가게 3곳 표시 중');
    expect(summary).toHaveAttribute('aria-live', 'polite');
  });

  it('칩을 바꿔도 카드 목록은 그대로다', async () => {
    const user = await openResident();
    await waitFor(() => expect(cardItems()).toHaveLength(3));
    const before = cardItems().map((item) => item.textContent);

    for (const name of ['없는 가게', '주민 요청', '있는 가게', '전체']) {
      await user.click(filterChip(name));
      expect(cardItems().map((item) => item.textContent)).toEqual(before);
    }
  });
});

describe('요청 카드', () => {
  it('요청 수 내림차순으로 표시되고 대형마트 거리는 값이 있는 카드에만 나온다', async () => {
    await openResident();
    await waitFor(() => expect(cardItems()).toHaveLength(3));
    const [fruit, sideDish, bakery] = cardItems();

    expect(fruit).toHaveTextContent(/^과일 \/ 채소 가게주민 29명이 요청 \/ 대형마트 2\.4km/);
    expect(sideDish).toHaveTextContent(/^반찬가게주민 12명이 요청/);
    expect(bakery).toHaveTextContent(/^빵집주민 6명이 요청/);
    expect(sideDish).not.toHaveTextContent('대형마트');
    expect(bakery).not.toHaveTextContent('대형마트');
  });

  it('"내가 요청함" 상태를 보이지 않는 텍스트로 전달한다(반찬만)', async () => {
    await openResident();
    await waitFor(() => expect(cardItems()).toHaveLength(3));
    const [fruit, sideDish, bakery] = cardItems();

    expect(sideDish).toHaveTextContent('내가 요청함');
    expect(fruit).toHaveTextContent('내가 요청하지 않음');
    expect(bakery).toHaveTextContent('내가 요청하지 않음');
  });

  it('카드 안에는 링크나 버튼이 없다(정보만 보여준다)', async () => {
    await openResident();
    await waitFor(() => expect(cardItems()).toHaveLength(3));

    cardItems().forEach((item) => expect(within(item).queryAllByRole('link')).toHaveLength(0));
    cardItems().forEach((item) => expect(within(item).queryAllByRole('button')).toHaveLength(0));
  });
});

describe('하단 내비게이션(임시 매핑)', () => {
  it('아이콘 4개가 이름을 가지고, 현재 항목만 aria-current="page" 이다', async () => {
    await openResident();
    const nav = within(screen.getByRole('navigation', { name: '주민 메뉴' }));

    expect(nav.getAllByRole('link').map((link) => link.textContent)).toEqual([
      '탐색',
      '가게 요청',
      '내 요청',
      '내 정보',
    ]);
    expect(nav.getByRole('link', { name: '탐색' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: '가게 요청' })).not.toHaveAttribute('aria-current');
    expect(nav.getByRole('link', { name: '가게 요청' })).toHaveAttribute(
      'href',
      '/resident/requests/new',
    );
    expect(nav.getByRole('link', { name: '내 요청' })).toHaveAttribute(
      'href',
      '/resident/requests',
    );
    expect(nav.getByRole('link', { name: '내 정보' })).toHaveAttribute('href', '/me');
    expect(nav.getByRole('link', { name: '내 정보' })).not.toHaveAttribute('aria-current');
  });
});

describe('동네별 데이터', () => {
  it('보정동: 주변 같은 업종이 1곳이라 카드는 비고 요청 마커와 핀만 보인다', async () => {
    await openResident('bojeong');

    expect(screen.getByRole('link', { name: /기흥구 보정동/ })).toBeInTheDocument();
    await screen.findByText('조건에 맞는 가게가 아직 없어요');
    expect(cardItems()).toHaveLength(0);
    expect(markerTexts()).toEqual(['과일 요청 14', '있는 가게 위치']);
  });

  it('마북동: 과일/채소 카드 1개와 요청·없는 가게 마커가 보인다', async () => {
    await openResident('mabuk');

    await waitFor(() => expect(cardItems()).toHaveLength(1));
    expect(cardItems()[0]).toHaveTextContent(
      /^과일 \/ 채소 가게주민 9명이 요청 \/ 대형마트 3\.1km/,
    );
    expect(markerTexts()).toEqual(['과일 요청 9', 'X : 과일 / 채소']);
  });
});
