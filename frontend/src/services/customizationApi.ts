import { apiRequest } from './apiClient';

export type CharacterItemType = 'SKIN' | 'HAT' | 'DESK_PET';

export interface EquippedCustomization {
  skinId: string;
  hatId: string;
  deskPetId: string;
}

export interface CharacterItem {
  id: string;
  itemName: string;
  itemType: CharacterItemType;
  requiredStudyMinutes: number;
  unlocked: boolean;
  remainingMinutes: number;
  equipped: boolean;
}

export interface CharacterItemsCatalogResponse {
  totalStudyMinutes: number;
  equipped: EquippedCustomization;
  items: CharacterItem[];
}

export interface UpdateCustomizationRequest {
  skinId: string;
  hatId: string;
  deskPetId: string;
}

export interface UpdateCustomizationResponse {
  userId: string;
  role: 'GUEST' | 'REGISTERED';
  skinId: string;
  hatId: string;
  deskPetId: string;
  totalStudyMinutes: number;
  roomId: string | null;
}

export async function fetchCharacterItemsCatalog(): Promise<CharacterItemsCatalogResponse> {
  return apiRequest<CharacterItemsCatalogResponse>('/api/v1/items');
}

export async function updateMyCustomization(
  payload: UpdateCustomizationRequest,
): Promise<UpdateCustomizationResponse> {
  return apiRequest<UpdateCustomizationResponse>('/api/v1/users/me/customization', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
