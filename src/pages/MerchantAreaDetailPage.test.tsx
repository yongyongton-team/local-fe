import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { merchantService, requestSubmitter } from '@/services';
import { renderApp } from '@/test/renderApp';

const heading1 = (name: string) => screen.findByRole('heading', { level: 1, name });
const section = (name: string) => screen.getByRole('region', { name });
const rowTexts = (name: string) =>
  within(section(name))
    .getAllByRole('listitem')
    .map((li) => li.textContent);
/** 요약 카드의 dt 이름 → dd 값 */
const stat = (name: string) => {
  const dt = screen.getByText(name, { selector: 'dt' });
  return dt.nextElementSibling?.textContent;
};
const fills = (name: string) =>
  within(section(name))
    .getAllByRole('listitem')
    .map((li) => Number(li.querySelector('[data-fill]')?.getAttribute('data-fill')));

afterEach(() => vi.restoreAllMocks());

describe.each([
  {
    id: 'guseong',
    title: '구성동 / 과일 가게',
    people: '29명',
    nearby: '0곳',
    conditions: ['늦게까지 영업, 17명', '낱개 구매, 11명', '배달, 7명'],
    times: ['평일 저녁, 60%', '주말, 30%', '평일 낮, 10%'],
    summary: '구성동에는 과일·채소 가게를 원하는 주민이 29명 있어요. 평일 저녁 방문이 좋아 보여요.',
  },
  {
    id: 'bojeong',
    title: '보정동 / 과일 가게',
    people: '14명',
    nearby: '1곳',
    conditions: ['늦게까지 영업, 8명', '낱개 구매, 5명', '배달, 3명'],
    times: ['주말, 60%', '평일 저녁, 30%', '평일 낮, 10%'],
    summary: '보정동에는 과일·채소 가게를 원하는 주민이 14명 있어요. 주말 방문이 좋아 보여요.',
  },
  {
    id: 'mabuk',
    title: '마북동 / 과일 가게',
    people: '9명',
    nearby: '0곳',
    conditions: ['늦게까지 영업, 5명', '낱개 구매, 3명', '배달, 2명'],
    times: ['평일 낮, 60%', '평일 저녁, 30%', '주말, 10%'],
    summary: '마북동에는 과일·채소 가게를 원하는 주민이 9명 있어요. 평일 낮 방문이 좋아 보여요.',
  },
])('$title', ({ id, title, people, nearby, conditions, times, summary }) => {
  it('제목, 요약 카드, 조건 3개, 시간대 3개, 한 줄 요약을 보여준다', async () => {
    renderApp([`/merchant/areas/${id}`]);

    expect(await heading1(title)).toBeInTheDocument();
    expect(stat('요청한 주민')).toBe(people);
    expect(stat('근처 같은 업종')).toBe(nearby);
    expect(rowTexts('주민이 원하는 조건')).toEqual(conditions);
    expect(rowTexts('가기 좋은 시간')).toEqual(times);
    expect(within(section('한 줄 요약')).getByText(summary)).toBeInTheDocument();
  });

  it('막대 길이는 데이터에서 계산한다(조건: 인원 ÷ 요청 인원, 시간대: 비율)', async () => {
    renderApp([`/merchant/areas/${id}`]);
    await heading1(title);

    const requestCount = Number(people.replace('명', ''));
    const expectedConditions = conditions.map(
      (text) => Number(/(\d+)명$/.exec(text)![1]) / requestCount,
    );
    const expectedTimes = times.map((text) => Number(/(\d+)%$/.exec(text)![1]) / 100);
    fills('주민이 원하는 조건').forEach((fill, i) =>
      expect(fill).toBeCloseTo(expectedConditions[i]!),
    );
    expect(fills('가기 좋은 시간')).toEqual(expectedTimes);
    // data 속성뿐 아니라 실제 막대 너비도 같은 값이다.
    const widths = within(section('가기 좋은 시간'))
      .getAllByRole('listitem')
      .map((li) => (li.querySelector('[data-fill]') as HTMLElement).style.width);
    expect(widths).toEqual(expectedTimes.map((t) => `${t * 100}%`));
  });

  it('시간대 행은 비율 내림차순이고 첫 행이 탐색 화면의 "가장 많은 방문 시간대"와 같다', async () => {
    renderApp([`/merchant/areas/${id}`]);
    await heading1(title);

    const ratios = fills('가기 좋은 시간');
    expect(ratios).toEqual([...ratios].sort((a, b) => b - a));
    const top = rowTexts('가기 좋은 시간')[0]!.split(', ')[0]!;

    // 같은 서비스 데이터에서 만든 탐색 행의 문구(PEAK_TIME_PHRASES)와 대조한다.
    const areas = await merchantService.listAreaDemands({
      categoryId: 'fruit-vegetable',
      radiusKm: null,
    });
    const peak = areas.find((a) => a.neighborhood.id === id)!.peakVisitTime!;
    const peakLabel = { 'weekday-day': '평일 낮', 'weekday-evening': '평일 저녁', weekend: '주말' }[
      peak
    ];
    expect(top).toBe(peakLabel);
  });
});

