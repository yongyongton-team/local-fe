import { ListRowLink } from '@/shared/ui/ListRowLink';
import type { AreaDemand } from '@/types/domain';
import { describeAreaRow } from './areaRows';

/** 사장님 동네 한 줄. 행 전체가 하나의 링크다(문구는 describeAreaRow 가 데이터에서 만든다). */
export function AreaDemandRow({ area, to }: { area: AreaDemand; to: string }) {
  const text = describeAreaRow(area);
  return (
    <ListRowLink
      to={to}
      title={text.title}
      detail={text.detail}
      accessibleName={text.accessibleName}
    />
  );
}
