import { Card, CardLink } from '@/shared/ui/Card';
import type { NeighborhoodReport } from '@/types/domain';
import styles from './DemandCard.module.css';

interface DemandCardProps {
  title: string;
  report: NeighborhoodReport;
  /** 지정하면 카드 전체가 해당 경로로 이동하는 링크가 된다. */
  to?: string;
}

/** 동네·업종별 수요 수치 요약 카드. */
export function DemandCard({ title, report, to }: DemandCardProps) {
  const { demand } = report;
  const content = (
    <span className={styles.content}>
      <span className={styles.title}>{title}</span>
      <span className={styles.stats}>
        요청 {demand.requestCount}명 · 주변 같은 업종 {demand.nearbySameCategoryCount}곳
        {demand.nearestHypermarketKm !== undefined &&
          ` · 대형마트 ${demand.nearestHypermarketKm}km`}
      </span>
    </span>
  );

  return to ? (
    <CardLink to={to} tone="accent">
      {content}
    </CardLink>
  ) : (
    <Card tone="accent">{content}</Card>
  );
}
