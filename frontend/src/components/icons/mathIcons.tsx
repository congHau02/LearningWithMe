import { StudioIconWrapper } from './StudioIconWrapper';
import type { StudioIconProps } from './types';

export function LineIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <line x1="5" y1="19" x2="19" y2="5" />
    </StudioIconWrapper>
  );
}

export function ArrowVectorIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <line x1="5" y1="19" x2="19" y2="5" />
      <polyline points="11 5 19 5 19 13" />
    </StudioIconWrapper>
  );
}

export function RectIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
    </StudioIconWrapper>
  );
}

export function CircleIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <circle cx="12" cy="12" r="8" />
    </StudioIconWrapper>
  );
}

export function LatexSigmaIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M18 5H7l6 7-6 7h11" />
    </StudioIconWrapper>
  );
}

export function UndoIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </StudioIconWrapper>
  );
}

export function RedoIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </StudioIconWrapper>
  );
}

export function GridTemplateIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </StudioIconWrapper>
  );
}

export function AxesOxyIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <path d="M12 20V4m-3 3 3-3 3 3" />
      <path d="M4 12h16m-3-3 3 3-3 3" />
    </StudioIconWrapper>
  );
}

export function PlainBoardIcon(props: StudioIconProps) {
  return (
    <StudioIconWrapper {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
    </StudioIconWrapper>
  );
}
