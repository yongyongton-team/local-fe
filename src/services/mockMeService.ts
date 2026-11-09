import type { Me } from '@/types/domain';
import type { MeService } from './meService';

/** [임의] 목 모드의 내 정보. 역할·동네·가게가 없는 새 게스트 모양이다. 네트워크를 쓰지 않는다. */
const MOCK_ME: Me = { id: 0, nickname: '예시 사용자', role: null, dong: null, shop: null };

export const mockMeService: MeService = {
  async getMe() {
    return { ...MOCK_ME };
  },
  async checkHealth() {
    return { details: { status: 'mock' } };
  },
};
