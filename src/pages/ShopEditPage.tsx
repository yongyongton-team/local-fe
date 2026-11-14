import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Navigate } from 'react-router';
import { MY_INFO_COPY, SHOP_COPY } from '@/features/my-info/copy';
import { ShopLocationMap, SHOP_ZOOM } from '@/features/my-info/ShopLocationMap';
import { useBackToMyInfo } from '@/features/my-info/useBackToMyInfo';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { useSelection } from '@/features/selection/SelectionContext';
import {
  DEMO_WRITE_BLOCKED_MESSAGE,
  authService,
  demandService,
  describeApiError,
  meService,
} from '@/services';
import { SHOP_NAME_MAX } from '@/shared/lib/inputLimits';
import { geocodeAddress, type GeoPoint } from '@/shared/lib/naverGeocode';
import { paths } from '@/shared/lib/paths';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { useNaverMapScript } from '@/shared/lib/useNaverMapScript';
import { AppBar } from '@/shared/ui/AppBar';
import { Button } from '@/shared/ui/Button';
import { LogoLink } from '@/shared/ui/LogoLink';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/shared/ui/naverMapDefaults';
import { Notice } from '@/shared/ui/Notice';
import { SelectBox } from '@/shared/ui/SelectBox';
import type { Me, StoreCategory } from '@/types/domain';
import styles from './ShopEditPage.module.css';

const loadMe = (signal: AbortSignal) => meService.getMe(signal);
const loadCategories = () => demandService.listCategories();

/** 주소를 입력하다 멈추고 이 시간이 지나면 검색한다(엔터는 바로 검색). */
const ADDRESS_DEBOUNCE_MS = 700;

/**
 * 내 가게 등록·수정 (Figma 41:121). 내 정보(/me)의 "내 가게" 행에서 들어온다. 신규 등록과 수정이 같은 화면이다.
 * 사장님(역할 OWNER)만 쓸 수 있다. 다른 역할이면 /me 로 돌려보낸다.
 * 위치는 지도를 움직여 가운데 핀으로 정하거나 주소로 찾는다. 좌표만 저장하고 동네는 서버가 좌표로 찾는다
 * (클라이언트는 동네를 계산하거나 보여주지 않는다).
 */
export function ShopEditPage() {
  const selection = useSelection();
  const me = useAsyncData(loadMe);
  const categories = useAsyncData(loadCategories);

  let body;
  if (selection.restoring || me.status === 'loading' || categories.status === 'loading') {
    body = <p role="status">{SHOP_COPY.loading}</p>;
  } else if (me.status === 'error') {
    body = <Notice title={MY_INFO_COPY.loadFailedTitle}>{describeLoadError(me.error)}</Notice>;
  } else if (categories.status === 'error') {
    body = (
      <p role="alert" className={styles.error}>
        {SHOP_COPY.categoriesFailed}
      </p>
    );
  } else if ((selection.role ?? me.data.role) !== 'merchant') {
    // 역할은 접근 권한이 아니지만, 사장님이 아니면 가게가 없는 화면이라 내 정보로 보낸다.
    body = <Navigate to={paths.me} replace />;
  } else {
    body = <ShopForm me={me.data} categories={categories.data} />;
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <AppBar title={SHOP_COPY.title} fallbackTo={paths.me} />
      </header>
      {body}
    </div>
  );
}

