import { Link } from 'react-router';
import logo from '@/shared/assets/logo.png';
import { paths } from '@/shared/lib/paths';
import styles from './LogoLink.module.css';

/**
 * 화면 위쪽의 서비스 로고. 누르면 메인 페이지(/)로 이동하는 링크(<a>)다.
 * - 이름은 링크의 aria-label 이 전달한다. 안의 로고 이미지는 장식이 되도록 링크가 이름을 덮는다(이중으로 읽히지 않는다).
 * - 시각적 크기·위치는 로고 그대로(129×43)이고, 터치 영역만 44px 로 넓힌다.
 * - 메인 페이지(/) 자체의 로고는 자기 자신으로 가는 링크가 필요 없어 이 컴포넌트를 쓰지 않는다.
 * - 선택한 역할·동네는 메모리 Context 에 있고 화면 이동으로는 초기화되지 않는다.
 */
export function LogoLink() {
  return (
    <Link to={paths.home} className={styles.link} aria-label="생기면 갈게요 메인으로 이동">
      <img src={logo} alt="생기면 갈게요" width={129} height={43} className={styles.image} />
    </Link>
  );
}
