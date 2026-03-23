// Carga jsQR dinámicamente
let jsQR = null;

async function cargarJsQR() {
  if (jsQR) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  jsQR = window.jsQR;
}

let streamActivo = null;
let scanLoop = null;
let yaEscaneado = false;

async function abrirScanner() {
  await cargarJsQR();
  yaEscaneado = false;

  const overlay = document.getElementById('scanner-overlay');
  const video = document.getElementById('qr-video');
  const resultado = document.getElementById('scan-result');
  resultado.style.display = 'none';
  resultado.innerHTML = '';

  overlay.classList.add('visible');

  try {
    streamActivo = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = streamActivo;
    await video.play();
    iniciarLoop();
  } catch (e) {
    resultado.style.display = 'block';
    resultado.innerHTML = `<div class="alert alert--error">No se pudo acceder a la cámara. Permitir el acceso e intentar de nuevo.</div>`;
  }
}

function iniciarLoop() {
  const video = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');
  const ctx = canvas.getContext('2d');

  function tick() {
    if (yaEscaneado) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        yaEscaneado = true;
        procesarQR(code.data);
        return;
      }
    }
    scanLoop = requestAnimationFrame(tick);
  }
  scanLoop = requestAnimationFrame(tick);
}

async function procesarQR(data) {
  // El QR contiene "/canjear/{cupon_id}"
  const match = data.match(/\/canjear\/(\d+)/);
  if (!match) {
    mostrarResultadoScan('error', 'QR no reconocido. ¿Es un cupón de esta cuponera?');
    return;
  }
  const cuponId = match[1];

  // Redirigir a la página de canje (que hace el POST automáticamente)
  detenerCamara();
  cerrarScanner();
  window.location.href = `/canjear/${cuponId}`;
}

function mostrarResultadoScan(tipo, mensaje) {
  const el = document.getElementById('scan-result');
  el.style.display = 'block';
  el.innerHTML = `<div class="alert alert--${tipo === 'error' ? 'error' : 'success'}">${mensaje}</div>`;
}

function detenerCamara() {
  if (scanLoop) { cancelAnimationFrame(scanLoop); scanLoop = null; }
  if (streamActivo) {
    streamActivo.getTracks().forEach(t => t.stop());
    streamActivo = null;
  }
}

function cerrarScanner() {
  detenerCamara();
  const overlay = document.getElementById('scanner-overlay');
  if (overlay) overlay.classList.remove('visible');
}
