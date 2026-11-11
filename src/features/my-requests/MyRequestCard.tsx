import { useId } from 'react';
import { CheckIcon } from '@/shared/ui/icons';
import type { MyRequest } from '@/types/domain';
import { buildMetaLine, formatMerchantResponse } from './requestProgress';
import styles from './MyRequestCard.module.css';

interface MyRequestCardProps {
  item: MyRequest;
  /** 삭제할 요청으로 골랐는지 */
  selected?: boolean;
  /** 체크를 누르면 부른다. 없으면 체크 표시를 그리지 않고 정보만 보여준다. */
  onSelectedChange?: (selected: boolean) => void;
  /** 삭제 요청 중에는 체크를 막는다. */
  selectionDisabled?: boolean;
}

/**
 * 내가 보낸 요청 한 건. 카드 자체는 누를 수 없고, 왼쪽 위 체크로 삭제할 요청을 고른다(Figma 41:152).
 * 체크는 원 없이 체크 모양만 있고, 고르면 검정, 아니면 연한 회색이다.
 */
export function MyRequestCard({
  item,
  selected = false,
  onSelectedChange,
  selectionDisabled = false,
}: MyRequestCardProps) {
  const titleId = useId();
  const responseLabelId = useId();
  const { request, neighborhood, category, requestCount, response } = item;

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      {onSelectedChange && (
        <label className={styles.check}>
          <input
            type="checkbox"
            className={`visually-hidden ${styles.checkInput}`}
            checked={selected}
            disabled={selectionDisabled}
            onChange={(event) => onSelectedChange(event.target.checked)}
          />
          <span className={styles.checkMark}>
            <CheckIcon />
          </span>
          <span className="visually-hidden">
            {neighborhood.name} {category.cardTitle} 요청 선택
          </span>
        </label>
      )}
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
