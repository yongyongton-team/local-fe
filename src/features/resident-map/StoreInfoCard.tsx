import { CloseIcon } from '@/shared/ui/icons';
import { IconButton } from '@/shared/ui/IconButton';
import { STORE_INFO_COPY } from './copy';
import styles from './StoreInfoCard.module.css';

interface StoreInfoCardProps {
  /** 가게 이름. 서버가 주지 않았거나 비어 있으면 없음(업종만 보인다). */
  name?: string;
  /** 업종 이름. 업종 목록에서 못 찾으면 없음(이름만 보인다). */
  categoryName?: string;
  onClose: () => void;
}

/**
 * 카드에 보여줄 글자: "가게 이름 · 업종". 있는 것만 보이고(앞뒤 공백은 뺀다), 둘 다 없으면 기본 문구다.
 * 마커의 보조 기술용 문구("있는 가게 위치" 등 패널 제목)는 쓰지 않는다.
 */
export function describeStore(name?: string, categoryName?: string): string {
  const parts = [name?.trim(), categoryName?.trim()].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(' · ') : STORE_INFO_COPY.unknown;
}

/**
 * 지도에서 가게 핀을 눌렀을 때 지도 아래쪽에 겹쳐 보이는 정보 카드: "가게 이름 · 업종".
 * 지도 영역 안에 있어 하단 내비나 다른 컨트롤을 가리지 않는다. 내용이 바뀌면 보조 기술에 알린다(role="status").
 */
export function StoreInfoCard({ name, categoryName, onClose }: StoreInfoCardProps) {
  return (
    <div className={styles.card}>
      <p role="status" className={styles.text}>
        {describeStore(name, categoryName)}
      </p>
      <IconButton label={STORE_INFO_COPY.close} icon={<CloseIcon />} onClick={onClose} />
    </div>
  );
}
