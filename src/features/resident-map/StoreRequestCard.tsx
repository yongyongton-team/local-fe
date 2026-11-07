import { Card } from '@/shared/ui/Card';
import { PersonCircleCheckIcon, PersonCirclePlusIcon } from '@/shared/ui/icons';
import type { NeighborhoodReport } from '@/types/domain';
import styles from './StoreRequestCard.module.css';

/**
 * 요청 카드: 업종 제목, 요청 수, 대형마트 거리(값이 있을 때만), 내 요청 상태 아이콘.
 * 카드 자체는 누를 수 없고 정보만 보여준다.
 */
export function StoreRequestCard({ report }: { report: NeighborhoodReport }) {
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
      {/* 아이콘만으로 전달하지 않도록 상태를 보이지 않는 텍스트로도 제공한다. */}
      <span className={styles.status}>
        {requestedByMe ? <PersonCircleCheckIcon /> : <PersonCirclePlusIcon />}
        <span className="visually-hidden">
          {requestedByMe ? '내가 요청함' : '내가 요청하지 않음'}
        </span>
      </span>
    </Card>
  );
}
