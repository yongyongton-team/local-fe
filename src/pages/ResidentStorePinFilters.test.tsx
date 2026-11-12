import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeNaver, type FakeNaver } from '@/test/fakeNaverMaps';
import { renderApp } from '@/test/renderApp';

/**
 * 주민 지도에서 가게(검은 핀)를 눌렀을 때 "가게 이름 · 업종"이 보이는지, 지도 필터 4가지마다 확인한다(목 서비스 + 가짜 지도).
 * 회귀: 목 모드에서 카드에 마커의 보조 기술용 문구 "있는 가게 위치"가 제목으로 보이던 문제.
 */
async function openResident(): Promise<{
  fake: FakeNaver;
  user: ReturnType<typeof userEvent.setup>;
}> {
  vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
  const fake = installFakeNaver();
  const user = userEvent.setup();
  renderApp();
  await screen.findByRole('option', { name: '기흥구 구성동' });
  await user.selectOptions(screen.getByLabelText('내 동네'), 'guseong');
  await user.click(screen.getByRole('radio', { name: /^주민/ }));
  await user.click(screen.getByRole('button', { name: '시작하기' }));
  await screen.findByRole('heading', { level: 1, name: '동네 탐색' });
  await waitFor(() => expect(fake.attached().length).toBeGreaterThan(0));
  return { fake, user };
}

const stores = (fake: FakeNaver) => fake.attached().filter((m) => m.options.clickable);
/** 지금 보이는 가게 정보 카드의 글자(닫기 버튼과 한 묶음). 없으면 null */
const cardText = () =>
  screen.queryByRole('button', { name: '가게 정보 닫기' })?.parentElement?.textContent ?? null;
const chip = (name: string) => screen.getByRole('radio', { name });

afterEach(() => vi.restoreAllMocks());

describe('가게 핀을 누르면 지도 필터와 관계없이 이름이 보인다(목)', () => {
  it('전체: 가게 핀을 누르면 가게 이름이 보이고 "있는 가게 위치"가 제목으로 보이지 않는다', async () => {
    const { fake } = await openResident();
    expect(stores(fake).length).toBeGreaterThan(0);

    act(() => stores(fake)[0]!.click());

    expect(cardText()).toMatch(/^예시 가게 1/);
    expect(cardText()).not.toContain('있는 가게 위치');
  });

  it('있는 가게: 필터를 켜고 가게 핀을 누르면 같은 정보 카드가 보인다', async () => {
    const { fake, user } = await openResident();
    await user.click(chip('있는 가게'));
    expect(chip('있는 가게')).toBeChecked();

    // 가게 핀만 남는다.
    expect(fake.attached().every((m) => m.options.clickable)).toBe(true);
    act(() => stores(fake)[1]!.click());

    expect(cardText()).toMatch(/^예시 가게 2/);
    expect(cardText()).not.toContain('있는 가게 위치');
  });

  it('있는 가게: 다른 핀을 누르면 카드가 교체된다(한 번에 하나)', async () => {
    const { fake, user } = await openResident();
    await user.click(chip('있는 가게'));

    act(() => stores(fake)[0]!.click());
    act(() => stores(fake)[2]!.click());

    expect(cardText()).toMatch(/^예시 가게 3/);
    expect(screen.getAllByRole('button', { name: '가게 정보 닫기' })).toHaveLength(1);
  });

  it.each(['없는 가게', '주민 요청'])(
    '%s: 가게 핀이 지도에 없어 누를 수 없고, 열려 있던 카드는 필터를 바꾸면 사라진다',
    async (filter) => {
      const { fake, user } = await openResident();
      act(() => stores(fake)[0]!.click());
      expect(cardText()).not.toBeNull();

      await user.click(chip(filter));

      expect(stores(fake)).toHaveLength(0);
      expect(cardText()).toBeNull();
    },
  );

  it('가게 핀을 누르고 필터를 "있는 가게"로 바꿔도 같은 가게의 카드가 계속 보인다', async () => {
    const { fake, user } = await openResident();
    act(() => stores(fake)[0]!.click());

    await user.click(chip('있는 가게'));

    expect(cardText()).toMatch(/^예시 가게 1/);
  });

  it('카드는 지도 영역 안에 있고 필터 칩·하단 내비를 가리지 않는다', async () => {
    const { fake } = await openResident();
    act(() => stores(fake)[0]!.click());

    const card = screen.getByRole('button', { name: '가게 정보 닫기' }).parentElement!;
    expect(
      within(screen.getByRole('radiogroup', { name: '지도 필터' })).getAllByRole('radio'),
    ).toHaveLength(4);
    expect(card.closest('nav')).toBeNull();
    expect(card.closest('[role="radiogroup"]')).toBeNull();
    expect(screen.getByRole('navigation', { name: '주민 메뉴' })).toBeInTheDocument();
  });
});
