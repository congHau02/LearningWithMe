import { StudioIconWrapper } from './StudioIconWrapper';
import type { StudioIconProps } from './types';

export function XIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </StudioIconWrapper>
  );
}

export function CheckIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M20 6 9 17l-5-5" />
    </StudioIconWrapper>
  );
}

export function ChevronDownIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="m6 9 6 6 6-6" />
    </StudioIconWrapper>
  );
}

export function ChevronUpIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="m18 15-6-6-6 6" />
    </StudioIconWrapper>
  );
}

export function ChevronRightIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="m9 18 6-6-6-6" />
    </StudioIconWrapper>
  );
}

export function ChevronLeftIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="m15 18-6-6 6-6" />
    </StudioIconWrapper>
  );
}

export function PlusIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M12 5v14M5 12h14" />
    </StudioIconWrapper>
  );
}

export function MinusIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M5 12h14" />
    </StudioIconWrapper>
  );
}

export function SearchIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </StudioIconWrapper>
  );
}

export function TrashIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </StudioIconWrapper>
  );
}

export function CopyIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </StudioIconWrapper>
  );
}

export function EditIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </StudioIconWrapper>
  );
}

export function InfoIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </StudioIconWrapper>
  );
}

export function AlertCircleIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </StudioIconWrapper>
  );
}

export function ExternalLinkIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </StudioIconWrapper>
  );
}

export function LockIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </StudioIconWrapper>
  );
}

export function EyeIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </StudioIconWrapper>
  );
}

export function EyeOffIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" />
    </StudioIconWrapper>
  );
}

export function MenuIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </StudioIconWrapper>
  );
}
