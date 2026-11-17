import { StudioIconWrapper } from './StudioIconWrapper';
import type { StudioIconProps } from './types';

export function VideoIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <rect width="20" height="15" x="2" y="3" rx="2" />
      <polygon points="10 8 16 12 10 16 10 8" />
      <line x1="2" x2="22" y1="21" y2="21" />
    </StudioIconWrapper>
  );
}

export function BoardIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M8 21h8M12 17v4" />
    </StudioIconWrapper>
  );
}

export function LayoutIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </StudioIconWrapper>
  );
}

export function MaximizeIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </StudioIconWrapper>
  );
}

export function MinimizeIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M4 14h6v6m10-10h-6V4m0 6 7-7M3 21l7-7" />
    </StudioIconWrapper>
  );
}

export function LaserIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
    </StudioIconWrapper>
  );
}

export function PenIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </StudioIconWrapper>
  );
}

export function HighlighterIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="m9 11-6 6v3h3l6-6" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </StudioIconWrapper>
  );
}

export function EraserIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </StudioIconWrapper>
  );
}

export function UploadIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </StudioIconWrapper>
  );
}

export function CameraIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </StudioIconWrapper>
  );
}

export function CrownIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </StudioIconWrapper>
  );
}

export function ShieldIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </StudioIconWrapper>
  );
}

export function UsersIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </StudioIconWrapper>
  );
}

export function GripVerticalIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="19" r="1" />
    </StudioIconWrapper>
  );
}

export function ArrowUpDownIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16" />
    </StudioIconWrapper>
  );
}

export function TextIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" x2="15" y1="20" y2="20" />
      <line x1="12" x2="12" y1="4" y2="20" />
    </StudioIconWrapper>
  );
}

