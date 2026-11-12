import { z } from 'zod';
import { createZodResolver } from './zodResolver';

export const NICKNAME_MAX_LENGTH = 20;
export const STUDY_GOAL_MAX_LENGTH = 60;

export const guestOnboardingSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên hiển thị')
    .max(NICKNAME_MAX_LENGTH, 'Tên hiển thị tối đa 20 ký tự'),
  avatarId: z.string().min(1, 'Vui lòng chọn nhân vật'),
  studyGoal: z
    .string()
    .trim()
    .max(STUDY_GOAL_MAX_LENGTH, 'Mục tiêu học tập tối đa 60 ký tự'),
});

export type GuestOnboardingFormValues = z.infer<typeof guestOnboardingSchema>;

export const guestOnboardingResolver =
  createZodResolver<GuestOnboardingFormValues>(guestOnboardingSchema);
