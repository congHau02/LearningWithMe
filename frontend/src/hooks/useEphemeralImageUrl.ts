import { useEffect, useState } from 'react';
import { formatApiError } from '../services/apiClient';
import { fetchEphemeralFileBlob } from '../services/tableApi';
import { useAuthStore } from '../stores/useAuthStore';

interface EphemeralImageState {
  objectUrl: string | null;
  error: string | null;
}

export function useEphemeralImageUrl(rawUrl: string | null | undefined): EphemeralImageState {
  const token = useAuthStore((s) => s.token);
  const [state, setState] = useState<EphemeralImageState>({
    objectUrl: null,
    error: null,
  });

  useEffect(() => {
    if (!rawUrl || typeof fetch !== 'function' || typeof URL.createObjectURL !== 'function') {
      setState({ objectUrl: null, error: null });
      return;
    }

    const controller = new AbortController();
    let createdObjectUrl: string | null = null;
    let active = true;

    setState({ objectUrl: null, error: null });

    void fetchEphemeralFileBlob(rawUrl, controller.signal, token)
      .then((blob) => {
        const nextUrl = URL.createObjectURL(blob);
        if (!active || controller.signal.aborted) {
          URL.revokeObjectURL?.(nextUrl);
          return;
        }
        createdObjectUrl = nextUrl;
        setState({ objectUrl: nextUrl, error: null });
      })
      .catch((err) => {
        if (!active || controller.signal.aborted) {
          return;
        }
        setState({
          objectUrl: null,
          error: formatApiError(err, 'Không thể tải ảnh bài tập.', true),
        });
      });

    return () => {
      active = false;
      controller.abort();
      if (createdObjectUrl) {
        URL.revokeObjectURL?.(createdObjectUrl);
        createdObjectUrl = null;
      }
    };
  }, [rawUrl, token]);

  return state;
}
