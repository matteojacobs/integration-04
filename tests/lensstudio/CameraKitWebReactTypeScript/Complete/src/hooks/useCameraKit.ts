import { useContext } from 'react';
import { CameraKitContext } from '../contexts/CameraKitContext';

export const useCameraKit = () => {
  const state = useContext(CameraKitContext);

  if (!state) {
    throw new Error('useCameraKit must be used inside of a CameraKitContext');
  }

  return state;
};
