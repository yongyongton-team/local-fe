import type { ComponentProps } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Card.module.css';

/**
 * - default: 흰 배경 + 테두리
 * - accent: 라임 배경. 텍스트는 검정
 */
type Tone = 'default' | 'accent';

type CardTag = 'div' | 'section' | 'article';

function className(tone: Tone, interactive: boolean) {
  return [styles.card, styles[tone], interactive ? styles.interactive : '']
    .filter(Boolean)
    .join(' ');
}

interface CardProps extends ComponentProps<'div'> {
  as?: CardTag;
  tone?: Tone;
}

/** 정보를 담는 카드. 카드 안에 링크·버튼을 넣을 수 있지만 카드 전체를 누르게 하려면 CardLink 를 쓴다. */
export function Card({ as: Tag = 'div', tone = 'default', className: extra, ...props }: CardProps) {
  return <Tag className={[className(tone, false), extra].filter(Boolean).join(' ')} {...props} />;
}

/**
 * 카드 전체가 하나의 링크인 카드. 내부에 버튼이나 다른 링크를 넣지 않는다(중첩 인터랙티브 금지).
 */
export function CardLink({
  tone = 'default',
  className: extra,
  ...props
}: LinkProps & { tone?: Tone }) {
  return <Link className={[className(tone, true), extra].filter(Boolean).join(' ')} {...props} />;
}
