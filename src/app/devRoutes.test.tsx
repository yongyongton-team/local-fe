import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';
import { createRoutes } from './routes';

describe('개발 전용 /dev/design-system', () => {
  it('개발 환경 라우트에서는 렌더링된다', async () => {
    renderApp(['/dev/design-system']);

    expect(
      await screen.findByRole('heading', { level: 1, name: '디자인 시스템 확인' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '색상' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '버튼' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '지도 필터 예시' })).toBeInTheDocument();
  });

  it('프로덕션 라우트 구성(개발 전용 라우트 없음)에서는 Not Found 로 처리된다', async () => {
    renderApp(['/dev/design-system'], createRoutes());

    expect(
      await screen.findByRole('heading', { level: 1, name: '찾을 수 없음' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('디자인 시스템 확인')).not.toBeInTheDocument();
  });
});
