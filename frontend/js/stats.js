let chartIngresos = null;
let chartProducto = null;

const ACCENT = '#d4581a';
const ACCENT2 = '#2d7a4f';
const GRID = 'rgba(0,0,0,0.06)';
const FONT = "'DM Sans', sans-serif";

const baseOpts = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: GRID }, ticks: { font: { family: FONT, size: 12 }, color: '#7a6a5e' } },
    y: { grid: { color: GRID }, ticks: { font: { family: FONT, size: 12 }, color: '#7a6a5e' } }
  }
};

async function iniciarStats() {
  await cargarResumen();
  await cargarGraficoIngresos();
  await cargarProductos();
}

async function cargarResumen() {
  // Usar datos del gráfico por día para calcular totales
  const res = await fetch('/api/stats/ingresos?periodo=dia');
  const data = await res.json();
  const total = data.reduce((s, r) => s + r.total, 0);

  const resCanjes = await fetch('/api/stats/ventas-producto?cupon_id=0&periodo=dia&metrica=canjes');
  // Obtener canjes totales sumando desde ingresos (canjes aproximados)
  // Mejor: usar endpoint de ingresos con metrica canjes
  const resAll = await fetch('/api/stats/ingresos?periodo=dia');
  const allData = await resAll.json();

  document.getElementById('stat-total').textContent = `$${total.toFixed(2)}`;

  // Canjes: sumar desde todos los productos
  const resProd = await fetch('/api/stats/productos');
  const prods = await resProd.json();
  let totalCanjes = 0;
  for (const p of prods) {
    const r = await fetch(`/api/stats/ventas-producto?cupon_id=${p.id}&periodo=dia&metrica=canjes`);
    const d = await r.json();
    totalCanjes += d.reduce((s, row) => s + row.canjes, 0);
  }
  document.getElementById('stat-canjes').textContent = totalCanjes;
}

async function cargarGraficoIngresos() {
  const periodo = document.getElementById('ctrl-periodo-ingresos').value;
  const res = await fetch(`/api/stats/ingresos?periodo=${periodo}`);
  const data = await res.json();

  const canvas = document.getElementById('chart-ingresos');
  const empty = document.getElementById('empty-ingresos');

  if (!data.length) {
    canvas.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  canvas.style.display = 'block';
  empty.style.display = 'none';

  const labels = data.map(r => r.periodo);
  const values = data.map(r => r.total);

  if (chartIngresos) chartIngresos.destroy();

  chartIngresos = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Ingresos ($)',
        data: values,
        backgroundColor: ACCENT + 'cc',
        borderColor: ACCENT,
        borderWidth: 1.5,
        borderRadius: 6,
      }]
    },
    options: {
      ...baseOpts,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` $${ctx.parsed.y.toFixed(2)}`
          }
        }
      },
      scales: {
        ...baseOpts.scales,
        y: {
          ...baseOpts.scales.y,
          ticks: {
            ...baseOpts.scales.y.ticks,
            callback: v => `$${v}`
          }
        }
      }
    }
  });
}

async function cargarProductos() {
  const res = await fetch('/api/stats/productos');
  const prods = await res.json();
  const sel = document.getElementById('ctrl-producto');
  sel.innerHTML = '<option value="">— Elegir producto —</option>';
  prods.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.producto;
    sel.appendChild(opt);
  });
}

async function cargarGraficoProducto() {
  const cuponId = document.getElementById('ctrl-producto').value;
  const periodo = document.getElementById('ctrl-periodo-producto').value;
  const metrica = document.getElementById('ctrl-metrica').value;

  const canvas = document.getElementById('chart-producto');
  const empty = document.getElementById('empty-producto');

  if (!cuponId) {
    canvas.style.display = 'none';
    empty.style.display = 'block';
    empty.querySelector('.empty__text').textContent = 'Elegí un producto para ver sus ventas';
    return;
  }

  const res = await fetch(`/api/stats/ventas-producto?cupon_id=${cuponId}&periodo=${periodo}&metrica=${metrica}`);
  const data = await res.json();

  if (!data.length) {
    canvas.style.display = 'none';
    empty.style.display = 'block';
    empty.querySelector('.empty__text').textContent = 'Sin ventas para este producto todavía';
    return;
  }

  canvas.style.display = 'block';
  empty.style.display = 'none';

  const labels = data.map(r => r.periodo);

  if (chartProducto) chartProducto.destroy();

  if (metrica === 'ambos') {
    chartProducto = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Ingresos ($)',
            data: data.map(r => r.dinero),
            backgroundColor: ACCENT + 'cc',
            borderColor: ACCENT,
            borderWidth: 1.5,
            borderRadius: 4,
            yAxisID: 'y',
          },
          {
            label: 'Canjes',
            data: data.map(r => r.canjes),
            type: 'line',
            borderColor: ACCENT2,
            backgroundColor: ACCENT2 + '22',
            borderWidth: 2,
            pointBackgroundColor: ACCENT2,
            pointRadius: 4,
            tension: 0.3,
            yAxisID: 'y2',
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            labels: { font: { family: FONT, size: 12 }, color: '#7a6a5e', boxWidth: 14 }
          }
        },
        scales: {
          x: { grid: { color: GRID }, ticks: { font: { family: FONT, size: 12 }, color: '#7a6a5e' } },
          y: {
            position: 'left',
            grid: { color: GRID },
            ticks: { font: { family: FONT, size: 12 }, color: '#7a6a5e', callback: v => `$${v}` }
          },
          y2: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { font: { family: FONT, size: 12 }, color: ACCENT2 }
          }
        }
      }
    });
  } else {
    const esDinero = metrica === 'dinero';
    chartProducto = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: esDinero ? 'Ingresos ($)' : 'Canjes',
          data: data.map(r => esDinero ? r.dinero : r.canjes),
          backgroundColor: (esDinero ? ACCENT : ACCENT2) + 'cc',
          borderColor: esDinero ? ACCENT : ACCENT2,
          borderWidth: 1.5,
          borderRadius: 6,
        }]
      },
      options: {
        ...baseOpts,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => esDinero ? ` $${ctx.parsed.y.toFixed(2)}` : ` ${ctx.parsed.y} canjes`
            }
          }
        },
        scales: {
          ...baseOpts.scales,
          y: {
            ...baseOpts.scales.y,
            ticks: {
              ...baseOpts.scales.y.ticks,
              callback: v => esDinero ? `$${v}` : v
            }
          }
        }
      }
    });
  }
}
