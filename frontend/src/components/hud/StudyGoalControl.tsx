import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useDismissiblePopover } from '../../hooks/useDismissiblePopover';
import { createZodResolver } from '../../utils/zodResolver';
import { CheckIcon, EditIcon } from '../icons';

export interface StudyGoalControlProps {
  studyGoal: string;
  studyGoalCompleted: boolean;
  canEdit?: boolean;
  inMobileDrawer?: boolean;
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
  inMobileDrawer = false,
  onUpdateGoal,
}: StudyGoalControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement>(null);

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

  const closeEditor = useCallback(() => {
    reset({ studyGoal });
    setIsEditing(false);
  }, [reset, studyGoal]);

  useDismissiblePopover(isEditing, containerRef, closeEditor, editTriggerRef);

  useEffect(() => {
    if (!isEditing) {
      reset({ studyGoal });
    }
  }, [studyGoal, isEditing, reset]);

  const trimmedGoal = (studyGoal ?? '').trim();
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
    <div
      ref={containerRef}
      className={`relative flex min-w-0 items-center gap-1.5 rounded-xl border border-border bg-card/85 px-2 py-1 text-xs shadow-sm sm:min-h-8 ${
        inMobileDrawer ? 'w-full justify-between' : ''
      }`}
    >
      {hasGoal && onUpdateGoal ? (
        <button
          type="button"
          data-testid="study-goal-toggle-btn"
          aria-pressed={isCompleted}
          aria-label={isCompleted ? 'Bỏ đánh dấu hoàn thành mục tiêu' : 'Đánh dấu hoàn thành mục tiêu'}
          title={isCompleted ? 'Bỏ đánh dấu hoàn thành mục tiêu' : 'Đánh dấu hoàn thành mục tiêu'}
          onClick={() => onUpdateGoal(trimmedGoal, !isCompleted)}
          className={`transition-botanical inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-7 sm:min-h-0 sm:min-w-7 sm:px-1.5 sm:text-[11px] ${
            isCompleted
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
              : 'border-border bg-secondary/80 text-muted-foreground hover:text-foreground'
          }`}
        >
          {isCompleted ? (
            <span data-testid="study-goal-completed-badge" className="inline-flex items-center">
              <span className="sr-only">✅</span>
              <CheckIcon className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            </span>
          ) : (
            <span className="h-3 w-3 rounded-full border border-muted-foreground/60" aria-hidden="true" />
          )}
        </button>
      ) : isCompleted ? (
        <span data-testid="study-goal-completed-badge" className="inline-flex items-center">
          <span className="sr-only">✅</span>
          <CheckIcon className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
        </span>
      ) : null}

      <p
        data-testid="study-goal-text"
        title={trimmedGoal || undefined}
        className={`truncate ${
          inMobileDrawer ? 'min-w-0 flex-1' : 'max-w-[180px] sm:max-w-[200px] lg:max-w-[240px]'
        } ${isCompleted ? 'font-medium text-emerald-300' : 'text-muted-foreground'}`}
      >
        {trimmedGoal || 'Chưa đặt mục tiêu học tập hôm nay'}
      </p>

      {canEdit && onUpdateGoal ? (
        <button
          ref={editTriggerRef}
          type="button"
          data-testid="study-goal-edit-btn"
          aria-expanded={isEditing}
          aria-controls="study-goal-popover"
          onClick={() => {
            reset({ studyGoal });
            setIsEditing((prev) => !prev);
          }}
          title="Chỉnh sửa mục tiêu học tập"
          aria-label="Chỉnh sửa mục tiêu học tập"
          className="transition-botanical inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-border bg-secondary/80 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7 sm:min-w-0 sm:px-2 sm:py-0.5 sm:text-[10px]"
        >
          <EditIcon className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <span>Sửa</span>
        </button>
      ) : null}

      {isEditing ? (
        <form
          id="study-goal-popover"
          className={`absolute top-full z-50 mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card/98 p-2.5 shadow-2xl backdrop-blur-md ${
            inMobileDrawer
              ? 'inset-x-0 w-full'
              : 'left-0 w-72 max-w-[calc(100vw-1.5rem)] sm:left-1/2 sm:-translate-x-1/2'
          }`}
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        >
          <input
            type="text"
            data-testid="study-goal-input"
            aria-label="Mục tiêu học tập"
            {...register('studyGoal')}
            placeholder="Nhập mục tiêu hôm nay (≤ 60 ký tự)"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary sm:h-8 sm:min-h-0"
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
              className="min-h-11 rounded-lg border border-border bg-secondary px-2.5 text-[11px] text-secondary-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7 sm:px-2"
            >
              Hủy
            </button>
            <button
              type="submit"
              data-testid="study-goal-save-btn"
              className="min-h-11 rounded-lg border border-primary/40 bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7 sm:px-2"
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
