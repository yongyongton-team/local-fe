import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { installFakeNaver } from '@/test/fakeNaverMaps';
import { renderApp } from '@/test/renderApp';

/** 주민 탐색 화면(/resident)에 실제 지도(가짜 SDK)를 적용했을 때의 연결을 검증한다. */
async function openResident() {
  const user = userEvent.setup();
  renderApp();
  await screen.findByRole('option', { name: '기흥구 구성동' });
  await user.click(screen.getByRole('radio', { name: /^주민/ }));
  await user.click(screen.getByRole('button', { name: '시작하기' }));
  return user;
}

const labels = (attached: { options: { icon: { content: HTMLElement } } }[]) =>
  attached.map(
    (m) => m.options.icon.content.textContent || m.options.icon.content.getAttribute('aria-label'),
  );

describe('주민 탐색 화면의 네이버 지도', () => {
  it('마커 데이터가 도착하면 지도에 마커 9개가 생기고 칩 필터로 마커만 바뀐다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    const fake = installFakeNaver();
    const user = await openResident();

    await screen.findByRole('region', { name: '동네 지도(예시)' });
    await waitFor(() => expect(fake.attached()).toHaveLength(9));
    expect(fake.maps.filter((m) => m.destroy.mock.calls.length === 0)).toHaveLength(1);
    // 서비스 계층이 준 임시 좌표를 쓴다.
    expect(fake.attached()[0]!.options.position.lat).toBeGreaterThan(37.2);

    await user.click(screen.getByRole('radio', { name: '없는 가게' }));
    await waitFor(() => expect(fake.attached()).toHaveLength(3));
    expect(labels(fake.attached()).every((t) => t?.startsWith('X : '))).toBe(true);

    await user.click(screen.getByRole('radio', { name: '있는 가게' }));
    await waitFor(() => expect(fake.attached()).toHaveLength(3));
    expect(labels(fake.attached())).toEqual(['있는 가게 위치', '있는 가게 위치', '있는 가게 위치']);

    await user.click(screen.getByRole('radio', { name: '전체' }));
    await waitFor(() => expect(fake.attached()).toHaveLength(9));
    // 지도는 한 번만 만들고 칩이 바뀌어도 다시 만들지 않는다.
    expect(fake.maps).toHaveLength(1);
    expect(fake.maps[0]!.destroy).not.toHaveBeenCalled();
    expect(fake.maps[0]!.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('하단 목록·하단 내비·요약 안내가 그대로 동작한다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    installFakeNaver();
    const user = await openResident();

    const region = await screen.findByRole('region', { name: '동네 지도(예시)' });
    expect(screen.getByRole('navigation', { name: '주민 메뉴' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '우리 동네에 없는 가게' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '주민 요청' }));
    await waitFor(() =>
      expect(within(region).getByText('현재 주민 요청 3곳 표시 중')).toBeInTheDocument(),
    );
  });

  it('인증에 실패하면 자리표시자 마커와 폴백 문구를 보여주고 칩 필터도 그대로 동작한다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    installFakeNaver();
    const user = await openResident();
    await screen.findByRole('region', { name: '동네 지도(예시)' });

    act(() => {
      window.navermap_authFailure?.();
    });

    expect(await screen.findByText('지도를 불러오지 못했어요')).toBeInTheDocument();
    const region = screen.getByRole('region', { name: '동네 지도(예시)' });
    await waitFor(() => expect(within(region).getAllByRole('listitem')).toHaveLength(9));
    await user.click(screen.getByRole('radio', { name: '없는 가게' }));
    await waitFor(() => expect(within(region).getAllByRole('listitem')).toHaveLength(3));
  });
});
