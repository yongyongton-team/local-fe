import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  MAP_FILTER_OPTIONS,
  getMarkerSummary,
  getVisibleMarkers,
  type MapFilter,
} from '@/features/resident-map/mapMarkers';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { getMissingStoreCards } from '@/features/resident-map/missingStoreCards';
import { QuickRequestDialog } from '@/features/resident-map/QuickRequestDialog';
import {
  applyOverridesToMarkers,
  applyOverridesToReports,
  applyOverridesToRequestedStores,
  type RequestOverrides,
} from '@/features/resident-map/quickRequestOverrides';
import { StoreInfoCard } from '@/features/resident-map/StoreInfoCard';
import { StoreRequestCard } from '@/features/resident-map/StoreRequestCard';
import { REQUESTED_STORES_COPY } from '@/features/resident-map/copy';
import {
  requestedKey,
  useMyRequestedKeys,
  useResidentExplore,
} from '@/features/resident-map/useResidentExplore';
import { NeighborhoodNotice } from '@/features/selection/NeighborhoodNotice';
import { useSelection } from '@/features/selection/SelectionContext';
import { demandService, requestSubmitter } from '@/services';
import { paths } from '@/shared/lib/paths';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { LogoLink } from '@/shared/ui/LogoLink';
import type { AsyncState } from '@/shared/lib/useAsyncData';
import { LinkButton } from '@/shared/ui/Button';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { IconButton } from '@/shared/ui/IconButton';
import { ChevronDownIcon, SearchIcon } from '@/shared/ui/icons';
import { MAP_COPY } from '@/shared/ui/copy';
import { NaverMap } from '@/shared/ui/NaverMap';
import { Notice } from '@/shared/ui/Notice';
import { Page } from '@/shared/ui/Page';
import { Text } from '@/shared/ui/Text';
import type {
  MapMarker,
  Neighborhood,
  NeighborhoodReport,
  RequestedStore,
  StoreCategory,
} from '@/types/domain';
import styles from './ResidentExplorePage.module.css';

/**
 * 주민용 동네 탐색 (Figma node 2:1283 / 2:1360 / 2:1425 / 2:1490).
 * 지도 필터 칩은 지도 마커의 표시 여부만 바꾼다. 카드 목록과 마커 위치는 바뀌지 않는다.
 * 상태 표시줄과 홈 인디케이터는 구현하지 않는다.
 */
export function ResidentExplorePage() {
  const { neighborhood, restoring } = useSelection();

  // 새로고침 뒤 서버에 저장된 선택을 불러오는 동안은 "먼저 선택해 주세요" 안내를 보여주지 않는다.
  if (restoring) {
    return (
      <Page title="동네 탐색">
        <p role="status">불러오는 중이에요.</p>
      </Page>
    );
  }
  if (!neighborhood) {
    return (
      <Page title="동네 탐색">
        <NeighborhoodNotice />
      </Page>
    );
  }
  // 동네가 바뀌면 이 화면의 상태(보낸 요청 반영, 열린 창, 고른 가게)를 모두 새로 시작한다.
  return <ExploreScreen key={neighborhood.id} neighborhood={neighborhood} />;
}

const loadCategories = () => demandService.listCategories();

