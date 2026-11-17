import { StudioIconWrapper } from './StudioIconWrapper';
import type { StudioIconProps } from './types';

export function TrophyIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v3h10v-3c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34M6 4h12a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4Z" />
    </StudioIconWrapper>
  );
}

export function FlameIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </StudioIconWrapper>
  );
}

export function ClockIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </StudioIconWrapper>
  );
}

export function SparklesIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </StudioIconWrapper>
  );
}

export function CoffeeIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM6 2v2M10 2v2M14 2v2" />
    </StudioIconWrapper>
  );
}

export function UserIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </StudioIconWrapper>
  );
}

export function DoorIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h20M13 20V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v16M9 12v.01" />
    </StudioIconWrapper>
  );
}

export function ChatIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </StudioIconWrapper>
  );
}

export function GoalIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </StudioIconWrapper>
  );
}

export function TargetIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </StudioIconWrapper>
  );
}
