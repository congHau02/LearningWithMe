import { useEffect, useState } from 'react';
import { formatApiError } from '../../services/apiClient';
import {
  fetchCharacterItemsCatalog,
  updateMyCustomization,
  type CharacterItem,
  type CharacterItemType,
} from '../../services/customizationApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { StarterAvatarPortrait } from '../auth/starterAvatars';
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        skinId: updated.skinId,
        hatId: updated.hatId,
        deskPetId: updated.deskPetId,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customizer-title"
        data-testid="character-customizer-modal"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-4">
            <StarterAvatarPortrait avatarId={skinId} hatId={hatId} deskPetId={deskPetId} size={64} testId="customizer-preview-portrait" />
            <div>
              <h2 id="customizer-title" className="text-lg font-bold tracking-tight">Tủ đồ &amp; Thú cưng bàn học</h2>
              <p className="text-xs text-muted-foreground">
                Tổng tích lũy: <span className="font-mono font-semibold text-primary">{totalMinutes} phút</span> học tập
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-accent">
            Đóng
          </button>
        </div>

        <div role="tablist" className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-border bg-background/60 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.type}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.type}
              data-testid={`customizer-tab-${tab.type}`}
              onClick={() => setActiveTab(tab.type)}
              className={`rounded-md px-2 py-2 text-xs font-semibold transition ${
                activeTab === tab.type ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {errorMsg ? (
          <p role="alert" className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {errorMsg}
          </p>
        ) : null}

        <div className="mt-4 grid flex-1 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
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
          <button type="button" onClick={onClose} className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent">
            Hủy
          </button>
          <button
            type="button"
            data-testid="customizer-save-btn"
            disabled={loading || saving}
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu trang bị'}
          </button>
        </div>
      </div>
    </div>
  );
}
