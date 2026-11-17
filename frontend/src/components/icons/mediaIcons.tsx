import { StudioIconWrapper } from './StudioIconWrapper';
import type { StudioIconProps } from './types';

export function MicIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
    </StudioIconWrapper>
  );
}

export function MicOffIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
      <line x1="8" x2="16" y1="22" y2="22" />
    </StudioIconWrapper>
  );
}

export function VolumeIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
    </StudioIconWrapper>
  );
}

export function VolumeOffIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" x2="16" y1="9" y2="15" />
      <line x1="16" x2="22" y1="9" y2="15" />
    </StudioIconWrapper>
  );
}

export function HeadphonesIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </StudioIconWrapper>
  );
}

export function PlayIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </StudioIconWrapper>
  );
}

export function PauseIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <rect width="4" height="16" x="6" y="4" rx="1" />
      <rect width="4" height="16" x="14" y="4" rx="1" />
    </StudioIconWrapper>
  );
}

export function TimerIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <line x1="10" x2="14" y1="2" y2="2" />
      <line x1="12" x2="15" y1="14" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </StudioIconWrapper>
  );
}

export function RotateCcwIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </StudioIconWrapper>
  );
}

export function RadioIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <circle cx="12" cy="12" r="2" />
      <path d="M4.93 19.07a10 10 0 0 1 0-14.14M19.07 4.93a10 10 0 0 1 0 14.14M7.76 16.24a6 6 0 0 1 0-8.48M16.24 7.76a6 6 0 0 1 0 8.48" />
    </StudioIconWrapper>
  );
}

export function ZapIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </StudioIconWrapper>
  );
}
