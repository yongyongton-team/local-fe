import { useLocation, useNavigate } from 'react-router';
import { paths } from '@/shared/lib/paths';

/**
 * 내 정보(/me)에서 들어온 하위 화면(동네 선택, 내 가게)이 저장을 끝내고 돌아가는 함수.
 * 이전 화면이 있으면 뒤로 가고, 직접 진입(이 앱에서 처음 연 화면)이면 돌아갈 곳이 없어 /me 로 간다.
 */
export function useBackToMyInfo(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key === 'default') void navigate(paths.me, { replace: true });
    else void navigate(-1);
  };
}
