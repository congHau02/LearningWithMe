import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { formatApiError } from '../../services/apiClient';
import { createGuestSession } from '../../services/authApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { AvatarPickerField } from './AvatarPickerField';
import { OnboardingTextField } from './OnboardingTextField';
import { DEFAULT_AVATAR_ID } from './starterAvatars';
import {
  guestOnboardingResolver,
  NICKNAME_MAX_LENGTH,
  STUDY_GOAL_MAX_LENGTH,
  type GuestOnboardingFormValues,
} from './guestOnboardingSchema';

export function GuestOnboardingModal() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const setSession = useAuthStore((s) => s.setSession);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GuestOnboardingFormValues>({
    resolver: guestOnboardingResolver,
    mode: 'onChange',
    defaultValues: {
      nickname: '',
      avatarId: DEFAULT_AVATAR_ID,
      studyGoal: '',
    },
  });

  const selectedAvatarId = watch('avatarId');
  const nicknameLength = (watch('nickname') ?? '').trim().length;
  const studyGoalLength = (watch('studyGoal') ?? '').trim().length;

  const onSubmit = async (values: GuestOnboardingFormValues) => {
    setSubmitError(null);
    try {
      const response = await createGuestSession(values);
      setSession({
        userId: response.guestId,
        nickname: response.nickname,
        avatarSpriteId: response.avatarId,
        studyGoal: response.studyGoal,
        authProvider: 'GUEST',
        token: response.guestToken,
      });
    } catch (error) {
      setSubmitError(
        formatApiError(error, 'Không thể khởi tạo phiên học. Vui lòng thử lại.'),
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-onboarding-title"
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
      >
        <div className="space-y-1.5">
          <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Guest Mode • Vào phòng không cần đăng ký
          </span>
          <h2
            id="guest-onboarding-title"
            className="text-xl font-bold tracking-tight text-foreground"
          >
            Thiết lập nhân vật học tập
          </h2>
          <p className="text-sm text-muted-foreground">
            Chọn ngoại hình, tên hiển thị và mục tiêu hôm nay để vào ngay thư viện 2D. Phiên Guest được lưu 7 ngày trên trình duyệt.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-5">
          <AvatarPickerField
            selectedAvatarId={selectedAvatarId}
            onSelect={(avatarId) =>
              setValue('avatarId', avatarId, { shouldValidate: true })
            }
          />

          <OnboardingTextField
            id="guest-nickname"
            label="Tên hiển thị"
            required
            maxLength={NICKNAME_MAX_LENGTH}
            currentLength={nicknameLength}
            placeholder="VD: Minh Hậu"
            autoFocus
            autoComplete="nickname"
            registration={register('nickname')}
            error={errors.nickname}
          />

          <OnboardingTextField
            id="guest-study-goal"
            label="Mục tiêu học tập hôm nay"
            maxLength={STUDY_GOAL_MAX_LENGTH}
            currentLength={studyGoalLength}
            placeholder="VD: Hoàn thành 2 chương Spring Boot"
            registration={register('studyGoal')}
            error={errors.studyGoal}
          />

          {submitError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/50 bg-destructive/15 px-3 py-2 text-xs text-rose-300"
            >
              {submitError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isSubmitting ? 'Đang vào phòng học...' : 'Vào phòng học ngay'}
          </button>
        </form>
      </div>
    </div>
  );
}
