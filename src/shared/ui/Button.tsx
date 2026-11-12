import type { ComponentProps } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';

/**
 * - primary: 검정 배경 + 흰 텍스트. 화면의 주된 행동(시작하기, 요청 보내기 등)
 * - highlight: 라임 배경 + 검정 텍스트. 눈에 띄게 권하는 보조 행동
 * - neutral: 옅은 회색 배경 + 검정 텍스트. 취소처럼 덜 강조하는 행동
 */
type Variant = 'primary' | 'highlight' | 'neutral';

/**
 * - large: 높이 60px, 하단의 넓은 주요 버튼
 * - medium: 높이 50px. 대화상자의 버튼
 * - small: 시각적 높이 36px. 터치 영역은 44px 로 확장된다.
 */
type Size = 'large' | 'medium' | 'small';

interface StyleProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

function className({ variant = 'primary', size = 'large', fullWidth = false }: StyleProps) {
  return [styles.button, styles[variant], styles[size], fullWidth ? styles.fullWidth : '']
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends ComponentProps<'button'>, StyleProps {
  /** 처리 중. 중복 실행을 막고 보조 기술에 "처리 중"을 알린다. */
  loading?: boolean;
}

/** 동작을 수행하는 버튼. 화면 이동에는 LinkButton 을 쓴다. */
export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  type = 'button',
  onClick,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={className({ variant, size, fullWidth })}
      // loading 중에도 포커스를 유지하려고 native disabled 대신 aria-disabled 를 쓰고 클릭만 막는다.
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={loading ? (event) => event.preventDefault() : onClick}
      {...props}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
      {/* span 바깥의 공백 덕분에 "요청 보내기 처리 중"처럼 띄어 읽는다. */}
      {loading && ' '}
      {loading && <span className="visually-hidden">처리 중</span>}
    </button>
  );
}

/** 버튼처럼 보이는 링크. 화면 이동 용도(<a>)다. */
export function LinkButton({ variant, size, fullWidth, ...props }: LinkProps & StyleProps) {
  return <Link className={className({ variant, size, fullWidth })} {...props} />;
}
