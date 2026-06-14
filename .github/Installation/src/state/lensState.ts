import { POVS } from "../data/povs";

export type LensState = {
  currentPovId: string;
  extraAccessories: Record<string, boolean>;
  activeBackgroundId: string | null;
};

export const lensState: LensState = {
  currentPovId: POVS[0].id,
  extraAccessories: {},
  activeBackgroundId: null,
};

export function resetLensStateForPov(povIndex: number): void {
  const pov = POVS[povIndex];

  lensState.currentPovId = pov.id;
  lensState.extraAccessories = {};
  lensState.activeBackgroundId = null;

  pov.extraAccessories.forEach((accessory) => {
    lensState.extraAccessories[accessory.id] = false;
  });
}

export function toggleExtraAccessory(accessoryId: string): void {
  if (!(accessoryId in lensState.extraAccessories)) {
    console.warn(`Accessory "${accessoryId}" is not available for current POV.`);
    return;
  }

  lensState.extraAccessories[accessoryId] =
    !lensState.extraAccessories[accessoryId];
}

export function selectBackground(backgroundId: string): void {
  if (lensState.activeBackgroundId === backgroundId) {
    lensState.activeBackgroundId = null;
    return;
  }

  lensState.activeBackgroundId = backgroundId;
}

export function clearBackground(): void {
  lensState.activeBackgroundId = null;
}