import { RoleSelectForm } from '@/features/selection/RoleSelectForm';
import { Text } from '@/shared/ui/Text';
import styles from './HomePage.module.css';

/**
 * 역할 및 동네 선택. 서비스명이 확정되지 않아 로고·브랜딩은 두지 않는다.
 * 큰 제목은 디자인 시스템 밖의 개별 화면 스타일(display)이다.
 */
export function HomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <Text as="h1" variant="display">
          우리 동네에 없는 가게, 원하면 생겨요
        </Text>
        <Text variant="caption">
          동네 지도에서 없는 가게를 보고, 생겼으면 하는 가게를 요청해요. 요청이 모이면 사장님과
          창업자가 봐요.
        </Text>
      </div>
      <RoleSelectForm />
    </div>
  );
}
