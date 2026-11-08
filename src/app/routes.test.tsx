import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';

const heading1 = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });

describe('첫 화면', () => {
  it('로고, 제목, 역할 3종, 동네 선택, 시작하기를 렌더링하고 역할은 선택되어 있지 않다', async () => {
    renderApp();

    expect(await heading1(/우리 동네에 없는 가게,\s*원하면 생겨요/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '생기면 갈게요' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '나는' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    radios.forEach((radio) => expect(radio).not.toBeChecked());
    expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument();
  });

  it('동네는 목록의 첫 항목(기흥구 구성동)이 기본 선택되어 있다', async () => {
    renderApp();

    const select = await screen.findByRole('combobox', { name: '내 동네' });
    await screen.findByRole('option', { name: '기흥구 구성동' });
    expect(select).toHaveDisplayValue('기흥구 구성동');
    expect(select).toBeEnabled();
  });

  it('역할을 고르면 그 역할만 선택 상태가 된다', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('radio', { name: /^사장님/ }));

    expect(screen.getByRole('radio', { name: /^사장님/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^주민/ })).not.toBeChecked();

    await user.click(screen.getByRole('radio', { name: /^예비 창업자/ }));

    expect(screen.getByRole('radio', { name: /^예비 창업자/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^사장님/ })).not.toBeChecked();
  });

  it.each([
    { role: /^주민/, title: '동네 탐색' },
    { role: /^사장님/, title: '내 업종을 원하는 동네' },
    { role: /^예비 창업자/, title: '입지 찾기' },
  ])('역할($role)을 고르고 시작하면 해당 기본 페이지로 이동한다', async ({ role, title }) => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.click(screen.getByRole('radio', { name: role }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));

    expect(await heading1(title)).toBeInTheDocument();
  });

  it('역할을 고르지 않고 시작하면 이동하지 않고 안내한다', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.click(screen.getByRole('button', { name: '시작하기' }));

    expect(screen.getByRole('alert')).toHaveTextContent('역할을 선택해 주세요');
    expect(screen.getAllByRole('radio')[0]).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('우리 동네에 없는 가게');

    // 역할을 고르면 안내가 사라진다.
    await user.click(screen.getByRole('radio', { name: /^주민/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('선택한 동네를 주민 화면에서 보여준다', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('option', { name: '기흥구 보정동' });
    await user.selectOptions(screen.getByLabelText('내 동네'), 'bojeong');
    await user.click(screen.getByRole('radio', { name: /^주민/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));

    // 선택한 동네 이름과 그 동네의 지도 마커(과일 요청 14)를 보여준다.
    expect(await screen.findByText('기흥구 보정동')).toBeInTheDocument();
    expect(await screen.findByText('과일 요청 14')).toBeInTheDocument();
    expect(screen.getByText(/예시 데이터/)).toBeInTheDocument();
  });
});

describe('Not Found', () => {
  it('정의되지 않은 경로는 Not Found 를 보여준다', async () => {
    renderApp(['/없는/경로']);

    expect(await heading1('찾을 수 없음')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '첫 화면으로' })).toHaveAttribute('href', '/');
  });
});

describe('URL 직접 진입', () => {
  it('동네를 선택하지 않아도 주민 화면은 렌더링되고 선택 안내를 보여준다', async () => {
    renderApp(['/resident']);

    expect(await heading1('동네 탐색')).toBeInTheDocument();
    expect(screen.getByText('내 동네를 먼저 선택해 주세요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '첫 화면으로' })).toHaveAttribute('href', '/');
  });

  it.each([
    ['/resident/requests', '내 요청'],
    ['/resident/requests/new', '가게 요청하기'],
    ['/merchant', '내 업종을 원하는 동네'],
    ['/founder', '입지 찾기'],
  ])('%s 는 %s 제목으로 렌더링된다', async (path, title) => {
    renderApp([path]);

    expect(await heading1(title)).toBeInTheDocument();
  });

  it('사장님 동네 상세는 areaId 의 수요를 보여준다', async () => {
    renderApp(['/merchant/areas/guseong']);

    expect(await heading1('구성동 / 과일 가게')).toBeInTheDocument();
    expect(screen.getByText('29명')).toBeInTheDocument();
  });

  it('창업자 동네 리포트는 areaId 의 수치를 보여준다', async () => {
    renderApp(['/founder/areas/mabuk/report']);

    expect(await heading1('마북동 / 과일 가게')).toBeInTheDocument();
    expect(screen.getByText('9명')).toBeInTheDocument();
  });

  it('창업자 리포트의 없는 동네는 페이지 안에서 찾을 수 없음을 안내한다', async () => {
    renderApp(['/founder/areas/unknown/report']);

    expect(await screen.findByText('찾을 수 없는 동네예요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '입지 찾기로' })).toHaveAttribute(
      'href',
      '/founder?category=fruit-vegetable',
    );
  });

  it('사장님 동네 상세의 없는 동네는 페이지 안에서 찾을 수 없음을 안내한다', async () => {
    renderApp(['/merchant/areas/unknown']);

    expect(await screen.findByText('찾을 수 없는 동네예요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '동네 목록으로' })).toHaveAttribute(
      'href',
      '/merchant',
    );
  });
});

describe('하단 내비게이션', () => {
  it.each(['/resident', '/resident/requests/new', '/resident/requests'])(
    '%s 에서는 표시된다',
    async (path) => {
      renderApp([path]);

      await screen.findByRole('heading', { level: 1 });
      expect(screen.getByRole('navigation', { name: '주민 메뉴' })).toBeInTheDocument();
    },
  );

  it.each(['/', '/merchant', '/merchant/areas/guseong', '/founder'])(
    '%s 에서는 숨겨진다',
    async (path) => {
      renderApp([path]);

      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    },
  );
});
