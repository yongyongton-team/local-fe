import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { meService } from '@/services';
import { renderApp } from '@/test/renderApp';
import type { Me } from '@/types/domain';

const me = (over: Partial<Me> = {}): Me => ({
  id: 7,
  nickname: '민트',
  role: 'resident',
  dong: { id: 22, name: '구성동', district: '기흥구' },
  shop: null,
  ...over,
});
const SHOP = {
  shopName: '싱싱과일',
  categoryId: 7,
  categoryName: '과일·채소',
  dongId: 22,
  dongName: '구성동',
};

/** 내 정보 화면을 열고 GET /me 결과가 보일 때까지 기다린다. */
async function openMyInfo(value: Me) {
  vi.spyOn(meService, 'getMe').mockResolvedValue(value);
  const view = renderApp(['/me']);
  await screen.findByText(/^ID : /);
  return view;
}

afterEach(() => vi.restoreAllMocks());

describe('내 정보: 프로필', () => {
  it('앱 로고, 뒤로 가기, 제목 "내 정보"가 있다', async () => {
    await openMyInfo(me());

    expect(screen.getByRole('link', { name: '생기면 갈게요 메인으로 이동' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '내 정보' })).toBeInTheDocument();
  });

  it('닉네임 + "님", ID, 닉네임을 수정할 수 없다는 안내를 보여준다', async () => {
    await openMyInfo(me({ id: 7, nickname: '민트' }));

    expect(screen.getByText('민트')).toBeInTheDocument();
    expect(screen.getByText('ID : 7')).toBeInTheDocument();
    expect(screen.getByText('닉네임은 처음 들어올 때 자동으로 정해져요')).toBeInTheDocument();
    // 닉네임은 수정할 수 없다: 입력 필드나 수정 버튼이 없다.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /수정|변경/ })).not.toBeInTheDocument();
  });

  it('닉네임이 비어 있으면 "사용자"로 대신 보여준다', async () => {
    await openMyInfo(me({ nickname: '   ' }));

    expect(screen.getByText('사용자')).toBeInTheDocument();
  });
});

