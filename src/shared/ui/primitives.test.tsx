import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { MobileLayout } from '@/shared/layouts/MobileLayout';
import { CardLink } from './Card';
import { IconButton } from './IconButton';
import { ArrowLeftIcon } from './icons';
import { Text } from './Text';

describe('IconButton', () => {
  it('접근 가능한 이름을 가지며 장식 아이콘은 숨겨진다', () => {
    const { container } = render(<IconButton label="뒤로 가기" icon={<ArrowLeftIcon />} />);

    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('CardLink', () => {
  it('카드 전체가 하나의 링크이며 안에 다른 인터랙티브 요소가 없다', () => {
    render(
      <MemoryRouter>
        <CardLink to="/merchant/areas/guseong" tone="accent">
          구성동
        </CardLink>
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: '구성동' });
    expect(link).toHaveAttribute('href', '/merchant/areas/guseong');
    expect(link.querySelector('a, button')).toBeNull();
  });
});

describe('Text', () => {
  it('시각 스타일과 HTML 태그를 분리한다', () => {
    render(
      <>
        <Text as="h2" variant="title">
          제목
        </Text>
        <Text as="span" variant="title">
          같은 스타일의 span
        </Text>
      </>,
    );

    expect(screen.getByRole('heading', { level: 2, name: '제목' })).toBeInTheDocument();
    expect(screen.getByText('같은 스타일의 span').tagName).toBe('SPAN');
  });
});

describe('MobileLayout', () => {
  it('header 와 bottomNav 슬롯은 선택적이며 본문은 main 안에 렌더링된다', () => {
    const { rerender } = render(<MobileLayout>본문</MobileLayout>);

    expect(screen.getByRole('main')).toHaveTextContent('본문');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    rerender(
      <MobileLayout header={<p>헤더</p>} bottomNav={<nav aria-label="하단">내비</nav>}>
        본문
      </MobileLayout>,
    );

    expect(screen.getByRole('banner')).toHaveTextContent('헤더');
    expect(screen.getByRole('navigation', { name: '하단' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('본문');
  });
});
