import { RESIDENT_OFFER_COPY } from './copy';
import { MAX_QUANTITY, MIN_QUANTITY } from './offerView';
import styles from './QuantityStepper.module.css';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** 수량 − / + (Figma 66:518 "수량" 행의 알약). 1~10 을 넘지 않는다. */
export function QuantityStepper({ value, onChange, disabled = false }: QuantityStepperProps) {
  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.button}
        aria-label={RESIDENT_OFFER_COPY.quantityDecrease}
        disabled={disabled || value <= MIN_QUANTITY}
        onClick={() => onChange(Math.max(MIN_QUANTITY, value - 1))}
      >
        −
      </button>
      <output className={styles.value}>{value}</output>
      <button
        type="button"
        className={styles.button}
        aria-label={RESIDENT_OFFER_COPY.quantityIncrease}
        disabled={disabled || value >= MAX_QUANTITY}
        onClick={() => onChange(Math.min(MAX_QUANTITY, value + 1))}
      >
        +
      </button>
    </div>
  );
}
