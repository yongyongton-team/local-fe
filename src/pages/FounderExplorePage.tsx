import { useId } from 'react';
import { useSearchParams } from 'react-router';
import { CATEGORY_PARAM } from '@/features/founder-explore/constants';
import {
  buildMapSummary,
  buildRankMarkers,
  describeLocationRow,
  resolveCategoryId,
} from '@/features/founder-explore/locationRows';
import { useCategories, useLocationRanks } from '@/features/founder-explore/useFounderExplore';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { paths } from '@/shared/lib/paths';
import { LogoLink } from '@/shared/ui/LogoLink';
import { IconButton } from '@/shared/ui/IconButton';
import { PeopleIcon } from '@/shared/ui/icons';
import { ListRowLink } from '@/shared/ui/ListRowLink';
import { NaverMap } from '@/shared/ui/NaverMap';
import { Notice } from '@/shared/ui/Notice';
import { SelectBox } from '@/shared/ui/SelectBox';
import { Text } from '@/shared/ui/Text';
import type { StoreCategory } from '@/types/domain';
import styles from './FounderExplorePage.module.css';

/**
 * 예비 창업자용 입지 찾기 (Figma node 2:1903).
 * 선택한 업종에 대해 요청 인원이 많은 동네를 순위로 보여준다. 업종은 URL 쿼리(?category=)에도 보관한다.
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
          {/* 사람들: 동작이 정해지지 않아 렌더링만 한다. 이름은 사장님 화면과 같다(임시). */}
          <IconButton label="이웃 보기" icon={<PeopleIcon />} />
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
          요청은 많고 가게는 없는 동네
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
                      accessibleName={text.accessibleName}
                    />
                  </li>
                );
              })}
            </ol>
          ))}
      </section>

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
    </>
  );
}
