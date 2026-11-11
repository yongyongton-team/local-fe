/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { act, screen, waitFor, within } from '@testing-library/react';
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

  it('"내 가게"는 "가게명 · 업종" 값과 함께 내 가게 화면(/me/shop)으로 가는 링크이고 > 가 있다', async () => {
    await openMyInfo(me({ role: 'merchant', shop: SHOP }));

    const row = screen.getByRole('link', { name: /내 가게/ });
    expect(row).toHaveAttribute('href', '/me/shop');
    expect(row).toHaveTextContent('싱싱과일 · 과일·채소');
    expect(row.querySelector('svg')).not.toBeNull();
    // "내 동네" 행과 같은 모양이다(둘 다 > 가 있다).
    expect(screen.getByRole('link', { name: /내 동네/ }).querySelector('svg')).not.toBeNull();
  });

  it('사장님인데 가게가 아직 없으면 임시 문구 "등록하기"를 보여주고, 눌러서 등록 화면으로 들어간다', async () => {
    const user = userEvent.setup();
    const { router } = await openMyInfo(me({ role: 'merchant', shop: null }));

    const row = screen.getByRole('link', { name: /내 가게/ });
    expect(row).toHaveTextContent('등록하기');
    expect(row).toHaveAttribute('href', '/me/shop');

    await user.click(row);
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/shop'));
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

describe('내 정보: 일러스트', () => {
  // 빛 번짐 svg 는 작아서 이미지 경로가 아니라 data URI 로 들어올 수 있다. 일러스트 영역 안의 이미지를 읽는다.
  const illustration = () => [...document.querySelectorAll<HTMLImageElement>('main .area img')];
  const characters = () => illustration().filter((img) => img.dataset.active !== undefined);
  const glows = () => illustration().filter((img) => img.dataset.active === undefined);
  const activeRoles = () =>
    characters()
      .filter((img) => img.dataset.active === 'true')
      .map((img) => img.dataset.role);

  it('사장님·주민·예비 창업자와 빛 번짐 이미지 4개가 장식(alt 없음)으로 렌더되고 크기 속성이 있다', async () => {
    await openMyInfo(me());

    expect(illustration()).toHaveLength(4);
    expect(characters()).toHaveLength(3);
    expect(glows()).toHaveLength(1);
    for (const img of illustration()) {
      expect(img).toHaveAttribute('alt', '');
      expect(img).toHaveAttribute('width');
      expect(img).toHaveAttribute('height');
      // 보조 기술에서 숨긴다(이미지를 감싼 영역이 aria-hidden).
      expect(img.closest('[aria-hidden="true"]')).not.toBeNull();
    }
    // 가로세로 속성은 에셋 원본 크기다(높이로만 크기를 정하고 가로는 자동). 비율은 디자인과 같다.
    const byRole = (role: string) => characters().find((img) => img.dataset.role === role)!;
    expect([byRole('resident').width, byRole('resident').height]).toEqual([465, 594]);
    expect([byRole('owner').width, byRole('owner').height]).toEqual([441, 594]);
    expect([byRole('founder').width, byRole('founder').height]).toEqual([428, 594]);
    expect([glows()[0]!.width, glows()[0]!.height]).toEqual([245, 245]);
    expect(byRole('resident').src).toContain('my-info-resident');
    expect(byRole('owner').src).toContain('my-info-owner');
    expect(byRole('founder').src).toContain('my-info-founder');
  });

  it.each([
    ['resident', 'resident'],
    ['merchant', 'owner'],
    ['founder', 'founder'],
  ] as const)('역할 %s 이면 %s 캐릭터만 활성이고 나머지는 비활성이다', async (role, expected) => {
    await openMyInfo(me({ role }));

    expect(
      characters()
        .map((img) => `${img.dataset.role}:${img.dataset.active}`)
        .sort(),
    ).toEqual(['resident', 'owner', 'founder'].map((r) => `${r}:${r === expected}`).sort());
    expect(activeRoles()).toEqual([expected]);
  });

  it.each([
    ['resident', 'resident'],
    ['merchant', 'owner'],
    ['founder', 'founder'],
  ] as const)('빛 번짐은 하나뿐이고 활성 역할(%s → %s) 뒤에 있다', async (role, expected) => {
    await openMyInfo(me({ role }));

    expect(glows()).toHaveLength(1);
    expect(glows()[0]!.dataset.role).toBe(expected);
    expect(glows()[0]!.dataset.role).toBe(activeRoles()[0]);
  });

  it('역할이 없으면 디자인 기준 상태(사장님 활성)다', async () => {
    await openMyInfo(me({ role: null }));

    expect(activeRoles()).toEqual(['owner']);
    expect(glows()[0]!.dataset.role).toBe('owner');
    // 역할 칩에는 아무것도 선택되어 있지 않다(일러스트만 디자인 기준으로 둔다).
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
  });

  it('역할 변경을 저장하는 동안에는 칩에 보이는(선택 중인) 역할을 따라가고, 실패하면 원래 역할로 돌아간다', async () => {
    const user = userEvent.setup();
    const gate: { fail: () => void } = { fail: () => {} };
    // 서버에 저장하는 구현처럼 보이게 하고, 저장이 끝나지 않는 상태를 만든다.
    Object.defineProperty(meService, 'savesRemotely', { value: true, configurable: true });
    vi.spyOn(meService, 'saveSelection').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          gate.fail = () => reject(new Error('x'));
        }),
    );
    try {
      await openMyInfo(me({ role: 'resident' }));
      expect(activeRoles()).toEqual(['resident']);

      await user.click(screen.getByRole('radio', { name: '예비 창업자' }));

      expect(screen.getByRole('radio', { name: '예비 창업자' })).toBeChecked();
      expect(activeRoles()).toEqual(['founder']);
      expect(glows()[0]!.dataset.role).toBe('founder');

      await act(async () => gate.fail());
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '주민' })).toBeChecked();
      expect(activeRoles()).toEqual(['resident']);
      expect(glows()[0]!.dataset.role).toBe('resident');
    } finally {
      Reflect.deleteProperty(meService, 'savesRemotely');
      Object.defineProperty(meService, 'savesRemotely', { value: false, configurable: true });
    }
  });

  it('역할 변경을 저장하는 동안 "내 가게" 행은 저장된 역할을 따라 그대로 있다(화면이 밀리지 않는다)', async () => {
    const user = userEvent.setup();
    Object.defineProperty(meService, 'savesRemotely', { value: true, configurable: true });
    vi.spyOn(meService, 'saveSelection').mockImplementation(() => new Promise(() => {}));
    try {
      await openMyInfo(me({ role: 'merchant', shop: SHOP }));
      expect(screen.getByRole('link', { name: /내 가게/ })).toBeInTheDocument();

      await user.click(screen.getByRole('radio', { name: '주민' }));

      expect(activeRoles()).toEqual(['resident']);
      expect(screen.getByRole('link', { name: /내 가게/ })).toBeInTheDocument();
    } finally {
      Object.defineProperty(meService, 'savesRemotely', { value: false, configurable: true });
    }
  });

  it('일러스트 CSS: 활성만 불투명·큰 크기·위, 비활성만 투명도 50%·작은 크기·낮은 자리다', () => {
    const css = readFileSync('src/features/my-info/MyInfoIllustration.module.css', 'utf8');
    const tokens = readFileSync('src/shared/styles/tokens.css', 'utf8');
    // 선택자(쉼표·줄바꿈 포함)가 같은 규칙의 본문을 꺼낸다.
    const body = (selector: string) =>
      css
        .split('}')
        .map((block) => block.split('{'))
        .find(
          ([head]) =>
            (head ?? '')
              .replace(/\/\*[\s\S]*?\*\//g, '')
              .replace(/\s+/g, ' ')
              .trim() === selector,
        )?.[1] ?? '';

    expect(tokens).toMatch(/--illust-inactive-opacity:\s*0\.5;/);
    expect(body(".character[data-active='false']")).toContain(
      'opacity: var(--illust-inactive-opacity)',
    );
    expect(body(".character[data-active='false']")).toContain(
      'height: var(--illust-inactive-height)',
    );
    expect(body(".character[data-active='true']")).toContain('opacity: 1');
    expect(body(".character[data-active='true']")).toContain('height: var(--illust-active-height)');
    expect(body(".character[data-active='true']")).toContain(
      'top: calc(var(--illust-active-top) + var(--dy, 0%))',
    );
    expect(body('.glow')).not.toContain('opacity');
    // 활성 캐릭터와 빛 번짐은 같은 가로 중심(슬롯)을 쓰고, 화면 밖으로 나가면 안쪽으로만 민다(clamp).
    const clamp = 'clamp(var(--active-min), var(--slot), var(--active-max))';
    // 활성 캐릭터는 clamp 한 중심에 옆 캐릭터와 벌리는 이동(--dx)만 더한다. 빛 번짐은 clamp 만 쓴다(활성을 따라가되 화면 안).
    expect(body(".character[data-active='true']")).toContain(
      `left: calc(${clamp} + var(--dx, 0%))`,
    );
    expect(body('.glow')).toContain(`left: ${clamp}`);
    // 활성이 위에 보인다.
    expect(body(".character[data-active='true']")).toContain('z-index: 2');
    expect(body(".character[data-active='false']")).toContain('z-index: 1');
    // 크기는 높이로만 정하고 가로는 자동이다.
    expect(body('.glow, .character')).toContain('width: auto');
    // 움직임 줄이기 설정이면 전환을 쓰지 않는다(전환은 no-preference 안에만 있다).
    const transitionAt = css.indexOf('transition:');
    expect(transitionAt).toBeGreaterThan(css.indexOf('prefers-reduced-motion: no-preference'));
    expect(css.slice(0, css.indexOf('@media'))).not.toContain('transition');
  });
});

