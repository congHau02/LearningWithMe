import { apiRequest } from './apiClient';
import type { AuthRole } from './authApi';
import { useAuthStore } from '../stores/useAuthStore';

export interface StudySessionDto {
  id: number | null;
  roomId: string;
  tableId: string;
  studyGoal: string | null;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
}

export interface PersonalStudyStatsResponse {
  userId: string;
  role: AuthRole;
  totalStudyMinutes: number;
  totalSessions: number;
  recentSessions: StudySessionDto[];
}

export interface StudyLeaderboardEntry {
  rank: number | null;
  userId: string;
  nickname: string;
  avatarSpriteId: string;
  role: AuthRole;
  totalStudyMinutes: number;
  totalSessions: number;
}

export interface StudyLeaderboardResponse {
  limit: number;
  totalRankedLearners: number;
  entries: StudyLeaderboardEntry[];
  myEntry: StudyLeaderboardEntry;
}

export function formatStudyDuration(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours === 0) {
    return `${minutes} phút`;
  }
  if (minutes === 0) {
    return `${hours} giờ`;
  }
  return `${hours} giờ ${minutes} phút`;
}

let latestRefreshSeq = 0;

export async function fetchPersonalStudyStats(): Promise<PersonalStudyStatsResponse> {
  return apiRequest<PersonalStudyStatsResponse>('/api/v1/stats/me', {
    method: 'GET',
  });
}

export async function fetchStudyLeaderboard(limit = 20): Promise<StudyLeaderboardResponse> {
  return apiRequest<StudyLeaderboardResponse>(
    `/api/v1/stats/leaderboard?limit=${encodeURIComponent(limit)}`,
    { method: 'GET' },
  );
}

export async function refreshPersonalStudyStats(): Promise<PersonalStudyStatsResponse | null> {
  const token = useAuthStore.getState().token;
  if (!token) {
    return null;
  }
  const requestSeq = ++latestRefreshSeq;
  try {
    const stats = await fetchPersonalStudyStats();
    if (requestSeq === latestRefreshSeq && useAuthStore.getState().token === token) {
      useAuthStore.getState().setTotalStudyMinutes(stats.totalStudyMinutes);
    }
    return stats;
  } catch {
    return null;
  }
}
