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
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
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
              className={`flex min-h-14 items-center gap-3 rounded-xl border p-2.5 text-left transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSelected
                  ? 'border-primary bg-primary/15 text-foreground shadow-sm ring-1 ring-primary/40'
                  : 'border-border bg-secondary/40 text-muted-foreground hover:border-primary/50 hover:bg-secondary/70'
              }`}
            >
              <StarterAvatarPortrait avatarId={avatar.id} size={40} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground sm:truncate">
                  {avatar.label}
                </p>
                <p className="text-[11px] text-muted-foreground sm:truncate">
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
