import { describe, expect, it } from 'vitest';
import { resetMockDb } from '@/mocks/memoryDb';
import type { NewStoreRequest } from '@/types/domain';
import { demandService, myRequestService, requestSubmitter } from '.';

const fruit = (overrides: Partial<NewStoreRequest> = {}): NewStoreRequest => ({
  neighborhoodId: 'guseong',
  categoryId: 'fruit-vegetable',
  detail: '밤 10시까지 하는 과일가게요.',
  conditions: ['늦게까지 영업'],
  visitTimes: ['weekday-evening'],
  visitFrequency: 'weekly',
  ...overrides,
});

const fruitReport = async () =>
  (await demandService.listReportsByNeighborhood('guseong')).find(
    (report) => report.category.id === 'fruit-vegetable',
  );

describe('내 요청 목 서비스', () => {
  it('처음에는 구성동 반찬 요청 1건과 사장님 응답이 있고 인원은 수요 데이터와 같다', async () => {
    const items = await myRequestService.listMyRequests();

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      category: { id: 'side-dish' },
      neighborhood: { name: '구성동' },
      requestCount: 12,
      request: { visitTimes: ['weekday-evening'], visitFrequency: 'monthly' },
      response: { merchantName: expect.any(String), pickupAt: expect.any(Date) },
    });
  });
});

describe('내 요청 목 서비스의 삭제', () => {
  it('요청을 목록에서 빼고 해당 동네·업종의 인원을 1 줄이며 "내가 요청함"을 해제한다', async () => {
    const submitted = await requestSubmitter.submit(fruit());
    expect((await fruitReport())?.demand).toMatchObject({ requestCount: 30, requestedByMe: true });

    await myRequestService.deleteRequest(submitted.id);

    const ids = (await myRequestService.listMyRequests()).map((item) => item.request.id);
    expect(ids).not.toContain(submitted.id);
    expect(ids).toHaveLength(1);
    expect((await fruitReport())?.demand).toMatchObject({ requestCount: 29, requestedByMe: false });
  });

  it('없는 id 는 이미 지워진 것으로 보고 아무것도 바꾸지 않는다', async () => {
    const before = await myRequestService.listMyRequests();

    await expect(myRequestService.deleteRequest('nope')).resolves.toBeUndefined();

    expect(await myRequestService.listMyRequests()).toEqual(before);
  });

  it('같은 요청을 두 번 지워도 인원은 한 번만 줄어든다', async () => {
    const [seed] = await myRequestService.listMyRequests();

    await myRequestService.deleteRequest(seed!.request.id);
    await myRequestService.deleteRequest(seed!.request.id);

    expect(await myRequestService.listMyRequests()).toEqual([]);
    const sideDish = (await demandService.listReportsByNeighborhood('guseong')).find(
      (report) => report.category.id === 'side-dish',
    );
    expect(sideDish?.demand.requestCount).toBe(11);
  });
});

describe('요청 제출', () => {
  it('과일/채소 요청을 보내면 인원이 29 → 30 이 되고 내가 요청함이 된다', async () => {
    expect((await fruitReport())?.demand).toMatchObject({ requestCount: 29 });
    expect((await fruitReport())?.demand.requestedByMe).toBeUndefined();

    await requestSubmitter.submit(fruit());

    expect((await fruitReport())?.demand).toMatchObject({ requestCount: 30, requestedByMe: true });
  });

  it('보낸 요청이 최근 순으로 앞에 오고, 새 요청에는 사장님 응답이 없다', async () => {
    await requestSubmitter.submit(fruit());

    const items = await myRequestService.listMyRequests();

    expect(items.map((item) => item.category.id)).toEqual(['fruit-vegetable', 'side-dish']);
    expect(items[0]).toMatchObject({ requestCount: 30, response: undefined });
    expect(items[1]?.response).toBeDefined();
  });

  it('같은 동네·같은 업종을 다시 보내면 새 요청을 만들지 않고 내용만 갱신한다(인원은 그대로)', async () => {
    const first = await requestSubmitter.submit(fruit());

    const second = await requestSubmitter.submit(
      fruit({
        detail: '채소도 있으면 좋겠어요',
        visitTimes: ['weekend'],
        visitFrequency: 'rarely',
      }),
    );

    expect(second.id).toBe(first.id);
    expect((await fruitReport())?.demand.requestCount).toBe(30);
    const items = await myRequestService.listMyRequests();
    expect(items).toHaveLength(2);
    expect(items[0]?.request).toMatchObject({
      detail: '채소도 있으면 좋겠어요',
      visitTimes: ['weekend'],
      visitFrequency: 'rarely',
    });
  });

  it('처음부터 있던 반찬 요청을 다시 보내도 인원(12)은 늘지 않는다', async () => {
    await requestSubmitter.submit(fruit({ categoryId: 'side-dish' }));

    const report = (await demandService.listReportsByNeighborhood('guseong')).find(
      (r) => r.category.id === 'side-dish',
    );
    expect(report?.demand.requestCount).toBe(12);
    expect(await myRequestService.listMyRequests()).toHaveLength(1);
  });

  it('다시 보낸 요청은 가장 최근 요청으로 올라온다', async () => {
    await requestSubmitter.submit(fruit());
    await requestSubmitter.submit(fruit({ categoryId: 'side-dish', visitTimes: ['weekend'] }));

    const items = await myRequestService.listMyRequests();

    expect(items.map((item) => item.category.id)).toEqual(['side-dish', 'fruit-vegetable']);
  });

  it('다른 동네의 같은 업종은 별개의 요청이고 해당 동네 인원만 오른다', async () => {
    await requestSubmitter.submit(fruit({ neighborhoodId: 'mabuk' }));

    const mabuk = await demandService.getReport('mabuk', 'fruit-vegetable');
    const guseong = await demandService.getReport('guseong', 'fruit-vegetable');
    expect(mabuk?.demand.requestCount).toBe(10);
    expect(guseong?.demand.requestCount).toBe(29);
    expect(await myRequestService.listMyRequests()).toHaveLength(2);
  });

  it('수요 데이터가 없던 동네·업종이면 새로 만들어 1명으로 시작한다', async () => {
    await requestSubmitter.submit(fruit({ neighborhoodId: 'bojeong', categoryId: 'bakery' }));

    const report = await demandService.getReport('bojeong', 'bakery');
    expect(report?.demand).toMatchObject({ requestCount: 1, requestedByMe: true });
  });
});

describe('동네 탐색 서비스 값과의 일치', () => {
  it('제출하면 탐색 화면용 카드 인원, 지도 마커 문구, 내가 요청함이 같은 값으로 갱신된다', async () => {
    const before = await demandService.listMapMarkers('guseong');
    expect(before.find((m) => m.id === 'guseong-request-fruit-vegetable')?.label).toBe(
      '과일 요청 29',
    );

    await requestSubmitter.submit(fruit());

    const report = await fruitReport();
    const markers = await demandService.listMapMarkers('guseong');
    expect(report?.demand).toMatchObject({ requestCount: 30, requestedByMe: true });
    expect(markers.find((m) => m.id === 'guseong-request-fruit-vegetable')?.label).toBe(
      '과일 요청 30',
    );
  });
});

describe('메모리 초기화', () => {
  it('resetMockDb 는 제출 전 시드 상태로 되돌린다', async () => {
    await requestSubmitter.submit(fruit());

    resetMockDb();

    expect((await fruitReport())?.demand).toMatchObject({ requestCount: 29 });
    expect(await myRequestService.listMyRequests()).toHaveLength(1);
  });
});
