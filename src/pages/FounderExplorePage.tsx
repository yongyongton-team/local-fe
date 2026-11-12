import { useId } from 'react';
import { useSearchParams } from 'react-router';
import { CATEGORY_PARAM } from '@/features/founder-explore/constants';
import { FOUNDER_COPY } from '@/features/founder-explore/copy';
import {
  buildMapSummary,
  buildRankMarkers,
  describeLocationRow,
  resolveCategoryId,
  shouldShowRankMap,
} from '@/features/founder-explore/locationRows';
import { useCategories, useLocationRanks } from '@/features/founder-explore/useFounderExplore';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { founderService } from '@/services';
import { paths } from '@/shared/lib/paths';
import { LogoLink } from '@/shared/ui/LogoLink';
import { ListRowLink } from '@/shared/ui/ListRowLink';
import { NaverMap } from '@/shared/ui/NaverMap';
import { Notice } from '@/shared/ui/Notice';
import { SelectBox } from '@/shared/ui/SelectBox';
import { Text } from '@/shared/ui/Text';
import type { StoreCategory } from '@/types/domain';
import styles from './FounderExplorePage.module.css';

/**
 * 예비 창업자용 입지 찾기 (Figma node 2:1903).
 * 선택한 업종에 대해 인구에 비해 가게가 부족한 동네를 서버가 준 순서 그대로 순위로 보여준다(다시 정렬하지 않는다).
 * 업종은 URL 쿼리(?category=)에도 보관한다.
 * 역할 선택은 접근 권한이 아니므로 선택된 역할·동네 없이 직접 들어와도 렌더링한다. 하단 내비게이션은 없다.
 * 동네 리포트(/founder/areas/:areaId/report)는 이 화면의 범위가 아니다. 행은 링크로만 연결한다.
 */
export function FounderExplorePage() {
  const categories = useCategories();

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <div className={styles.headerRow}>
          <Text as="h1" variant="title">
            입지 찾기
          </Text>
        </div>
      </header>

      {categories.status === 'loading' && <p role="status">불러오는 중이에요.</p>}
      {categories.status === 'error' && (
        <Notice title="업종을 가져오지 못했어요">{describeLoadError(categories.error)}</Notice>
      )}
      {categories.status === 'success' && (
        <Explorer
          categories={categories.data.categories}
          defaultCategoryId={categories.data.defaultCategoryId}
        />
      )}
    </div>
  );
}

function Explorer({
  categories,
  defaultCategoryId,
}: {
  categories: readonly StoreCategory[];
  defaultCategoryId: string;
}) {
  const selectId = useId();
  const [params, setParams] = useSearchParams();
  const categoryId = resolveCategoryId(params.get(CATEGORY_PARAM), categories, defaultCategoryId);
  const category = categories.find((c) => c.id === categoryId);
  const ranks = useLocationRanks(categoryId);

  function handleChange(value: string) {
    // 업종을 바꿀 때마다 기록을 쌓지 않도록 현재 기록을 바꾼다. 리포트에서 뒤로 오면 마지막 선택이 유지된다.
    setParams({ [CATEGORY_PARAM]: value }, { replace: true });
  }

  const items = ranks.status === 'success' ? ranks.data : [];
  // 위치 정보가 없는 순위(서버 순위에는 좌표가 없다)는 지도에 마커를 만들지 않는다. 목록은 그대로 보여준다.
  const markers = buildRankMarkers(items, categoryId);
  const showMap = shouldShowRankMap(founderService.remote, markers.length);

  return (
    <>
      <div className={styles.question}>
        <label htmlFor={selectId} className={styles.questionLabel}>
          어떤 가게를 열고 싶으세요?
        </label>
        <div className={styles.select}>
          <SelectBox
            id={selectId}
            value={categoryId}
            onChange={(event) => handleChange(event.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.cardTitle}
              </option>
            ))}
          </SelectBox>
        </div>
      </div>

      <section className={styles.listSection} aria-labelledby={`${selectId}-list`}>
        <h2 className={styles.sectionTitle} id={`${selectId}-list`}>
          {FOUNDER_COPY.rankSectionTitle}
        </h2>
        <Text variant="caption">용인시 행정동 순위</Text>
        {ranks.status === 'loading' && <p role="status">불러오는 중이에요.</p>}
        {ranks.status === 'error' && (
          <Notice title="데이터를 가져오지 못했어요">{describeLoadError(ranks.error)}</Notice>
        )}
        {ranks.status === 'success' &&
          (items.length === 0 ? (
            <Notice title="아직 요청이 없는 업종이에요" />
          ) : (
            <ol className={styles.rankList}>
              {items.map((item) => {
                const text = describeLocationRow(item);
                return (
                  <li key={item.neighborhood.id}>
                    <ListRowLink
                      to={paths.founderAreaReport(item.neighborhood.id, categoryId)}
                      title={text.title}
                      detail={text.detail}
                      extra={text.extra}
                      accessibleName={text.accessibleName}
                    />
                  </li>
                );
              })}
            </ol>
          ))}
      </section>

      {/* 서버 순위에는 좌표가 없어 마커가 0개이면(API 모드) 빈 지도 카드를 숨기고 순위 목록만 보여준다. */}
      {showMap && (
        <div className={styles.map}>
          {/* 업종에 따라 마커 집합이 달라지므로 바뀔 때마다 마커 전체가 보이게 다시 맞춘다. */}
          <NaverMap
            refitOnChange
            label="입지 후보 지도(예시)"
            markers={markers}
            summary={
              ranks.status === 'success' && category
                ? buildMapSummary(category, markers.length)
                : undefined
            }
          />
        </div>
      )}
    </>
  );
}
