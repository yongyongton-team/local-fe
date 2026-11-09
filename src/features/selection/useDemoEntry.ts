import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { authService, describeApiError } from '@/services';
import { ROLE_OPTIONS } from './roles';
import { useSelection } from './SelectionContext';

/** 데모 진입·종료를 알리는 쿼리 파라미터 이름과 값 */
const DEMO_PARAM = 'demo';

/**
 * 시연용 사장님 데모 진입(/?demo=owner)과 종료(/?demo=off). URL 로만 진입한다(버튼 없음).
 * authService.demoLoginEnabled 가 false(API 모드가 아니거나 VITE_ENABLE_DEMO_LOGIN 이 꺼짐)이면 demo 파라미터를 완전히 무시한다.
 * - owner: POST /auth/demo 로 로그인하고 토큰·데모 표시를 저장한 뒤, 사장님 역할을 선택하고 사장님 기본 페이지로 이동한다(PUT /me 없음).
 *   실패하면 이동하지 않고 onError 로 문구를 알리며, 파라미터는 주소에서 지운다.
 * - off: 토큰과 데모 표시를 지우고 선택을 비운 뒤 파라미터를 주소에서 지운다.
 * StrictMode 가 효과를 두 번 실행해도 로그인은 한 번만 부른다.
 *
 * @returns entering 데모 로그인을 기다리는 중인지(이 동안 폼 대신 기존 로딩 표시를 보인다)
 */
export function useDemoEntry(onError: (message: string) => void): { entering: boolean } {
  const navigate = useNavigate();
  const selection = useSelection();
  const [params, setParams] = useSearchParams();
  const value = authService.demoLoginEnabled ? params.get(DEMO_PARAM) : null;
  const [entering, setEntering] = useState(value === 'owner');
  // 같은 값으로 효과가 다시 실행돼도(StrictMode) 한 번만 처리한다. 파라미터가 사라지면 다시 쓸 수 있게 비운다.
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (value === null) {
      handledRef.current = null;
      return;
    }
    if (handledRef.current === value) return;
    const stripParam = () =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete(DEMO_PARAM);
          return next;
        },
        { replace: true },
      );

    if (value === 'off') {
      handledRef.current = value;
      authService.endDemoSession();
      selection.clear();
      stripParam();
      return;
    }
    if (value === 'owner') {
      handledRef.current = value;
      authService.startDemoSession().then(
        () => {
          selection.select('merchant', null);
          const target = ROLE_OPTIONS.find((option) => option.role === 'merchant');
          // 파라미터는 이동하면서 주소에서 사라진다(replace).
          void navigate(target?.homePath ?? '/', { replace: true });
        },
        (error: unknown) => {
          setEntering(false);
          onError(describeApiError(error));
          stripParam();
        },
      );
    }
    // 알 수 없는 값은 무시한다(주소도 그대로 둔다).
  }, [value, selection, navigate, setParams, onError]);

  return { entering };
}
