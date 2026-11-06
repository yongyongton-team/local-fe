import { RoleSelectForm } from '@/features/selection/RoleSelectForm';
import logo from '@/shared/assets/logo.png';
import { Text } from '@/shared/ui/Text';
import styles from './HomePage.module.css';

/**
 * 역할 및 동네 선택 (Figma node 2:1169).
 * 화면의 시각·배터리·통신 상태와 홈 인디케이터는 구현하지 않는다.
 * 큰 제목은 디자인 시스템 밖의 개별 화면 스타일(display)이다.
 */
export function HomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        {/* Figma 로고 에셋. 서비스명은 아직 확정 전이라 문서·패키지의 임시 이름은 그대로 둔다. */}
        <img src={logo} alt="생기면 갈게요" width={129} height={43} className={styles.logo} />
        <div className={styles.copy}>
          <Text as="h1" variant="display">
            우리 동네에 없는 가게,
            <br />
            원하면 생겨요
          </Text>
          <Text variant="caption">
            동네 지도에서 없는 가게를 보고, 생겼으면 하는 가게를 요청해요. 요청이 모이면 사장님과
            창업자가 봐요.
          </Text>
        </div>
      </div>
      <RoleSelectForm />
    </div>
  );
}
