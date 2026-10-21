import { PartRecord, DiameterSummary } from '../types';

/**
 * Detect delimiter: comma, semicolon, tab, pipe, or space
 */
export function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .slice(0, 15);

  if (lines.length === 0) return ',';

  let commas = 0;
  let semicolons = 0;
  let tabs = 0;
  let pipes = 0;

  lines.forEach(l => {
    commas += (l.match(/,/g) || []).length;
    semicolons += (l.match(/;/g) || []).length;
    tabs += (l.match(/\t/g) || []).length;
    pipes += (l.match(/\|/g) || []).length;
  });

  if (semicolons >= commas && semicolons >= tabs && semicolons > 0) return ';';
  if (tabs >= commas && tabs >= semicolons && tabs > 0) return '\t';
  if (pipes >= commas && pipes >= semicolons && pipes > 0) return '|';
  return ',';
}

/**
 * Clean cell content (strip quotes, spaces, BOM)
 */
export function cleanCell(cell: string | undefined): string {
  if (!cell) return '';
  return cell
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

/**
 * Normalizes text for header comparison (lowercase, removes accents, symbols)
 */
export function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Parses numeric values safely supporting:
 * - "17.5"
 * - "17,5"
 * - " 2 "
 * - "14.0(14.0x30.0)" -> returns 14.0
 */
export function parseFlexibleNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim().replace(/\s+/g, '');
  const match = str.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return 0;
  const num = parseFloat(match[0].replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

export interface ParseResult {
  headerMetadata: string[];
  rawLines: string[];
  sampleRows: string[][];
  parts: PartRecord[];
  diameterSummary: DiameterSummary[];
  totalPartsCount: number;
  totalHolesProduction: number;
  rawRowCount: number;
  detectedColumns: {
    parte: number;
    perfil: number;
    cantPartes: number;
    diametro: number;
    agujerosPorParte: number;
  };
  delimiterUsed: string;
}

/**
 * Advanced, ultra-tolerant parser for metallurgy CSV, TXT and Excel exports
 */
export function parseMetallurgyCsv(
  rawContent: string,
  customColMap?: { parte: number; perfil: number; cantPartes: number; diametro: number; agujerosPorParte: number },
  forcedDelimiter?: string
): ParseResult {
  const delimiter = forcedDelimiter || detectDelimiter(rawContent);

  const rawLines = rawContent
    .split(/\r?\n/)
    .map(l => l.replace(/^\uFEFF/, '').trim())
    .filter(l => l.length > 0);

  const sampleRows: string[][] = rawLines.slice(0, 10).map(line =>
    line.split(delimiter).map(cleanCell)
  );

  let tableHeaderIndex = -1;
  let colMap = customColMap ? { ...customColMap } : {
    parte: -1,
    perfil: -1,
    cantPartes: -1,
    diametro: -1,
    agujerosPorParte: -1,
  };

  const headerMetadata: string[] = [];

  // Search for the table header row
  if (!customColMap) {
    for (let i = 0; i < Math.min(rawLines.length, 25); i++) {
      const cells = rawLines[i].split(delimiter).map(cleanCell);
      const normCells = cells.map(normalizeHeader);

      // Part keywords: parte, marca, pieza, pos, posicion, part, mark
      const pIdx = normCells.findIndex(c =>
        c === 'parte' || c === 'marca' || c === 'pieza' || c === 'pos' || c === 'posicion' || c === 'part' || c === 'mark'
      );

      // Profile keywords: perfil, profile, seccion, material
      const perfIdx = normCells.findIndex(c =>
        c === 'perfil' || c.includes('profile') || c === 'seccion' || c === 'secc' || c.includes('perfil')
      );

      // Quantity keywords: cant, cantidad, qty, cantpartes
      const qtyIdx = normCells.findIndex((c, idx) =>
        idx !== pIdx && (c.includes('cant') || c === 'qty' || c === 'cantidad' || c === 'cantpartes')
      );

      // Diameter keywords: diametro, diam, dia, hole, d
      const dIdx = normCells.findIndex(c =>
        c === 'diametro' || c === 'diam' || c.includes('diam') || c === 'd' || c === 'o'
      );

      // Hole count keywords: agujeros, taladros, agujerosporpartes, holes (strictly avoid matching file title "bulones por parte")
      const hIdx = normCells.findIndex((c, idx) =>
        idx !== pIdx && (c.includes('agujero') || c.includes('taladro') || c === 'holes' || (c.includes('perf') && !c.includes('perfil')))
      );

      // Valid table header MUST match at least 2 distinct key headers!
      const foundCount = [pIdx, perfIdx, qtyIdx, dIdx, hIdx].filter(idx => idx !== -1).length;
      if (foundCount >= 2) {
        tableHeaderIndex = i;
        colMap.parte = pIdx !== -1 ? pIdx : 0;
        colMap.perfil = perfIdx !== -1 ? perfIdx : 1;
        colMap.cantPartes = qtyIdx !== -1 ? qtyIdx : 2;
        colMap.diametro = dIdx !== -1 ? dIdx : 3;
        colMap.agujerosPorParte = hIdx !== -1 ? hIdx : 4;
        break;
      } else {
        headerMetadata.push(rawLines[i]);
      }
    }
  }

  // Fallback if no header found
  if (tableHeaderIndex === -1 && !customColMap) {
    tableHeaderIndex = 0;
    colMap = {
      parte: 0,
      perfil: 1,
      cantPartes: 2,
      diametro: 3,
      agujerosPorParte: 4,
    };
  }

  const dataLines = tableHeaderIndex >= 0 ? rawLines.slice(tableHeaderIndex + 1) : rawLines;

  let currentPartRecord: PartRecord | null = null;
  const partsMap = new Map<string, PartRecord>();

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (!line.replace(new RegExp(`\\${delimiter}`, 'g'), '').trim()) continue;

    const cells = line.split(delimiter).map(cleanCell);

    const rawPart = colMap.parte >= 0 && colMap.parte < cells.length ? cells[colMap.parte] : '';
    const rawProfile = colMap.perfil >= 0 && colMap.perfil < cells.length ? cells[colMap.perfil] : '';
    const rawQty = colMap.cantPartes >= 0 && colMap.cantPartes < cells.length ? cells[colMap.cantPartes] : '';
    const rawDiam = colMap.diametro >= 0 && colMap.diametro < cells.length ? cells[colMap.diametro] : '';
    const rawHoles = colMap.agujerosPorParte >= 0 && colMap.agujerosPorParte < cells.length ? cells[colMap.agujerosPorParte] : '';

    // Ignore accidental duplicate header rows
    if (normalizeHeader(rawPart).includes('parte') && normalizeHeader(rawDiam).includes('diam')) {
      continue;
    }

    // New Part row
    if (rawPart.length > 0) {
      const parsedQty = parseFlexibleNumber(rawQty);
      const qty = parsedQty > 0 ? parsedQty : 1;

      currentPartRecord = {
        id: `part-${rawPart}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        partId: rawPart,
        profile: rawProfile || 'ESTÁNDAR',
        quantity: qty,
        holes: [],
        totalHolesPerPiece: 0,
        totalHolesAllPieces: 0,
      };
      partsMap.set(rawPart, currentPartRecord);
    }

    // Check if this row (whether new part or continuation row) has hole information
    const numDiam = parseFlexibleNumber(rawDiam);
    const numHoles = parseFlexibleNumber(rawHoles);

    if (currentPartRecord && numDiam > 0 && numHoles > 0) {
      // Check for slot / coliso notation e.g. "14.0(14.0x30.0)" or "17.5(40.0x17.5)"
      const slotMatch = rawDiam.match(/\(([^)]+)\)/);
      const slot = slotMatch ? slotMatch[1] : undefined;
      const holeType = slot ? ('coliso' as const) : ('pasante' as const);

      currentPartRecord.holes.push({
        id: `h-${numDiam}-${slot || 'std'}-${Math.random().toString(36).slice(2, 6)}`,
        diameter: numDiam,
        countPerPiece: numHoles, // Exactly the number of holes specified in column!
        type: holeType,
        slot: slot,
      });
    }
  }

  // Calculate totals per part
  const parts: PartRecord[] = Array.from(partsMap.values()).map(part => {
    const totalHolesPerPiece = part.holes.reduce((sum, h) => sum + h.countPerPiece, 0);
    const totalHolesAllPieces = totalHolesPerPiece * part.quantity;
    return {
      ...part,
      totalHolesPerPiece,
      totalHolesAllPieces,
    };
  });

  // Calculate Tooling / Diameter Breakdown
  const diameterMap = new Map<number, {
    perPieceSum: number;
    productionSum: number;
    parts: Set<string>;
  }>();

  for (const part of parts) {
    for (const hole of part.holes) {
      if (!diameterMap.has(hole.diameter)) {
        diameterMap.set(hole.diameter, {
          perPieceSum: 0,
          productionSum: 0,
          parts: new Set(),
        });
      }
      const item = diameterMap.get(hole.diameter)!;
      item.perPieceSum += hole.countPerPiece;
      item.productionSum += hole.countPerPiece * part.quantity;
      item.parts.add(part.partId);
    }
  }

  const diameterSummary: DiameterSummary[] = Array.from(diameterMap.entries())
    .map(([diameter, data]) => {
      const vc = 28;
      const recommendedRpm = Math.round((1000 * vc) / (Math.PI * diameter));
      const timePerHoleSeconds = Math.max(8, Math.round(diameter * 0.9));

      return {
        diameter,
        totalHolesPerPieceSum: data.perPieceSum,
        totalHolesProduction: data.productionSum,
        participatingParts: Array.from(data.parts),
        suggestedTool: diameter <= 26 ? `Broca / Punzón Ø${diameter}mm` : `Fresa / Mecha Ø${diameter}mm`,
        recommendedRpm,
        estimatedTimeSeconds: data.productionSum * timePerHoleSeconds,
      };
    })
    .sort((a, b) => a.diameter - b.diameter);

  const totalPartsCount = parts.reduce((sum, p) => sum + p.quantity, 0);
  const totalHolesProduction = parts.reduce((sum, p) => sum + p.totalHolesAllPieces, 0);

  return {
    headerMetadata,
    rawLines,
    sampleRows,
    parts,
    diameterSummary,
    totalPartsCount,
    totalHolesProduction,
    rawRowCount: dataLines.length,
    detectedColumns: colMap,
    delimiterUsed: delimiter,
  };
}

/**
 * Generates consolidated CSV export string
 */
export function exportPartsToCsv(parts: PartRecord[]): string {
  const headers = [
    'Marca / Pieza',
    'Perfil',
    'Cant. Piezas',
    'Diametro (mm)',
    'Tipo / Ranura',
    'Agujeros por Pieza',
    'Total Agujeros Lote',
  ];
  const rows: string[] = [headers.join(',')];

  for (const part of parts) {
    if (part.holes.length === 0) {
      rows.push([
        `"${part.partId}"`,
        `"${part.profile}"`,
        part.quantity,
        '-',
        'Sin perforaciones',
        0,
        0,
      ].join(','));
      continue;
    }

    for (const hole of part.holes) {
      rows.push([
        `"${part.partId}"`,
        `"${part.profile}"`,
        part.quantity,
        hole.diameter.toFixed(1),
        hole.slot ? `"Coliso ${hole.slot}"` : '"Pasante"',
        hole.countPerPiece,
        hole.countPerPiece * part.quantity,
      ].join(','));
    }
  }

  return rows.join('\n');
}
