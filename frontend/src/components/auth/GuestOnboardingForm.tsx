import { useState } from "react";
import { useForm } from "react-hook-form";
import { formatApiError } from "../../services/apiClient";
import { createGuestSession } from "../../services/authApi";
import { useAuthStore } from "../../stores/useAuthStore";
import { ChevronRightIcon } from "../icons";
import { AvatarPickerField } from "./AvatarPickerField";
import { OnboardingTextField } from "./OnboardingTextField";
import { DEFAULT_AVATAR_ID } from "./starterAvatars";
import {
  guestOnboardingResolver,
  NICKNAME_MAX_LENGTH,
  STUDY_GOAL_MAX_LENGTH,
  type GuestOnboardingFormValues,
} from "./guestOnboardingSchema";

export interface GuestOnboardingFormProps {
  isBackendWaiting?: boolean;
}

export function GuestOnboardingForm({
  isBackendWaiting = false,
}: GuestOnboardingFormProps) {
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
    mode: "onChange",
    defaultValues: { nickname: "", avatarId: DEFAULT_AVATAR_ID, studyGoal: "" },
  });

  const selectedAvatarId = watch("avatarId");
  const nicknameLength = (watch("nickname") ?? "").trim().length;
  const studyGoalLength = (watch("studyGoal") ?? "").trim().length;

  const onSubmit = async (values: GuestOnboardingFormValues) => {
    setSubmitError(null);
    try {
      const response = await createGuestSession(values);
      setSession({
        userId: response.guestId,
        nickname: response.nickname,
        avatarSpriteId: response.avatarId,
        studyGoal: response.studyGoal,
        authProvider: "GUEST",
        token: response.guestToken,
      });
    } catch (error) {
      setSubmitError(
        formatApiError(
          error,
          "Không thể khởi tạo phiên học. Vui lòng thử lại.",
        ),
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-3.5 space-y-3.5"
    >
      <AvatarPickerField
        selectedAvatarId={selectedAvatarId}
        onSelect={(avatarId) =>
          setValue("avatarId", avatarId, { shouldValidate: true })
        }
      />

      <OnboardingTextField
        id="guest-nickname"
        label="Tên hiển thị"
        required
        maxLength={NICKNAME_MAX_LENGTH}
        currentLength={nicknameLength}
        placeholder="VD: 10 giờ kém 7"
        autoFocus
        autoComplete="off"
        registration={register("nickname")}
        error={errors.nickname}
      />

      <OnboardingTextField
        id="guest-study-goal"
        label="Mục tiêu học tập hôm nay"
        maxLength={STUDY_GOAL_MAX_LENGTH}
        currentLength={studyGoalLength}
        placeholder="VD: Hoàn thành 2 chương Spring Boot"
        registration={register("studyGoal")}
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
        disabled={isSubmitting || isBackendWaiting}
        className="group min-h-11 w-full rounded-xl border border-primary/40 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="inline-flex items-center justify-center gap-2">
          <span>
            {isBackendWaiting
              ? "Đang chờ máy chủ khởi động..."
              : isSubmitting
                ? "Đang vào phòng học..."
                : "Vào phòng học ngay"}
          </span>
          <span className="inline-flex shrink-0 items-center transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
            <ChevronRightIcon className="h-4 w-4" />
          </span>
        </span>
      </button>
    </form>
  );
}
