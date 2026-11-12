import { DEFAULT_AVATAR_ID } from '../../services/authStorage';

export { DEFAULT_AVATAR_ID };

export interface StarterAvatarOption {
  id: string;
  label: string;
  subtitle: string;
  shirtHex: string;
  hairHex: string;
  skinHex: string;
  accessory: 'none' | 'glasses' | 'headphones' | 'leaf';
}

export const STARTER_AVATARS: readonly StarterAvatarOption[] = [
  {
    id: 'default_student',
    label: 'Học sinh chuẩn',
    subtitle: 'Áo xanh thư viện',
    shirtHex: '#38bdf8',
    hairHex: '#1e293b',
    skinHex: '#f6d2b5',
    accessory: 'none',
  },
  {
    id: 'student_glasses',
    label: 'Mọt sách',
    subtitle: 'Kính cận tập trung',
    shirtHex: '#34d399',
    hairHex: '#3f2e21',
    skinHex: '#f4c7a1',
    accessory: 'glasses',
  },
  {
    id: 'student_hoodie',
    label: 'Lofi Chill',
    subtitle: 'Tai nghe chống ồn',
    shirtHex: '#f59e0b',
    hairHex: '#0f172a',
    skinHex: '#eab892',
    accessory: 'headphones',
  },
  {
    id: 'student_sprout',
    label: 'Mầm xanh',
    subtitle: 'Chăm chỉ mỗi ngày',
    shirtHex: '#2dd4bf',
    hairHex: '#4a3525',
    skinHex: '#f7d5ba',
    accessory: 'leaf',
  },
] as const;

export function findAvatarOption(avatarId: string): StarterAvatarOption {
  return (
    STARTER_AVATARS.find((item) => item.id === avatarId) ?? STARTER_AVATARS[0]
  );
}

export function StarterAvatarPortrait({
  avatarId,
  size = 44,
}: {
  avatarId: string;
  size?: number;
}) {
  const avatar = findAvatarOption(avatarId);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="shrink-0 rounded-lg bg-slate-900/70"
    >
      <path
        d="M12 44C12 36.268 17.373 31 24 31C30.627 31 36 36.268 36 44"
        fill={avatar.shirtHex}
      />
      <circle cx="24" cy="21" r="10" fill={avatar.skinHex} />
      <path
        d="M14 20C14 13.5 18.5 10 24 10C29.5 10 34 13.5 34 20C32 16.5 28.5 15 24 15C19.5 15 16 16.5 14 20Z"
        fill={avatar.hairHex}
      />
      <circle cx="20.5" cy="22" r="1.4" fill="#0f172a" />
      <circle cx="27.5" cy="22" r="1.4" fill="#0f172a" />
      <path
        d="M21.5 26C22.4 27 25.6 27 26.5 26"
        stroke="#0f172a"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {avatar.accessory === 'glasses' ? (
        <g stroke="#e2e8f0" strokeWidth="1.4">
          <rect x="17" y="19.5" width="5.5" height="4.5" rx="1.2" />
          <rect x="25.5" y="19.5" width="5.5" height="4.5" rx="1.2" />
          <line x1="22.5" y1="21.5" x2="25.5" y2="21.5" />
        </g>
      ) : null}
      {avatar.accessory === 'headphones' ? (
        <g>
          <path
            d="M13 21C13 14.5 17.8 9.5 24 9.5C30.2 9.5 35 14.5 35 21"
            stroke="#e2e8f0"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <rect x="11" y="18.5" width="3.5" height="7" rx="1.5" fill="#38bdf8" />
          <rect x="33.5" y="18.5" width="3.5" height="7" rx="1.5" fill="#38bdf8" />
        </g>
      ) : null}
      {avatar.accessory === 'leaf' ? (
        <g>
          <path d="M24 10V5.5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M24 6C26.5 3.5 30 4 29.5 6.8C29 8.5 26 8.5 24 6Z"
            fill="#4ade80"
          />
        </g>
      ) : null}
    </svg>
  );
}
