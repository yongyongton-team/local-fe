import { myRequestService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';

const loadMyRequests = () => myRequestService.listMyRequests();

/** 내가 보낸 요청(최근 순). 화면을 열 때마다 새로 불러온다. */
export function useMyRequests() {
  return useAsyncData(loadMyRequests);
}
