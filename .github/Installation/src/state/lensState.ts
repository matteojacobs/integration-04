export type LensState = {
  activePovId: string;
  activeAccessoryIds: string[];
  activeBackgroundId: string | null;
};

export const lensState: LensState = {
  activePovId: "main-character",
  activeAccessoryIds: [],
  activeBackgroundId: null,
};

export function resetLensStateForPov(povId: string) {
  lensState.activePovId = povId;
  lensState.activeAccessoryIds = [];
  lensState.activeBackgroundId = null;
}

export function toggleAccessory(accessoryId: string) {
  const index = lensState.activeAccessoryIds.indexOf(accessoryId);

  if (index === -1) {
    lensState.activeAccessoryIds.push(accessoryId);
  } else {
    lensState.activeAccessoryIds.splice(index, 1);
  }
}

export function setBackground(backgroundId: string | null) {
  lensState.activeBackgroundId = backgroundId;
}