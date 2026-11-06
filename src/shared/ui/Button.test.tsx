import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('클릭하면 onClick 을 호출하고 기본 type 은 button 이다', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>저장</Button>);

    const button = screen.getByRole('button', { name: '저장' });
    expect(button).toHaveAttribute('type', 'button');
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled 이면 클릭해도 onClick 을 호출하지 않는다', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        저장
      </Button>,
    );

    const button = screen.getByRole('button', { name: '저장' });
    expect(button).toBeDisabled();
    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading 중에는 중복 실행을 막고 처리 중 상태를 알린다', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        요청 보내기
      </Button>,
    );

    const button = screen.getByRole('button', { name: /요청 보내기/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleName('요청 보내기 처리 중');
    // 포커스는 유지된다(native disabled 가 아님).
    expect(button).toBeEnabled();

    await user.click(button);
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading 중 submit 버튼은 폼을 제출하지 않는다', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading>
          제출
        </Button>
      </form>,
    );

    await user.click(screen.getByRole('button', { name: /제출/ }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('loading 이 아니면 aria-busy / aria-disabled 를 달지 않는다', () => {
    render(<Button>저장</Button>);

    const button = screen.getByRole('button', { name: '저장' });
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button).not.toHaveAttribute('aria-disabled');
  });
});
