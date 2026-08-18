import type { AudioRole } from '../types';

export const STANDARD_ROLES: { role: AudioRole; label: string; hint: string }[] = [
  { role: 'pledge', label: '국기에 대한 맹세', hint: '맹세문 낭독 음원' },
  { role: 'anthem', label: '애국가', hint: '보통 1절' },
  { role: 'silence', label: '묵념곡', hint: '순국선열에 대한 묵념' },
  { role: 'schoolSong', label: '교가', hint: '우리 학교 교가' },
  { role: 'entrance', label: '입장곡', hint: '졸업식·입학식 입장' },
  { role: 'exit', label: '퇴장곡', hint: '행사 마무리' },
  { role: 'award', label: '시상 배경음', hint: '시상식 배경' },
];

export function roleLabel(role: AudioRole): string {
  const found = STANDARD_ROLES.find((entry) => entry.role === role);
  if (found !== undefined) return found.label;
  return role.startsWith('custom:') ? role.slice('custom:'.length) : role;
}
