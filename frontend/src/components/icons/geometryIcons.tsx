import { StudioIconWrapper } from './StudioIconWrapper';
import type { StudioIconProps } from './types';

export function DashedLineIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M5 19 8.5 15.5M10.5 13.5 14 10M16 8l3-3" />
    </StudioIconWrapper>
  );
}

export function CircleCenterIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </StudioIconWrapper>
  );
}

export function TriangleIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <polygon points="12 4 4 19 20 19" />
    </StudioIconWrapper>
  );
}

export function GeoMarkIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M5 19V5M5 19h14M5 12h7v7" />
    </StudioIconWrapper>
  );
}

export function VertexLabelIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <circle cx="6.5" cy="17.5" r="2" fill="currentColor" />
      <path d="M11.5 16 15 6l3.5 10M12.5 13h5" />
    </StudioIconWrapper>
  );
}

export function SnapAngleIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M5 19h14M5 19V5" />
      <path d="M5 19a8 8 0 0 1 8-8" />
      <circle cx="5" cy="19" r="1.5" fill="currentColor" />
    </StudioIconWrapper>
  );
}
