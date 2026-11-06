import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { demandService } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { Button } from '@/shared/ui/Button';
import { CheckIcon } from '@/shared/ui/icons';
import type { UserRole } from '@/types/domain';
import { ROLE_OPTIONS } from './roles';
import { useSelection } from './SelectionContext';
import styles from './RoleSelectForm.module.css';

const loadNeighborhoods = () => demandService.listNeighborhoods();

/** 역할과 동네를 고르고 시작하는 폼. 역할 선택 차이는 별도 페이지가 아니라 이 폼의 상태다. */
export function RoleSelectForm() {
  const navigate = useNavigate();
  const selection = useSelection();
  const neighborhoods = useAsyncData(loadNeighborhoods);

  // 기본 역할은 Figma 첫 상태(주민 선택)를 따른다.
  const [role, setRole] = useState<UserRole>(selection.role ?? 'resident');
  const [neighborhoodId, setNeighborhoodId] = useState(selection.neighborhood?.id ?? '');
  const [showError, setShowError] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const neighborhood =
      neighborhoods.status === 'success'
        ? neighborhoods.data.find((n) => n.id === neighborhoodId)
        : undefined;
    if (!neighborhood) {
      setShowError(true);
      selectRef.current?.focus();
      return;
    }
    selection.select(role, neighborhood);
    const target = ROLE_OPTIONS.find((option) => option.role === role);
    if (target) void navigate(target.homePath);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <fieldset className={styles.roles}>
        <legend className={styles.legend}>나는</legend>
        {ROLE_OPTIONS.map((option) => {
          const checked = option.role === role;
          return (
            <label key={option.role} className={styles.roleOption}>
              <input
                type="radio"
                name="role"
                value={option.role}
                checked={checked}
                onChange={() => setRole(option.role)}
                className="visually-hidden"
              />
              <span className={`${styles.roleCard} ${checked ? styles.roleCardChecked : ''}`}>
                <span className={styles.roleText}>
                  <span className={styles.roleLabel}>{option.label}</span>
                  <span className={styles.roleDescription}>{option.description}</span>
                </span>
                <span className={styles.roleMark} aria-hidden="true">
                  {checked && <CheckIcon />}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor="neighborhood" className={styles.legend}>
          내 동네
        </label>
        <select
          id="neighborhood"
          ref={selectRef}
          className={styles.select}
          value={neighborhoodId}
          onChange={(event) => {
            setNeighborhoodId(event.target.value);
            setShowError(false);
          }}
          aria-invalid={showError}
          aria-describedby={showError ? 'neighborhood-error' : undefined}
          disabled={neighborhoods.status === 'loading'}
        >
          <option value="">
            {neighborhoods.status === 'loading' ? '불러오는 중이에요' : '동네를 선택해 주세요'}
          </option>
          {neighborhoods.status === 'success' &&
            neighborhoods.data.map((n) => (
              <option key={n.id} value={n.id}>
                {n.district} {n.name}
              </option>
            ))}
        </select>
        {neighborhoods.status === 'error' && (
          <p role="alert" className={styles.error}>
            동네 목록을 불러오지 못했어요. 새로고침해 주세요.
          </p>
        )}
        {showError && (
          <p id="neighborhood-error" role="alert" className={styles.error}>
            동네를 선택해 주세요.
          </p>
        )}
      </div>

      <Button type="submit" fullWidth>
        시작하기
      </Button>
    </form>
  );
}
