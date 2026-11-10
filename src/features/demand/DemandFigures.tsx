import type { DemandSummary } from '@/types/domain';
import styles from './DemandFigures.module.css';

/** 수요 핵심 수치. 값은 구조화된 데이터에서 그대로 가져온다. */
export function DemandFigures({ demand }: { demand: DemandSummary }) {
  return (
    <dl className={styles.figures}>
      <div className={styles.item}>
        <dt>요청한 주민</dt>
        <dd>{demand.requestCount}명</dd>
      </div>
      <div className={styles.item}>
        <dt>주변 같은 업종</dt>
        <dd>{demand.nearbySameCategoryCount}곳</dd>
      </div>
      {demand.nearestHypermarketKm !== undefined && (
        <div className={styles.item}>
          <dt>가장 가까운 대형마트</dt>
          <dd>{demand.nearestHypermarketKm}km</dd>
        </div>
      )}
    </dl>
  );
}