function ExploreScreen({ neighborhood }: { neighborhood: Neighborhood }) {
  const [filter, setFilter] = useState<MapFilter>('all');
  const { reports: loadedReports, markers, requestedStores } = useResidentExplore(neighborhood.id);
  // 내가 이미 요청한 (동네, 업종). "주민이 요청한 가게"의 ✓ 에만 쓴다. 실패해도 목록은 그대로다.
  const myRequestedKeys = useMyRequestedKeys();
  // 업종 이름(가게 정보 카드용). 이미 받아 둔 업종 목록을 쓰므로 추가 요청은 없다.
  const categories = useAsyncData(loadCategories);

  // 이 화면에서 보낸 간편 요청: 서버를 다시 읽지 않고 카드의 인원·아이콘과 지도의 "요청 N" 알약만 고친다.
  const [overrides, setOverrides] = useState<RequestOverrides>({});
  const [quickTarget, setQuickTarget] = useState<StoreCategory | null>(null);
  // 지도에서 고른 가게 핀. 한 번에 하나만 보인다.
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const reports: AsyncState<NeighborhoodReport[]> = useMemo(
    () =>
      loadedReports.status === 'success'
        ? {
            status: 'success',
            data: [...applyOverridesToReports(loadedReports.data, overrides)],
          }
        : loadedReports,
    [loadedReports, overrides],
  );
  const markerData = useMemo(
    () => (markers.status === 'success' ? applyOverridesToMarkers(markers.data, overrides) : []),
    [markers, overrides],
  );

  const visibleMarkers = getVisibleMarkers(markerData, filter);
  // 고른 가게가 필터나 데이터 변경으로 지도에서 사라지면 정보 카드도 함께 사라진다.
  const selectedStore = selectedStoreId
    ? visibleMarkers.find((m) => m.id === selectedStoreId && m.kind === 'existing')
    : undefined;
  const selectedCategoryName =
    selectedStore?.categoryId && categories.status === 'success'
      ? categories.data.find((c) => c.id === selectedStore.categoryId)?.name
      : undefined;
  const handleStoreClick = (marker: MapMarker) => setSelectedStoreId(marker.id);
  const handleMapClick = () => setSelectedStoreId(null);
  const summary =
    markers.status === 'success'
      ? getMarkerSummary(visibleMarkers.length, filter)
      : '지도 마커를 불러오는 중이에요';

  return (
    <div className={styles.screen}>
      <h1 className="visually-hidden">동네 탐색</h1>

      <header className={styles.header}>
        <LogoLink />
        <div className={styles.headerRow}>
          {/* 동네 변경 동작은 디자인에서 확인되지 않아 임시로 첫 화면으로 이동한다. */}
          <Link to={paths.home} className={styles.neighborhood}>
            <span>
              {neighborhood.district} {neighborhood.name}
            </span>
            <ChevronDownIcon />
            <span className="visually-hidden"> 동네 변경, 첫 화면으로 이동</span>
          </Link>
          {/* 검색: 동작이 정해지지 않아 렌더링만 한다. 이름은 임시다. */}
          {/* 사람들 아이콘(이웃 보기)은 내 정보 아이콘과 같은 그림이라 주민 화면에서 뺐다. 주민의 진입점은 하단 내비다. */}
          <div className={styles.actions}>
            <IconButton label="검색" icon={<SearchIcon />} />
          </div>
        </div>
      </header>

      <div className={styles.filters}>
        <ChipGroup
          label="지도 필터"
          options={MAP_FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {markers.status === 'error' && (
        <Notice title="지도 마커를 가져오지 못했어요">{describeLoadError(markers.error)}</Notice>
      )}
      <div className={styles.mapBleed}>
        <NaverMap
          markers={visibleMarkers}
          label={MAP_COPY.regionLabel('동네 지도', requestSubmitter.remote)}
          remote={requestSubmitter.remote}
          summary={summary}
          onStoreClick={handleStoreClick}
          onMapClick={handleMapClick}
        />
        {selectedStore && (
          <StoreInfoCard
            name={selectedStore.storeName}
            categoryName={selectedCategoryName}
            onClose={() => setSelectedStoreId(null)}
          />
        )}
      </div>

      <section aria-labelledby="missing-stores" className={styles.listSection}>
        <Text as="h2" variant="contents" id="missing-stores">
          우리 동네에 없는 가게
        </Text>
        <Text variant="caption">걸어서 15분 안에 같은 업종 가게가 없어요 · 요청 많은 순</Text>
        <StoreCards state={reports} onRequest={setQuickTarget} />
      </section>

      {/* 요청은 있지만 "없는 가게"에는 없는 업종. 하나도 없으면(불러오는 중·실패 포함) 섹션 전체를 숨긴다. */}
      {requestedStores.status === 'success' && requestedStores.data.length > 0 && (
        <RequestedStoresSection
          neighborhoodId={neighborhood.id}
          stores={[...applyOverridesToRequestedStores(requestedStores.data, overrides)]}
          myRequestedKeys={myRequestedKeys}
          sentCategoryIds={overrides}
          onRequest={setQuickTarget}
        />
      )}

      {quickTarget && (
        <QuickRequestDialog
          neighborhood={neighborhood}
          category={quickTarget}
          onClose={() => setQuickTarget(null)}
          onSent={(categoryId, added) =>
            setOverrides((previous) => ({
              ...previous,
              // 이미 반영한 업종이면 인원을 두 번 더하지 않는다.
              [categoryId]: previous[categoryId] ?? { extra: added ? 1 : 0 },
            }))
          }
        />
      )}

      {/* 하단 내비 위에 띄운다. 디자인에서는 내비가 버튼을 가리지만 웹에서는 터치와 가독성 때문에 겹치지 않게 한다. */}
      <div className={styles.fab}>
        <LinkButton to={paths.residentRequestNew} size="small">
          +가게 요청하기
        </LinkButton>
      </div>
    </div>
  );
}

function StoreCards({
  state,
  onRequest,
}: {
  state: AsyncState<NeighborhoodReport[]>;
  onRequest: (category: StoreCategory) => void;
}) {
  if (state.status === 'loading') return <p role="status">불러오는 중이에요.</p>;
  if (state.status === 'error') {
    return <Notice title="데이터를 가져오지 못했어요">{describeLoadError(state.error)}</Notice>;
  }

  const cards = getMissingStoreCards(state.data);
  if (cards.length === 0) {
    return <Notice title="조건에 맞는 가게가 아직 없어요" />;
  }
  return (
    <ol className={styles.cardList}>
      {cards.map((report) => (
        <li key={report.category.id}>
          <StoreRequestCard
            category={report.category}
            requestCount={report.demand.requestCount}
            nearestHypermarketKm={report.demand.nearestHypermarketKm}
            requestedByMe={report.demand.requestedByMe === true}
            onRequest={onRequest}
          />
        </li>
      ))}
    </ol>
  );
}

/**
 * "주민이 요청한 가게": 요청 많은 순. 이 화면에서 보내면 "없는 가게" 카드와 같은 방식(overrides)으로 인원이 +1 이고(409 면 그대로), 지도를 다시 부르지 않는다.
 * ✓ 는 GET /me/requests 에 같은 동네·업종이 있거나, 이 화면에서 방금 보냈거나 이미 요청해 둔 것(409)일 때다.
 */
function RequestedStoresSection({
  neighborhoodId,
  stores,
  myRequestedKeys,
  sentCategoryIds,
  onRequest,
}: {
  neighborhoodId: string;
  stores: readonly RequestedStore[];
  myRequestedKeys: ReadonlySet<string>;
  sentCategoryIds: RequestOverrides;
  onRequest: (category: StoreCategory) => void;
}) {
  return (
    <section aria-labelledby="requested-stores" className={styles.listSection}>
      <Text as="h2" variant="contents" id="requested-stores">
        {REQUESTED_STORES_COPY.title}
      </Text>
      <Text variant="caption">{REQUESTED_STORES_COPY.description}</Text>
      <ol className={styles.cardList}>
        {stores.map(({ category, requestCount }) => (
          <li key={category.id}>
            <StoreRequestCard
              category={category}
              requestCount={requestCount}
              requestedByMe={
                myRequestedKeys.has(requestedKey(neighborhoodId, category.id)) ||
                sentCategoryIds[category.id] !== undefined
              }
              onRequest={onRequest}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