describe('내 정보: 활성 캐릭터와 옆 캐릭터가 겹치지 않게 벌리는 이동', () => {
  const css = readFileSync('src/features/my-info/MyInfoIllustration.module.css', 'utf8');
  const tokens = readFileSync('src/shared/styles/tokens.css', 'utf8');
  const token = (name: string) => {
    const value = new RegExp(`${name}:\\s*(-?[\\d.]+)(%?)`).exec(tokens);
    if (!value) throw new Error(`토큰 없음: ${name}`);
    return Number(value[1]);
  };
  const rule = (selector: string) =>
    css
      .split('}')
      .map((block) => block.split('{'))
      .find(
        ([head]) =>
          (head ?? '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ')
            .trim() === selector,
      )?.[1] ?? '';

  // 402px 화면의 일러스트 영역(362×266) 안 좌표(px). 이미지 너비는 높이 × 가로세로 비율(에셋 원본 크기)이다.
  const AREA = 362;
  const AREA_H = 266;
  const ratio = { resident: 465 / 594, owner: 441 / 594, founder: 428 / 594 } as const;
  const slot = (role: keyof typeof ratio) => (token(`--illust-slot-${role}`) / 100) * AREA;
  const ACTIVE_H = (token('--illust-active-height') / 100) * AREA_H;
  const INACTIVE_H = (token('--illust-inactive-height') / 100) * AREA_H;
  const GLOW = (token('--illust-glow-width') / 100) * AREA;
  const GUTTER = 20;
  /** 활성 캐릭터의 가로 중심: 슬롯 중심을 빛 번짐이 화면 안에 들어오게 clamp 한 뒤 이동(dx)을 더한다. */
  const activeCenter = (role: keyof typeof ratio, dx: number) =>
    Math.min(Math.max(slot(role), GLOW / 2 - GUTTER), AREA + GUTTER - GLOW / 2) + (dx / 100) * AREA;
  const span = (center: number, role: keyof typeof ratio, height: number) => {
    const width = ratio[role] * height;
    return [center - width / 2, center + width / 2] as const;
  };
  /** 두 이미지 상자의 가로 겹침 폭(px). 음수는 떨어져 있는 간격이다. */
  const overlap = (a: readonly [number, number], b: readonly [number, number]) =>
    Math.min(a[1], b[1]) - Math.max(a[0], b[0]);

  it('예비 창업자가 활성이면 활성은 오른쪽으로, 사장님(비활성)은 왼쪽으로 옮기고 둘 다 위로 옮긴다', () => {
    expect(token('--illust-founder-active-dx')).toBeGreaterThan(0);
    expect(token('--illust-founder-active-dy')).toBeLessThan(0);
    expect(token('--illust-founder-owner-dx')).toBeLessThan(0);
    expect(token('--illust-founder-owner-dy')).toBeLessThan(0);
    expect(rule(".illustration[data-active-role='founder'] .founder")).toContain(
      '--dx: var(--illust-founder-active-dx)',
    );
    expect(rule(".illustration[data-active-role='founder'] .owner")).toContain(
      '--dx: var(--illust-founder-owner-dx)',
    );
  });

  it('주민이 활성이면 활성은 왼쪽으로, 사장님(비활성)은 오른쪽으로 옮기고 둘 다 위로 옮긴다', () => {
    expect(token('--illust-resident-active-dx')).toBeLessThan(0);
    expect(token('--illust-resident-active-dy')).toBeLessThan(0);
    expect(token('--illust-resident-owner-dx')).toBeGreaterThan(0);
    expect(token('--illust-resident-owner-dy')).toBeLessThan(0);
    expect(rule(".illustration[data-active-role='resident'] .resident")).toContain(
      '--dx: var(--illust-resident-active-dx)',
    );
    expect(rule(".illustration[data-active-role='resident'] .owner")).toContain(
      '--dx: var(--illust-resident-owner-dx)',
    );
  });

  it('사장님이 활성인 상태(디자인 기준)에는 이동 규칙이 없다', () => {
    expect(css).not.toContain("data-active-role='owner'");
    expect(css).not.toContain("data-active-role='merchant'");
  });

  it('빛 번짐은 활성이 올라간 만큼의 절반만 올라간다(가로는 활성을 따라 clamp)', () => {
    expect(token('--illust-glow-dy-ratio')).toBe(0.5);
    expect(rule(".illustration[data-active-role='founder'] .glow")).toContain(
      'calc(var(--illust-founder-active-dy) * var(--illust-glow-dy-ratio))',
    );
    expect(rule(".illustration[data-active-role='resident'] .glow")).toContain(
      'calc(var(--illust-resident-active-dy) * var(--illust-glow-dy-ratio))',
    );
  });

  it('402px 기준 겹침 폭: 예비 창업자 활성 ↔ 사장님 약 45px → 거의 0, 주민 활성 ↔ 사장님 약 52px → 거의 0', () => {
    const owner = (dx: number) => span(slot('owner') + (dx / 100) * AREA, 'owner', INACTIVE_H);

    const founderBefore = overlap(span(activeCenter('founder', 0), 'founder', ACTIVE_H), owner(0));
    const founderAfter = overlap(
      span(activeCenter('founder', token('--illust-founder-active-dx')), 'founder', ACTIVE_H),
      owner(token('--illust-founder-owner-dx')),
    );
    expect(founderBefore).toBeGreaterThan(40);
    expect(founderAfter).toBeLessThan(founderBefore - 40);
    expect(founderAfter).toBeLessThanOrEqual(1);

    const residentBefore = overlap(
      span(activeCenter('resident', 0), 'resident', ACTIVE_H),
      owner(0),
    );
    const residentAfter = overlap(
      span(activeCenter('resident', token('--illust-resident-active-dx')), 'resident', ACTIVE_H),
      owner(token('--illust-resident-owner-dx')),
    );
    expect(residentBefore).toBeGreaterThan(45);
    expect(residentAfter).toBeLessThan(residentBefore - 45);
    expect(residentAfter).toBeLessThanOrEqual(1);
  });

  it('활성 캐릭터가 오른쪽(왼쪽)에 있고 비활성 사장님과 겹치는 옆 캐릭터가 늘지 않으며 화면 가장자리에서 12px 이상 안쪽이다(402px)', () => {
    const founder = span(
      activeCenter('founder', token('--illust-founder-active-dx')),
      'founder',
      ACTIVE_H,
    );
    const owner = span(
      slot('owner') + (token('--illust-founder-owner-dx') / 100) * AREA,
      'owner',
      INACTIVE_H,
    );
    // 활성 예비 창업자가 사장님보다 오른쪽이다.
    expect(founder[0]).toBeGreaterThan(owner[0]);
    expect((founder[0] + founder[1]) / 2).toBeGreaterThan((owner[0] + owner[1]) / 2);
    // 사장님은 왼쪽의 비활성 주민(0~슬롯 폭)과도 겹치지 않는다.
    const residentInactive = span(slot('resident'), 'resident', INACTIVE_H);
    expect(overlap(owner, residentInactive)).toBeLessThanOrEqual(0);
    // 화면 가장자리까지의 거리: 영역 왼쪽 끝이 화면에서 20px 안쪽이다.
    expect(founder[1] + GUTTER).toBeLessThanOrEqual(AREA + 2 * GUTTER - 12);
    const resident = span(
      activeCenter('resident', token('--illust-resident-active-dx')),
      'resident',
      ACTIVE_H,
    );
    expect(resident[0] + GUTTER).toBeGreaterThanOrEqual(12);
    const ownerForResident = span(
      slot('owner') + (token('--illust-resident-owner-dx') / 100) * AREA,
      'owner',
      INACTIVE_H,
    );
    const founderInactive = span(slot('founder'), 'founder', INACTIVE_H);
    expect(overlap(ownerForResident, founderInactive)).toBeLessThanOrEqual(0);
  });

  it('component: 일러스트 영역에 활성 역할(data-active-role)이 표시된다', async () => {
    await openMyInfo(me({ role: 'founder' }));

    expect(document.querySelector('main .area > div')).toHaveAttribute(
      'data-active-role',
      'founder',
    );
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
