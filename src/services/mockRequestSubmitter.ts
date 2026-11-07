import type { StoreRequest } from '@/types/domain';
import type { RequestSubmitter } from './requestSubmitter';

/** 제출한 요청을 메모리에만 보관한다. 새로고침하면 사라진다. 서버에는 보내지 않는다. */
const submitted: StoreRequest[] = [];

export const mockRequestSubmitter: RequestSubmitter = {
  async submit(request) {
    const saved: StoreRequest = { ...request, id: `mock-request-${submitted.length + 1}` };
    submitted.push(saved);
    return saved;
  },
};
