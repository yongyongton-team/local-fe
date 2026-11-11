import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MY_INFO_COPY } from '@/features/my-info/copy';
import { MyInfoIllustration } from '@/features/my-info/MyInfoIllustration';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { ROLE_OPTIONS } from '@/features/selection/roles';
import { useSelection } from '@/features/selection/SelectionContext';
import { DEMO_WRITE_BLOCKED_MESSAGE, authService, describeApiError, meService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { paths } from '@/shared/lib/paths';
import { AppBar } from '@/shared/ui/AppBar';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { AvatarIcon, ChevronRightIcon } from '@/shared/ui/icons';
import { LogoLink } from '@/shared/ui/LogoLink';
import { Notice } from '@/shared/ui/Notice';
import type { Me, Neighborhood, UserRole } from '@/types/domain';
import styles from './MyInfoPage.module.css';

const loadMe = (signal: AbortSignal) => meService.getMe(signal);

const ROLE_CHIPS = ROLE_OPTIONS.map(({ role, label }) => ({ value: role, label }));

/**
 * 내 정보 (Figma 41:31). 진입 링크는 아직 없다(디자인 대기) — 주소(/me)로만 열 수 있다.
 * - 닉네임·ID·가게는 GET /me, 역할·동네는 선택 Context(없으면 GET /me 의 값)를 쓴다.
 * - 역할 칩을 누르면 PUT /me 로 바꾸고 그 역할의 첫 화면으로 이동한다. 데모 세션은 서버에 쓰지 않고 막는다.
 * - "내 가게" 행은 역할이 사장님일 때만 보인다.
 * - 일러스트는 장식이고, 칩에 보이는(선택 중인) 역할의 캐릭터가 활성이다. 역할이 없으면 사장님 상태(디자인 기준)다.
 * - "내 가게" 행(사장님만)은 가게 등록·수정(/me/shop)으로 간다. 가게가 없어도 눌러서 등록한다.
 */
export function MyInfoPage() {
  const selection = useSelection();
  const me = useAsyncData(loadMe);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <AppBar title={MY_INFO_COPY.title} fallbackTo={paths.home} />
      </header>

      {(me.status === 'loading' || selection.restoring) && <p role="status">불러오는 중이에요.</p>}
      {me.status === 'error' && !selection.restoring && (
        <Notice title={MY_INFO_COPY.loadFailedTitle}>{describeLoadError(me.error)}</Notice>
      )}
      {me.status === 'success' && !selection.restoring && <Content me={me.data} />}
    </div>
  );
}

/** 서버의 내 동네(GET /me)를 도메인 동네로 바꾼다. 동네 id 는 문자열이다. */
function toNeighborhood(dong: Me['dong']): Neighborhood | null {
  return dong ? { id: String(dong.id), district: dong.district, name: dong.name } : null;
}

function Content({ me }: { me: Me }) {
  const navigate = useNavigate();
  const selection = useSelection();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // state 갱신보다 빠른 연타를 막는다.
  const savingRef = useRef(false);

  // 역할 변경을 서버에 저장하는 동안 칩과 일러스트가 선택 중인 역할을 따라간다. 실패하면 원래 역할로 돌아간다.
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const savedRole = selection.role ?? me.role;
  const role = pendingRole ?? savedRole;
  const neighborhood = selection.neighborhood ?? toNeighborhood(me.dong);
  const nickname = me.nickname.trim() || MY_INFO_COPY.fallbackNickname;

  async function changeRole(next: UserRole) {
    if (savingRef.current || next === savedRole) return;
    setError(null);

    // 데모 세션(공유 계정)은 역할을 바꾸지 않는다(PUT /me 없음). 서비스에도 같은 방어가 있다.
    if (authService.isDemoSession()) {
      setError(DEMO_WRITE_BLOCKED_MESSAGE);
      return;
    }

    if (meService.savesRemotely) {
      // 서버는 역할과 동네를 함께 받는다.
      if (!neighborhood) {
        setError(MY_INFO_COPY.needsDong);
        return;
      }
      savingRef.current = true;
      setSaving(true);
      setPendingRole(next);
      try {
        await meService.saveSelection(next, neighborhood.id);
      } catch (e) {
        setError(describeApiError(e));
        savingRef.current = false;
        setSaving(false);
        setPendingRole(null);
        return;
      }
    }
    selection.select(next, neighborhood);
    const target = ROLE_OPTIONS.find((option) => option.role === next);
    void navigate(target?.homePath ?? paths.home);
  }

  const shop = me.shop;
  const shopValue = shop
    ? [shop.shopName, shop.categoryName].filter(Boolean).join(' · ') || MY_INFO_COPY.shopEmpty
    : MY_INFO_COPY.shopEmpty;

  return (
    <>
      <section className={styles.profile} aria-label="프로필">
        <div className={styles.profileRow}>
          <span className={styles.avatar}>
            <AvatarIcon />
          </span>
          <div className={styles.names}>
            <p className={styles.nickname}>
              <span className={styles.nicknameText}>{nickname}</span>
              {MY_INFO_COPY.nicknameSuffix}
            </p>
            <p className={styles.id}>
              {MY_INFO_COPY.idLabel}
              {me.id}
            </p>
          </div>
        </div>
        <p className={styles.note}>{MY_INFO_COPY.nicknameNote}</p>
      </section>

      <div className={styles.roles}>
        <p className={styles.roleLabel}>{MY_INFO_COPY.roleLabel}</p>
        <ChipGroup
          label={MY_INFO_COPY.roleGroupLabel}
          options={ROLE_CHIPS}
          value={role}
          onChange={(next) => void changeRole(next)}
          showCheck={false}
          size="large"
        />
        {saving && (
          <p role="status" className="visually-hidden">
            저장하는 중이에요.
          </p>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>

      <MyInfoIllustration role={role} />

      <ul className={styles.card}>
        <li>
          <Link to={paths.meDong} className={`${styles.row} ${styles.rowLink}`}>
            <span className={styles.rowLabel}>{MY_INFO_COPY.myDong}</span>
            <span className={styles.rowValue}>
              {neighborhood
                ? `${neighborhood.district} ${neighborhood.name}`.trim()
                : MY_INFO_COPY.dongEmpty}
            </span>
            <span className={styles.chevron} aria-hidden="true">
              <ChevronRightIcon />
            </span>
          </Link>
        </li>
        {/* 행은 저장된 역할을 따른다. 변경을 저장하는 동안 선택 중인 역할로 행이 늘거나 줄어 화면이 밀리지 않게 한다. */}
        {savedRole === 'merchant' && (
          <li>
            <Link to={paths.meShop} className={`${styles.row} ${styles.rowLink}`}>
              <span className={styles.rowLabel}>{MY_INFO_COPY.myShop}</span>
              <span className={styles.rowValue}>{shopValue}</span>
              <span className={styles.chevron} aria-hidden="true">
                <ChevronRightIcon />
              </span>
            </Link>
          </li>
        )}
      </ul>
    </>
  );
}
