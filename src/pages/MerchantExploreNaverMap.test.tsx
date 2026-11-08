import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { installFakeNaver } from '@/test/fakeNaverMaps';
import { renderApp } from '@/test/renderApp';

/** 사장님 탐색(/merchant)의 반경 칩과 실제 지도(가짜 SDK)의 연결. */
const GIHEUNG = { sw: { lat: 37.21, lng: 127.055 }, ne: { lat: 37.335, lng: 127.17 } };
type Bounds = { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };
const chip = (name: string) => screen.getByRole('radio', { name });

async function openMerchant() {
  vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
  const fake = installFakeNaver();
  const user = userEvent.setup();
  renderApp(['/merchant']);
  await waitFor(() => expect(fake.attachedCircles()).toHaveLength(1));
  return { fake, user };
}

describe('사장님 탐색의 반경 칩과 지도 시점', () => {
  it('기본 3km: 3km 원과 원 전체 시점', async () => {
    const { fake } = await openMerchant();

    expect(fake.circles[0]!.options.radius).toBe(3000);
    const [bounds] = fake.maps[0]!.fitBounds.mock.calls[0] as [Bounds];
    expect(bounds.ne.lat - 37.2985).toBeCloseTo(3 / 111.32, 3);
  });

  it('"기흥구 전체"를 누르면 원을 지우고 기흥구 범위로 부드럽게 이동한다', async () => {
    const { fake, user } = await openMerchant();

    await user.click(chip('기흥구 전체'));

    await waitFor(() => expect(fake.attachedCircles()).toHaveLength(0));
    expect(fake.maps[0]!.panToBounds).toHaveBeenCalledTimes(1);
    const [bounds] = fake.maps[0]!.panToBounds.mock.calls[0] as [Bounds];
    expect(bounds).toMatchObject(GIHEUNG);
    expect(fake.maps).toHaveLength(1);
  });

  it('5km·3km 로 돌아가면 기존처럼 원 반경과 원 전체 시점으로 바뀐다', async () => {
    const { fake, user } = await openMerchant();

    await user.click(chip('5km 안'));
    await waitFor(() => expect(fake.circles[0]!.setRadius).toHaveBeenCalledWith(5000));
    const [five] = fake.maps[0]!.panToBounds.mock.calls[0] as [Bounds];
    expect(five.ne.lat - 37.2985).toBeCloseTo(5 / 111.32, 3);

    await user.click(chip('기흥구 전체'));
    await user.click(chip('3km 안'));
    await waitFor(() => expect(fake.attachedCircles()).toHaveLength(1));
    expect(fake.attachedCircles()[0]!.options.radius).toBe(3000);
    const calls = fake.maps[0]!.panToBounds.mock.calls;
    const [three] = calls[calls.length - 1] as [Bounds];
    expect(three.ne.lat - 37.2985).toBeCloseTo(3 / 111.32, 3);
    expect(fake.maps).toHaveLength(1);
  });

  it('"기흥구 전체"에서도 목록은 세 동네 그대로다', async () => {
    const { user } = await openMerchant();

    await user.click(chip('기흥구 전체'));

    expect(await screen.findByText('요청 많은 순 · 기흥구 전체')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^(구성동|보정동|마북동),/ })).toHaveLength(3);
  });
});
