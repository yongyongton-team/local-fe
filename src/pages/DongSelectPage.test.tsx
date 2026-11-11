import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demandService, meService } from '@/services';
import { renderApp } from '@/test/renderApp';
import type { Neighborhood } from '@/types/domain';

const n = (id: string, district: string, name: string): Neighborhood => ({ id, district, name });
const LIST: Neighborhood[] = [
  n('1', '기흥구', '구성동'),
  n('2', '기흥구', '마북동'),
  n('3', '기흥구', '보정동'),
  n('4', '수지구', '죽전1동'),
  n('5', '수지구', '풍덕천1동'),
  n('6', '처인구', '역삼동'),
];

/** 동 목록을 고정하고, 첫 화면에서 주민 + 동네를 고른 뒤 내 정보 → 동네 선택으로 들어간다. */
async function openDongSelect(startLabel: string) {
  vi.spyOn(demandService, 'listNeighborhoods').mockResolvedValue(LIST);
  const user = userEvent.setup();
  const view = renderApp(['/']);
  await screen.findByRole('option', { name: startLabel });
  await user.selectOptions(screen.getByLabelText('내 동네'), startLabel);
  await user.click(screen.getByRole('radio', { name: /^주민/ }));
  await user.click(screen.getByRole('button', { name: '시작하기' }));
  await screen.findByRole('heading', { level: 1, name: '동네 탐색' });
  await act(() => view.router.navigate('/me'));
  await act(() => view.router.navigate('/me/dong'));
  await screen.findByRole('heading', { level: 1, name: '동네 선택' });
  await screen.findByRole('list', { name: '동 목록' });
  return { user, ...view };
}

const list = () => within(screen.getByRole('list', { name: '동 목록' }));
const names = () =>
  list()
    .getAllByRole('button')
    .map((b) => b.textContent);
const confirm = () => screen.getByRole('button', { name: '이 동네로 정하기' });

afterEach(() => vi.restoreAllMocks());

