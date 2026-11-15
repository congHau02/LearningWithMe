import { useCallback, useEffect, useRef } from 'react';
import type { TableMemberDto } from '../services/tableApi';
import { WebRtcMeshManager } from '../services/webrtcMeshManager';
import { setActiveVoiceBridge, useVoiceStore } from '../stores/useVoiceStore';

export interface TableVoiceControls {
  joinVoice: () => Promise<void>;
  leaveVoice: () => void;
  toggleMute: () => boolean;
}

export function useTableVoiceChat(
  tableId: string | null,
  selfUserId: string | null,
  members: TableMemberDto[],
): TableVoiceControls {
  const managerRef = useRef<WebRtcMeshManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = new WebRtcMeshManager();
  }

  useEffect(() => {
    managerRef.current!.bindTable(tableId, selfUserId);
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

    return () => {
      setActiveVoiceBridge(null);
      manager.leave(true);
      useVoiceStore.getState().resetVoice();
    };
  }, [tableId]);

  useEffect(() => {
    if (!tableId || members.length === 0) return;
    managerRef.current?.syncSeatedMembers(new Set(members.map((m) => m.userId)));
  }, [tableId, members]);

  const joinVoice = useCallback(() => managerRef.current!.join(), []);
  const leaveVoice = useCallback(() => managerRef.current!.leave(true), []);
  const toggleMute = useCallback(() => managerRef.current!.toggleMute(), []);

  return { joinVoice, leaveVoice, toggleMute };
}
