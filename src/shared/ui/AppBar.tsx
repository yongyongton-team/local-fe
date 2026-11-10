import { useLocation, useNavigate } from 'react-router';
import { IconButton } from './IconButton';
import { ArrowLeftIcon } from './icons';
import { Text } from './Text';
import styles from './AppBar.module.css';

interface AppBarProps {
  /** 화면 제목(h1) */
  title: string;
  /** 이 앱에서 처음 연 화면(직접 진입)이라 돌아갈 이전 화면이 없을 때 이동할 경로 */
  fallbackTo: string;
}

/**
 * 뒤로 가기 아이콘 버튼 + 제목(h1). 로고 아래에 놓는 화면 앱바다.
 * 이전 화면이 있으면 그 화면으로, 직접 진입했으면 fallbackTo 로 간다.
 */
export function AppBar({ title, fallbackTo }: AppBarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  function goBack() {
    // location.key 가 'default' 이면 이 앱에서 처음 연 화면(직접 진입)이다.
    if (location.key === 'default') {
      void navigate(fallbackTo);
    } else {
      void navigate(-1);
    }
  }

  return (
    <div className={styles.appBar}>
      <IconButton label="뒤로 가기" icon={<ArrowLeftIcon />} onClick={goBack} />
      <Text as="h1" variant="title" className={styles.title}>
        {title}
      </Text>
    </div>
  );
}
