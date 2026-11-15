import {
  DEFAULT_AVATAR_ID,
  DEFAULT_DESK_PET_ID,
  DEFAULT_HAT_ID,
} from '../../services/authStorage';

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
  { id: 'default_student', label: 'Học sinh chuẩn', subtitle: 'Áo xanh thư viện', shirtHex: '#38bdf8', hairHex: '#1e293b', skinHex: '#f6d2b5', accessory: 'none' },
  { id: 'student_glasses', label: 'Mọt sách', subtitle: 'Kính cận tập trung', shirtHex: '#34d399', hairHex: '#3f2e21', skinHex: '#f4c7a1', accessory: 'glasses' },
  { id: 'student_hoodie', label: 'Lofi Chill', subtitle: 'Tai nghe chống ồn', shirtHex: '#f59e0b', hairHex: '#0f172a', skinHex: '#eab892', accessory: 'headphones' },
  { id: 'student_sprout', label: 'Mầm xanh', subtitle: 'Chăm chỉ mỗi ngày', shirtHex: '#2dd4bf', hairHex: '#4a3525', skinHex: '#f7d5ba', accessory: 'leaf' },
] as const;

const EXTRA_CATALOG_SKINS: Readonly<Record<string, StarterAvatarOption>> = {
  skin_hoodie_blue: { id: 'skin_hoodie_blue', label: 'Áo Hoodie Xanh', subtitle: 'Thư viện đêm', shirtHex: '#2563eb', hairHex: '#0f172a', skinHex: '#f4c7a1', accessory: 'none' },
  skin_scholar_blazer: { id: 'skin_scholar_blazer', label: 'Blazer Học Giả', subtitle: 'Lễ phục tri thức', shirtHex: '#7c3aed', hairHex: '#1e293b', skinHex: '#f6d2b5', accessory: 'glasses' },
};

export function findAvatarOption(avatarId: string): StarterAvatarOption {
  return (
    STARTER_AVATARS.find((item) => item.id === avatarId) ??
    EXTRA_CATALOG_SKINS[avatarId] ??
    STARTER_AVATARS[0]
  );
}

export function StarterAvatarPortrait({
  avatarId,
  hatId = DEFAULT_HAT_ID,
  deskPetId = DEFAULT_DESK_PET_ID,
  size = 44,
  testId,
}: {
  avatarId: string;
  hatId?: string;
  deskPetId?: string;
  size?: number;
  testId?: string;
}) {
  const avatar = findAvatarOption(avatarId);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      data-testid={testId}
      data-avatar-id={avatarId}
      data-hat-id={hatId}
      data-desk-pet-id={deskPetId}
      className="shrink-0 rounded-lg bg-slate-900/70"
    >
      <path d="M12 44C12 36.268 17.373 31 24 31C30.627 31 36 36.268 36 44" fill={avatar.shirtHex} />
      {avatar.id === 'skin_scholar_blazer' ? (
        <path d="M21 31L24 39L27 31H21Z" fill="#fde68a" />
      ) : null}
      <circle cx="24" cy="21" r="10" fill={avatar.skinHex} />
      <path d="M14 20C14 13.5 18.5 10 24 10C29.5 10 34 13.5 34 20C32 16.5 28.5 15 24 15C19.5 15 16 16.5 14 20Z" fill={avatar.hairHex} />
      <circle cx="20.5" cy="22" r="1.4" fill="#0f172a" />
      <circle cx="27.5" cy="22" r="1.4" fill="#0f172a" />
      <path d="M21.5 26C22.4 27 25.6 27 26.5 26" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />

      {avatar.accessory === 'glasses' ? (
        <g stroke="#e2e8f0" strokeWidth="1.4">
          <rect x="17" y="19.5" width="5.5" height="4.5" rx="1.2" />
          <rect x="25.5" y="19.5" width="5.5" height="4.5" rx="1.2" />
          <line x1="22.5" y1="21.5" x2="25.5" y2="21.5" />
        </g>
      ) : null}
      {(avatar.accessory === 'headphones' || hatId === 'hat_headphones') ? (
        <g>
          <path d="M13 21C13 14.5 17.8 9.5 24 9.5C30.2 9.5 35 14.5 35 21" stroke="#e2e8f0" strokeWidth="2.2" strokeLinecap="round" />
          <rect x="11" y="18.5" width="3.5" height="7" rx="1.5" fill="#38bdf8" />
          <rect x="33.5" y="18.5" width="3.5" height="7" rx="1.5" fill="#38bdf8" />
        </g>
      ) : null}
      {avatar.accessory === 'leaf' ? (
        <g>
          <path d="M24 10V5.5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M24 6C26.5 3.5 30 4 29.5 6.8C29 8.5 26 8.5 24 6Z" fill="#4ade80" />
        </g>
      ) : null}
      {hatId === 'hat_graduation_cap' ? (
        <g>
          <polygon points="24,4 37,9.5 24,14 11,9.5" fill="#1e293b" stroke="#fbbf24" strokeWidth="1" />
          <line x1="35" y1="10" x2="36.5" y2="17" stroke="#fbbf24" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="36.5" cy="17.5" r="1.4" fill="#fbbf24" />
        </g>
      ) : null}
      {deskPetId === 'pet_sleepy_cat' ? (
        <g>
          <circle cx="39" cy="40" r="4.5" fill="#f59e0b" />
          <polygon points="35.5,37 37,33.5 38.5,36.5" fill="#f59e0b" />
          <polygon points="42.5,37 41,33.5 39.5,36.5" fill="#f59e0b" />
          <circle cx="37.5" cy="39.5" r="0.8" fill="#0f172a" />
          <circle cx="40.5" cy="39.5" r="0.8" fill="#0f172a" />
        </g>
      ) : deskPetId === 'pet_wise_owl' ? (
        <g>
          <ellipse cx="39" cy="40" rx="4.2" ry="5" fill="#92400e" />
          <circle cx="37.5" cy="39" r="1.5" fill="#fef08a" />
          <circle cx="40.5" cy="39" r="1.5" fill="#fef08a" />
          <circle cx="37.5" cy="39" r="0.7" fill="#0f172a" />
          <circle cx="40.5" cy="39" r="0.7" fill="#0f172a" />
        </g>
      ) : deskPetId === 'pet_sprout_pot' ? (
        <g>
          <rect x="36.5" y="40.5" width="6" height="4.5" rx="1" fill="#c2410c" />
          <path d="M39.5 40.5V36.5" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="37.8" cy="36.5" r="1.6" fill="#4ade80" />
          <circle cx="41.2" cy="36.5" r="1.6" fill="#4ade80" />
        </g>
      ) : null}
    </svg>
  );
}
