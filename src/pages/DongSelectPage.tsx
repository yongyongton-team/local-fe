import { useRef, useState } from 'react';
import { DONG_SELECT_COPY, MY_INFO_COPY } from '@/features/my-info/copy';
import { useBackToMyInfo } from '@/features/my-info/useBackToMyInfo';
import { useSelection } from '@/features/selection/SelectionContext';
import {
  DEMO_WRITE_BLOCKED_MESSAGE,
  authService,
  demandService,
  describeApiError,
  meService,
} from '@/services';
import { paths } from '@/shared/lib/paths';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { AppBar } from '@/shared/ui/AppBar';
import { Button } from '@/shared/ui/Button';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { CheckIcon, SearchIcon } from '@/shared/ui/icons';
import { LogoLink } from '@/shared/ui/LogoLink';
import type { Neighborhood } from '@/types/domain';
import styles from './DongSelectPage.module.css';

const loadNeighborhoods = () => demandService.listNeighborhoods();

/**
 * 동네 선택 (Figma 41:75). 내 정보(/me)에서 들어와 내 동네를 바꾼다.
 * - 구 칩은 동 목록 데이터에서 만든다(하드코딩 없음). 처음에는 현재 내 동네의 구가 선택된다.
 * - 검색은 동 이름 부분 일치이고 구 칩과 함께 적용된다.
 * - 목록은 약 6행 높이에서 카드 안에서 스크롤한다.
 * - "이 동네로 정하기": 현재 동네와 같으면 호출 없이 돌아가고, 다르면 PUT /me 로 저장한 뒤 Context 를 갱신하고 돌아간다.
 */
export function DongSelectPage() {
  const selection = useSelection();
  const neighborhoods = useAsyncData(loadNeighborhoods);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <AppBar title={DONG_SELECT_COPY.title} fallbackTo={paths.me} />
      </header>

      {selection.restoring || neighborhoods.status === 'loading' ? (
        <p role="status">{DONG_SELECT_COPY.listLoading}</p>
      ) : neighborhoods.status === 'error' ? (
        <p role="alert" className={styles.error}>
          {DONG_SELECT_COPY.listFailed}
        </p>
      ) : (
        <Picker list={neighborhoods.data} />
      )}
    </div>
  );
}

function Picker({ list }: { list: Neighborhood[] }) {
  const goBack = useBackToMyInfo();
  const selection = useSelection();
  const current = selection.neighborhood;

  const [query, setQuery] = useState('');
  const [chosenDistrict, setChosenDistrict] = useState<string | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // 구는 목록 순서(서버: 구 가나다 순)대로 중복 없이 모은다. 구 정보가 없는 동네는 칩을 만들지 않는다.
  const districts = [...new Set(list.map((n) => n.district).filter(Boolean))];
  const currentDistrict = list.find((n) => n.id === current?.id)?.district ?? current?.district;
  // 고르기 전에는 현재 내 동네의 구, 없거나 목록에 없으면 첫 구.
  const district =
    chosenDistrict ?? (districts.includes(currentDistrict ?? '') ? currentDistrict : districts[0]);
  const selectedId = chosenId ?? current?.id ?? null;
  const selected = list.find((n) => n.id === selectedId) ?? null;

  const keyword = query.trim();
  const visible = list.filter(
    (n) =>
      (district === undefined || n.district === district) &&
      (keyword === '' || n.name.includes(keyword)),
  );

  async function save() {
    if (savingRef.current || !selected) return;
    setError(null);

    // 현재 동네와 같으면 저장할 것이 없다(서버 호출 없음).
    if (selected.id === current?.id) {
      goBack();
      return;
    }
    // 서버는 역할과 동네를 함께 저장한다. 역할이 없으면 저장할 수 없다.
    const role = selection.role;
    if (!role) {
      setError(MY_INFO_COPY.needsRole);
      return;
    }
    // 데모 세션(공유 계정)은 동네를 바꾸지 않는다(PUT /me 없음). 서비스에도 같은 방어가 있다.
    if (authService.isDemoSession()) {
      setError(DEMO_WRITE_BLOCKED_MESSAGE);
      return;
    }

    if (meService.savesRemotely) {
      savingRef.current = true;
      setSaving(true);
      try {
        await meService.saveSelection(role, selected.id);
      } catch (e) {
        // 서버 message 는 쓰지 않는다. 오류 종류·코드로 정한 문구만 보여준다.
        setError(describeApiError(e));
        savingRef.current = false;
        setSaving(false);
        return;
      }
    }
    selection.select(role, selected);
    goBack();
  }

  return (
    <>
      <div className={styles.search}>
        <label htmlFor="dong-search" className="visually-hidden">
          {DONG_SELECT_COPY.searchLabel}
        </label>
        <input
          id="dong-search"
          type="text"
          className={styles.searchInput}
          placeholder={DONG_SELECT_COPY.searchPlaceholder}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setError(null);
          }}
        />
        <span className={styles.searchIcon} aria-hidden="true">
          <SearchIcon />
        </span>
      </div>

      {districts.length > 0 && (
        <div className={styles.districts}>
          <ChipGroup
            label={DONG_SELECT_COPY.districtGroupLabel}
            options={districts.map((d) => ({ value: d, label: d }))}
            value={district ?? null}
            onChange={setChosenDistrict}
            showCheck={false}
            size="large"
          />
        </div>
      )}

      <div className={styles.listCard}>
        {visible.length > 0 ? (
          <ul className={styles.list} aria-label={DONG_SELECT_COPY.listLabel}>
            {visible.map((n) => {
              const active = n.id === selectedId;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`${styles.row} ${active ? styles.rowActive : ''}`}
                    aria-pressed={active}
                    onClick={() => {
                      setChosenId(n.id);
                      setError(null);
                    }}
                  >
                    <span>{n.name}</span>
                    {active && (
                      <span className={styles.check} aria-hidden="true">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p role="status" className={styles.empty}>
            {DONG_SELECT_COPY.noResults}
          </p>
        )}
      </div>

      <div className={styles.footer}>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Button
          type="button"
          fullWidth
          disabled={!selected}
          loading={saving}
          onClick={() => void save()}
        >
          {DONG_SELECT_COPY.confirm}
        </Button>
      </div>
    </>
  );
}
