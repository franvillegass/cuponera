let negocioActual = null;
let tabActual = 'cupones';
let feedCargado = false;
let statsCargado = false;

async function init() {
  const res = await fetch('/api/negocios/me');
  if (!res.ok) { window.location.href = '/login'; return; }
  negocioActual = await res.json();
  document.getElementById('nav-nombre').textContent = negocioActual.nombre;
  cargarCupones();
}

// ── Tabs ──
function switchTab(tab) {
  tabActual = tab;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`tbtn-${tab}`).classList.add('active');

  if (tab === 'feed' && !feedCargado) {
    cargarFeedPanel();
    feedCargado = true;
  }
  if (tab === 'stats' && !statsCargado) {
    iniciarStats();
    statsCargado = true;
  }
}

// ── Feed del barrio en el panel ──
async function cargarFeedPanel() { return cargarFeed("feed-panel"); }




// ── Cupones del negocio ──
async function cargarCupones() {
  const lista = document.getElementById('lista-cupones');
  const res = await fetch('/api/cupones/mios');
  if (!res.ok) { lista.innerHTML = '<div class="alert alert--error">Error al cargar cupones</div>'; return; }
  const cupones = await res.json();

  if (!cupones.length) {
    lista.innerHTML = `
      <div class="empty">
        <div class="empty__icon">🎟️</div>
        <div class="empty__text">Todavía no tenés cupones.<br>¡Creá el primero!</div>
      </div>`;
    return;
  }

  lista.innerHTML = cupones.map(c => {
    const unidad = c.tipo_precio === 'peso' ? '/kg' : '/unidad';
    const descuento = Math.round((1 - c.precio_final / c.precio_base) * 100);
    return `
      <div class="panel-cupon" id="cupon-${c.id}">
        <div class="panel-cupon__info">
          <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
            <span class="panel-cupon__nombre">${c.producto}</span>
            <span class="badge badge--${c.activo ? 'active' : 'inactive'}">${c.activo ? 'Activo' : 'Inactivo'}</span>
            <span class="descuento-pill">-${descuento}%</span>
          </div>
          <div class="panel-cupon__precios">
            <span class="precio-base">$${c.precio_base.toFixed(2)}</span>
            → <span class="precio-final">$${c.precio_final.toFixed(2)}</span>${unidad}
            ${c.limite_canjes ? ` · Límite: ${c.limite_canjes}` : ''}
            · ${c.total_canjes} canje${c.total_canjes !== 1 ? 's' : ''}
          </div>
        </div>
        <div class="panel-cupon__actions">
          <label class="toggle" title="${c.activo ? 'Desactivar' : 'Activar'} cupón">
            <input type="checkbox" ${c.activo ? 'checked' : ''} onchange="toggleCupon(${c.id}, this)">
            <span class="toggle__track"></span>
          </label>
          <button class="btn btn--secondary btn--sm" onclick="verQR(${c.id}, '${c.producto.replace(/'/g, "\\'")}')">QR</button>
          <button class="btn btn--danger btn--sm" onclick="eliminarCupon(${c.id})">Borrar</button>
        </div>
      </div>`;
  }).join('');
}

async function toggleCupon(id, checkbox) {
  const res = await fetch(`/api/cupones/${id}/toggle`, { method: 'PATCH' });
  if (!res.ok) { checkbox.checked = !checkbox.checked; alert('Error al cambiar estado'); return; }
  const data = await res.json();
  const card = document.getElementById(`cupon-${id}`);
  const badge = card.querySelector('.badge');
  badge.className = `badge badge--${data.activo ? 'active' : 'inactive'}`;
  badge.textContent = data.activo ? 'Activo' : 'Inactivo';
}

async function eliminarCupon(id) {
  if (!confirm('¿Eliminar este cupón? Esta acción no se puede deshacer.')) return;
  const res = await fetch(`/api/cupones/${id}`, { method: 'DELETE' });
  if (!res.ok) { alert('Error al eliminar'); return; }
  cargarCupones();
  statsCargado = false; // forzar recarga de stats
}

