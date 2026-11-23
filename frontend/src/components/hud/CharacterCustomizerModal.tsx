import { useEffect, useRef, useState } from 'react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatApiError } from '../../services/apiClient';
import {
  fetchCharacterItemsCatalog,
  updateMyCustomization,
  type CharacterItem,
  type CharacterItemType,
} from '../../services/customizationApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { StarterAvatarPortrait } from '../auth/starterAvatars';
import { XIcon } from '../icons';
import { DoubleBezelCard } from '../ui/DoubleBezelCard';
import { CharacterCustomizerItemCard } from './CharacterCustomizerItemCard';

export interface CharacterCustomizerModalProps {
  onClose: () => void;
}

const TABS: readonly { type: CharacterItemType; label: string }[] = [
  { type: 'SKIN', label: 'Trang phục (SKIN)' },
  { type: 'HAT', label: 'Mũ & Tai nghe (HAT)' },
  { type: 'DESK_PET', label: 'Thú cưng bàn (PET)' },
];

export function CharacterCustomizerModal({ onClose }: CharacterCustomizerModalProps) {
  const initialSkinId = useAuthStore((s) => s.avatarSpriteId);
  const initialHatId = useAuthStore((s) => s.hatId);
  const initialDeskPetId = useAuthStore((s) => s.deskPetId);
  const storedMinutes = useAuthStore((s) => s.totalStudyMinutes);

  const [activeTab, setActiveTab] = useState<CharacterItemType>('SKIN');
  const [items, setItems] = useState<CharacterItem[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(storedMinutes);
  const [skinId, setSkinId] = useState(initialSkinId);
  const [hatId, setHatId] = useState(initialHatId);
  const [deskPetId, setDeskPetId] = useState(initialDeskPetId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const dialogContainerRef = useRef<HTMLDivElement>(null);

  useEscapeToClose(onClose);
  useFocusTrap(dialogContainerRef);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCharacterItemsCatalog()
      .then((catalog) => {
        if (!active) return;
        setItems(catalog.items);
        setTotalMinutes(catalog.totalStudyMinutes);
        setSkinId(catalog.equipped.skinId);
        setHatId(catalog.equipped.hatId);
        setDeskPetId(catalog.equipped.deskPetId);
        useAuthStore.getState().setTotalStudyMinutes(catalog.totalStudyMinutes);
        useAuthStore.getState().updateCustomization(catalog.equipped);
        setErrorMsg(null);
      })
      .catch((err) => {
        if (active) setErrorMsg(formatApiError(err, 'Không thể tải danh sách vật phẩm.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const selectedId = activeTab === 'SKIN' ? skinId : activeTab === 'HAT' ? hatId : deskPetId;

  const handleSelectItem = (type: CharacterItemType, id: string) => {
    setErrorMsg(null);
    if (type === 'SKIN') setSkinId(id);
    else if (type === 'HAT') setHatId(id);
    else setDeskPetId(id);
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      const updated = await updateMyCustomization({ skinId, hatId, deskPetId });
      useAuthStore.getState().updateCustomization({
        skinId: updated.skinId, hatId: updated.hatId, deskPetId: updated.deskPetId,
      });
      onClose();
    } catch (err) {
      setErrorMsg(formatApiError(err, 'Không thể lưu trang bị nhân vật.'));
    } finally {
      setSaving(false);
    }
  };

  const tabItems = items.filter((item) => item.itemType === activeTab);

  return (
    <div ref={dialogContainerRef} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-3 backdrop-blur-md sm:items-center sm:p-4">
      <DoubleBezelCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="customizer-title"
        data-testid="character-customizer-modal"
        className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col sm:max-h-[88dvh]"
        innerClassName="flex flex-col flex-1 min-h-0 p-5 sm:p-6 overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-4">
            <StarterAvatarPortrait avatarId={skinId} hatId={hatId} deskPetId={deskPetId} size={64} testId="customizer-preview-portrait" />
            <div>
              <h2 id="customizer-title" className="text-lg font-bold tracking-tight text-foreground">
                Tủ đồ &amp; Thú cưng bàn học
              </h2>
              <p className="text-xs text-muted-foreground">
                Tổng tích lũy: <span className="font-mono font-semibold text-primary">{totalMinutes} phút</span> học tập
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-border bg-secondary px-3 py-1 text-xs font-medium text-foreground transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-secondary/80 sm:min-h-9"
          >
            <XIcon className="h-3.5 w-3.5" />
            <span>Đóng</span>
          </button>
        </div>

        <div role="tablist" aria-label="Danh mục trang bị nhân vật" className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-border bg-background/60 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.type}
              type="button"
              role="tab"
              id={`customizer-tab-${tab.type}`}
              aria-selected={activeTab === tab.type}
              aria-controls={`customizer-panel-${tab.type}`}
              data-testid={`customizer-tab-${tab.type}`}
              onClick={() => setActiveTab(tab.type)}
              className={`min-h-11 rounded-lg px-2 py-2 text-xs font-semibold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] sm:min-h-9 ${
                activeTab === tab.type ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {errorMsg ? (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-2 text-xs text-rose-300">
            {errorMsg}
          </p>
        ) : null}

        <div
          role="tabpanel"
          id={`customizer-panel-${activeTab}`}
          aria-labelledby={`customizer-tab-${activeTab}`}
          data-testid="customizer-items-grid"
          className="mt-4 grid h-[min(45dvh,280px)] content-start grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:h-[264px] sm:grid-cols-2"
        >
          {loading ? (
            <p className="col-span-full py-6 text-center text-xs text-muted-foreground">Đang tải danh sách vật phẩm...</p>
          ) : (
            tabItems.map((item) => (
              <CharacterCustomizerItemCard
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onSelect={(id) => handleSelectItem(activeTab, id)}
              />
            ))
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-border bg-secondary px-4 py-2 text-xs font-medium text-foreground transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-secondary/80 sm:min-h-9"
          >
            Hủy
          </button>
          <button
            type="button"
            data-testid="customizer-save-btn"
            disabled={loading || saving}
            onClick={handleSave}
            className="min-h-11 rounded-xl border border-primary/40 bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-md transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:brightness-105 active:brightness-95 disabled:opacity-50 sm:min-h-9"
          >
            {saving ? 'Đang lưu...' : 'Lưu trang bị'}
          </button>
        </div>
      </DoubleBezelCard>
    </div>
  );
}
