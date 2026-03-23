async function cargarFeed(contenedorId = 'feed') {
  const feed = document.getElementById(contenedorId);
  if (!feed) return;

  const res = await fetch('/api/cupones/feed');
  const cupones = await res.json();

  if (!cupones.length) {
    feed.innerHTML = `
      <div class="empty">
        <div class="empty__icon">🏪</div>
        <div class="empty__text">No hay cupones activos en este momento.<br>¡Volvé más tarde!</div>
      </div>`;
    return;
  }

  feed.innerHTML = cupones.map(c => {
    const descuento = Math.round((1 - c.precio_final / c.precio_base) * 100);
    const unidad = c.tipo_precio === 'peso' ? 'kg' : 'unidad';
    const limiteText = c.limite_canjes ? `Límite: ${c.limite_canjes} usos` : 'Sin límite de usos';

    // Botón de mapa: si tiene coords usamos lat/lng, si solo tiene dirección buscamos por texto
    let mapaBtn = '';
    if (c.negocio_lat && c.negocio_lng) {
      const url = `https://www.google.com/maps?q=${c.negocio_lat},${c.negocio_lng}`;
      mapaBtn = `<a href="${url}" target="_blank" rel="noopener" class="btn btn--secondary btn--sm" style="text-decoration:none;">
        📍 Cómo llegar
      </a>`;
    } else if (c.negocio_direccion) {
      const query = encodeURIComponent(c.negocio_direccion);
      const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
      mapaBtn = `<a href="${url}" target="_blank" rel="noopener" class="btn btn--secondary btn--sm" style="text-decoration:none;">
        📍 Cómo llegar
      </a>`;
    }

    return `
      <div class="card cupon-card" onclick="toggleCuponCard(this)">
        <div class="cupon-card__header">
          <div>
            <div class="cupon-card__negocio">${c.negocio}</div>
            <div class="cupon-card__producto">${c.producto}</div>
            <div class="cupon-card__precios">
              <span class="precio-base">$${c.precio_base.toFixed(2)}</span>
              <span class="precio-final">$${c.precio_final.toFixed(2)}</span>
              <span style="font-size:.8rem;color:var(--text-muted)">/${unidad}</span>
            </div>
          </div>
          <span class="descuento-pill">-${descuento}%</span>
        </div>
        <div class="cupon-card__detalle">
          <div class="cupon-card__meta">
            ${c.negocio_desc ? `<div>${c.negocio_desc}</div>` : ''}
            ${c.negocio_direccion ? `<div style="color:var(--text-muted);">📍 ${c.negocio_direccion}</div>` : ''}
            <div>${limiteText}</div>
            ${c.un_canje_por_ip ? '<div>Un uso por persona</div>' : ''}
          </div>
          <div style="display:flex;gap:.6rem;flex-wrap:wrap;">
            <button class="btn btn--primary" style="flex:1;min-width:160px;" onclick="iniciarScan(event)">
              📷 Escanear QR
            </button>
            ${mapaBtn ? `<div style="flex:1;min-width:120px;">${mapaBtn}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function toggleCuponCard(card) {
  const detalle = card.querySelector('.cupon-card__detalle');
  const estaAbierto = detalle.classList.contains('open');
  card.closest('.feed').querySelectorAll('.cupon-card__detalle.open')
    .forEach(d => d.classList.remove('open'));
  if (!estaAbierto) detalle.classList.add('open');
}

function iniciarScan(event) {
  event.stopPropagation();
  abrirScanner();
}

if (document.getElementById('feed')) {
  cargarFeed('feed');
}
