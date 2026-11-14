import type { DemandSummary, MeShop, OwnerOffer, ResidentOffer } from '@/types/domain';
import { mockDemandSummaries, mockSeedRequests, type MockStoredRequest } from './demand';
import { mockSeedOffers } from './offers';

/*
 * 목 서비스가 함께 쓰는 메모리 DB. 새로고침하면 시드 상태로 돌아간다. 서버에는 아무것도 보내지 않는다.
 * 동네 탐색의 카드·마커, 내가 요청함 표시, 내 요청 화면이 모두 같은 수요 데이터(summaries)를
 * 읽기 때문에 요청을 제출하면 UI 코드를 바꾸지 않아도 같은 값으로 갱신된다.
 */
interface MemoryDb {
  /** 동네·업종별 수요 수치. 제출하면 인원이 늘어난다. */
  summaries: DemandSummary[];
  /** 내가 보낸 요청. 배열 끝이 가장 최근이다. */
  requests: MockStoredRequest[];
  nextRequestNumber: number;
  /** 내 가게(GET /me 의 shop 에 해당). 등록하기 전에는 null. 내 가게 화면이 저장하면 채워진다. */
  shop: MeShop | null;
  /** 사장님이 보낸 제안. 배열 앞이 가장 최근이다. */
  offers: OwnerOffer[];
  nextOfferNumber: number;
}

function createInitialDb(): MemoryDb {
  return {
    summaries: mockDemandSummaries.map((summary) => ({ ...summary })),
    requests: mockSeedRequests.map(({ request, offers }) => ({
      request: { ...request },
      offers: offers?.map(copyResidentOffer),
    })),
    nextRequestNumber: 1,
    shop: null,
    offers: mockSeedOffers.map((offer) => ({ ...offer })),
    nextOfferNumber: 1,
  };
}

/** 시드 제안을 복사한다(날짜·주문 포함). 테스트가 상태를 바꿔도 시드는 그대로여야 한다. */
export function copyResidentOffer(offer: ResidentOffer): ResidentOffer {
  return {
    ...offer,
    pickupAt: new Date(offer.pickupAt),
    deadlineAt: new Date(offer.deadlineAt),
    myOrder: offer.myOrder && { ...offer.myOrder },
  };
}

let db = createInitialDb();

export const getDb = (): MemoryDb => db;

/** 메모리 상태를 시드로 되돌린다. 테스트 사이에 호출한다. */
export function resetMockDb(): void {
  db = createInitialDb();
}
