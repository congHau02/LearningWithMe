import { useCallback, useEffect, useRef } from 'react';
import type { TableMemberDto } from '../services/tableApi';
import { WebRtcMeshManager } from '../services/webrtcMeshManager';
import { useGameStore } from '../stores/useGameStore';
import { setActiveVoiceBridge, useVoiceStore } from '../stores/useVoiceStore';

export interface TableVoiceControls {
  toggleMute: () => Promise<boolean>;
}

/**
 * Automatically connects seated learners to the table WebRTC voice mesh
 * in listen-only (mic muted) mode and tears down cleanly when leaving the table.
 */
export function useTableVoiceChat(
  tableId: string | null,
  selfUserId: string | null,
  members: TableMemberDto[],
): TableVoiceControls {
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const managerRef = useRef<WebRtcMeshManager | null>(null);
  const prevConnectedRef = useRef(connectionStatus === 'CONNECTED');

  if (!managerRef.current) {
    managerRef.current = new WebRtcMeshManager();
  }

  useEffect(() => {
    const manager = managerRef.current!;
    manager.bindTable(tableId, selfUserId);
    if (tableId && selfUserId) {
      void manager.join();
    }
  }, [tableId, selfUserId]);

  useEffect(() => {
    const manager = managerRef.current!;
    if (!tableId) {
      setActiveVoiceBridge(null);
      return;
    }

    setActiveVoiceBridge({
      handleSignal: (signal) => manager.handleIncomingSignal(signal),
      teardown: () => manager.leave(true),
    });

    const unlockPlayback = () => manager.resumeAudioPlayback();
    window.addEventListener('pointerdown', unlockPlayback, { passive: true });
    window.addEventListener('keydown', unlockPlayback, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlockPlayback);
      window.removeEventListener('keydown', unlockPlayback);
      setActiveVoiceBridge(null);
      manager.leave(true);
      useVoiceStore.getState().resetVoice();
    };
  }, [tableId]);

  useEffect(() => {
    const isNowConnected = connectionStatus === 'CONNECTED';
    if (isNowConnected && !prevConnectedRef.current && tableId && selfUserId) {
      managerRef.current?.announcePresence();
    }
    prevConnectedRef.current = isNowConnected;
  }, [connectionStatus, tableId, selfUserId]);

  useEffect(() => {
    if (!tableId || members.length === 0) return;
    managerRef.current?.syncSeatedMembers(new Set(members.map((m) => m.userId)));
  }, [tableId, members]);

  const toggleMute = useCallback(() => managerRef.current!.toggleMute(), []);

  return { toggleMute };
}