describe('구조와 접근성', () => {
  it('요약 카드는 dt/dd 쌍이고, 막대는 보조 기술에서 숨기며, AI 배지는 장식이다', async () => {
    renderApp(['/merchant/areas/guseong']);
    await heading1('구성동 / 과일 가게');

    expect(document.querySelectorAll('dl > div > dt')).toHaveLength(2);
    section('주민이 원하는 조건')
      .querySelectorAll('[data-fill]')
      .forEach((bar) => expect(bar.closest('[aria-hidden="true"]')).not.toBeNull());
    const badge = within(section('한 줄 요약')).getByText('AI');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(within(section('한 줄 요약')).getByText('예시 정리 · AI 연동 예정')).toBeInTheDocument();
  });

  it('"방문 판매 제안하기" 버튼은 "결정 필요" 알약을 설명으로 가리키고 동작이 없다', async () => {
    const user = userEvent.setup();
    renderApp(['/merchant/areas/guseong']);
    await heading1('구성동 / 과일 가게');

    const button = screen.getByRole('button', { name: '방문 판매 제안하기' });
    expect(button).toHaveAccessibleDescription('결정 필요');
    expect(document.getElementById(button.getAttribute('aria-describedby')!)).toHaveTextContent(
      '결정 필요',
    );

    // 눌러도 화면이 바뀌지 않는다(다음 화면 미정).
    await user.click(button);
    expect(
      screen.getByRole('heading', { level: 1, name: '구성동 / 과일 가게' }),
    ).toBeInTheDocument();
  });

  it('하단 내비게이션이 없다', async () => {
    renderApp(['/merchant/areas/guseong']);
    await heading1('구성동 / 과일 가게');

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('역할·동네 선택 없이 직접 들어와도 렌더링한다', async () => {
    renderApp(['/merchant/areas/mabuk']);

    expect(await heading1('마북동 / 과일 가게')).toBeInTheDocument();
  });
});

describe('로딩과 없는 동네', () => {
  it('불러오는 동안 안내를 보여준다', async () => {
    renderApp(['/merchant/areas/guseong']);

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중이에요.');
    await heading1('구성동 / 과일 가게');
  });

  it('없는 areaId 는 찾을 수 없음 안내와 /merchant 링크를 보여준다', async () => {
    renderApp(['/merchant/areas/unknown']);

    expect(await screen.findByText('찾을 수 없는 동네예요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '동네 목록으로' })).toHaveAttribute(
      'href',
      '/merchant',
    );
    expect(screen.queryByRole('button', { name: '방문 판매 제안하기' })).not.toBeInTheDocument();
  });

  it('조회가 실패하면 오류 안내를 보여준다', async () => {
    vi.spyOn(merchantService, 'getAreaDetail').mockRejectedValue(new Error('x'));
    renderApp(['/merchant/areas/guseong']);

    expect(await screen.findByText('데이터를 가져오지 못했어요')).toBeInTheDocument();
  });

  it('한 줄 요약 생성이 실패해도 수치 화면은 그대로 보여준다', async () => {
    const services = await import('@/services');
    vi.spyOn(services.areaDescriptionGenerator, 'generate').mockRejectedValue(new Error('x'));
    renderApp(['/merchant/areas/guseong']);

    expect(await heading1('구성동 / 과일 가게')).toBeInTheDocument();
    expect(
      within(section('한 줄 요약')).getByText('요약을 불러오지 못했어요.'),
    ).toBeInTheDocument();
    expect(rowTexts('주민이 원하는 조건')).toHaveLength(3);
  });
});

describe('주민 요청과의 연동', () => {
  it('주민이 과일/채소 요청을 보내면 구성동 요청 인원이 29명에서 30명으로 바뀐다', async () => {
    const { unmount } = renderApp(['/merchant/areas/guseong']);
    await heading1('구성동 / 과일 가게');
    expect(stat('요청한 주민')).toBe('29명');
    unmount();

    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: 'fruit-vegetable',
      detail: '과일가게요',
      conditions: [],
      visitTimes: [],
    });
    renderApp(['/merchant/areas/guseong']);

    await heading1('구성동 / 과일 가게');
    expect(stat('요청한 주민')).toBe('30명');
    expect(
      within(section('한 줄 요약')).getByText(/원하는 주민이 30명 있어요/),
    ).toBeInTheDocument();
    // 조건 인원은 정적 목이라 그대로다.
    expect(rowTexts('주민이 원하는 조건')[0]).toBe('늦게까지 영업, 17명');
  });
});

describe('이동', () => {
  it('탐색 화면의 동네 행을 누르면 그 동네 상세가 열린다', async () => {
    const user = userEvent.setup();
    renderApp(['/merchant']);

    await user.click(await screen.findByRole('link', { name: /^보정동/ }));

    expect(await heading1('보정동 / 과일 가게')).toBeInTheDocument();
  });

  it('이전 화면이 있으면 뒤로 가기가 그 화면으로 돌아간다', async () => {
    const user = userEvent.setup();
    renderApp(['/merchant', '/merchant/areas/guseong'], undefined, 1);
    await heading1('구성동 / 과일 가게');

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(await heading1('내 업종을 원하는 동네')).toBeInTheDocument();
  });

  it('직접 진입했으면 뒤로 가기가 /merchant 로 이동한다', async () => {
    const user = userEvent.setup();
    renderApp(['/merchant/areas/guseong']);
    await heading1('구성동 / 과일 가게');

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(await heading1('내 업종을 원하는 동네')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('구성동 / 과일 가게')).not.toBeInTheDocument());
  });

  it('동네를 바꿔 들어가면 이전 동네 값을 잠깐이라도 보여주지 않는다', async () => {
    const user = userEvent.setup();
    renderApp(['/merchant']);
    await user.click(await screen.findByRole('link', { name: /^구성동/ }));
    await heading1('구성동 / 과일 가게');
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    await user.click(await screen.findByRole('link', { name: /^마북동/ }));

    expect(await heading1('마북동 / 과일 가게')).toBeInTheDocument();
    expect(stat('요청한 주민')).toBe('9명');
  });
});
