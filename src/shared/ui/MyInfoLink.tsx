import { Link } from 'react-router';
import { paths } from '@/shared/lib/paths';
import { MyPageIcon } from './icons';
import styles from './MyInfoLink.module.css';

/**
 * 우측 상단의 "내 정보" 아이콘 링크(/me). 사장님·예비 창업자 화면의 로고 줄 오른쪽 끝에 놓는다(RoleLayout).
 * 아이콘은 25×26 이고, 터치 영역만 44px 로 넓힌다. 이름은 링크의 aria-label 이 전달한다.
 */
export function MyInfoLink() {
  return (
    <Link to={paths.me} className={styles.link} aria-label="내 정보">
      <MyPageIcon />
    </Link>
  );
}
