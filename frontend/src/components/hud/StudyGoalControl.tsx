import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createZodResolver } from '../../utils/zodResolver';

export interface StudyGoalControlProps {
  studyGoal: string;
  studyGoalCompleted: boolean;
  canEdit?: boolean;
  onUpdateGoal?: (studyGoal: string, completed: boolean) => void;
}

const MAX_STUDY_GOAL_LENGTH = 60;

const studyGoalSchema = z.object({
  studyGoal: z
    .string()
    .trim()
    .max(MAX_STUDY_GOAL_LENGTH, `Mục tiêu học tập tối đa ${MAX_STUDY_GOAL_LENGTH} ký tự.`),
});

type StudyGoalFormValues = z.infer<typeof studyGoalSchema>;

/** Inline Study Goal display, live check-off toggle, and RHF+Zod editor inside {@link TopBar}. */
export function StudyGoalControl({
  studyGoal,
  studyGoalCompleted,
  canEdit = false,
  onUpdateGoal,
}: StudyGoalControlProps) {
  const [isEditing, setIsEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<StudyGoalFormValues>({
    resolver: createZodResolver<StudyGoalFormValues>(studyGoalSchema),
    defaultValues: { studyGoal },
  });

  useEffect(() => {
    if (!isEditing) {
      reset({ studyGoal });
    }
  }, [studyGoal, isEditing, reset]);

  const trimmedGoal = studyGoal.trim();
  const hasGoal = trimmedGoal.length > 0;
  const isCompleted = hasGoal && studyGoalCompleted;
  const draftLength = (watch('studyGoal') ?? '').trim().length;

  const onSubmit = (values: StudyGoalFormValues) => {
    const nextTrimmed = values.studyGoal;
    const nextCompleted =
      nextTrimmed.length === 0
        ? false
        : nextTrimmed === trimmedGoal
          ? studyGoalCompleted
          : false;
    onUpdateGoal?.(nextTrimmed, nextCompleted);
    setIsEditing(false);
  };

  return (
    <div className="relative flex min-w-0 items-center gap-1.5 rounded-lg border border-border/70 bg-secondary/50 px-2 py-1 text-xs sm:min-h-8">
      {hasGoal && onUpdateGoal ? (
        <button
          type="button"
          data-testid="study-goal-toggle-btn"
          aria-pressed={isCompleted}
          aria-label={isCompleted ? 'Bỏ đánh dấu hoàn thành mục tiêu' : 'Đánh dấu hoàn thành mục tiêu'}
          title={isCompleted ? 'Bỏ đánh dấu hoàn thành mục tiêu' : 'Đánh dấu hoàn thành mục tiêu'}
          onClick={() => onUpdateGoal(trimmedGoal, !isCompleted)}
          className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center gap-1 rounded border px-1.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isCompleted
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
              : 'border-border bg-secondary/70 text-muted-foreground hover:text-foreground'
          }`}
        >
          {isCompleted ? <span data-testid="study-goal-completed-badge">✅</span> : <span>○</span>}
        </button>
      ) : isCompleted ? (
        <span data-testid="study-goal-completed-badge">✅</span>
      ) : null}

      <p
        data-testid="study-goal-text"
        title={trimmedGoal || undefined}
        className={`max-w-[180px] truncate sm:max-w-[200px] lg:max-w-[240px] ${
          isCompleted ? 'font-medium text-emerald-300' : 'text-muted-foreground'
        }`}
      >
        {trimmedGoal || 'Chưa đặt mục tiêu học tập hôm nay'}
      </p>

      {canEdit && onUpdateGoal ? (
        <button
          type="button"
          data-testid="study-goal-edit-btn"
          aria-expanded={isEditing}
          onClick={() => {
            reset({ studyGoal });
            setIsEditing((prev) => !prev);
          }}
          title="Chỉnh sửa mục tiêu học tập"
          aria-label="Chỉnh sửa mục tiêu học tập"
          className="shrink-0 rounded border border-border/80 bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ✏️ Sửa
        </button>
      ) : null}

      {isEditing ? (
        <form
          className="absolute left-0 top-full z-50 mt-2 flex w-72 max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-1.5 rounded-xl border border-border bg-slate-900/95 p-2.5 shadow-2xl backdrop-blur-md sm:left-1/2 sm:-translate-x-1/2"
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        >
          <input
            type="text"
            data-testid="study-goal-input"
            aria-label="Mục tiêu học tập"
            {...register('studyGoal')}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Esc') {
                e.stopPropagation();
                reset({ studyGoal });
                setIsEditing(false);
              }
            }}
            placeholder="Nhập mục tiêu hôm nay (≤ 60 ký tự)"
            className="h-8 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <span className="font-mono text-[10px] text-muted-foreground">
            {draftLength}/{MAX_STUDY_GOAL_LENGTH}
          </span>
          <div className="flex w-full items-center justify-end gap-1.5">
            <button
              type="button"
              data-testid="study-goal-cancel-btn"
              onClick={() => {
                reset({ studyGoal });
                setIsEditing(false);
              }}
              className="min-h-11 rounded border border-border bg-secondary px-2.5 text-[11px] text-secondary-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7 sm:px-2"
            >
              Hủy
            </button>
            <button
              type="submit"
              data-testid="study-goal-save-btn"
              className="min-h-11 rounded border border-emerald-500/40 bg-emerald-500/20 px-2.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7 sm:px-2"
            >
              Lưu
            </button>
          </div>
          {errors.studyGoal?.message ? (
            <span data-testid="study-goal-error" className="w-full text-[11px] text-rose-400">
              {errors.studyGoal.message}
            </span>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
