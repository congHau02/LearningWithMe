export interface GoogleCredentialResponse {
  credential?: string;
}

export interface GooglePromptNotification {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
}

export interface GoogleAccountsIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    cancel_on_tap_outside?: boolean;
  }) => void;
  prompt: (momentListener?: (notification: GooglePromptNotification) => void) => void;
  renderButton?: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsIdApi;
      };
    };
  }
}

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GIS_LOAD_TIMEOUT_MS = 10_000;
let scriptLoadPromise: Promise<GoogleAccountsIdApi> | null = null;

export function getGoogleClientId(): string {
  return String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
}

export async function loadGoogleIdentityApi(): Promise<GoogleAccountsIdApi> {
  const existing = window.google?.accounts?.id;
  if (existing) {
    return existing;
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<GoogleAccountsIdApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`,
    );
    if (existingScript?.dataset.gisStatus === 'loaded' || existingScript?.dataset.gisStatus === 'error') {
      scriptLoadPromise = null;
      reject(new Error('Không thể khởi tạo Google Identity Services.'));
      return;
    }

    const script = existingScript ?? document.createElement('script');
    const timeoutId = window.setTimeout(() => {
      cleanup();
      scriptLoadPromise = null;
      reject(new Error('Hết thời gian tải thư viện đăng nhập Google.'));
    }, GIS_LOAD_TIMEOUT_MS);

    const onLoad = () => {
      cleanup();
      script.dataset.gisStatus = 'loaded';
      const api = window.google?.accounts?.id;
      if (api) {
        resolve(api);
      } else {
        scriptLoadPromise = null;
        reject(new Error('Không thể khởi tạo Google Identity Services.'));
      }
    };

    const onError = () => {
      cleanup();
      script.dataset.gisStatus = 'error';
      scriptLoadPromise = null;
      reject(new Error('Không thể tải thư viện đăng nhập Google.'));
    };

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    if (!existingScript) {
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return scriptLoadPromise;
}

export async function requestGoogleIdTokenPopup(options?: {
  fallbackButtonContainer?: HTMLElement | null;
  onCredential?: (idToken: string) => void;
}): Promise<string> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error(
      'Chưa cấu hình VITE_GOOGLE_CLIENT_ID cho đăng nhập Google.',
    );
  }

  const googleIdApi = await loadGoogleIdentityApi();

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    googleIdApi.initialize({
      client_id: clientId,
      cancel_on_tap_outside: true,
      callback: (response) => {
        if (!response.credential) {
          if (!settled) {
            settled = true;
            reject(new Error('Google không trả về mã xác thực (idToken).'));
          }
          return;
        }
        if (!settled) {
          settled = true;
          resolve(response.credential);
        } else {
          options?.onCredential?.(response.credential);
        }
      },
    });

    if (options?.fallbackButtonContainer && googleIdApi.renderButton) {
      options.fallbackButtonContainer.innerHTML = '';
      googleIdApi.renderButton(options.fallbackButtonContainer, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 320,
      });
    }

    googleIdApi.prompt((notification) => {
      if (settled) {
        return;
      }
      if (
        notification?.isNotDisplayed?.() ||
        notification?.isSkippedMoment?.() ||
        notification?.isDismissedMoment?.()
      ) {
        settled = true;
        reject(
          new Error(
            'Hộp thoại Google One Tap tạm ẩn. Vui lòng bấm nút Google bên dưới hoặc cho phép pop-up.',
          ),
        );
      }
    });
  });
}
