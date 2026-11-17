import type { SVGProps } from 'react';

export interface StudioIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
}
