import styles from './SampleDataBadge.module.css';

/** 목 데이터를 보여주는 화면에 붙이는 표시. 실제 통계가 아님을 알린다. */
export function SampleDataBadge() {
  return <span className={styles.badge}>예시 데이터</span>;
}