describe('내 정보: 역할 칩', () => {
  it('주민·사장님·예비 창업자 칩이 있고 현재 역할만 선택되어 있다', async () => {
    await openMyInfo(me({ role: 'merchant' }));

    const group = within(screen.getByRole('radiogroup', { name: '역할' }));
    expect(group.getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual([
      '주민',
      '사장님',
      '예비 창업자',
    ]);
    expect(group.getByRole('radio', { name: '사장님' })).toBeChecked();
    expect(group.getByRole('radio', { name: '주민' })).not.toBeChecked();
    expect(group.getByRole('radio', { name: '예비 창업자' })).not.toBeChecked();
  });

  it('역할이 없으면 아무 칩도 선택되어 있지 않다', async () => {
    await openMyInfo(me({ role: null }));

    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
  });

  it.each([
    ['사장님', '/merchant'],
    ['예비 창업자', '/founder'],
  ])('%s 칩을 누르면 그 역할의 첫 화면(%s)으로 이동한다', async (label, path) => {
    const user = userEvent.setup();
    const { router } = await openMyInfo(me({ role: 'resident' }));

    await user.click(screen.getByRole('radio', { name: label }));

    await waitFor(() => expect(router.state.location.pathname).toBe(path));
  });

  it('주민 칩을 누르면 주민 첫 화면(동네 탐색)으로 이동한다', async () => {
    const user = userEvent.setup();
    const { router } = await openMyInfo(me({ role: 'merchant' }));

    await user.click(screen.getByRole('radio', { name: '주민' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/resident'));
  });

  it('이미 선택된 역할을 다시 눌러도 이동하지 않는다', async () => {
    const user = userEvent.setup();
    const save = vi.spyOn(meService, 'saveSelection');
    const { router } = await openMyInfo(me({ role: 'resident' }));

    await user.click(screen.getByRole('radio', { name: '주민' }));

    expect(router.state.location.pathname).toBe('/me');
    expect(save).not.toHaveBeenCalled();
  });
});

describe('내 정보: 행(역할별)', () => {
  it('주민은 "내 동네" 행만 보이고 "내 가게" 행은 없다', async () => {
    await openMyInfo(me({ role: 'resident', shop: SHOP }));

    expect(screen.getByRole('link', { name: /내 동네/ })).toBeInTheDocument();
    expect(screen.queryByText('내 가게')).not.toBeInTheDocument();
  });

  it('예비 창업자도 "내 동네" 행만 보인다', async () => {
    await openMyInfo(me({ role: 'founder', shop: SHOP }));

    expect(screen.getByRole('link', { name: /내 동네/ })).toBeInTheDocument();
    expect(screen.queryByText('내 가게')).not.toBeInTheDocument();
  });

  it('사장님은 "내 동네"와 "내 가게" 행이 모두 보인다', async () => {
    await openMyInfo(me({ role: 'merchant', shop: SHOP }));

    expect(screen.getByRole('link', { name: /내 동네/ })).toBeInTheDocument();
    expect(screen.getByText('내 가게')).toBeInTheDocument();
    expect(screen.getByText('싱싱과일 · 과일·채소')).toBeInTheDocument();
  });

  it('"내 동네"는 "{구} {동}" 값과 함께 동네 선택(/me/dong)으로 가는 링크다', async () => {
    await openMyInfo(me());

    const row = screen.getByRole('link', { name: /내 동네/ });
    expect(row).toHaveAttribute('href', '/me/dong');
    expect(row).toHaveTextContent('내 동네');
    expect(row).toHaveTextContent('기흥구 구성동');
  });

  it('"내 가게"는 이동하지 않는다(링크·버튼이 아니다): 다음 PR 에서 가게 화면을 만든다', async () => {
    await openMyInfo(me({ role: 'merchant', shop: SHOP }));

    expect(screen.queryByRole('link', { name: /내 가게/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /내 가게/ })).not.toBeInTheDocument();
  });

  it('사장님인데 가게가 아직 없으면 임시 문구 "등록하기"를 보여준다', async () => {
    await openMyInfo(me({ role: 'merchant', shop: null }));

    expect(screen.getByText('내 가게')).toBeInTheDocument();
    expect(screen.getByText('등록하기')).toBeInTheDocument();
  });

  it('가게 업종 이름이 없으면 가게 이름만 보여준다', async () => {
    await openMyInfo(me({ role: 'merchant', shop: { ...SHOP, categoryName: '' } }));

    expect(screen.getByText('싱싱과일')).toBeInTheDocument();
  });

  it('내 동네가 없으면 임시 문구로 대신 보여주고 깨지지 않는다', async () => {
    await openMyInfo(me({ dong: null }));

    expect(screen.getByRole('link', { name: /내 동네/ })).toHaveTextContent('정하지 않았어요');
  });
});

describe('내 정보: 디자인 주석은 화면에 나오지 않는다', () => {
  it.each([
    ['사장님', me({ role: 'merchant', shop: SHOP })],
    ['주민', me({ role: 'resident' })],
  ])('%s 로 열어도 동작 설명용 주석 문구 3개가 없다', async (_name, value) => {
    await openMyInfo(value);

    expect(document.body).not.toHaveTextContent('"내 가게"는 사장님일 때만 보여요');
    expect(document.body).not.toHaveTextContent('내 가게"는 사장님일 때만');
    expect(document.body).not.toHaveTextContent('역할을 바꾸면 그 역할의 첫 화면으로 가요');
    expect(document.body).not.toHaveTextContent(/곳 중 6곳|아래로 더 있어요/);
  });
});

describe('내 정보: 불러오기', () => {
  it('불러오는 동안 로딩 문구를 보여준다', () => {
    vi.spyOn(meService, 'getMe').mockReturnValue(new Promise<Me>(() => {}));
    renderApp(['/me']);

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중이에요.');
  });

  it('실패하면 안내를 보여주고 서버 message 는 쓰지 않는다', async () => {
    vi.spyOn(meService, 'getMe').mockRejectedValue(new Error('서버 원문 노출 금지'));
    renderApp(['/me']);

    expect(await screen.findByText('내 정보를 가져오지 못했어요')).toBeInTheDocument();
    expect(screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
  });
});
