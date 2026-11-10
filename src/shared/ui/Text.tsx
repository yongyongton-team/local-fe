import type { ElementType, HTMLAttributes } from 'react';
import styles from './Text.module.css';

/**
 * 시각 스타일.
 * - title / contents / caption: 디자인 시스템 기본 스타일
 * - display: 디자인 시스템 밖의 개별 화면 스타일(온보딩 큰 제목)
 */
export type TextVariant = 'display' | 'title' | 'contents' | 'caption';

type TextTag = 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4';

interface TextProps extends HTMLAttributes<HTMLElement> {
  /** HTML 의미. 시각 스타일(variant)과 별개로 문서 구조에 맞게 고른다. 기본 p */
  as?: TextTag;
  /** 시각 스타일. 기본 contents */
  variant?: TextVariant;
}

/** 시각 스타일과 HTML 태그를 분리하는 텍스트 컴포넌트. 예: <Text as="h2" variant="title"> */
export function Text({ as = 'p', variant = 'contents', className, ...props }: TextProps) {
  const Tag: ElementType = as;
  return <Tag className={[styles[variant], className].filter(Boolean).join(' ')} {...props} />;
}