describe('동네 선택: 화면 구성', () => {
  it('앱 로고, 뒤로 가기, 제목, 검색 입력, 구 칩, 목록, 하단 버튼이 있다', async () => {
    await openDongSelect('기흥구 구성동');

    expect(screen.getByRole('link', { name: '생기면 갈게요 메인으로 이동' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '동 이름 검색' })).toHaveAttribute(
      'placeholder',
      '동 이름 (예: 구성)',
    );
    expect(screen.getByRole('radiogroup', { name: '구 선택' })).toBeInTheDocument();
    expect(confirm()).toBeInTheDocument();
  });

  it('구 칩은 동 목록 데이터에서 만든다(목록 순서, 중복 없음)', async () => {
    await openDongSelect('기흥구 구성동');

    const chips = within(screen.getByRole('radiogroup', { name: '구 선택' })).getAllByRole('radio');
    expect(chips.map((c) => c.closest('label')?.textContent)).toEqual([
      '기흥구',
      '수지구',
      '처인구',
    ]);
  });

  it('처음에는 현재 내 동네의 구가 선택되고, 그 동이 굵게 표시되며 체크(선택 상태)다', async () => {
    await openDongSelect('수지구 풍덕천1동');

    expect(screen.getByRole('radio', { name: '수지구' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '기흥구' })).not.toBeChecked();
    expect(names()).toEqual(['죽전1동', '풍덕천1동']);
    expect(list().getByRole('button', { name: '풍덕천1동' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(list().getByRole('button', { name: '죽전1동' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('디자인 주석(목록 아래 "{구} {전체}곳 중 6곳 · 아래로 더 있어요")은 화면에 없다', async () => {
    await openDongSelect('기흥구 구성동');

    expect(document.body).not.toHaveTextContent(/곳 중 6곳|아래로 더 있어요|\d+곳 중/);
  });
});

describe('동네 선택: 구 칩과 검색', () => {
  it('구 칩을 누르면 그 구의 동만 보인다', async () => {
    const { user } = await openDongSelect('기흥구 구성동');
    expect(names()).toEqual(['구성동', '마북동', '보정동']);

    await user.click(screen.getByRole('radio', { name: '처인구' }));

    expect(screen.getByRole('radio', { name: '처인구' })).toBeChecked();
    expect(names()).toEqual(['역삼동']);
  });

  it('검색어는 동 이름 부분 일치로 거른다(앞뒤 공백 무시)', async () => {
    const { user } = await openDongSelect('기흥구 구성동');

    await user.type(screen.getByRole('textbox', { name: '동 이름 검색' }), ' 북 ');

    expect(names()).toEqual(['마북동']);
  });

  it('검색은 선택한 구 안에서만 찾는다(구 칩과 함께 적용)', async () => {
    const { user } = await openDongSelect('기흥구 구성동');

    await user.type(screen.getByRole('textbox', { name: '동 이름 검색' }), '죽전');
    expect(screen.getByText('찾는 동네가 없어요')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '수지구' }));
    expect(names()).toEqual(['죽전1동']);
  });

  it('결과가 없으면 임시 문구 "찾는 동네가 없어요"를 보여주고, 지우면 목록이 돌아온다', async () => {
    const { user } = await openDongSelect('기흥구 구성동');
    const input = screen.getByRole('textbox', { name: '동 이름 검색' });

    await user.type(input, '없는동');
    expect(screen.getByRole('status')).toHaveTextContent('찾는 동네가 없어요');
    expect(screen.queryByRole('list', { name: '동 목록' })).not.toBeInTheDocument();

    await user.clear(input);
    expect(names()).toEqual(['구성동', '마북동', '보정동']);
    expect(screen.queryByText('찾는 동네가 없어요')).not.toBeInTheDocument();
  });
});

describe('동네 선택: 저장하고 돌아가기', () => {
  it('동을 누르면 그 동이 선택 상태가 되고, 이전 동은 해제된다', async () => {
    const { user } = await openDongSelect('기흥구 구성동');

    await user.click(list().getByRole('button', { name: '마북동' }));

    expect(list().getByRole('button', { name: '마북동' })).toHaveAttribute('aria-pressed', 'true');
    expect(list().getByRole('button', { name: '구성동' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('"이 동네로 정하기"를 누르면 내 정보로 돌아가 바뀐 동네를 보여준다', async () => {
    const { user, router } = await openDongSelect('기흥구 구성동');
    await user.click(list().getByRole('button', { name: '마북동' }));

    await user.click(confirm());

    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(await screen.findByRole('link', { name: /내 동네/ })).toHaveTextContent('기흥구 마북동');
  });

  it('구를 바꿔 다른 구의 동을 골라도 저장된다', async () => {
    const { user, router } = await openDongSelect('기흥구 구성동');
    await user.click(screen.getByRole('radio', { name: '수지구' }));
    await user.click(list().getByRole('button', { name: '죽전1동' }));

    await user.click(confirm());

    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(await screen.findByRole('link', { name: /내 동네/ })).toHaveTextContent(
      '수지구 죽전1동',
    );
  });

  it('현재 동네와 같으면 저장 없이 내 정보로 돌아간다', async () => {
    const save = vi.spyOn(meService, 'saveSelection');
    const { user, router } = await openDongSelect('기흥구 구성동');

    await user.click(confirm());

    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(save).not.toHaveBeenCalled();
  });

  it('역할이 없으면(직접 진입) 저장하지 않고 안내를 보여준다', async () => {
    vi.spyOn(demandService, 'listNeighborhoods').mockResolvedValue(LIST);
    const user = userEvent.setup();
    const { router } = renderApp(['/me/dong']);
    await screen.findByRole('list', { name: '동 목록' });

    // 역할이 없는 상태에서 동을 고르고 저장하면 역할이 없다는 안내가 나온다(서버는 역할과 동네를 함께 받는다).
    await user.click(list().getByRole('button', { name: '마북동' }));
    await user.click(confirm());

    expect(await screen.findByRole('alert')).toHaveTextContent('역할을 먼저 정해 주세요.');
    expect(router.state.location.pathname).toBe('/me/dong');
  });

  it('선택된 동이 없으면 버튼이 비활성이고, 동을 고르면 활성이 된다', async () => {
    vi.spyOn(demandService, 'listNeighborhoods').mockResolvedValue(LIST);
    const user = userEvent.setup();
    renderApp(['/me/dong']);
    await screen.findByRole('list', { name: '동 목록' });

    expect(confirm()).toBeDisabled();
    await user.click(list().getByRole('button', { name: '구성동' }));
    expect(confirm()).toBeEnabled();
  });
});

describe('동네 선택: 불러오기', () => {
  it('불러오는 동안 로딩 문구를 보여준다', () => {
    vi.spyOn(demandService, 'listNeighborhoods').mockReturnValue(
      new Promise<Neighborhood[]>(() => {}),
    );
    renderApp(['/me/dong']);

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중이에요.');
  });

  it('목록을 가져오지 못하면 안내를 보여주고 버튼은 없다', async () => {
    vi.spyOn(demandService, 'listNeighborhoods').mockRejectedValue(new Error('x'));
    renderApp(['/me/dong']);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '동네 목록을 불러오지 못했어요. 새로고침해 주세요.',
    );
    expect(screen.queryByRole('button', { name: '이 동네로 정하기' })).not.toBeInTheDocument();
  });

  it('구 정보가 없는 동네만 있으면 구 칩 없이 전체 목록을 보여준다', async () => {
    vi.spyOn(demandService, 'listNeighborhoods').mockResolvedValue([
      n('1', '', '구성동'),
      n('2', '', '마북동'),
    ]);
    renderApp(['/me/dong']);

    await screen.findByRole('list', { name: '동 목록' });
    expect(screen.queryByRole('radiogroup', { name: '구 선택' })).not.toBeInTheDocument();
    expect(names()).toEqual(['구성동', '마북동']);
  });
});
