import type { ReactNode } from 'react';
import type { StudioIconProps } from './types';

interface StudioIconWrapperProps extends StudioIconProps {
  children: ReactNode;
}

export function StudioIconWrapper({
  size = 20,
  strokeWidth = 1.5,
  className = '',
  children,
  ...props
}: StudioIconWrapperProps) {
  const isAccessible = Boolean(props['aria-label'] || props['aria-labelledby']);
  const accessibilityProps = isAccessible
    ? { role: 'img' as const }
    : { 'aria-hidden': 'true' as const };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...accessibilityProps}
      {...props}
    >
      {children}
    </svg>
  );
}
