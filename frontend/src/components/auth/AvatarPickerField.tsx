import { STARTER_AVATARS, StarterAvatarPortrait } from './starterAvatars';

interface AvatarPickerFieldProps {
  selectedAvatarId: string;
  onSelect: (avatarId: string) => void;
}

export function AvatarPickerField({
  selectedAvatarId,
  onSelect,
}: AvatarPickerFieldProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">
        Chọn ngoại hình nhân vật
      </legend>
      <div
        role="radiogroup"
        aria-label="Chọn ngoại hình nhân vật"
        className="grid grid-cols-2 gap-2.5"
      >
        {STARTER_AVATARS.map((avatar) => {
          const isSelected = selectedAvatarId === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(avatar.id)}
              className={`flex min-h-14 items-center gap-3 rounded-lg border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSelected
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'border-border bg-secondary/40 text-muted-foreground hover:border-primary/50 hover:bg-secondary/70'
              }`}
            >
              <StarterAvatarPortrait avatarId={avatar.id} size={40} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {avatar.label}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {avatar.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
