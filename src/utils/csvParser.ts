import { PartRecord, DiameterSummary, HoleDetail } from '../types';

/**
 * Detect delimiter (comma, semicolon, tab)
 */
export function detectDelimiter(text: string): string {
  const lines = text.split('\n').filter(l => l.trim().length > 0).slice(0, 10);
  const commas = lines.reduce((acc, l) => acc + (l.match(/,/g) || []).length, 0);
  const semicolons = lines.reduce((acc, l) => acc + (l.match(/;/g) || []).length, 0);
  const tabs = lines.reduce((acc, l) => acc + (l.match(/\t/g) || []).length, 0);

  if (semicolons > commas && semicolons > tabs) return ';';
  if (tabs > commas && tabs > semicolons) return '\t';
  return ',';
}

/**
 * Clean cell content (strip quotes, spaces)
 */
function cleanCell(cell: string | undefined): string {
  if (!cell) return '';
  return cell.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Normalizes text for comparison (lowercase, removes accents)
 */
function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export interface ParseResult {
  headerMetadata: string[];
  parts: PartRecord[];
  diameterSummary: DiameterSummary[];
  totalPartsCount: number;
  totalHolesProduction: number;
  rawRowCount: number;
  detectedColumns: { [key: string]: number };
}

/**
 * Parses metallurgy CSV / TXT files with forward-filling of blank part/profile cells
 */
export function parseMetallurgyCsv(rawContent: string): ParseResult {
  const delimiter = detectDelimiter(rawContent);
  const rawLines = rawContent
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const headerMetadata: string[] = [];
  let tableHeaderIndex = -1;
  let colMap = {
    parte: -1,
    perfil: -1,
    cantPartes: -1,
    diametro: -1,
    agujerosPorParte: -1,
  };

  // Find header row by matching column names
  for (let i = 0; i < rawLines.length; i++) {
    const cells = rawLines[i].split(delimiter).map(cleanCell);
    const normCells = cells.map(normalizeHeader);

    // Look for keywords
    const pIdx = normCells.findIndex(c => c.includes('parte') || c.includes('marca') || c.includes('pieza') || c === 'part');
    const perfIdx = normCells.findIndex(c => c.includes('perfil') || c.includes('profile') || c.includes('seccion'));
    const dIdx = normCells.findIndex(c => c.includes('diam') || c.includes('diametro') || c === 'o' || c.includes('hole'));
    const hIdx = normCells.findIndex(c => c.includes('agujero') || c.includes('taladro') || c.includes('perf') || c.includes('holes'));

    if (pIdx !== -1 && (perfIdx !== -1 || dIdx !== -1 || hIdx !== -1)) {
      tableHeaderIndex = i;
      colMap.parte = pIdx;
      colMap.perfil = perfIdx;

      // Find Cant. Partes
      colMap.cantPartes = normCells.findIndex((c, idx) => 
        idx !== pIdx && (c.includes('cant') || c.includes('qty') || c.includes('cantidad'))
      );

      colMap.diametro = dIdx;
      colMap.agujerosPorParte = hIdx;
      break;
    } else {
      headerMetadata.push(rawLines[i]);
    }
  }

  // If no header found, assume standard default column layout:
  // Col 0: Parte, Col 1: Perfil, Col 2: Cant. Partes, Col 3: Diametro, Col 4: Agujeros
  if (tableHeaderIndex === -1) {
    tableHeaderIndex = 0;
    colMap = {
      parte: 0,
      perfil: 1,
      cantPartes: 2,
      diametro: 3,
      agujerosPorParte: 4,
    };
  }

  // Fallbacks for any missing column
  if (colMap.parte === -1) colMap.parte = 0;
  if (colMap.perfil === -1) colMap.perfil = 1;
  if (colMap.cantPartes === -1) colMap.cantPartes = 2;
  if (colMap.diametro === -1) colMap.diametro = 3;
  if (colMap.agujerosPorParte === -1) colMap.agujerosPorParte = 4;

  const dataLines = rawLines.slice(tableHeaderIndex + 1);

  let currentPartId = '';
  let currentProfile = '';
  let currentQuantity = 1;

  const partsMap = new Map<string, PartRecord>();

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    // Check if line is just delimiters or empty
    if (!line.replace(new RegExp(`\\${delimiter}`, 'g'), '').trim()) continue;

    const cells = line.split(delimiter).map(cleanCell);

    const rawPart = cells[colMap.parte] || '';
    const rawProfile = cells[colMap.perfil] || '';
    const rawQty = cells[colMap.cantPartes] || '';
    const rawDiam = cells[colMap.diametro] || '';
    const rawHoles = cells[colMap.agujerosPorParte] || '';

    // Forward fill logic: If new part specified, update current context
    if (rawPart.length > 0) {
      currentPartId = rawPart;
      if (rawProfile.length > 0) currentProfile = rawProfile;
      const parsedQty = parseFloat(rawQty.replace(',', '.'));
      currentQuantity = !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1;
    } else if (rawProfile.length > 0 && !currentProfile) {
      currentProfile = rawProfile;
    }

    if (!currentPartId) {
      // If we still don't have a part name, generate or skip
      if (rawDiam || rawHoles) {
        currentPartId = `PIEZA-${partsMap.size + 1}`;
      } else {
        continue;
      }
    }

    // Parse diameter and hole count
    const numDiam = parseFloat(rawDiam.replace(',', '.'));
    const numHoles = parseFloat(rawHoles.replace(',', '.'));

    // Valid hole row must have at least diameter or holes
    if (!isNaN(numDiam) && numDiam > 0 && !isNaN(numHoles) && numHoles > 0) {
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
      // Check if diameter already exists in this part, if so accumulate or append
      const existingHole = partRecord.holes.find(h => h.diameter === numDiam);
      if (existingHole) {
        existingHole.countPerPiece += numHoles;
      } else {
        partRecord.holes.push({
          id: `h-${numDiam}-${Math.random().toString(36).slice(2, 6)}`,
          diameter: numDiam,
          countPerPiece: numHoles,
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

  // Calculate Diameter Summary (Tooling breakdown)
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
      // Calculate suggested cutting parameters for steel (Vc approx 25-30 m/min for HSS)
      const vc = 28; // m/min
      const recommendedRpm = Math.round((1000 * vc) / (Math.PI * diameter));
      // Approx 12-18 seconds per hole including approach and retract for 6-10mm steel plate
      const timePerHoleSeconds = Math.max(8, Math.round(diameter * 0.9));

      return {
        diameter,
        totalHolesPerPieceSum: data.perPieceSum,
        totalHolesProduction: data.productionSum,
        participatingParts: Array.from(data.parts),
        suggestedTool: diameter <= 26 ? `Broca / Punzón Ø${diameter}mm` : `Fresa de taladrado / Mecha Ø${diameter}mm`,
        recommendedRpm,
        estimatedTimeSeconds: data.productionSum * timePerHoleSeconds,
      };
    })
    .sort((a, b) => a.diameter - b.diameter);

  const totalPartsCount = parts.reduce((sum, p) => sum + p.quantity, 0);
  const totalHolesProduction = parts.reduce((sum, p) => sum + p.totalHolesAllPieces, 0);

  return {
    headerMetadata,
    parts,
    diameterSummary,
    totalPartsCount,
    totalHolesProduction,
    rawRowCount: dataLines.length,
    detectedColumns: colMap,
  };
}

/**
 * Generates clean CSV string from current parts data
 */
export function exportPartsToCsv(parts: PartRecord[]): string {
  const headers = ['Parte', 'Perfil', 'Cant. Partes', 'Diametro (mm)', 'Agujeros por pieza', 'Total Agujeros Produccion'];
  const rows: string[] = [headers.join(',')];

  for (const part of parts) {
    for (let i = 0; i < part.holes.length; i++) {
      const hole = part.holes[i];
      const isFirst = i === 0;
      rows.push([
        isFirst ? `"${part.partId}"` : '',
        isFirst ? `"${part.profile}"` : '',
        isFirst ? part.quantity : '',
        hole.diameter.toFixed(1),
        hole.countPerPiece,
        hole.countPerPiece * part.quantity,
      ].join(','));
    }
  }

  return rows.join('\n');
}
