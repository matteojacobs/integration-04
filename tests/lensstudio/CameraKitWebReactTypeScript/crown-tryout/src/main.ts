import { bootstrapCameraKit } from '@snap/camera-kit';

(async function () {
  const cameraKit = await bootstrapCameraKit({
    apiToken: import .meta.env.VITE_API_KEY,
  });
  const liveRenderTarget = document.getElementById(
    'canvas'
  ) as HTMLCanvasElement;
  const session = await cameraKit.createSession({ liveRenderTarget });
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  await session.setSource(mediaStream);
  //await session.setFPSLimit(30);
  
  const lens = await cameraKit.lensRepository.loadLens(
    import.meta.env.VITE_LENS_ID,
    import.meta.env.VITE_GROUP_ID
  );

  await session.applyLens(lens);
  await session.play();
})();