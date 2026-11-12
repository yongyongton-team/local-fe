import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { installFakeNaver } from '@/test/fakeNaverMaps';
import { renderApp } from '@/test/renderApp';

/** 창업자 입지 찾기(/founder)에 실제 지도(가짜 SDK)를 적용했을 때의 연결을 검증한다. */
const select = () => screen.getByRole('combobox', { name: '어떤 가게를 열고 싶으세요?' });
const mapRegion = () => screen.getByRole('region', { name: '입지 후보 지도(예시)' });

async function openFounder(path = '/founder') {
  const user = userEvent.setup();
  renderApp([path]);
  await screen.findByRole('link', { name: /^1\./ });
  return user;
}

const labels = (attached: { options: { icon: { content: HTMLElement } } }[]) =>
  attached.map((m) => m.options.icon.content.textContent);

describe('창업자 입지 찾기의 네이버 지도', () => {
  it('키가 없으면 SDK 를 쓰지 않고 자리표시자 알약을 보여준다', async () => {
    const fake = installFakeNaver();
    await openFounder();

    expect(fake.maps).toHaveLength(0);
    expect(document.querySelectorAll('script[data-naver-map-sdk]')).toHaveLength(0);
    expect(
      within(mapRegion())
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['1. 구성동', '3. 보정동', '4. 마북동']);
    expect(screen.queryByText('지도를 불러오지 못했어요')).not.toBeInTheDocument();
  });

  it('준비되면 순위 알약 3개가 서비스가 준 좌표로 만들어진다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    const fake = installFakeNaver();
    await openFounder();

    await waitFor(() => expect(fake.attached()).toHaveLength(3));
    expect(labels(fake.attached())).toEqual(['1. 구성동', '3. 보정동', '4. 마북동']);
    for (const marker of fake.attached()) {
      expect(marker.options.position.lat).toBeGreaterThan(37.2);
      expect(marker.options.position.lat).toBeLessThan(37.4);
      expect(marker.options.position.lng).toBeGreaterThan(127.0);
      expect(marker.options.position.lng).toBeLessThan(127.2);
      // 순위 알약은 기존 어두운 알약("요청") 모양이다.
      expect(marker.options.icon.content.querySelector('.request')).not.toBeNull();
    }
    // 세 동네의 좌표는 서로 다르다.
    expect(
      new Set(fake.attached().map((m) => `${m.options.position.lat}|${m.options.position.lng}`))
        .size,
    ).toBe(3);
    expect(fake.maps[0]!.fitBounds).toHaveBeenCalledTimes(1);
    expect(mapRegion()).toBeInTheDocument();
  });

  it('업종을 바꾸면 마커만 갱신하고 지도는 다시 만들지 않으며 마커 전체가 보이게 다시 맞춘다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    const fake = installFakeNaver();
    const user = await openFounder();
    await waitFor(() => expect(fake.attached()).toHaveLength(3));
    const [map] = fake.maps;

    await user.selectOptions(select(), '반찬가게');
    await waitFor(() => expect(fake.attached()).toHaveLength(1));
    expect(labels(fake.attached())).toEqual(['1. 구성동']);
    expect(map!.setCenter).toHaveBeenCalledTimes(1); // 마커 하나: 고정 줌으로 맞춘다

    await user.selectOptions(select(), '과일 / 채소 가게');
    await waitFor(() => expect(fake.attached()).toHaveLength(3));
    expect(labels(fake.attached())).toEqual(['1. 구성동', '3. 보정동', '4. 마북동']);
    // 세 동네가 다시 모두 보이게 맞춘다(처음 한 번 + 되돌아왔을 때 한 번).
    expect(map!.fitBounds).toHaveBeenCalledTimes(2);

    expect(fake.maps).toHaveLength(1);
    expect(map!.destroy).not.toHaveBeenCalled();
  });

  it('반찬 업종으로 먼저 들어와도 과일로 바꾸면 멀리 있는 동네까지 보이게 다시 맞춘다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    const fake = installFakeNaver();
    const user = await openFounder('/founder?category=side-dish');
    await waitFor(() => expect(fake.attached()).toHaveLength(1));
    expect(fake.maps[0]!.fitBounds).not.toHaveBeenCalled();

    await user.selectOptions(select(), '과일 / 채소 가게');

    await waitFor(() => expect(fake.attached()).toHaveLength(3));
    expect(fake.maps[0]!.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('업종 요약은 지도의 보이지 않는 aria-live 로 알리고 순위 목록은 그대로 있다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    installFakeNaver();
    const user = await openFounder();

    const live = await within(mapRegion()).findByText('과일 / 채소 가게 기준 동네 3곳 표시 중');
    expect(live).toHaveAttribute('aria-live', 'polite');
    await user.selectOptions(select(), '빵집');
    await within(mapRegion()).findByText('빵집 기준 동네 1곳 표시 중');
    expect(screen.getAllByRole('link', { name: /^1\. 구성동/ })).toHaveLength(1);
  });

  it('인증에 실패하면 폴백 문구와 자리표시자 알약을 보여주고 업종 변경도 동작한다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    installFakeNaver();
    const user = await openFounder();
    await waitFor(() => expect(mapRegion()).toBeInTheDocument());

    act(() => {
      window.navermap_authFailure?.();
    });

    expect(await screen.findByText('지도를 불러오지 못했어요')).toBeInTheDocument();
    await waitFor(() => expect(within(mapRegion()).getAllByRole('listitem')).toHaveLength(3));
    await user.selectOptions(select(), '반찬가게');
    await waitFor(() => expect(within(mapRegion()).getAllByRole('listitem')).toHaveLength(1));
  });

  it('SDK 가 예외를 던져도 앱은 멈추지 않고 폴백을 보여준다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    installFakeNaver();
    vi.spyOn(window.naver.maps, 'Map').mockImplementation(() => {
      throw new Error('sdk broken');
    });
    await openFounder();

    expect(await screen.findByText('지도를 불러오지 못했어요')).toBeInTheDocument();
    expect(within(mapRegion()).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /^1\. 구성동/ })).toBeInTheDocument();
  });

  it('하단 내비게이션이 없고 사람들 버튼만 있다(검색 없음)', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    installFakeNaver();
    await openFounder();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '검색' })).not.toBeInTheDocument();
  });
});
