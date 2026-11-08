import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { merchantService, requestSubmitter } from '@/services';
import type { AreaDemand } from '@/types/domain';
import { renderApp } from '@/test/renderApp';

/** 첫 화면 없이 /merchant 로 직접 들어가고 동네 행이 보일 때까지 기다린다. */
async function openMerchant() {
  renderApp(['/merchant']);
  await screen.findByRole('link', { name: /^구성동/ });
}

const mapRegion = () => screen.getByRole('region', { name: '수요 지도(예시)' });
const areaRows = () =>
  within(
    screen.getByRole('heading', { level: 1, name: '내 업종을 원하는 동네' }).closest('section')!,
  ).queryAllByRole('listitem');
const chip = (name: string) => screen.getByRole('radio', { name });
const live = () => document.querySelector('[aria-live="polite"]') as HTMLElement;

afterEach(() => vi.restoreAllMocks());

describe('렌더링', () => {
  it('로고, 가게 정보, 반경 칩 3개(기본 3km 안), 섹션 제목과 부제를 보여준다', async () => {
    await openMerchant();

    expect(screen.getByRole('img', { name: '생기면 갈게요' })).toBeInTheDocument();
    // 가게 정보는 h1 이 아닌 보조 텍스트다.
    expect(screen.getByText('싱싱과일 · 과일·채소')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: '내 업종을 원하는 동네' }),
    ).toBeInTheDocument();
    expect(screen.getByText('요청 많은 순 · 3km 안')).toBeInTheDocument();

    const group = within(screen.getByRole('radiogroup', { name: '탐색 반경' }));
    expect(group.getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual([
      '3km',
      '5km',
      'all',
    ]);
    expect(chip('3km 안')).toBeChecked();
    expect(chip('5km 안')).not.toBeChecked();
    expect(chip('기흥구 전체')).not.toBeChecked();
  });

  it('동네 행 3개를 구성동 → 보정동 → 마북동 순으로 보여준다', async () => {
    await openMerchant();

    const rows = areaRows();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('구성동 · 요청 29명');
    expect(rows[0]).toHaveTextContent('0.3km · 평일 저녁이 많아요 · 근처 같은 업종 0곳');
    expect(rows[1]).toHaveTextContent('보정동 · 요청 14명');
    expect(rows[1]).toHaveTextContent('2.4km · 주말이 많아요 · 근처 같은 업종 1곳');
    expect(rows[2]).toHaveTextContent('마북동 · 요청 9명');
    expect(rows[2]).toHaveTextContent('1.8km · 평일 낮이 많아요 · 근처 같은 업종 0곳');
  });

  it('동네 행 링크는 /merchant/areas/:areaId 를 가리키고 이름이 한 문장으로 읽힌다', async () => {
    await openMerchant();

    const link = screen.getByRole('link', {
      name: '구성동, 요청 29명, 0.3km, 평일 저녁이 많아요, 근처 같은 업종 0곳',
    });
    expect(link).toHaveAttribute('href', '/merchant/areas/guseong');
    expect(screen.getByRole('link', { name: /^보정동/ })).toHaveAttribute(
      'href',
      '/merchant/areas/bojeong',
    );
    expect(screen.getByRole('link', { name: /^마북동/ })).toHaveAttribute(
      'href',
      '/merchant/areas/mabuk',
    );
    // 행 안에는 다른 링크나 버튼이 없다(장식 화살표는 이름에 포함되지 않는다).
    areaRows().forEach((row) => {
      expect(within(row).getAllByRole('link')).toHaveLength(1);
      expect(within(row).queryAllByRole('button')).toHaveLength(0);
    });
  });

  it('하단 내비게이션과 동네 선택 버튼이 없다', async () => {
    await openMerchant();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /동네 변경/ })).not.toBeInTheDocument();
  });

  it('검색과 이웃 보기 버튼은 접근 가능한 이름을 가진다(동작은 아직 없다)', async () => {
    await openMerchant();

    expect(screen.getByRole('button', { name: '검색' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이웃 보기' })).toBeInTheDocument();
  });

  it('역할·동네를 선택하지 않고 직접 들어와도 선택 안내 없이 렌더링한다', async () => {
    await openMerchant();

    expect(screen.queryByText('내 동네를 먼저 선택해 주세요')).not.toBeInTheDocument();
    expect(areaRows()).toHaveLength(3);
  });
});

describe('지도 영역', () => {
  it('요청 마커 3개와 중심 핀(보이지 않는 텍스트), 임시 표시를 보여준다', async () => {
    await openMerchant();
    await waitFor(() => expect(within(mapRegion()).queryAllByRole('listitem')).toHaveLength(3));

    const map = within(mapRegion());
    expect(map.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '과일 요청 29',
      '반찬 요청 12',
      '빵 요청 6',
    ]);
    expect(map.getByText('내 가게 위치')).toBeInTheDocument();
    expect(map.getByText(/지도 연동 예정 · 예시 데이터/)).toBeInTheDocument();
  });

  it('점선 원은 장식으로 숨겨져 있고 반경(km)을 data 로 가진다', async () => {
    await openMerchant();
    await waitFor(() => expect(mapRegion().querySelector('[data-radius-km]')).not.toBeNull());

    const ring = mapRegion().querySelector('[data-radius-km]');
    expect(ring).toHaveAttribute('aria-hidden', 'true');
    expect(ring).toHaveAttribute('data-radius-km', '3');
  });

  it('반경 칩을 바꾸면 반경 값만 바뀌고 마커는 그대로다(지도는 고정)', async () => {
    const user = userEvent.setup();
    await openMerchant();
    await waitFor(() => expect(within(mapRegion()).queryAllByRole('listitem')).toHaveLength(3));
    const markersBefore = within(mapRegion())
      .getAllByRole('listitem')
      .map((li) => li.textContent);

    await user.click(chip('5km 안'));
    expect(mapRegion().querySelector('[data-radius-km]')).toHaveAttribute('data-radius-km', '5');
    await user.click(chip('기흥구 전체'));
    expect(mapRegion().querySelector('[data-radius-km]')).toHaveAttribute('data-radius-km', 'none');

    expect(
      within(mapRegion())
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(markersBefore);
  });
});

describe('반경 칩', () => {
  it('바꾸면 선택 상태와 부제가 바뀐다', async () => {
    const user = userEvent.setup();
    await openMerchant();

    await user.click(chip('5km 안'));
    expect(chip('5km 안')).toBeChecked();
    expect(chip('3km 안')).not.toBeChecked();
    expect(screen.getByText('요청 많은 순 · 5km 안')).toBeInTheDocument();

    await user.click(chip('기흥구 전체'));
    expect(screen.getByText('요청 많은 순 · 기흥구 전체')).toBeInTheDocument();
  });

  it('세 동네가 모두 3km 이내라 반경을 바꿔도 목록은 같다(필터 결과와 일치)', async () => {
    const user = userEvent.setup();
    await openMerchant();
    const texts = () => areaRows().map((row) => row.textContent);
    const before = texts();

    await user.click(chip('5km 안'));
    await waitFor(() => expect(live()).toHaveTextContent('5km 안 동네 3곳 표시 중'));
    expect(texts()).toEqual(before);

    await user.click(chip('기흥구 전체'));
    await waitFor(() => expect(live()).toHaveTextContent('기흥구 전체 동네 3곳 표시 중'));
    expect(texts()).toEqual(before);
  });

  it('서비스에 선택한 반경(km)을 넘기고, 제한 없는 "기흥구 전체"는 null 로 넘긴다', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(merchantService, 'listAreaDemands');
    await openMerchant();

    await user.click(chip('5km 안'));
    await user.click(chip('기흥구 전체'));

    const radii = spy.mock.calls.map(([query]) => query.radiusKm);
    expect(radii).toEqual(expect.arrayContaining([3, 5, null]));
    spy.mock.calls.forEach(([query]) => expect(query.categoryId).toBe('fruit-vegetable'));
  });

  it('반경이 바뀔 때 요약을 aria-live 로 알린다', async () => {
    await openMerchant();

    await waitFor(() => expect(live()).toHaveTextContent('3km 안 동네 3곳 표시 중'));
    expect(live()).toHaveAttribute('aria-live', 'polite');
  });

  it('필터 결과가 다르면 목록이 필터 결과에 맞게 바뀐다(멀리 있는 동네가 빠짐)', async () => {
    const user = userEvent.setup();
    const area = (name: string, id: string, count: number, km: number): AreaDemand => ({
      neighborhood: { id, district: '기흥구', name },
      requestCount: count,
      distanceKm: km,
      peakVisitTime: 'weekend',
      nearbySameCategoryCount: 0,
    });
    const near = area('가까운동', 'near', 5, 2);
    const far = area('먼동', 'far', 50, 4.5);
    vi.spyOn(merchantService, 'listAreaDemands').mockImplementation(async ({ radiusKm }) =>
      [far, near].filter((a) => radiusKm === null || a.distanceKm <= radiusKm),
    );
    renderApp(['/merchant']);
    await screen.findByRole('link', { name: /^가까운동/ });

    expect(screen.queryByRole('link', { name: /^먼동/ })).not.toBeInTheDocument();

    await user.click(chip('5km 안'));
    expect(await screen.findByRole('link', { name: /^먼동/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^가까운동/ })).toBeInTheDocument();
  });
});

describe('빈 상태와 로딩', () => {
  it('반경에 해당하는 동네가 없으면 빈 상태를 보여준다', async () => {
    vi.spyOn(merchantService, 'listAreaDemands').mockResolvedValue([]);
    renderApp(['/merchant']);

    expect(await screen.findByText('3km 안에는 아직 요청이 없어요')).toBeInTheDocument();
    expect(areaRows()).toHaveLength(0);
  });

  it('불러오는 동안에는 로딩 문구를 보여준다', () => {
    vi.spyOn(merchantService, 'getProfile').mockReturnValue(new Promise(() => {}));
    renderApp(['/merchant']);

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중이에요.');
  });
});

describe('주민 요청과의 연동', () => {
  it('주민이 과일/채소 요청을 보내면 구성동 인원이 30명으로 이 화면에 반영된다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: 'fruit-vegetable',
      detail: '과일가게요',
      conditions: [],
      visitTimes: [],
    });
    renderApp(['/merchant']);

    expect(await screen.findByText('구성동 · 요청 30명')).toBeInTheDocument();
    await waitFor(() => expect(within(mapRegion()).getByText('과일 요청 30')).toBeInTheDocument());
  });
});
