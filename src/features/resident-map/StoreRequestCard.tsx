import { Link } from 'react-router';
import { paths } from '@/shared/lib/paths';
import { Card } from '@/shared/ui/Card';
import { PersonCircleCheckIcon, PersonCirclePlusIcon } from '@/shared/ui/icons';
import type { NeighborhoodReport } from '@/types/domain';
import { QUICK_REQUEST_COPY } from './copy';
import styles from './StoreRequestCard.module.css';

interface StoreRequestCardProps {
  report: NeighborhoodReport;
  /** 사람+ 를 눌렀을 때(내가 요청하지 않은 카드). 간편 요청 창을 연다. */
  onRequest: (report: NeighborhoodReport) => void;
}

/**
 * 요청 카드: 업종 제목, 요청 수, 대형마트 거리(값이 있을 때만), 내 요청 상태 아이콘.
 * 카드 자체는 누를 수 없고, 오른쪽 아이콘만 누를 수 있다.
 * - 사람+ (내가 요청하지 않음): 누르면 "나도 요청" 창이 열린다.
 * - 사람✓ (내가 요청함): 누르면 내 요청 화면으로 간다.
 */
export function StoreRequestCard({ report, onRequest }: StoreRequestCardProps) {
  const { category, demand } = report;
  const requestedByMe = demand.requestedByMe === true;

  return (
    <Card tone="accent" className={styles.card}>
      <span className={styles.text}>
        <span className={styles.title}>{category.cardTitle}</span>
        <span className={styles.description}>
          주민 {demand.requestCount}명이 요청
          {demand.nearestHypermarketKm !== undefined &&
            ` / 대형마트 ${demand.nearestHypermarketKm}km`}
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
          onClick={() => onRequest(report)}
        >
          <PersonCirclePlusIcon />
        </button>
      )}
    </Card>
  );
}
