import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { demandService, describeApiError, meService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { Button } from '@/shared/ui/Button';
import { CheckCircleIcon } from '@/shared/ui/icons';
import { SelectBox } from '@/shared/ui/SelectBox';
import type { UserRole } from '@/types/domain';
import characters from './assets/role-characters.png';
import { ROLE_OPTIONS } from './roles';
import { useSelection } from './SelectionContext';
import styles from './RoleSelectForm.module.css';

const loadNeighborhoods = () => demandService.listNeighborhoods();

/**
 * 캐릭터 스프라이트(role-characters.png, 세 명이 가로로 나란히)에서 역할별로 잘라 쓰는 값.
 * Figma(node 2:1169)의 이미지 크롭 값 그대로다: 박스 너비(px), 이미지 너비(%), 왼쪽 이동(%).
 */
const CHARACTER_CROP: Record<UserRole, { width: number; imageWidth: string; imageLeft: string }> = {
  resident: { width: 39, imageWidth: '299.07%', imageLeft: '0%' },
  merchant: { width: 38, imageWidth: '314.75%', imageLeft: '-105.08%' },
  founder: { width: 36, imageWidth: '323.78%', imageLeft: '-218.38%' },
};

/**
 * 역할과 동네를 고르고 시작하는 폼. 역할 선택 차이는 별도 페이지가 아니라 이 폼의 상태다.
 * Figma 첫 상태처럼 역할은 아무것도 선택하지 않은 채 시작하고, 동네는 목록의 첫 항목이 기본 선택된다.
 */
export function RoleSelectForm() {
  const navigate = useNavigate();
  const selection = useSelection();
  const neighborhoods = useAsyncData(loadNeighborhoods);

  const [role, setRole] = useState<UserRole | null>(selection.role);
  const [chosenNeighborhoodId, setChosenNeighborhoodId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState(false);
  // 역할·동네 저장(PUT /me) 진행 중 여부와 실패 안내. 서버 message 가 아니라 오류 종류·코드로 정한 문구다.
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const firstRadioRef = useRef<HTMLInputElement>(null);

  const list = neighborhoods.status === 'success' ? neighborhoods.data : [];
  // 사용자가 고르기 전에는 이전 선택, 없으면 목록의 첫 동네를 보여준다.
  const neighborhoodId = chosenNeighborhoodId ?? selection.neighborhood?.id ?? list[0]?.id ?? '';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // 저장하는 동안 다시 눌러도 요청이 한 번만 나간다(state 갱신보다 빠른 연타도 막으려고 ref 로 확인한다).
    if (submittingRef.current) return;
    if (!role) {
      setRoleError(true);
      firstRadioRef.current?.focus();
      return;
    }
    const neighborhood = list.find((n) => n.id === neighborhoodId);
    if (!neighborhood) return;

    // mock 모드는 서버에 저장하지 않으므로 기다리지 않고 바로 이동한다(기존 동작 그대로, 네트워크 없음).
    if (meService.savesRemotely) {
      submittingRef.current = true;
      setSubmitting(true);
      setSubmitError(null);
      try {
        // api 모드: PUT /me 로 역할과 동네를 저장한다.
        await meService.saveSelection(role, neighborhood.id);
      } catch (error) {
        // 실패하면 이동하지 않고 안내를 보여준다.
        setSubmitError(describeApiError(error));
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }
    }
    selection.select(role, neighborhood);
    const target = ROLE_OPTIONS.find((option) => option.role === role);
    if (target) void navigate(target.homePath);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <fieldset className={styles.roles} aria-describedby={roleError ? 'role-error' : undefined}>
        <legend className={`${styles.label} ${styles.roleLabelInset}`}>나는</legend>
        {ROLE_OPTIONS.map((option, index) => {
          const checked = option.role === role;
          const crop = CHARACTER_CROP[option.role];
          return (
            <label key={option.role} className={styles.roleOption}>
              <input
                ref={index === 0 ? firstRadioRef : undefined}
                type="radio"
                name="role"
                value={option.role}
                checked={checked}
                onChange={() => {
                  setRole(option.role);
                  setRoleError(false);
                  setSubmitError(null);
                }}
                className="visually-hidden"
              />
              <span className={`${styles.roleCard} ${checked ? styles.roleCardChecked : ''}`}>
                <span className={styles.characterSlot} aria-hidden="true">
                  <span className={styles.character} style={{ width: crop.width }}>
                    <img
                      src={characters}
                      alt=""
                      decoding="async"
                      className={styles.characterImage}
                      style={{ '--w': crop.imageWidth, '--left': crop.imageLeft } as CSSProperties}
                    />
                  </span>
                </span>
                <span className={styles.roleText}>
                  <span className={styles.roleTitle}>{option.label}</span>
                  <span className={styles.roleDescription}>{option.description}</span>
                </span>
                <span className={styles.roleMark} aria-hidden="true">
                  <CheckCircleIcon filled={checked} />
                </span>
              </span>
            </label>
          );
        })}
        {roleError && (
          <p id="role-error" role="alert" className={styles.error}>
            역할을 선택해 주세요.
          </p>
        )}
      </fieldset>

      <div className={styles.field}>
        <label
          htmlFor="neighborhood"
          className={`${styles.label} ${styles.neighborhoodLabelInset}`}
        >
          내 동네
        </label>
        <SelectBox
          id="neighborhood"
          value={neighborhoodId}
          onChange={(event) => {
            setChosenNeighborhoodId(event.target.value);
            setSubmitError(null);
          }}
          disabled={neighborhoods.status !== 'success'}
        >
          {neighborhoods.status === 'success' ? (
            list.map((n) => (
              <option key={n.id} value={n.id}>
                {n.district} {n.name}
              </option>
            ))
          ) : (
            <option value="">
              {neighborhoods.status === 'loading' ? '불러오는 중이에요' : '불러오지 못했어요'}
            </option>
          )}
        </SelectBox>
        {neighborhoods.status === 'error' && (
          <p role="alert" className={styles.error}>
            동네 목록을 불러오지 못했어요. 새로고침해 주세요.
          </p>
        )}
      </div>

      <div className={styles.submit}>
        {submitError && (
          <p role="alert" className={styles.error}>
            {submitError}
          </p>
        )}
        <Button type="submit" fullWidth loading={submitting}>
          시작하기
        </Button>
      </div>
    </form>
  );
}
