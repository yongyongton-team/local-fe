import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/mocks/memoryDb';
import { merchantService, NoShopError, offerService } from '@/services';
import { renderApp } from '@/test/renderApp';
import type { MerchantProfile, OwnerOffer } from '@/types/domain';

const heading1 = (name: string) => screen.findByRole('heading', { level: 1, name });
const offer = (overrides: Partial<OwnerOffer> = {}): OwnerOffer => ({
  id: 'x1',
  title: '테스트 제안',
  status: 'OPEN',
  price: 15000,
  pickupAt: new Date('2026-11-15T10:00:00+09:00'),
  deadlineAt: new Date('2026-11-14T18:00:00+09:00'),
  orderCount: 0,
  minOrders: 20,
  ...overrides,
});
const listOffers = (offers: OwnerOffer[]) =>
  vi.spyOn(offerService, 'listOwnerOffers').mockResolvedValue(offers);
const cards = () => screen.queryAllByRole('article');

afterEach(() => vi.restoreAllMocks());

describe('내 가게(제안 목록): 정상', () => {
  it('앱바 제목, 요약 카드("{동} · {업종}"과 요청 수·조건), 제안 카드를 보여준다', async () => {
    renderApp(['/merchant/offers']);

    expect(await heading1('내 가게')).toBeInTheDocument();
    const summary = await screen.findByRole('region', { name: '내 가게 요약' });
    expect(within(summary).getByText('구성동 · 과일 가게')).toBeInTheDocument();
    expect(summary).toHaveTextContent(/요청 29명 · .+ 조건이 많아요/);
    expect(
      await screen.findByRole('heading', { level: 3, name: '제철 과일 꾸러미' }),
    ).toBeInTheDocument();
  });

  it('제안 카드: 상태 배지, 가격·받는 날·마감 행, 진행 막대와 "0 / 20명 예약"', async () => {
    renderApp(['/merchant/offers']);

    const card = await screen.findByRole('article', { name: '제철 과일 꾸러미' });
    expect(within(card).getByText('모집 중')).toBeInTheDocument();
    expect(within(card).getByText('가격').nextElementSibling).toHaveTextContent('15,000원');
    expect(within(card).getByText('받는 날').nextElementSibling).toHaveTextContent(
      '11/15(일) 오전 10:00',
    );
    expect(within(card).getByText('마감').nextElementSibling).toHaveTextContent('11/14(토) 18:00');
    const bar = within(card).getByRole('progressbar', { name: '0 / 20명 예약' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '20');
  });

  it('하단 버튼: 내 제안 보내기(이 동네의 작성 화면)와 요청 모아 보기로(/merchant)', async () => {
    renderApp(['/merchant/offers']);

    expect(await screen.findByRole('link', { name: '내 제안 보내기' })).toHaveAttribute(
      'href',
      '/merchant/offers/new?area=guseong',
    );
    expect(screen.getByRole('link', { name: '요청 모아 보기로' })).toHaveAttribute(
      'href',
      '/merchant',
    );
  });

  it('?area= 로 동네를 정하면 요약과 "내 제안 보내기"가 그 동네를 따른다', async () => {
    renderApp(['/merchant/offers?area=bojeong']);

    expect(await screen.findByText('보정동 · 과일 가게')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 제안 보내기' })).toHaveAttribute(
      'href',
      '/merchant/offers/new?area=bojeong',
    );
  });

  it('사장님 탐색 화면의 가게 정보를 누르면 내 가게로 온다', async () => {
    const user = userEvent.setup();
    renderApp(['/merchant']);

    const link = await screen.findByRole('link', { name: '싱싱과일 · 과일·채소' });
    expect(link).toHaveAttribute('href', '/merchant/offers');
    await user.click(link);

    expect(await heading1('내 가게')).toBeInTheDocument();
  });
});

describe('내 가게(제안 목록): 기본 시드(모집 중 1건 + 확정 1건)', () => {
  it('처음 목록에 모집 중과 확정 제안이 함께 있고 확정은 막대가 가득 찬다', async () => {
    renderApp(['/merchant/offers']);

    const open = await screen.findByRole('article', { name: '제철 과일 꾸러미' });
    const confirmed = await screen.findByRole('article', { name: '주말 채소 박스' });
    expect(cards()).toHaveLength(2);
    expect(within(open).getByText('모집 중')).toBeInTheDocument();
    expect(within(confirmed).getByText('확정')).toBeInTheDocument();
    expect(within(confirmed).getByText('가격').nextElementSibling).toHaveTextContent('12,000원');
    const bar = within(confirmed).getByRole('progressbar', { name: '22 / 20명 예약' });
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('100%');
  });
});

describe('내 가게(제안 목록): 상태·행·진행', () => {
  it('상태 다섯 가지의 배지 문구(모집 중 / 확정 / 마감 / 취소 / 완료)', async () => {
    listOffers(
      (['OPEN', 'CONFIRMED', 'CLOSED', 'CANCELLED', 'DONE'] as const).map((status, i) =>
        offer({ id: `s${i}`, title: `제안 ${status}`, status }),
      ),
    );
    renderApp(['/merchant/offers']);

    await screen.findByRole('article', { name: '제안 OPEN' });
    const badge = (title: string) =>
      within(screen.getByRole('article', { name: title })).getByText(
        /^(모집 중|확정|마감|취소|완료)$/,
        {
          selector: 'span',
        },
      );
    expect(badge('제안 OPEN')).toHaveTextContent('모집 중');
    expect(badge('제안 CONFIRMED')).toHaveTextContent('확정');
    expect(badge('제안 CLOSED')).toHaveTextContent('마감');
    expect(badge('제안 CANCELLED')).toHaveTextContent('취소');
    expect(badge('제안 DONE')).toHaveTextContent('완료');
  });

  it('상태를 모르면 배지가 없다', async () => {
    listOffers([{ ...offer({ title: '상태 없음' }), status: undefined }]);
    renderApp(['/merchant/offers']);

    const card = await screen.findByRole('article', { name: '상태 없음' });
    expect(card.querySelector('span')).toBeNull();
  });

  it('price 와 pickupAt 이 없으면 그 행만 숨기고 마감 행과 진행 막대는 그대로다', async () => {
    listOffers([{ ...offer({ title: '값 일부 없음' }), price: undefined, pickupAt: undefined }]);
    renderApp(['/merchant/offers']);

    const card = await screen.findByRole('article', { name: '값 일부 없음' });
    expect(within(card).queryByText('가격')).not.toBeInTheDocument();
    expect(within(card).queryByText('받는 날')).not.toBeInTheDocument();
    expect(within(card).getByText('마감')).toBeInTheDocument();
    expect(within(card).getByRole('progressbar')).toBeInTheDocument();
  });

  it('모든 행 값이 없어도 제목·진행 막대는 나온다', async () => {
    listOffers([{ id: 'z', title: '최소 정보', orderCount: 2, minOrders: 4 }]);
    renderApp(['/merchant/offers']);

    const card = await screen.findByRole('article', { name: '최소 정보' });
    expect(card.querySelector('dl')).toBeNull();
    expect(within(card).getByText('2 / 4명 예약')).toBeInTheDocument();
  });

  it('진행 막대는 예약 인원 ÷ 최소 주문 수이고 숫자와 문구가 같은 값이다', async () => {
    listOffers([offer({ title: '진행 중', orderCount: 5, minOrders: 20 })]);
    renderApp(['/merchant/offers']);

    const bar = await screen.findByRole('progressbar', { name: '5 / 20명 예약' });
    expect(bar).toHaveAttribute('aria-valuenow', '5');
    expect(bar).toHaveAttribute('aria-valuemax', '20');
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('25%');
  });

  it('여러 제안은 서버(목은 최근) 순서 그대로 나온다', async () => {
    listOffers([offer({ id: 'a', title: '첫째' }), offer({ id: 'b', title: '둘째' })]);
    renderApp(['/merchant/offers']);

    await screen.findByRole('article', { name: '첫째' });
    expect(cards().map((c) => within(c).getByRole('heading').textContent)).toEqual([
      '첫째',
      '둘째',
    ]);
  });
});

describe('내 가게(제안 목록): 빈 목록·오류', () => {
  it('빈 목록이면 안내와 "내 제안 보내기"만 보이고 "요청 모아 보기로"는 없다', async () => {
    getDb().offers.length = 0;
    renderApp(['/merchant/offers']);

    expect(await screen.findByText('아직 보낸 제안이 없어요')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '내 제안 보내기' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '요청 모아 보기로' })).not.toBeInTheDocument();
    expect(cards()).toHaveLength(0);
  });

  it('제안 목록을 못 불러오면 오류 안내이고 요약 카드와 버튼은 그대로다', async () => {
    vi.spyOn(offerService, 'listOwnerOffers').mockRejectedValue(new Error('서버 원문'));
    renderApp(['/merchant/offers']);

    expect(await screen.findByText('제안을 가져오지 못했어요')).toBeInTheDocument();
    expect(screen.getByText('잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(await screen.findByRole('region', { name: '내 가게 요약' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 제안 보내기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '요청 모아 보기로' })).toBeInTheDocument();
  });

  it('불러오는 동안 안내를 보여준다', async () => {
    vi.spyOn(offerService, 'listOwnerOffers').mockReturnValue(new Promise(() => undefined));
    renderApp(['/merchant/offers']);

    expect((await screen.findAllByRole('status')).length).toBeGreaterThan(0);
  });

  it('가게가 없으면 가게 없음 안내이고 제안 목록과 "내 제안 보내기"는 없다', async () => {
    vi.spyOn(merchantService, 'getProfile').mockRejectedValue(new NoShopError());
    renderApp(['/merchant/offers']);

    expect(await screen.findByText('아직 등록된 가게가 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '내 제안 보내기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '보낸 제안' })).not.toBeInTheDocument();
  });

  it('동네를 알 수 없으면(가게의 동 정보도 ?area= 도 없다) 안내하고 "내 제안 보내기"는 없다', async () => {
    vi.spyOn(merchantService, 'getProfile').mockResolvedValue({
      shopName: '가게',
      categoryId: 'fruit-vegetable',
      categoryName: '과일·채소',
      district: '기흥구',
    } satisfies MerchantProfile);
    renderApp(['/merchant/offers']);

    expect(await screen.findByText('제안을 보낼 동네를 알 수 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '내 제안 보내기' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '요청 모아 보기로' })).toBeInTheDocument();
    await waitFor(() => expect(cards().length).toBeGreaterThan(0));
  });
});
