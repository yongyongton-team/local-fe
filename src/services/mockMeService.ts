import { mockCategories } from '@/mocks/demand';
import { getDb } from '@/mocks/memoryDb';
import type { Me } from '@/types/domain';
import type { MeService } from './meService';

/** [임의] 목 모드의 내 정보. 역할·동네·가게가 없는 새 게스트 모양이다. 네트워크를 쓰지 않는다. */
const MOCK_ME: Me = { id: 0, nickname: '예시 사용자', role: null, dong: null, shop: null };

export const mockMeService: MeService = {
  savesRemotely: false,
  canRestoreSelection() {
    return false;
  },
  async restoreSelection() {
    return null;
  },
  async getMe() {
    const shop = getDb().shop;
    return { ...MOCK_ME, shop: shop && { ...shop } };
  },
  async saveSelection(role) {
    // 목 모드: 서버에 저장하지 않는다(네트워크 없음). 선택값은 화면의 메모리 Context 가 가진다.
    return { ...MOCK_ME, role };
  },
  async saveShop({ shopName, categoryId, lat, lng }) {
    // 목 모드: 메모리 상태만 바꾼다(네트워크 없음). 동네는 서버가 좌표로 찾는 값이라 목에서는 비워 둔다.
    const category = mockCategories.find((c) => c.id === categoryId);
    getDb().shop = { shopName, categoryName: category?.name ?? '', dongName: '', lat, lng };
  },
  async checkHealth() {
    return { details: { status: 'mock' } };
  },
};
