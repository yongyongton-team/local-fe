import { useState } from 'react';
import { Link } from 'react-router';
import {
  MAP_FILTER_OPTIONS,
  getMarkerSummary,
  getVisibleMarkers,
  type MapFilter,
} from '@/features/resident-map/mapMarkers';
import { getMissingStoreCards } from '@/features/resident-map/missingStoreCards';
import { StoreRequestCard } from '@/features/resident-map/StoreRequestCard';
import { useResidentExplore } from '@/features/resident-map/useResidentExplore';
import { NeighborhoodNotice } from '@/features/selection/NeighborhoodNotice';
import { useSelection } from '@/features/selection/SelectionContext';
import logo from '@/shared/assets/logo.png';
import { paths } from '@/shared/lib/paths';
import type { AsyncState } from '@/shared/lib/useAsyncData';
import { LinkButton } from '@/shared/ui/Button';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { IconButton } from '@/shared/ui/IconButton';
import { ChevronDownIcon, PeopleIcon, SearchIcon } from '@/shared/ui/icons';
import { NaverMap } from '@/shared/ui/NaverMap';
import { Notice } from '@/shared/ui/Notice';
import { Page } from '@/shared/ui/Page';
import { Text } from '@/shared/ui/Text';
import type { Neighborhood, NeighborhoodReport } from '@/types/domain';
import styles from './ResidentExplorePage.module.css';

/**
 * 주민용 동네 탐색 (Figma node 2:1283 / 2:1360 / 2:1425 / 2:1490).
 * 지도 필터 칩은 지도 마커의 표시 여부만 바꾼다. 카드 목록과 마커 위치는 바뀌지 않는다.
 * 상태 표시줄과 홈 인디케이터는 구현하지 않는다.
 */
export function ResidentExplorePage() {
  const { neighborhood } = useSelection();

  if (!neighborhood) {
    return (
      <Page title="동네 탐색">
        <NeighborhoodNotice />
      </Page>
    );
  }
  return <ExploreScreen neighborhood={neighborhood} />;
}

function ExploreScreen({ neighborhood }: { neighborhood: Neighborhood }) {
  const [filter, setFilter] = useState<MapFilter>('all');
  const { reports, markers } = useResidentExplore(neighborhood.id);

  const visibleMarkers =
    markers.status === 'success' ? getVisibleMarkers(markers.data, filter) : [];
  const summary =
    markers.status === 'success'
      ? getMarkerSummary(visibleMarkers.length, filter)
      : '지도 마커를 불러오는 중이에요';

  return (
    <div className={styles.screen}>
      <h1 className="visually-hidden">동네 탐색</h1>

      <header className={styles.header}>
        <img src={logo} alt="생기면 갈게요" width={129} height={43} className={styles.logo} />
        <div className={styles.headerRow}>
          {/* 동네 변경 동작은 디자인에서 확인되지 않아 임시로 첫 화면으로 이동한다. */}
          <Link to={paths.home} className={styles.neighborhood}>
            <span>
              {neighborhood.district} {neighborhood.name}
            </span>
            <ChevronDownIcon />
            <span className="visually-hidden"> 동네 변경, 첫 화면으로 이동</span>
          </Link>
          {/* 검색·이웃 보기: 동작이 정해지지 않아 렌더링만 한다. 이름은 임시다. */}
          <div className={styles.actions}>
            <IconButton label="검색" icon={<SearchIcon />} />
            <IconButton label="이웃 보기" icon={<PeopleIcon />} />
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
        <Notice title="지도 마커를 가져오지 못했어요">잠시 후 다시 시도해 주세요.</Notice>
      )}
      <div className={styles.mapBleed}>
        <NaverMap markers={visibleMarkers} label="동네 지도(예시)" summary={summary} />
      </div>

      <section aria-labelledby="missing-stores" className={styles.listSection}>
        <Text as="h2" variant="contents" id="missing-stores">
          우리 동네에 없는 가게
        </Text>
        <Text variant="caption">걸어서 15분 안에 같은 업종 가게가 없어요 · 요청 많은 순</Text>
        <StoreCards state={reports} />
      </section>

      {/* 하단 내비 위에 띄운다. 디자인에서는 내비가 버튼을 가리지만 웹에서는 터치와 가독성 때문에 겹치지 않게 한다. */}
      <div className={styles.fab}>
        <LinkButton to={paths.residentRequestNew} size="small">
          +가게 요청하기
        </LinkButton>
      </div>
    </div>
  );
}

function StoreCards({ state }: { state: AsyncState<NeighborhoodReport[]> }) {
  if (state.status === 'loading') return <p role="status">불러오는 중이에요.</p>;
  if (state.status === 'error') {
    return <Notice title="데이터를 가져오지 못했어요">잠시 후 다시 시도해 주세요.</Notice>;
  }

  const cards = getMissingStoreCards(state.data);
  if (cards.length === 0) {
    return <Notice title="조건에 맞는 가게가 아직 없어요" />;
  }
  return (
    <ol className={styles.cardList}>
      {cards.map((report) => (
        <li key={report.category.id}>
          <StoreRequestCard report={report} />
        </li>
      ))}
    </ol>
  );
}
