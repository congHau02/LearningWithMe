import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import manifestRaw from '../../public/site.webmanifest?raw';
import vercelRaw from '../../vercel.json?raw';
import { GuestOnboardingModal } from '../components/auth/GuestOnboardingModal';
import { BrandLogo } from '../components/brand/BrandLogo';
import { TopBar } from '../components/hud/TopBar';

describe('BrandLogo & multi-device brand asset integration', () => {
  it('renders responsive AVIF/WebP picture sources with PNG fallback and explicit dimensions', () => {
    const { container } = render(<BrandLogo variant="topbar" alt="Learning With Me" />);
    const wrapper = screen.getByTestId('brand-logo-topbar');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).not.toHaveAttribute('aria-hidden');

    const avifSource = container.querySelector('source[type="image/avif"]');
    const webpSource = container.querySelector('source[type="image/webp"]');
    expect(avifSource?.getAttribute('srcset')).toContain('64w');
    expect(avifSource?.getAttribute('srcset')).toContain('128w');
    expect(avifSource?.getAttribute('srcset')).toContain('256w');
    expect(webpSource?.getAttribute('srcset')).toContain('64w');
    expect(webpSource?.getAttribute('srcset')).toContain('256w');

    const img = screen.getByRole('img', { name: 'Learning With Me' });
    expect(img).toHaveAttribute('width', '36');
    expect(img).toHaveAttribute('height', '36');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).toHaveAttribute('srcset');
    expect(img).toHaveClass('object-contain');
    // Guard against reintroducing an opaque custom square tile behind the transparent emblem.
    expect(wrapper.className).not.toMatch(/\bbg-\[/);
  });

  it('replaces the legacy 2D placeholder in TopBar with decorative BrandLogo', () => {
    render(
      <TopBar
        roomId="room-1"
        characterState="FREE_ROAM"
        nickname="Minh Hau"
        authProvider="GUEST"
        studyGoal=""
        backendStatus="UP"
        currentTableId={null}
      />,
    );

    const logo = screen.getByTestId('brand-logo-topbar');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('heading', { name: 'Cùng Nhau Học Bài' })).toBeInTheDocument();
    expect(screen.queryByText('2D')).not.toBeInTheDocument();
  });

  it('displays the modal BrandLogo inside GuestOnboardingModal', () => {
    render(<GuestOnboardingModal />);
    expect(screen.getByTestId('brand-logo-modal')).toBeInTheDocument();
    const img = screen.getByRole('img', { name: 'Logo Learning With Me' });
    expect(img).toHaveAttribute('width', '64');
    expect(img).toHaveAttribute('height', '64');
  });

  it('wires all favicons, PWA manifest, Open Graph tags and Vercel cache headers', () => {
    expect(indexHtml).toContain('href="/favicon.ico"');
    expect(indexHtml).toContain('href="/favicon-32x32.png"');
    expect(indexHtml).toContain('href="/apple-touch-icon.png"');
    expect(indexHtml).toContain('href="/site.webmanifest"');
    expect(indexHtml).toContain('property="og:image" content="/og-image.png"');
    expect(indexHtml).toContain('name="twitter:image" content="/og-image.png"');

    const manifest = JSON.parse(manifestRaw) as {
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };
    expect(manifest.icons.map((i) => i.src)).toEqual([
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/icon-512-maskable.png',
    ]);
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);

    const vercelConfig = JSON.parse(vercelRaw) as {
      headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const assetCacheHeader = vercelConfig.headers?.find((h) => h.source === '/assets/(.*)');
    expect(assetCacheHeader?.headers[0]?.value).toContain('immutable');
    const unhashedGameAssetsHeader = vercelConfig.headers?.find(
      (h) => h.source === '/assets/(sprites|tilesets)/(.*)',
    );
    expect(unhashedGameAssetsHeader?.headers[0]?.value).not.toContain('immutable');
  });
});