function ShopForm({ me, categories }: { me: Me; categories: StoreCategory[] }) {
  const goBack = useBackToMyInfo();
  const script = useNaverMapScript();
  const shop = me.shop;

  // 수정 모드: 서버 가게의 업종 id 는 숫자, 목은 이름뿐이라 id 로 찾고 없으면 이름으로 찾는다.
  const savedCategory = shop
    ? categories.find((c) =>
        shop.categoryId !== undefined
          ? c.id === String(shop.categoryId)
          : c.name === shop.categoryName,
      )
    : undefined;
  const savedPoint: GeoPoint | null =
    shop && shop.lat !== undefined && shop.lng !== undefined
      ? { lat: shop.lat, lng: shop.lng }
      : null;

  const [name, setName] = useState(shop?.shopName ?? '');
  const [categoryId, setCategoryId] = useState(savedCategory?.id ?? '');
  // 정해진 가게 위치. 신규 등록은 사용자가 지도를 움직이거나 주소를 찾기 전까지 null 이다(초기 중심을 그대로 저장하지 않는다).
  const [position, setPosition] = useState<GeoPoint | null>(savedPoint);
  const [target, setTarget] = useState<{ point: GeoPoint; seq: number } | null>(null);
  const [query, setQuery] = useState('');
  const [addressNotFound, setAddressNotFound] = useState(false);
  const [mapCrashed, setMapCrashed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  // 낡은 검색 결과가 나중에 도착해 새 결과를 덮어쓰지 않게 하는 번호
  const searchRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const mapReady = script.status === 'ready' && !mapCrashed;
  const mapFailed = mapCrashed || script.status === 'error';
  const canSave =
    name.trim() !== '' &&
    name.trim().length <= SHOP_NAME_MAX &&
    categoryId !== '' &&
    position !== null &&
    mapReady &&
    !saving;

  async function search(text: string) {
    const keyword = text.trim();
    const seq = ++searchRef.current;
    if (keyword === '') {
      setAddressNotFound(false);
      return;
    }
    const point = await geocodeAddress(keyword);
    if (seq !== searchRef.current) return;
    if (!point) {
      setAddressNotFound(true);
      return;
    }
    setAddressNotFound(false);
    setPosition(point);
    setTarget((previous) => ({ point, seq: (previous?.seq ?? 0) + 1 }));
  }

  // 입력이 끝난 뒤 잠시 있다가 검색한다.
  useEffect(() => {
    if (query.trim() === '') return;
    const id = window.setTimeout(() => void search(query), ADDRESS_DEBOUNCE_MS);
    timerRef.current = id;
    return () => window.clearTimeout(id);
  }, [query]);

  function handleAddressKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    // 한글 입력 중(조합 중)의 엔터는 글자를 확정하는 키다. 폼 제출도 막는다.
    event.preventDefault();
    if (event.nativeEvent.isComposing) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    void search(query);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // 저장하는 동안 다시 눌러도 요청이 한 번만 나간다(state 갱신보다 빠른 연타도 막으려고 ref 로 확인한다).
    if (savingRef.current || !canSave || position === null) return;
    setError(null);

    // 데모 세션(공유 계정)은 가게를 만들거나 고치지 않는다(PUT /me/shop 없음). 서비스에도 같은 방어가 있다.
    if (authService.isDemoSession()) {
      setError(DEMO_WRITE_BLOCKED_MESSAGE);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await meService.saveShop({
        shopName: name.trim(),
        categoryId,
        lat: position.lat,
        lng: position.lng,
      });
    } catch (e) {
      // 서버 message 는 쓰지 않는다. 오류 종류·코드로 정한 문구만 보여준다.
      setError(describeApiError(e, 'shop'));
      savingRef.current = false;
      setSaving(false);
      return;
    }
    // 내 정보는 열릴 때 GET /me 로 다시 읽으므로 돌아가면 바뀐 가게가 보인다.
    goBack();
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className={styles.field}>
        <label htmlFor="shop-name" className={styles.label}>
          {SHOP_COPY.nameLabel}
        </label>
        <input
          id="shop-name"
          type="text"
          className={styles.input}
          autoComplete="off"
          maxLength={SHOP_NAME_MAX}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="shop-category" className={styles.label}>
          {SHOP_COPY.categoryLabel}
        </label>
        <div className={styles.select}>
          <SelectBox
            id="shop-category"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setError(null);
            }}
          >
            <option value="" disabled>
              {SHOP_COPY.categoryPlaceholder}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectBox>
        </div>
      </div>

      <div className={styles.field}>
        <p className={styles.label}>{SHOP_COPY.locationLabel}</p>
        <ShopLocationMap
          label={SHOP_COPY.mapLabel}
          initialCenter={savedPoint ?? DEFAULT_CENTER}
          initialZoom={savedPoint ? SHOP_ZOOM : DEFAULT_ZOOM}
          target={target}
          onUserMove={(center) => {
            setPosition(center);
            setError(null);
          }}
          onError={() => setMapCrashed(true)}
        />
        {mapFailed && (
          <p role="alert" className={styles.error}>
            {SHOP_COPY.mapFailed}
          </p>
        )}
        {!mapFailed && !mapReady && <p role="status">{SHOP_COPY.mapLoading}</p>}
      </div>

      <div className={styles.field}>
        <label htmlFor="shop-address" className={styles.label}>
          {SHOP_COPY.addressLabel}
        </label>
        <input
          id="shop-address"
          type="text"
          className={styles.input}
          placeholder={SHOP_COPY.addressPlaceholder}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setAddressNotFound(false);
          }}
          onKeyDown={handleAddressKeyDown}
        />
        {addressNotFound && (
          <p role="status" className={styles.notice}>
            {SHOP_COPY.addressNotFound}
          </p>
        )}
      </div>

      <div className={styles.footer}>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Button type="submit" variant="highlight" fullWidth disabled={!canSave} loading={saving}>
          {SHOP_COPY.save}
        </Button>
      </div>
    </form>
  );
}
