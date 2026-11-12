import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/services/api/apiError';
import { authService, merchantService, NoShopError, offerService } from '@/services';
import { renderApp } from '@/test/renderApp';

type User = ReturnType<typeof userEvent.setup>;

const heading1 = (name: string) => screen.findByRole('heading', { level: 1, name });
const field = (label: string) => screen.getByLabelText(label);
const submit = () => screen.getByRole('button', { name: /제안 보내기/ });
const change = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });

async function openForm(path = '/merchant/offers/new') {
  const view = renderApp([path]);
  await heading1('방문 판매 제안');
  await screen.findByRole('region', { name: '내 가게 요약' });
  return view;
}

/** 필수값을 모두 채운다. 받는 날짜는 11/15(일) 10:00, 마감은 11/14(토) 18:00 이다. */
async function fillValid(user: User, { description = '', title = '제철 과일 꾸러미' } = {}) {
  await user.type(field('제목'), title);
  if (description) await user.type(field('설명 (선택)'), description);
  await user.type(field('가격'), '15000');
  change('받는 날짜 / 시간', '2026-11-15T10:00');
  await user.type(field('받는 곳'), '구성동 주민센터 앞');
  change('주문 마감', '2026-11-14T18:00');
}

afterEach(() => vi.restoreAllMocks());

