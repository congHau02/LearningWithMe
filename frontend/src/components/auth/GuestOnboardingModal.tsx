import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { formatApiError } from '../../services/apiClient';
import { createGuestSession } from '../../services/authApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { AvatarPickerField } from './AvatarPickerField';
import { OnboardingTextField } from './OnboardingTextField';
import { RegisteredLoginPanel } from './RegisteredLoginPanel';
import { DEFAULT_AVATAR_ID } from './starterAvatars';
import {
  guestOnboardingResolver,
  NICKNAME_MAX_LENGTH,
  STUDY_GOAL_MAX_LENGTH,
  type GuestOnboardingFormValues,
} from './guestOnboardingSchema';

type EntryTab = 'GUEST' | 'LOGIN';

export function GuestOnboardingModal() {
  const [activeTab, setActiveTab] = useState<EntryTab>('GUEST');
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
        <div
          role="tablist"
          aria-label="Chế độ vào phòng học"
          className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-background/70 p-1"
        >
          <button
            type="button"
            role="tab"
            id="entry-tab-guest"
            aria-selected={activeTab === 'GUEST'}
            onClick={() => setActiveTab('GUEST')}
            className={`min-h-9 rounded-md px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === 'GUEST'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Vào ngay (Khách)
          </button>
          <button
            type="button"
            role="tab"
            id="entry-tab-login"
            aria-selected={activeTab === 'LOGIN'}
            onClick={() => setActiveTab('LOGIN')}
            className={`min-h-9 rounded-md px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === 'LOGIN'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Đăng nhập tài khoản
          </button>
        </div>

        <div className="space-y-1.5">
          <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {activeTab === 'GUEST'
              ? 'Guest Mode • Vào phòng không cần đăng ký'
              : 'Registered Mode • Khôi phục hồ sơ & giờ học'}
          </span>
          <h2
            id="guest-onboarding-title"
            className="text-xl font-bold tracking-tight text-foreground"
          >
            {activeTab === 'GUEST'
              ? 'Thiết lập nhân vật học tập'
              : 'Đăng nhập tài khoản'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {activeTab === 'GUEST'
              ? 'Chọn ngoại hình, tên hiển thị và mục tiêu hôm nay để vào ngay thư viện 2D. Phiên Guest được lưu 7 ngày trên trình duyệt.'
              : 'Đăng nhập bằng tài khoản đã đăng ký để khôi phục nhân vật, vật phẩm mở khóa và tổng số phút học.'}
          </p>
        </div>

        {activeTab === 'GUEST' ? (
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
        ) : (
          <RegisteredLoginPanel />
        )}
      </div>
    </div>
  );
}
