// Formulario de "Solicitar cotización" por categoría del catálogo, igual que en las fichas de terza.com:
// todas piden los mismos datos de contacto; cambian los rangos de "Tamaño del proyecto" y pasto agrega "Tipo de pasto".
type Cotizacion = { rangos?: string[]; tipoPasto?: boolean };

const M2_CHICO = ['Rango 1 (0-50 m²)', 'Rango 2 (51-200 m²)', 'Rango 3 (201 m² en adelante)'];
const PIEZAS = ['Rango 1 (1-10 pzas)', 'Rango 2 (11-50 pzas)', 'Rango 3 (51-100 pzas)'];

const porCategoria: Record<string, Cotizacion> = {
  alfombras: { rangos: M2_CHICO },
  'pisos-de-madera': { rangos: M2_CHICO },
  'pisos-deck': { rangos: M2_CHICO },
  'muros-verdes': { rangos: M2_CHICO },
  'pasto-sintetico': { rangos: M2_CHICO, tipoPasto: true },
  'piso-vinilico': { rangos: ['Rango 1 (0-100 m²)', 'Rango 2 (101-500 m²)', 'Rango 3 (501 m² en adelante)'] },
  'pisos-laminados': { rangos: ['Rango 1 (0-100 m²)', 'Rango 2 (101-1000 m²)', 'Rango 3 (1001 m² en adelante)'] },
  'persianas-enrollables': { rangos: PIEZAS },
  'persianas-de-madera': { rangos: PIEZAS },
  // Pisos híbridos, lambrín y paneles, Flexiroc y accesorios: sin tamaño de proyecto
};

export const cotizacionDe = (categoria: string): Cotizacion => porCategoria[categoria] ?? {};
