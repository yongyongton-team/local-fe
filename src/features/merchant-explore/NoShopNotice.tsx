import { Notice } from '@/shared/ui/Notice';

/**
 * 서버에 등록된 가게가 없을 때(API 모드의 새 사장님 계정)의 안내. 기존 Notice 를 쓰고 새 UI 는 없다.
 * 문구는 임시다. 가게 등록 화면이 없어 이동 링크도 두지 않는다.
 */
export function NoShopNotice() {
  return (
    <Notice title="아직 등록된 가게가 없어요">
      가게를 등록하면 내 업종을 원하는 동네를 볼 수 있어요.
    </Notice>
  );
}
