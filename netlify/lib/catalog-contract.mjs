export const publicFields = Object.freeze({
  Catalogo: ['id', 'titulo', 'descripcion', 'precio', 'disponible', 'imagenes', 'categoria', 'vendido', 'badge', 'reservado'],
  Config: ['clave', 'valor'], Ventas: ['concepto', 'importe'],
});
const publicSettings = new Set(['titulo', 'intro', 'nota_reserva', 'whatsapp', 'actualizado', 'meta_total', 'mp_comision_inmediata', 'mp_comision_3_cuotas', 'mp_iva', 'mostrar_boton_vender']);
export const isPublicSheet = sheet => Object.hasOwn(publicFields, sheet);

// Both transports cross this boundary. Never return source metadata.
export function publicTable(sheet, table) {
  if (!isPublicSheet(sheet) || !Array.isArray(table?.cols) || !Array.isArray(table?.rows)) throw new Error('Invalid source table');
  const fields = publicFields[sheet];
  const indices = fields.map(label => {
    const matches = table.cols.flatMap((column, index) => column?.label === label ? [index] : []);
    if (matches.length !== 1) throw new Error('Invalid source columns');
    return matches[0];
  });
  const rows = table.rows.map(row => {
    if (!Array.isArray(row?.c)) throw new Error('Invalid source row');
    return { c: indices.map(index => {
      const value = row.c[index]?.v ?? '';
      if (!['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Invalid source cell');
      return { v: value };
    }) };
  }).filter(row => sheet === 'Config' ? publicSettings.has(String(row.c[0].v).trim()) : sheet === 'Ventas' ? row.c[0].v === 'TOTAL VENDIDO' : String(row.c[1].v).trim());
  if (sheet === 'Ventas' && (rows.length !== 1 || typeof rows[0].c[1].v !== 'number')) throw new Error('Invalid sales total');
  return { cols: fields.map(label => ({ label })), rows };
}

// Match Apps Script, including positional Config/Ventas columns.
export function tableFromValues(sheet, values) {
  if (!isPublicSheet(sheet) || !Array.isArray(values) || !values.length || values.some(row => !Array.isArray(row))) throw new Error('Invalid source values');
  const labels = sheet === 'Catalogo' ? values[0].map(value => String(value).trim()) : publicFields[sheet];
  return { cols: labels.map(label => ({ label })), rows: values.slice(1).map(row => ({ c: row.map(value => ({ v: value })) })) };
}
