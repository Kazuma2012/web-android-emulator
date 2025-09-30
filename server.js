import express from 'express';
import { WebSocketServer } from 'ws';
import { RTCPeerConnection, RTCVideoSource, RTCVideoFrame } from 'wrtc';
import RFB from 'node-rfb2';
import { createCanvas, ImageData } from 'canvas';

const app = express();
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: 8081 });

// VNC設定
const VNC_HOST = 'localhost';
const VNC_PORT = 5900;
const VNC_PASSWORD = '';

wss.on('connection', ws => {
  console.log('Client connected');
  let pc, videoSource;

  ws.on('message', async msg => {
    const data = JSON.parse(msg.toString());

    if (data.type === 'offer') {
      pc = new RTCPeerConnection();
      videoSource = new RTCVideoSource();
      pc.addTrack(videoSource.createTrack());

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type:'answer', sdp: answer.sdp }));

      // VNC接続
      const rfb = RFB.createConnection({ host: VNC_HOST, port: VNC_PORT, password: VNC_PASSWORD });

      rfb.on('rect', rect => {
        if(rect.encodingName !== 'raw') return;

        const canvas = createCanvas(rect.width, rect.height);
        const ctx = canvas.getContext('2d');
        const imageData = new ImageData(new Uint8ClampedArray(rect.data), rect.width, rect.height);
        ctx.putImageData(imageData, 0, 0);

        const frame = new RTCVideoFrame(canvas.toBuffer('raw'), rect.width, rect.height);
        videoSource.onFrame(frame);
      });

      ws.on('message', inputMsg => {
        const input = JSON.parse(inputMsg.toString());
        if(input.type==='keydown' || input.type==='keyup'){
          rfb.keyEvent(input.key, input.type==='keydown');
        }
      });
    }
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
