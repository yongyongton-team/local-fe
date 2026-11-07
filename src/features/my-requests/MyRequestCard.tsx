import { useId } from 'react';
import type { MyRequest } from '@/types/domain';
import { buildMetaLine, formatMerchantResponse } from './requestProgress';
import styles from './MyRequestCard.module.css';

/** 내가 보낸 요청 한 건. 카드 자체는 누를 수 없고 정보만 보여준다. */
export function MyRequestCard({ item }: { item: MyRequest }) {
  const titleId = useId();
  const responseLabelId = useId();
  const { request, neighborhood, category, requestCount, response } = item;

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h3 id={titleId} className={styles.title}>
          {category.cardTitle}
        </h3>
        <p className={styles.count}>{requestCount}명</p>
      </div>
      <p className={styles.meta}>
        {buildMetaLine(neighborhood.name, request.visitTimes, request.visitFrequency)}
      </p>

      {response ? (
        // 라벨과 메시지가 하나의 묶음으로 읽히도록 group 으로 묶는다.
        <div role="group" aria-labelledby={responseLabelId} className={styles.response}>
          <p id={responseLabelId} className={styles.responseLabel}>
            사장님 응답
          </p>
          <p className={styles.responseMessage}>{formatMerchantResponse(response)}</p>
        </div>
      ) : (
        <p className={styles.noResponse}>아직 사장님 응답이 없어요</p>
      )}
    </article>
  );
}
