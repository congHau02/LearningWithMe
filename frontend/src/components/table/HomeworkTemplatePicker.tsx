import { MATH_SLIDE_TEMPLATES, type MathTemplateId } from '../../utils/mathSlideTemplates';
import { AxesOxyIcon, GridTemplateIcon, NumberLineIcon, PlainBoardIcon } from '../icons';

interface HomeworkTemplatePickerProps {
  disabled: boolean;
  onCreateTemplate: (templateId: MathTemplateId) => void;
}

const TEMPLATE_ICON: Record<MathTemplateId, typeof GridTemplateIcon> = {
  GRID: GridTemplateIcon,
  OXY_AXES: AxesOxyIcon,
  NUMBER_LINE: NumberLineIcon,
  PLAIN_DARK: PlainBoardIcon,
  PLAIN_LIGHT: PlainBoardIcon,
};

export function HomeworkTemplatePicker({ disabled, onCreateTemplate }: HomeworkTemplatePickerProps) {
  return (
    <div
      data-testid="math-template-picker"
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background/70 px-2.5 py-2"
    >
      <span className="mr-1 text-[11px] font-medium text-muted-foreground">Mẫu giấy nháp:</span>
      {MATH_SLIDE_TEMPLATES.map((tpl) => {
        const Icon = TEMPLATE_ICON[tpl.id];
        return (
          <button
            key={tpl.id}
            type="button"
            data-testid={`math-template-${tpl.id}`}
            aria-label={`Tạo trang ${tpl.label}`}
            title={`Tạo trang ${tpl.label} (1280×720)`}
            disabled={disabled}
            onClick={() => onCreateTemplate(tpl.id)}
            className="inline-flex min-h-[44px] sm:min-h-[34px] items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-botanical hover:border-primary/60 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{tpl.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
