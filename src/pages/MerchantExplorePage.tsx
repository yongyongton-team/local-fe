import { useState } from 'react';
import { AreaDemandRow } from '@/features/merchant-explore/AreaDemandRow';
import { buildRadiusSummary, buildSubtitle } from '@/features/merchant-explore/areaRows';
import {
  DEFAULT_RADIUS,
  RADIUS_OPTIONS,
  type RadiusValue,
} from '@/features/merchant-explore/constants';
import {
  useAreaDemands,
  useMerchantMapData,
  useMerchantProfile,
} from '@/features/merchant-explore/useMerchantExplore';
import { paths } from '@/shared/lib/paths';
import { LogoLink } from '@/shared/ui/LogoLink';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { IconButton } from '@/shared/ui/IconButton';
import { PeopleIcon, SearchIcon } from '@/shared/ui/icons';
import { NaverMap } from '@/shared/ui/NaverMap';
import { Notice } from '@/shared/ui/Notice';
import { Text } from '@/shared/ui/Text';
import styles from './MerchantExplorePage.module.css';

const RADIUS_CHIP_OPTIONS = RADIUS_OPTIONS.map(({ value, label }) => ({ value, label }));

/**
 * 사장님용 수요 동네 탐색 (Figma node 2:1712 / 2:1763 / 2:1814: 반경 칩 상태만 다른 같은 화면).
 * 역할 선택은 접근 권한이 아니므로 선택된 역할·동네 없이 직접 들어와도 렌더링한다.
 * 하단 내비게이션과 동네 선택 버튼은 이 화면에 없다.
 * 지도는 반경 칩이 바뀌어도 그대로다. 반경 값(km)은 지도 연동 때 실제 반경으로 쓰도록 origin 에 담아 둔다.
 */
export function MerchantExplorePage() {
  const [radius, setRadius] = useState<RadiusValue>(DEFAULT_RADIUS);
  const option = RADIUS_OPTIONS.find((o) => o.value === radius) ?? RADIUS_OPTIONS[0];

  const profile = useMerchantProfile();
  const map = useMerchantMapData();

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <div className={styles.headerRow}>
          {/* 사장님 가게 정보(보조 텍스트). 로그인과 가게 등록이 없어 목 프로필이다. */}
          <p className={styles.shop}>
            {profile.status === 'success'
              ? `${profile.data.shopName} · ${profile.data.categoryName}`
              : ''}
          </p>
          {/* 검색·사람들: 동작이 정해지지 않아 렌더링만 한다. 이름은 임시다. */}
          <div className={styles.actions}>
            <IconButton label="검색" icon={<SearchIcon />} />
            <IconButton label="이웃 보기" icon={<PeopleIcon />} />
          </div>
        </div>
      </header>

      <div className={styles.filters}>
        <ChipGroup
          label="탐색 반경"
          options={RADIUS_CHIP_OPTIONS}
          value={radius}
          onChange={setRadius}
        />
      </div>

      <div className={styles.mapBleed}>
        <NaverMap
          label="수요 지도(예시)"
          markers={map.status === 'success' ? map.data.markers : []}
          origin={
            map.status === 'success' ? { ...map.data.origin, radiusKm: option.km } : undefined
          }
        />
      </div>

      <section className={styles.listSection} aria-labelledby="merchant-areas">
        <Text as="h1" variant="contents" id="merchant-areas">
          내 업종을 원하는 동네
        </Text>
        <Text variant="caption">{buildSubtitle(option.label)}</Text>
        {profile.status === 'loading' && <p role="status">불러오는 중이에요.</p>}
        {profile.status === 'error' && (
          <Notice title="가게 정보를 가져오지 못했어요">잠시 후 다시 시도해 주세요.</Notice>
        )}
        {profile.status === 'success' && (
          <AreaList
            categoryId={profile.data.categoryId}
            radiusLabel={option.label}
            radiusKm={option.km}
          />
        )}
      </section>
    </div>
  );
}

function AreaList({
  categoryId,
  radiusLabel,
  radiusKm,
}: {
  categoryId: string;
  radiusLabel: string;
  radiusKm: number | null;
}) {
  const areas = useAreaDemands(categoryId, radiusKm);

  return (
    <>
      {/* 반경이 바뀔 때 목록 변화를 보조 기술에 알린다. */}
      <p className="visually-hidden" aria-live="polite">
        {areas.status === 'success' ? buildRadiusSummary(radiusLabel, areas.data.length) : ''}
      </p>
      {areas.status === 'loading' && <p role="status">불러오는 중이에요.</p>}
      {areas.status === 'error' && (
        <Notice title="데이터를 가져오지 못했어요">잠시 후 다시 시도해 주세요.</Notice>
      )}
      {areas.status === 'success' &&
        (areas.data.length === 0 ? (
          <Notice title={`${radiusLabel}에는 아직 요청이 없어요`} />
        ) : (
          <ol className={styles.areaList}>
            {areas.data.map((area) => (
              <li key={area.neighborhood.id}>
                <AreaDemandRow area={area} to={paths.merchantArea(area.neighborhood.id)} />
              </li>
            ))}
          </ol>
        ))}
    </>
  );
}
