// Shared public contract for optional product proposals. No business data or credentials.
export const categories = ['Electrodomésticos', 'Cocina', 'Muebles y organización', 'Deco y textiles', 'Hogar y exterior', 'Tecnología', 'Ropa y accesorios', 'Libros', 'Tarot y oráculos', 'Cuidado personal', 'Otros'];
export const conditions = ['Nuevo, sin uso', 'Usado, excelente estado', 'Usado, buen estado', 'Usado, con detalles'];
export const currencies = ['ARS', 'USD', 'CRC'];
export const limits = Object.freeze({ products: 10, photos: 3, sourceBytes: 12 * 1024 * 1024, photoBytes: 750 * 1024, photoSide: 1600, requestBytes: 4 * 1024 * 1024 });