describe('방문 판매 제안 작성: 렌더링', () => {
  it('앱바 제목과 같은 요약 카드, 시안의 필드 라벨(오타를 고친 "받는")이 있다', async () => {
    await openForm();

    expect(screen.getByRole('region', { name: '내 가게 요약' })).toHaveTextContent(
      '구성동 · 과일 가게',
    );
    for (const label of [
      '제목',
      '설명 (선택)',
      '가격',
      '받는 날짜 / 시간',
      '받는 곳',
      '주문 마감',
    ]) {
      expect(field(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('group', { name: '최소 주문' })).toHaveTextContent('20명');
    expect(screen.queryByText('받은 날짜 / 시간')).not.toBeInTheDocument();
    expect(screen.queryByText('받은 곳')).not.toBeInTheDocument();
  });

  it('처음에는 "제안 보내기"가 비활성이다', async () => {
    await openForm();

    expect(submit()).toBeDisabled();
  });

  it('?area= 의 동네를 요약에 쓴다', async () => {
    await openForm('/merchant/offers/new?area=bojeong');

    expect(screen.getByRole('region', { name: '내 가게 요약' })).toHaveTextContent(
      '보정동 · 과일 가게',
    );
  });

  it('가게가 없으면 가게 없음 안내만 있고 폼은 없다', async () => {
    vi.spyOn(merchantService, 'getProfile').mockRejectedValue(new NoShopError());
    renderApp(['/merchant/offers/new']);

    expect(await screen.findByText('아직 등록된 가게가 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /제안 보내기/ })).not.toBeInTheDocument();
  });
});

describe('방문 판매 제안 작성: 최소 주문 stepper', () => {
  it('기본 20, − 와 + 로 바꾸고 1 아래로는 내려가지 않는다', async () => {
    const user = userEvent.setup();
    await openForm();
    const group = screen.getByRole('group', { name: '최소 주문' });
    const minus = within(group).getByRole('button', { name: '최소 주문 줄이기' });
    const plus = within(group).getByRole('button', { name: '최소 주문 늘리기' });

    await user.click(plus);
    expect(group).toHaveTextContent('21명');
    for (let i = 0; i < 25; i += 1) await user.click(minus);

    expect(group).toHaveTextContent('1명');
    await user.click(minus);
    expect(group).toHaveTextContent('1명');
  });
});

describe('방문 판매 제안 작성: 검증', () => {
  it('마감이 받는 날짜와 같으면 빨간 오류 문구가 나오고 보낼 수 없다', async () => {
    const user = userEvent.setup();
    await openForm();
    await fillValid(user);

    change('주문 마감', '2026-11-15T10:00');

    expect(screen.getByRole('alert')).toHaveTextContent('마감은 받는 날짜보다 빨라야 해요.');
    expect(field('주문 마감')).toHaveAttribute('aria-invalid', 'true');
    expect(field('주문 마감')).toHaveAccessibleDescription('마감은 받는 날짜보다 빨라야 해요.');
    expect(field('받는 날짜 / 시간')).not.toHaveAttribute('aria-invalid');
    expect(submit()).toBeDisabled();
  });

  it('마감이 더 늦어도 같은 오류이고, 받는 날짜보다 빨라지면 오류가 사라지고 보낼 수 있다', async () => {
    const user = userEvent.setup();
    await openForm();
    await fillValid(user);

    change('주문 마감', '2026-11-16T09:00');
    expect(screen.getByRole('alert')).toHaveTextContent('마감은 받는 날짜보다 빨라야 해요.');
    expect(submit()).toBeDisabled();

    change('주문 마감', '2026-11-14T18:00');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(field('주문 마감')).not.toHaveAttribute('aria-invalid');
    expect(submit()).toBeEnabled();
  });

  it('필수값이 하나라도 비면 비활성이고 첫 번째 빈 항목을 안내한다', async () => {
    const user = userEvent.setup();
    await openForm();

    await user.type(field('제목'), '제안');
    expect(submit()).toBeDisabled();
    expect(screen.getByText('가격을 1원 이상으로 입력해 주세요.')).toBeInTheDocument();

    await user.type(field('가격'), '0');
    expect(submit()).toBeDisabled();

    await user.clear(field('가격'));
    await user.type(field('가격'), '1000');
    expect(screen.getByText('받는 날짜와 시간을 골라 주세요.')).toBeInTheDocument();
    change('받는 날짜 / 시간', '2026-11-15T10:00');
    expect(screen.getByText('받는 곳을 입력해 주세요.')).toBeInTheDocument();
    await user.type(field('받는 곳'), '앞');
    expect(screen.getByText('주문 마감 날짜와 시간을 골라 주세요.')).toBeInTheDocument();
    expect(submit()).toBeDisabled();

    change('주문 마감', '2026-11-14T18:00');
    expect(submit()).toBeEnabled();
    expect(screen.queryByText('주문 마감 날짜와 시간을 골라 주세요.')).not.toBeInTheDocument();
  });

  it('설명은 비어 있어도 보낼 수 있다', async () => {
    const user = userEvent.setup();
    await openForm();
    await fillValid(user);

    expect(submit()).toBeEnabled();
  });

  it('가격은 숫자만 받고 천 단위 쉼표로 보인다', async () => {
    const user = userEvent.setup();
    await openForm();

    await user.type(field('가격'), '1a5,0b00');

    expect(field('가격')).toHaveValue('15,000');
  });

  it('고른 날짜를 시안 형식으로 보여준다(12시간제 / 24시간제)', async () => {
    await openForm();

    change('받는 날짜 / 시간', '2026-11-15T10:00');
    change('주문 마감', '2026-11-14T18:00');

    const text = (label: string) => field(label).parentElement?.textContent;
    expect(text('받는 날짜 / 시간')).toContain('11/15(일) 오전 10:00');
    expect(text('주문 마감')).toContain('11/14(토) 18:00');
  });
});

describe('방문 판매 제안 작성: 제출', () => {
  it('입력값이 CreateOfferRequest 로 가는 필드(동네·업종은 현재 선택)에 그대로 매핑된다', async () => {
    const user = userEvent.setup();
    const create = vi
      .spyOn(offerService, 'createOffer')
      .mockResolvedValue({ notifiedResidentCount: 3 });
    await openForm();
    await fillValid(user, { description: '소포장으로 드려요' });
    await user.click(screen.getByRole('button', { name: '최소 주문 줄이기' }));

    await user.click(submit());

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      neighborhoodId: 'guseong',
      categoryId: 'fruit-vegetable',
      title: '제철 과일 꾸러미',
      description: '소포장으로 드려요',
      price: 15000,
      minOrders: 19,
      pickupAt: new Date('2026-11-15T10:00:00+09:00'),
      pickupPlace: '구성동 주민센터 앞',
      deadlineAt: new Date('2026-11-14T18:00:00+09:00'),
    });
  });

  it('설명이 비면 description 없이 보내고, ?area= 의 동네로 보낸다', async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(offerService, 'createOffer').mockResolvedValue({});
    await openForm('/merchant/offers/new?area=bojeong');
    await fillValid(user);

    await user.click(submit());

    const input = create.mock.calls[0]?.[0];
    expect(input?.neighborhoodId).toBe('bojeong');
    expect(input).not.toHaveProperty('description');
  });

  it('성공하면 알림 보낸 주민 수를 Modal 로 알리고, 확인하면 내 가게(목록)로 가서 새 제안이 보인다', async () => {
    const user = userEvent.setup();
    const { router } = await openForm();
    await fillValid(user, { title: '새로 보낸 제안' });

    await user.click(submit());

    const dialog = await screen.findByRole('dialog', { name: '제안을 보냈어요' });
    expect(within(dialog).getByText('알림 보낸 주민 29명')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    expect(await heading1('내 가게')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/merchant/offers');
    expect(router.state.location.search).toBe('?area=guseong');
    expect(await screen.findByRole('article', { name: '새로 보낸 제안' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('알림 인원을 모르면 인원 없는 안내 문구다', async () => {
    const user = userEvent.setup();
    vi.spyOn(offerService, 'createOffer').mockResolvedValue({});
    await openForm();
    await fillValid(user);

    await user.click(submit());

    expect(await screen.findByText('요청한 주민에게 알림을 보냈어요.')).toBeInTheDocument();
  });

  it('Escape 로 닫아도 제안은 이미 보냈으므로 목록으로 간다(양식이 남아 다시 보내지 않게)', async () => {
    const user = userEvent.setup();
    await openForm();
    await fillValid(user);
    await user.click(submit());
    await screen.findByRole('dialog', { name: '제안을 보냈어요' });

    await user.keyboard('{Escape}');

    expect(await heading1('내 가게')).toBeInTheDocument();
  });

  it('보내는 동안 중복 제출을 막는다(연타해도 한 번만 호출)', async () => {
    const user = userEvent.setup();
    let release: (value: { notifiedResidentCount: number }) => void = () => undefined;
    const create = vi.spyOn(offerService, 'createOffer').mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    await openForm();
    await fillValid(user);

    await user.click(submit());
    await user.click(submit());
    fireEvent.submit(field('제목').closest('form')!);

    expect(create).toHaveBeenCalledTimes(1);
    expect(submit()).toHaveAttribute('aria-busy', 'true');
    release({ notifiedResidentCount: 1 });
    await screen.findByRole('dialog');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('데모 세션이면 서버에 보내지 않고 차단 안내를 보인다', async () => {
    const user = userEvent.setup();
    vi.spyOn(authService, 'isDemoSession').mockReturnValue(true);
    const create = vi.spyOn(offerService, 'createOffer').mockResolvedValue({});
    await openForm();
    await fillValid(user);

    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '데모 계정은 사장님 화면만 볼 수 있어요. 나가려면 주소 끝에 ?demo=off를 붙여 주세요.',
    );
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('서비스가 DEMO_SESSION 으로 막아도 같은 차단 안내를 보인다', async () => {
    const user = userEvent.setup();
    vi.spyOn(offerService, 'createOffer').mockRejectedValue(
      new ApiError({ kind: 'parse', code: 'DEMO_SESSION', message: '내부 문구' }),
    );
    await openForm();
    await fillValid(user);

    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent('데모 계정은 사장님 화면만');
    expect(screen.queryByText('내부 문구')).not.toBeInTheDocument();
  });

  it('서버 오류는 describeApiError 의 한국어 문구로만 보이고(서버 message 는 안 보임) 다시 보낼 수 있다', async () => {
    const user = userEvent.setup();
    const create = vi
      .spyOn(offerService, 'createOffer')
      .mockRejectedValueOnce(
        new ApiError({
          kind: 'http',
          status: 400,
          code: 'VALIDATION_ERROR',
          message: '서버 원문 메시지',
        }),
      )
      .mockResolvedValueOnce({ notifiedResidentCount: 2 });
    await openForm();
    await fillValid(user);

    await user.click(submit());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      '입력한 내용을 다시 확인해 주세요. 가격, 최소 주문 인원, 날짜를 살펴봐 주세요.',
    );
    expect(screen.queryByText(/서버 원문 메시지/)).not.toBeInTheDocument();
    expect(submit()).toBeEnabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(submit());
    expect(await screen.findByRole('dialog', { name: '제안을 보냈어요' })).toBeInTheDocument();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('네트워크 오류는 네트워크 안내 문구다', async () => {
    const user = userEvent.setup();
    vi.spyOn(offerService, 'createOffer').mockRejectedValue(
      new ApiError({ kind: 'network', message: 'x' }),
    );
    await openForm();
    await fillValid(user);

    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '네트워크 연결을 확인하고 다시 시도해 주세요.',
    );
  });

  it('입력을 고치면 이전 오류 안내가 사라진다', async () => {
    const user = userEvent.setup();
    vi.spyOn(offerService, 'createOffer').mockRejectedValue(new Error('x'));
    await openForm();
    await fillValid(user);
    await user.click(submit());
    await screen.findByRole('alert');

    await user.type(field('제목'), '!');

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
