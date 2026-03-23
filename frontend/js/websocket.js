let ws = null;
let reconnectTimeout = null;

function conectarWS() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${window.location.host}/ws/panel`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[WS] Conectado al panel');
    if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.tipo === 'nuevo_canje') {
        mostrarModalCanje(data);
      }
    } catch (e) {
      console.error('[WS] Error procesando mensaje:', e);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Desconectado. Reconectando en 3s...');
    reconnectTimeout = setTimeout(conectarWS, 3000);
  };

  ws.onerror = (e) => {
    console.error('[WS] Error:', e);
    ws.close();
  };
}

// Arrancar conexión cuando el panel carga
conectarWS();
