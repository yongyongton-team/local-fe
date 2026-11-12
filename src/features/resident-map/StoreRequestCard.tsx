import { Link } from 'react-router';
import { paths } from '@/shared/lib/paths';
import { Card } from '@/shared/ui/Card';
import { PersonCircleCheckIcon, PersonCirclePlusIcon } from '@/shared/ui/icons';
import type { StoreCategory } from '@/types/domain';
import { QUICK_REQUEST_COPY } from './copy';
import styles from './StoreRequestCard.module.css';

interface StoreRequestCardProps {
  category: StoreCategory;
  requestCount: number;
  /** 값이 있을 때만 "/ 대형마트 N km" 를 보여준다. */
  nearestHypermarketKm?: number;
  /** 내가 요청함이면 ✓ 아이콘(내 요청 보기 링크), 아니면 + 아이콘(나도 요청) */
  requestedByMe: boolean;
  /** 사람+ 를 눌렀을 때(내가 요청하지 않은 카드). 간편 요청 창을 연다. */
  onRequest: (category: StoreCategory) => void;
}

/**
 * 요청 카드: 업종 제목, 요청 수, 대형마트 거리(값이 있을 때만), 내 요청 상태 아이콘.
 * "우리 동네에 없는 가게"와 "주민이 요청한 가게" 목록이 함께 쓴다.
 * 카드 자체는 누를 수 없고, 오른쪽 아이콘만 누를 수 있다.
 * - 사람+ (내가 요청하지 않음): 누르면 "나도 요청" 창이 열린다.
 * - 사람✓ (내가 요청함): 누르면 내 요청 화면으로 간다.
 */
export function StoreRequestCard({
  category,
  requestCount,
  nearestHypermarketKm,
  requestedByMe,
  onRequest,
}: StoreRequestCardProps) {
  return (
    <Card tone="accent" className={styles.card}>
      <span className={styles.text}>
        <span className={styles.title}>{category.cardTitle}</span>
        <span className={styles.description}>
          주민 {requestCount}명이 요청
          {nearestHypermarketKm !== undefined && ` / 대형마트 ${nearestHypermarketKm}km`}
        </span>
      </span>
      {/* 아이콘만 있는 컨트롤이라 이름을 aria-label 로 전달한다. 터치 영역은 44px 이상이다. */}
      {requestedByMe ? (
        <Link
          to={paths.residentRequests}
          className={styles.status}
          aria-label={QUICK_REQUEST_COPY.viewMyRequestsLabel}
        >
          <PersonCircleCheckIcon />
        </Link>
      ) : (
        <button
          type="button"
          className={styles.status}
          aria-label={QUICK_REQUEST_COPY.addRequestLabel}
          onClick={() => onRequest(category)}
        >
          <PersonCirclePlusIcon />
        </button>
      )}
    </Card>
  );
}
