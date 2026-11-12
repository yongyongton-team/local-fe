import founder from '@/assets/my-info/my-info-founder.webp';
import glow from '@/assets/my-info/my-info-glow.svg';
import owner from '@/assets/my-info/my-info-owner.webp';
import resident from '@/assets/my-info/my-info-resident.webp';
import type { UserRole } from '@/types/domain';
import styles from './MyInfoIllustration.module.css';

/** 일러스트의 캐릭터 슬롯. 왼쪽 주민, 가운데 사장님, 오른쪽 예비 창업자. 가로세로는 에셋 원본 크기다(비율만 쓴다). */
type IllustrationRole = 'resident' | 'owner' | 'founder';
const CHARACTERS: readonly {
  role: IllustrationRole;
  src: string;
  width: number;
  height: number;
  className: string;
}[] = [
  { role: 'resident', src: resident, width: 465, height: 594, className: styles.resident ?? '' },
  { role: 'owner', src: owner, width: 441, height: 594, className: styles.owner ?? '' },
  { role: 'founder', src: founder, width: 428, height: 594, className: styles.founder ?? '' },
];

/** 도메인 역할 → 슬롯. 역할이 아직 없으면(null) 디자인 기준 상태인 사장님이다. */
function toIllustrationRole(role: UserRole | null): IllustrationRole {
  if (role === 'resident') return 'resident';
  if (role === 'founder') return 'founder';
  return 'owner';
}

/**
 * 내 정보 화면의 일러스트(Figma 41:31). 선택한 역할의 캐릭터가 활성(크게, 불투명)이고 뒤에 연두색 빛 번짐이 있으며,
 * 나머지 둘은 작게 낮은 자리에 투명도 50% 로 놓인다. 사장님이 선택된 상태가 디자인 기준이다.
 * 활성이 바뀌면 크기·투명도·빛 번짐 위치가 부드럽게 바뀐다(움직임 줄이기 설정이면 바로). 영역 높이는 고정이다.
 * 장식이라 이름이 없고 보조 기술에서 숨긴다. data-role·data-active 는 테스트용 표시다.
 */
export function MyInfoIllustration({ role }: { role: UserRole | null }) {
  const active = toIllustrationRole(role);
  return (
    <div className={styles.area} aria-hidden="true">
      <div className={styles.illustration} data-active-role={active}>
        <img
          src={glow}
          alt=""
          width={245}
          height={245}
          className={styles.glow}
          data-role={active}
        />
        {CHARACTERS.map((character) => (
          <img
            key={character.role}
            src={character.src}
            alt=""
            width={character.width}
            height={character.height}
            className={`${styles.character} ${character.className}`}
            data-role={character.role}
            data-active={character.role === active}
          />
        ))}
      </div>
    </div>
  );
}
