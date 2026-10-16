// Presentation-only data adapter. Production UI, rendering and motion remain unchanged.
(() => {
  'use strict';
  const table = (labels, rows) => ({ table: { cols: labels.map(label => ({ label })), rows: rows.map(row => ({ c: row.map(v => ({ v })) })) } });
  const description = 'Objeto de ejemplo para presentar el catálogo. Esta descripción extensa permite revisar el detalle completo, su apertura, foco y cierre. '.repeat(5);
  const image = "https://drive.google.com/file/d/1JYiOP8zx7NyT9IfLr__ZbmR6B0ozJZ1H/view?usp=drive_link|https://drive.google.com/file/d/1zslBF0FXWPW342P_51-E2TqQdcLTk4BH/view?usp=drive_link|https://drive.google.com/file/d/1YPMKTDpv1cdJ_SJ-nWHdOdZDpNzDJ00y/view?usp=drive_link";
  const fixtures = {
    Catalogo: table(['id','titulo','descripcion','precio','disponible','imagenes','categoria','vendido','badge'], Array.from({length:15}, (_, i) => [`muestra-${i}`, i === 2 ? 'Artículo reservado' : `Objeto de ejemplo ${i+1}`, description, (i+1)*4000, i === 2 ? 'Reservado' : 'Sí', i < 3 ? '' : image, ['Deco','Libros','Cocina'][i%3], 'No', i === 0 ? 'Recién agregado' : ''])),
    Config: table(['clave','valor'], [['whatsapp','5492235550101'],['meta_total','400000'],['actualizado','10/10/2026'],['titulo','Plot Twist · demostración'],['intro','Datos ilustrativos. Esta demostración no realiza compras ni envía consultas.']]),
    Ventas: table(['Concepto','Monto'], [['TOTAL VENDIDO',180000]])
  };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.pathname === '/api/catalog') {
      const fixture = fixtures[url.searchParams.get('sheet')];
      return Promise.resolve(new Response(JSON.stringify(fixture || {error:'Unknown sample'}), {status:fixture ? 200 : 400, headers:{'Content-Type':'application/json'}}));
    }
    return nativeFetch(input, options);
  };
  // Keep presentation selections and names away from the real catalog's storage.
  for (const kind of ['localStorage','sessionStorage']) {
    const values = new Map();
    Object.defineProperty(window, kind, {value:{getItem:key=>values.get(key) ?? null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()}});
  }
  window.open = () => null;
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (link && new URL(link.href,location.href).origin !== location.origin) event.preventDefault();
  }, true);
  async function runAction(action) {
    if (!['catalog','delivery','description','invitation','selection','gallery','reset'].includes(action)) return;
    if (action === 'reset') { location.reload(); return; }
    const ready = () => document.querySelector('#products')?.getAttribute('aria-busy') === 'false';
    for (let attempt=0; !ready() && attempt<125; attempt++) await new Promise(resolve=>setTimeout(resolve,40));
    if (!ready()) return;
    const select = document.querySelector('#products .card:not(.reserved) .select-btn');
    if (action === 'selection' && select?.getAttribute('aria-pressed') !== 'true') select.click();
    const mobile = matchMedia('(max-width:767px)').matches;
    const selectors = {catalog:mobile ? '.mobile-nav .catalog-trigger' : '.header-links .catalog-trigger',delivery:mobile ? '.mobile-nav [popovertarget="deliveryPopup"]' : '.header-delivery',description:'#products .description-more',invitation:'#webPromoTrigger',selection:mobile ? '#openBagMobile' : '#openBag',gallery:'#products .media-button'};
    const target = document.querySelector(selectors[action]);
    if (!target) return;
    target.scrollIntoView({block:'center',behavior:'instant'});
    requestAnimationFrame(() => target.click());
  }
  const requested = new URLSearchParams(location.search).get('demo');
  if (requested) window.addEventListener('load', () => runAction(requested), {once:true});
})();
