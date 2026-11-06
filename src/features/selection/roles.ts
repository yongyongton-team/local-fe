import { paths } from '@/shared/lib/paths';
import type { UserRole } from '@/types/domain';

export const ROLE_OPTIONS: readonly {
  role: UserRole;
  label: string;
  description: string;
  homePath: string;
}[] = [
  {
    role: 'resident',
    label: '주민',
    description: '우리 동네에 생겼으면 하는 가게를 요청해요',
    homePath: paths.resident,
  },
  {
    role: 'merchant',
    label: '사장님',
    description: '내 업종을 원하는 동네를 찾아요',
    homePath: paths.merchant,
  },
  {
    role: 'founder',
    label: '예비 창업자',
    description: '가게를 열 동네를 찾아요',
    homePath: paths.founder,
  },
];
