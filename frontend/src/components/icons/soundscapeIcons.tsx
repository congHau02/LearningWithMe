import { StudioIconWrapper } from './StudioIconWrapper';
import type { StudioIconProps } from './types';

export function RainIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M16 14v6M8 14v6M12 16v6" />
    </StudioIconWrapper>
  );
}

export function CafeIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" x2="6" y1="1" y2="4" />
      <line x1="10" x2="10" y1="1" y2="4" />
      <line x1="14" x2="14" y1="1" y2="4" />
    </StudioIconWrapper>
  );
}

export function WavesIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </StudioIconWrapper>
  );
}

export function CampfireIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      <line x1="4" x2="20" y1="21" y2="17" />
      <line x1="4" x2="20" y1="17" y2="21" />
    </StudioIconWrapper>
  );
}

export function WindIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
    </StudioIconWrapper>
  );
}

export function LofiPianoIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </StudioIconWrapper>
  );
}

export function BellChimeIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </StudioIconWrapper>
  );
}
