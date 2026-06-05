import { bootstrapCameraKit } from '@snap/camera-kit';

(async function () {
  const cameraKit = await bootstrapCameraKit({
    apiToken: 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzgwNjcxNjY0LCJzdWIiOiI5ZWY0MGRhNC00MTE2LTRhYzQtYTA5ZC1hN2ZhM2YzMmY3ODl-U1RBR0lOR343MWMzYTBmNC02NTcxLTRlZmItOGM1OS02MmZiOGMwYzhhNWYifQ.Jk60HZ2FzcuF4OlxJwlPs7ptviVNHEQ2YBY1H-B3j7k',
  });
  const liveRenderTarget = document.getElementById(
    'canvas'
  ) as HTMLCanvasElement;
  const session = await cameraKit.createSession({ liveRenderTarget });
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });

  await session.setSource(mediaStream);
  await session.play();

  const lens = await cameraKit.lensRepository.loadLens(
    'ca448eb7-93b0-474a-a73f-133770fa064f',
    '381ce689-4be4-41ac-8b15-107b9d37999d'
  );

  await session.applyLens(lens);
})();