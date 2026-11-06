import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TextArea } from './TextArea';

describe('TextArea', () => {
  it('label 로 입력 필드를 찾을 수 있다', () => {
    render(<TextArea label="원하는 가게와 조건" />);

    expect(screen.getByLabelText('원하는 가게와 조건')).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('설명이 aria-describedby 로 연결된다', () => {
    render(<TextArea label="내용" description="자유롭게 적어 주세요." />);

    expect(screen.getByLabelText('내용')).toHaveAccessibleDescription('자유롭게 적어 주세요.');
    expect(screen.getByLabelText('내용')).not.toBeInvalid();
  });

  it('오류 메시지가 입력 필드와 연결되고 invalid 상태가 된다', () => {
    render(
      <TextArea label="내용" description="비워 둘 수 없어요." error="내용을 입력해 주세요." />,
    );

    const field = screen.getByLabelText('내용');
    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription('비워 둘 수 없어요. 내용을 입력해 주세요.');
    expect(screen.getByRole('alert')).toHaveTextContent('내용을 입력해 주세요.');
  });

  it('입력값과 변경 이벤트를 지원한다(제어 컴포넌트)', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState('');
      return (
        <>
          <TextArea label="내용" value={value} onChange={(event) => setValue(event.target.value)} />
          <output>{value.length}자</output>
        </>
      );
    }
    render(<Controlled />);

    await user.type(screen.getByLabelText('내용'), '과일가게');

    expect(screen.getByLabelText('내용')).toHaveValue('과일가게');
    expect(screen.getByText('4자')).toBeInTheDocument();
  });

  it('id 를 지정하지 않아도 여러 개를 함께 써도 label 이 섞이지 않는다', () => {
    render(
      <>
        <TextArea label="첫째" />
        <TextArea label="둘째" />
      </>,
    );

    expect(screen.getByLabelText('첫째')).not.toBe(screen.getByLabelText('둘째'));
  });
});
