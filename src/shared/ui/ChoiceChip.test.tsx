import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChipGroup } from './ChipGroup';
import { ChoiceChip } from './ChoiceChip';

const OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'missing', label: '없는 가게' },
] as const;

function Group() {
  const [value, setValue] = useState<'all' | 'missing'>('all');
  return <ChipGroup label="필터" options={OPTIONS} value={value} onChange={setValue} />;
}

describe('ChipGroup (radio)', () => {
  it('radiogroup 의미로 선택 상태를 전달한다', () => {
    render(<Group />);

    expect(screen.getByRole('radiogroup', { name: '필터' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '전체' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '없는 가게' })).not.toBeChecked();
    // 모든 칩을 tab 으로 만들지 않는다.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('클릭하면 선택이 바뀌고 하나만 선택된다', async () => {
    const user = userEvent.setup();
    render(<Group />);

    await user.click(screen.getByText('없는 가게'));

    expect(screen.getByRole('radio', { name: '없는 가게' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '전체' })).not.toBeChecked();
  });

  it('방향키로 선택을 옮길 수 있다', async () => {
    const user = userEvent.setup();
    render(<Group />);

    await user.click(screen.getByRole('radio', { name: '전체' }));
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: '없는 가게' })).toBeChecked();
  });
});

describe('ChoiceChip', () => {
  it('toggle 은 aria-pressed 로 선택 상태를 전달하고 클릭하면 반전 값을 전달한다', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <ChoiceChip mode="toggle" selected={false} onToggle={onToggle}>
        영업 중만
      </ChoiceChip>,
    );

    const chip = screen.getByRole('button', { name: '영업 중만' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip);

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('선택된 toggle 은 aria-pressed=true 이고 체크 아이콘(숨김)이 함께 표시된다', () => {
    const { container } = render(
      <ChoiceChip mode="toggle" selected onToggle={() => {}}>
        영업 중만
      </ChoiceChip>,
    );

    expect(screen.getByRole('button', { name: '영업 중만' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // 색상 외 표시: 장식 체크 아이콘은 보조 기술에서 숨겨진다.
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('disabled 이면 선택할 수 없다', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ChoiceChip mode="radio" name="x" value="a" selected={false} disabled onSelect={onSelect}>
        비활성
      </ChoiceChip>,
    );

    expect(screen.getByRole('radio', { name: '비활성' })).toBeDisabled();
    await user.click(screen.getByText('비활성'));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