async function verQR(id, producto) {
  const res = await fetch(`/api/cupones/${id}/qr`);
  const data = await res.json();
  document.getElementById('qr-titulo').textContent = producto;
  document.getElementById('qr-imagen').src = `data:image/png;base64,${data.qr}`;
  abrirModal('modal-qr');
}

// ── Crear cupón ──
function abrirModalCrear() {
  document.getElementById('alert-crear').innerHTML = '';
  ['c-producto','c-precio-base','c-precio-final','c-limite'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('c-un-canje').checked = false;
  abrirModal('modal-crear');
}

async function crearCupon() {
  const producto = document.getElementById('c-producto').value.trim();
  const precio_base = parseFloat(document.getElementById('c-precio-base').value);
  const precio_final = parseFloat(document.getElementById('c-precio-final').value);
  const tipo_precio = document.getElementById('c-tipo').value;
  const limiteVal = document.getElementById('c-limite').value;
  const limite_canjes = limiteVal ? parseInt(limiteVal) : null;
  const un_canje_por_ip = document.getElementById('c-un-canje').checked;
  const alertEl = document.getElementById('alert-crear');

  if (!producto || isNaN(precio_base) || isNaN(precio_final)) {
    alertEl.innerHTML = '<div class="alert alert--error">Completá todos los campos requeridos</div>'; return;
  }
  if (precio_final >= precio_base) {
    alertEl.innerHTML = '<div class="alert alert--error">El precio con cupón debe ser menor al precio normal</div>'; return;
  }

  const res = await fetch('/api/cupones/', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ producto, precio_base, precio_final, tipo_precio, limite_canjes, un_canje_por_ip })
  });
  if (!res.ok) {
    const data = await res.json();
    alertEl.innerHTML = `<div class="alert alert--error">${data.detail || 'Error al crear'}</div>`; return;
  }
  cerrarModal('modal-crear');
  cargarCupones();
  statsCargado = false;
}

// ── Canje ──
let canjeActualId = null;
let canjeActualPrecio = null;

function mostrarModalCanje(info) {
  canjeActualId = info.canje_id;
  canjeActualPrecio = info.precio_final;

  document.getElementById('canje-producto').textContent = info.producto;
  document.getElementById('canje-precio-label').textContent =
    `$${info.precio_final.toFixed(2)} / ${info.tipo_precio === 'peso' ? 'kg' : 'unidad'}`;
  document.getElementById('canje-cantidad-label').textContent =
    info.tipo_precio === 'peso' ? '¿Cuántos kg lleva el cliente?' : '¿Cuántas unidades lleva?';
  document.getElementById('canje-cantidad').step = info.tipo_precio === 'peso' ? '0.01' : '1';
  document.getElementById('canje-cantidad').value = '';
  document.getElementById('canje-total').textContent = '';
  abrirModal('modal-canje');

  document.getElementById('canje-cantidad').oninput = function() {
    const cant = parseFloat(this.value);
    if (!isNaN(cant) && cant > 0) {
      document.getElementById('canje-total').textContent = `Total: $${(cant * canjeActualPrecio).toFixed(2)}`;
    } else {
      document.getElementById('canje-total').textContent = '';
    }
  };
}

async function confirmarCanje() {
  const cantidad = parseFloat(document.getElementById('canje-cantidad').value);
  if (isNaN(cantidad) || cantidad <= 0) { alert('Ingresá una cantidad válida'); return; }
  const res = await fetch(`/api/canjes/confirmar/${canjeActualId}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ cantidad })
  });
  if (!res.ok) { alert('Error al confirmar'); return; }
  const data = await res.json();
  cerrarModal('modal-canje');
  alert(`✅ Venta confirmada\nTotal: $${data.total.toFixed(2)}`);
  cargarCupones();
  statsCargado = false;
}

async function cancelarCanje() {
  if (canjeActualId) await fetch(`/api/canjes/cancelar/${canjeActualId}`, { method: 'DELETE' });
  cerrarModal('modal-canje');
}

// ── Helpers ──
function abrirModal(id) { document.getElementById(id).classList.add('visible'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('visible'); }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay && overlay.id !== 'modal-canje') overlay.classList.remove('visible');
  });
});

async function logout() {
  await fetch('/api/negocios/logout', { method: 'POST' });
  window.location.href = '/';
}

init();
