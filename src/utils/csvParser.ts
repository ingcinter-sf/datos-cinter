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
 * Parses a numeric value that might use either comma or dot as decimal separator
 * Handles "14,0", "14.0", "15", " 8 ", etc.
 */
export function parseFlexibleNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim().replace(/\s+/g, '');
  // If format is like "14,0" or "14.0"
  const cleanStr = str.replace(',', '.');
  const num = parseFloat(cleanStr);
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

  // Search for the header row if not using custom map
  if (!customColMap) {
    for (let i = 0; i < Math.min(rawLines.length, 25); i++) {
      const cells = rawLines[i].split(delimiter).map(cleanCell);
      const normCells = cells.map(normalizeHeader);

      // Part keywords: parte, marca, pieza, pos, posicion, part, mark, id
      const pIdx = normCells.findIndex(c =>
        c.includes('parte') || c.includes('marca') || c.includes('pieza') || c === 'pos' || c.includes('posicion') || c === 'part' || c === 'mark'
      );

      // Profile keywords: perfil, profile, seccion, secc, material, descrip
      const perfIdx = normCells.findIndex(c =>
        c.includes('perfil') || c.includes('profile') || c.includes('seccion') || c.includes('material') || c.includes('desc')
      );

      // Quantity keywords: cant, cantidad, qty, partes
      const qtyIdx = normCells.findIndex((c, idx) =>
        idx !== pIdx && (c.includes('cant') || c.includes('qty') || c.includes('cantidad') || c === 'ctdad')
      );

      // Diameter keywords: diam, diametro, dia, o, d, hole, perforacion
      const dIdx = normCells.findIndex(c =>
        c.includes('diam') || c === 'o' || c === 'd' || c.includes('calibre') || c.includes('diametro')
      );

      // Hole count keywords: agujero, agujeros, taladro, taladros, holes, perf
      const hIdx = normCells.findIndex(c =>
        c.includes('agujero') || c.includes('taladro') || c.includes('perf') || c.includes('hole') || c.includes('bulon') || c.includes('perforac')
      );

      // If at least Part or (Diameter and Holes) are found on this row
      if (pIdx !== -1 || (dIdx !== -1 && hIdx !== -1)) {
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

  // Fallback: If no header row found, guess based on data in first data row
  if (tableHeaderIndex === -1 && !customColMap) {
    tableHeaderIndex = -1; // process all rows
    colMap = {
      parte: 0,
      perfil: 1,
      cantPartes: 2,
      diametro: 3,
      agujerosPorParte: 4,
    };
  }

  const dataLines = tableHeaderIndex >= 0 ? rawLines.slice(tableHeaderIndex + 1) : rawLines;

  let currentPartId = '';
  let currentProfile = '';
  let currentQuantity = 1;

  const partsMap = new Map<string, PartRecord>();

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    // Check if empty or separator line
    if (!line.replace(new RegExp(`\\${delimiter}`, 'g'), '').trim()) continue;

    const cells = line.split(delimiter).map(cleanCell);

    const rawPart = colMap.parte >= 0 && colMap.parte < cells.length ? cells[colMap.parte] : '';
    const rawProfile = colMap.perfil >= 0 && colMap.perfil < cells.length ? cells[colMap.perfil] : '';
    const rawQty = colMap.cantPartes >= 0 && colMap.cantPartes < cells.length ? cells[colMap.cantPartes] : '';
    const rawDiam = colMap.diametro >= 0 && colMap.diametro < cells.length ? cells[colMap.diametro] : '';
    const rawHoles = colMap.agujerosPorParte >= 0 && colMap.agujerosPorParte < cells.length ? cells[colMap.agujerosPorParte] : '';

    // Check if this row is an accidental repeated header
    if (normalizeHeader(rawPart).includes('parte') && normalizeHeader(rawDiam).includes('diam')) {
      continue;
    }

    // Forward fill logic
    if (rawPart.length > 0) {
      currentPartId = rawPart;
      if (rawProfile.length > 0) currentProfile = rawProfile;
      const parsedQty = parseFlexibleNumber(rawQty);
      currentQuantity = parsedQty > 0 ? parsedQty : 1;
    } else if (rawProfile.length > 0 && !currentProfile) {
      currentProfile = rawProfile;
    }

    if (!currentPartId) {
      if (rawDiam || rawHoles) {
        currentPartId = `PIEZA-${partsMap.size + 1}`;
      } else {
        continue;
      }
    }

    const numDiam = parseFlexibleNumber(rawDiam);
    const numHoles = parseFlexibleNumber(rawHoles);

    // If diameter or holes present, record it
    if (numDiam > 0 || numHoles > 0) {
      const validDiam = numDiam > 0 ? numDiam : 14;
      const validHoles = numHoles > 0 ? numHoles : 1;

      if (!partsMap.has(currentPartId)) {
        partsMap.set(currentPartId, {
          id: `part-${currentPartId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          partId: currentPartId,
          profile: currentProfile || 'ESTÁNDAR',
          quantity: currentQuantity,
          holes: [],
          totalHolesPerPiece: 0,
          totalHolesAllPieces: 0,
        });
      }

      const partRecord = partsMap.get(currentPartId)!;
      // If quantity changed on later row
      if (rawQty && parseFlexibleNumber(rawQty) > 0) {
        partRecord.quantity = parseFlexibleNumber(rawQty);
      }
      if (rawProfile && rawProfile.length > 0) {
        partRecord.profile = rawProfile;
      }

      // Check if diameter exists in this part
      const existingHole = partRecord.holes.find(h => Math.abs(h.diameter - validDiam) < 0.05);
      if (existingHole) {
        existingHole.countPerPiece += validHoles;
      } else {
        partRecord.holes.push({
          id: `h-${validDiam}-${Math.random().toString(36).slice(2, 6)}`,
          diameter: validDiam,
          countPerPiece: validHoles,
          type: 'pasante',
        });
      }
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
    'Agujeros por Pieza',
    'Total Agujeros Lote',
  ];
  const rows: string[] = [headers.join(',')];

  for (const part of parts) {
    for (const hole of part.holes) {
      rows.push([
        `"${part.partId}"`,
        `"${part.profile}"`,
        part.quantity,
        hole.diameter.toFixed(1),
        hole.countPerPiece,
        hole.countPerPiece * part.quantity,
      ].join(','));
    }
  }

  return rows.join('\n');
}
