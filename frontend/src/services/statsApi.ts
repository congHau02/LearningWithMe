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

let latestRefreshSeq = 0;

export async function fetchPersonalStudyStats(): Promise<PersonalStudyStatsResponse> {
  return apiRequest<PersonalStudyStatsResponse>('/api/v1/stats/me', {
    method: 'GET',
  });
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
