import logo64Avif from '../../assets/brand/logo-64.avif';
import logo64Png from '../../assets/brand/logo-64.png';
import logo64Webp from '../../assets/brand/logo-64.webp';
import logo128Avif from '../../assets/brand/logo-128.avif';
import logo128Png from '../../assets/brand/logo-128.png';
import logo128Webp from '../../assets/brand/logo-128.webp';
import logo256Avif from '../../assets/brand/logo-256.avif';
import logo256Png from '../../assets/brand/logo-256.png';
import logo256Webp from '../../assets/brand/logo-256.webp';

export type BrandLogoVariant = 'topbar' | 'modal';

export interface BrandLogoProps {
  variant?: BrandLogoVariant;
  /** Keep empty string when placed right next to visible brand heading text to avoid duplicate screen-reader announcements. */
  alt?: string;
  className?: string;
}

const VARIANT_CONFIG: Record<
  BrandLogoVariant,
  {
    wrapperClassName: string;
    width: number;
    height: number;
    sizes: string;
  }
> = {
  topbar: {
    wrapperClassName: 'h-8 w-8 drop-shadow-[0_2px_6px_rgba(0,0,0,0.42)] sm:h-9 sm:w-9',
    width: 36,
    height: 36,
    sizes: '(min-width: 640px) 36px, 32px',
  },
  modal: {
    wrapperClassName: 'h-14 w-14 drop-shadow-[0_6px_14px_rgba(0,0,0,0.46)] sm:h-16 sm:w-16',
    width: 64,
    height: 64,
    sizes: '(min-width: 640px) 64px, 56px',
  },
};

const AVIF_SRC_SET = `${logo64Avif} 64w, ${logo128Avif} 128w, ${logo256Avif} 256w`;
const WEBP_SRC_SET = `${logo64Webp} 64w, ${logo128Webp} 128w, ${logo256Webp} 256w`;
const PNG_SRC_SET = `${logo64Png} 64w, ${logo128Png} 128w, ${logo256Png} 256w`;
// React 18 runtime expects lowercase `fetchpriority` to avoid unknown-DOM-prop console warnings.
const FETCH_PRIORITY_HIGH = { fetchpriority: 'high' } as Record<string, string>;

export function BrandLogo({
  variant = 'topbar',
  alt = '',
  className = '',
}: BrandLogoProps) {
  const cfg = VARIANT_CONFIG[variant];
  const isDecorative = alt === '';

  return (
    <span
      data-testid={`brand-logo-${variant}`}
      aria-hidden={isDecorative || undefined}
      className={`inline-flex shrink-0 select-none items-center justify-center ${cfg.wrapperClassName} ${className}`.trim()}
    >
      <picture className="block h-full w-full">
        <source type="image/avif" srcSet={AVIF_SRC_SET} sizes={cfg.sizes} />
        <source type="image/webp" srcSet={WEBP_SRC_SET} sizes={cfg.sizes} />
        <img
          src={logo128Png}
          srcSet={PNG_SRC_SET}
          sizes={cfg.sizes}
          width={cfg.width}
          height={cfg.height}
          alt={alt}
          loading="eager"
          decoding="async"
          {...FETCH_PRIORITY_HIGH}
          draggable={false}
          className="h-full w-full object-contain"
        />
      </picture>
    </span>
  );
}
