import { PartRecord, DiameterSummary, ThicknessSummaryRow } from '../types';

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
 * Extracts plate or profile metal thickness in mm:
 * e.g.:
 * - "PL7.9*64" -> 7.9 mm
 * - "LP70*60*3.2" -> 3.2 mm
 * - "PL12.7*220" -> 12.7 mm
 * - "PL70*7.9" -> 7.9 mm
 * - "L57*4.8" -> 4.8 mm
 * - "HI250-4.8-6.4*200" -> 4.8 mm
 */
export interface ProfileThicknessInfo {
  primary: number;
  web?: number;
  flange?: number;
  isDualThickness?: boolean;
}

export function extractProfileThicknessInfo(profile: string): ProfileThicknessInfo {
  if (!profile) return { primary: 6.4 };
  const p = profile.toUpperCase().replace(/\s+/g, '');

  // 1. Built-up I beam: HI500-4.8-9.5*240, HF500-4.8-9.5*240, HI375-4.8-6.4*200
  // (HI/HF/H/I/WF)<altura>-<espesor_alma>-<espesor_ala>*<ancho_ala>
  const hiMatch = p.match(/^(?:HI|HF|H|I|WF)\d*(?:\.\d+)?-(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?:\*(\d+(?:\.\d+)?))?/);
  if (hiMatch) {
    const web = parseFloat(hiMatch[1]);
    const flange = parseFloat(hiMatch[2]);
    return {
      primary: web,
      web,
      flange,
      isDualThickness: true,
    };
  }

  // 2. Wide flange W150*29.8 -> web approx 5.8, flange 9.3
  if (p.startsWith('W150')) {
    return {
      primary: 5.8,
      web: 5.8,
      flange: 9.3,
      isDualThickness: true,
    };
  }

  const single = extractProfileThickness(profile);
  return { primary: single };
}

export function extractProfileThickness(profile: string): number {
  if (!profile) return 6.4;
  const p = profile.toUpperCase().replace(/\s+/g, '');

  // 1. Folded profile LP70*60*3.2 or PLP130*3.2 -> last number is thickness
  const lpMatch = p.match(/^(?:LP|PLP|CHS)\d+(?:\.\d+)?(?:\*\d+(?:\.\d+)?)?\*(\d+(?:\.\d+)?)$/);
  if (lpMatch) return parseFloat(lpMatch[1]);

  // 2. Angle L57*4.8 -> 4.8
  const lMatch = p.match(/^L\d+(?:\.\d+)?\*(\d+(?:\.\d+)?)$/);
  if (lMatch) return parseFloat(lMatch[1]);

  // 3. Built-up I beam HI250-4.8-6.4*200 -> web 4.8
  const hiMatch = p.match(/^HI\d+(?:\.\d+)?-(\d+(?:\.\d+)?)/);
  if (hiMatch) return parseFloat(hiMatch[1]);

  // 4. Wide flange W150*29.8 -> web approx 5.8
  if (p.startsWith('W150')) return 5.8;

  // 5. Plate PL: PL7.9*64 or PL70*7.9 or PL12.7*220
  const plMatch = p.match(/^PL(\d+(?:\.\d+)?)\*(\d+(?:\.\d+)?)$/);
  if (plMatch) {
    const a = parseFloat(plMatch[1]);
    const b = parseFloat(plMatch[2]);
    return Math.min(a, b);
  }

  // 6. Fallback: if has *number, smaller dimension or last number
  const parts = p.split('*');
  if (parts.length > 1) {
    const num = parseFloat(parts[parts.length - 1]);
    if (!isNaN(num) && num > 0 && num < 100) return num;
  }

  return 6.4;
}

/**
 * Extracts Obra Title from header line (2nd position in CSV, e.g. "VMC")
 */
export function extractObraTitle(lines: string[], delimiter: string): string {
  if (lines.length === 0) return 'OBRA GENERAL';

  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const cells = lines[i].split(delimiter).map(cleanCell);
    // Look at 2nd cell (index 1)
    if (cells.length > 1 && cells[1] && !cells[1].toLowerCase().includes('perfil')) {
      const candidate = cells[1].trim();
      if (candidate.length > 0 && !candidate.toLowerCase().includes('fecha')) {
        return candidate.toUpperCase();
      }
    }
  }

  return 'VMC';
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
  obraTitle: string;
  headerMetadata: string[];
  rawLines: string[];
  sampleRows: string[][];
  parts: PartRecord[];
  diameterSummary: DiameterSummary[];
  totalPartsCount: number;
  totalHolesProduction: number;
  totalMetersProduction: number; // Total linear meters to machine
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

  const obraTitle = extractObraTitle(rawLines, delimiter);

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

      const pIdx = normCells.findIndex(c =>
        c === 'parte' || c === 'marca' || c === 'pieza' || c === 'pos' || c === 'posicion' || c === 'part' || c === 'mark'
      );

      const perfIdx = normCells.findIndex(c =>
        c === 'perfil' || c.includes('profile') || c === 'seccion' || c === 'secc' || c.includes('perfil')
      );

      const qtyIdx = normCells.findIndex((c, idx) =>
        idx !== pIdx && (c.includes('cant') || c === 'qty' || c === 'cantidad' || c === 'cantpartes')
      );

      const dIdx = normCells.findIndex(c =>
        c === 'diametro' || c === 'diam' || c.includes('diam') || c === 'd' || c === 'o'
      );

      const hIdx = normCells.findIndex((c, idx) =>
        idx !== pIdx && (c.includes('agujero') || c.includes('taladro') || c === 'holes' || (c.includes('perf') && !c.includes('perfil')))
      );

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

    if (normalizeHeader(rawPart).includes('parte') && normalizeHeader(rawDiam).includes('diam')) {
      continue;
    }

    // New Part row or continuation of existing part
    if (rawPart.length > 0) {
      const partKey = `${rawPart.toUpperCase()}__${(rawProfile || '').toUpperCase()}`;
      if (partsMap.has(partKey)) {
        currentPartRecord = partsMap.get(partKey)!;
        // If row specified new quantity and it differs, ensure it is non-zero
        const parsedQty = parseFlexibleNumber(rawQty);
        if (parsedQty > 0 && currentPartRecord.quantity <= 1) {
          currentPartRecord.quantity = parsedQty;
        }
      } else {
        const parsedQty = parseFlexibleNumber(rawQty);
        const qty = parsedQty > 0 ? parsedQty : 1;
        const thickInfo = extractProfileThicknessInfo(rawProfile);

        currentPartRecord = {
          id: `part-${rawPart}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          partId: rawPart,
          profile: rawProfile || 'ESTÁNDAR',
          thickness: thickInfo.primary,
          webThickness: thickInfo.web,
          flangeThickness: thickInfo.flange,
          isDualThickness: thickInfo.isDualThickness,
          quantity: qty,
          holes: [],
          totalHolesPerPiece: 0,
          totalHolesAllPieces: 0,
        };
        partsMap.set(partKey, currentPartRecord);
      }
    }

    const numDiam = parseFlexibleNumber(rawDiam);
    const numHoles = parseFlexibleNumber(rawHoles);

    if (currentPartRecord && numDiam > 0 && numHoles > 0) {
      // Check for slot / corredera notation e.g. "14.0(14.0x30.0)" or "17.5(40.0x17.5)"
      const slotMatch = rawDiam.match(/\(([^)]+)\)/);
      const slot = slotMatch ? slotMatch[1] : undefined;
      const holeType = slot ? ('corredera' as const) : ('pasante' as const);

      // Determine thickness and location for dual-thickness profiles (HI, etc.)
      let holeThickness = currentPartRecord.thickness;
      let location: string | undefined = undefined;

      if (currentPartRecord.isDualThickness && currentPartRecord.webThickness && currentPartRecord.flangeThickness) {
        // In built-up I-beams (HI/HF):
        // Standard Web (Alma) connections: Ø <= 17.5 mm (e.g. Ø14.0, Ø17.5)
        // Standard Flange (Alas) connections: Ø >= 19.5 mm (e.g. Ø21.0, Ø24.0, Ø28.0)
        // Intermediate clearance/tolerance diameter Ø17.9 mm:
        // In structural workshop drawings (e.g. Hf80028, Hf80042, Hf80051), these 8 holes
        // are split symmetrically between the Web (Alma) and the Flanges (Alas): 4 in Alma, 4 in Alas!
        if (Math.abs(numDiam - 17.9) < 0.15 && numHoles >= 2 && numHoles % 2 === 0) {
          const half = Math.round(numHoles / 2);
          currentPartRecord.holes.push({
            id: `h-${numDiam}-alma-${Math.random().toString(36).slice(2, 6)}`,
            diameter: numDiam,
            countPerPiece: half,
            type: holeType,
            slot: slot,
            location: 'alma',
            thickness: currentPartRecord.webThickness,
          });
          currentPartRecord.holes.push({
            id: `h-${numDiam}-alas-${Math.random().toString(36).slice(2, 6)}`,
            diameter: numDiam,
            countPerPiece: numHoles - half,
            type: holeType,
            slot: slot,
            location: 'alas',
            thickness: currentPartRecord.flangeThickness,
          });
          continue;
        }

        if (numDiam >= 19.5) {
          holeThickness = currentPartRecord.flangeThickness;
          location = 'alas';
        } else {
          holeThickness = currentPartRecord.webThickness;
          location = 'alma';
        }
      }

      currentPartRecord.holes.push({
        id: `h-${numDiam}-${slot || 'std'}-${Math.random().toString(36).slice(2, 6)}`,
        diameter: numDiam,
        countPerPiece: numHoles,
        type: holeType,
        slot: slot,
        location,
        thickness: holeThickness,
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

  const { diameterSummary, totalPartsCount, totalHolesProduction, totalMetersProduction } = calculateSummaries(parts);

  return {
    obraTitle,
    headerMetadata,
    rawLines,
    sampleRows,
    parts,
    diameterSummary,
    totalPartsCount,
    totalHolesProduction,
    totalMetersProduction,
    rawRowCount: dataLines.length,
    detectedColumns: colMap,
    delimiterUsed: delimiter,
  };
}

/**
 * Recalculates diameter tooling breakdown, linear meters to machine, and totals
 */
export function calculateSummaries(parts: PartRecord[], omitCorrederas: boolean = false): {
  diameterSummary: DiameterSummary[];
  totalPartsCount: number;
  totalHolesProduction: number;
  totalMetersProduction: number;
} {
  const totalParts = parts.reduce((sum, p) => sum + p.quantity, 0);

  const map = new Map<number, {
    perPieceSum: number;
    productionSum: number;
    metersSum: number;
    parts: Set<string>;
  }>();

  let totalHoles = 0;
  let totalMeters = 0;

  for (const part of parts) {
    const relevantHoles = omitCorrederas
      ? part.holes.filter(h => h.type !== 'corredera' && !h.slot)
      : part.holes;

    for (const hole of relevantHoles) {
      if (!map.has(hole.diameter)) {
        map.set(hole.diameter, {
          perPieceSum: 0,
          productionSum: 0,
          metersSum: 0,
          parts: new Set(),
        });
      }
      const item = map.get(hole.diameter)!;
      const countForPart = hole.countPerPiece * part.quantity;
      const thickness = hole.thickness || part.thickness || 6.4;
      const linearMeters = (countForPart * thickness) / 1000;

      item.perPieceSum += hole.countPerPiece;
      item.productionSum += countForPart;
      item.metersSum += linearMeters;
      item.parts.add(part.partId);

      totalHoles += countForPart;
      totalMeters += linearMeters;
    }
  }

  const diameterSummary: DiameterSummary[] = Array.from(map.entries())
    .map(([diameter, data]) => {
      const vc = 28;
      const recommendedRpm = Math.round((1000 * vc) / (Math.PI * diameter));
      const timePerHoleSeconds = Math.max(8, Math.round(diameter * 0.9));

      return {
        diameter,
        totalHolesPerPieceSum: data.perPieceSum,
        totalHolesProduction: data.productionSum,
        totalMetersDrilled: Math.round(data.metersSum * 100) / 100,
        participatingParts: Array.from(data.parts),
        suggestedTool: diameter <= 26 ? `Broca / Punzón Ø${diameter}mm` : `Fresa / Mecha especial Ø${diameter}mm`,
        recommendedRpm,
        estimatedTimeSeconds: data.productionSum * timePerHoleSeconds,
      };
    })
    .sort((a, b) => a.diameter - b.diameter);

  return {
    diameterSummary,
    totalPartsCount: totalParts,
    totalHolesProduction: totalHoles,
    totalMetersProduction: Math.round(totalMeters * 100) / 100,
  };
}

/**
 * Builds Matrix of Perforations separated by Thickness (rows) and Diameters (columns)
 * Accurately supports parts with multiple thicknesses (e.g. HI beams with Web/Alma and Flange/Alas)
 */
export function buildThicknessMatrix(parts: PartRecord[], omitCorrederas: boolean = false): {
  matrixRows: ThicknessSummaryRow[];
  uniqueDiameters: number[];
  grandTotalHoles: number;
  grandTotalMeters: number;
} {
  const thicknessMap = new Map<number, ThicknessSummaryRow>();
  const diameterSet = new Set<number>();

  for (const part of parts) {
    const relevantHoles = omitCorrederas
      ? part.holes.filter(h => h.type !== 'corredera' && !h.slot)
      : part.holes;

    for (const hole of relevantHoles) {
      const holeThickness = hole.thickness || part.thickness || 6.4;
      diameterSet.add(hole.diameter);

      if (!thicknessMap.has(holeThickness)) {
        thicknessMap.set(holeThickness, {
          thickness: holeThickness,
          holesByDiameter: {},
          totalHolesInThickness: 0,
          totalMetersInThickness: 0,
          participatingParts: [],
        });
      }

      const row = thicknessMap.get(holeThickness)!;
      if (!row.participatingParts.includes(part.partId)) {
        row.participatingParts.push(part.partId);
      }

      const holeCount = hole.countPerPiece * part.quantity;
      row.holesByDiameter[hole.diameter] = (row.holesByDiameter[hole.diameter] || 0) + holeCount;
      row.totalHolesInThickness += holeCount;
    }
  }

  // Calculate linear meters for each thickness row
  let grandTotalHoles = 0;
  let grandTotalMeters = 0;

  const matrixRows = Array.from(thicknessMap.values())
    .map(row => {
      const meters = (row.totalHolesInThickness * row.thickness) / 1000;
      row.totalMetersInThickness = Math.round(meters * 100) / 100;
      grandTotalHoles += row.totalHolesInThickness;
      grandTotalMeters += row.totalMetersInThickness;
      return row;
    })
    .sort((a, b) => a.thickness - b.thickness);

  const uniqueDiameters = Array.from(diameterSet).sort((a, b) => a - b);

  return {
    matrixRows,
    uniqueDiameters,
    grandTotalHoles,
    grandTotalMeters: Math.round(grandTotalMeters * 100) / 100,
  };
}

/**
 * Merges two arrays of PartRecords with smart summation of quantities
 */
export function mergePartRecords(baseParts: PartRecord[], incomingParts: PartRecord[]): PartRecord[] {
  const map = new Map<string, PartRecord>();

  for (const part of baseParts) {
    map.set(part.partId.toUpperCase(), {
      ...part,
      holes: part.holes.map(h => ({ ...h })),
    });
  }

  for (const part of incomingParts) {
    const key = part.partId.toUpperCase();
    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.quantity += part.quantity;
      if (!existing.webThickness && part.webThickness) existing.webThickness = part.webThickness;
      if (!existing.flangeThickness && part.flangeThickness) existing.flangeThickness = part.flangeThickness;
      if (part.isDualThickness) existing.isDualThickness = true;

      for (const h of part.holes) {
        const existingHole = existing.holes.find(
          eh =>
            Math.abs(eh.diameter - h.diameter) < 0.05 &&
            eh.slot === h.slot &&
            (eh.thickness === h.thickness || !eh.thickness) &&
            (eh.location === h.location || !eh.location)
        );
        if (!existingHole) {
          existing.holes.push({ ...h });
        }
      }

      existing.totalHolesPerPiece = existing.holes.reduce((sum, h) => sum + h.countPerPiece, 0);
      existing.totalHolesAllPieces = existing.totalHolesPerPiece * existing.quantity;
    } else {
      map.set(key, {
        ...part,
        holes: part.holes.map(h => ({ ...h })),
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Generates consolidated CSV export string
 */
export function exportPartsToCsv(parts: PartRecord[]): string {
  const headers = [
    'Marca / Pieza',
    'Perfil',
    'Espesor (mm)',
    'Cant. Piezas',
    'Diametro (mm)',
    'Tipo / Ranura',
    'Agujeros por Pieza',
    'Total Agujeros Lote',
    'Metros Lineales (m)',
  ];
  const rows: string[] = [headers.join(',')];

  for (const part of parts) {
    if (part.holes.length === 0) {
      rows.push([
        `"${part.partId}"`,
        `"${part.profile}"`,
        part.thickness,
        part.quantity,
        '-',
        'Sin perforaciones',
        0,
        0,
        0,
      ].join(','));
      continue;
    }

    for (const hole of part.holes) {
      const count = hole.countPerPiece * part.quantity;
      const holeThickness = hole.thickness || part.thickness;
      const meters = (count * holeThickness) / 1000;
      rows.push([
        `"${part.partId}"`,
        `"${part.profile}"`,
        holeThickness,
        part.quantity,
        hole.diameter.toFixed(1),
        hole.slot ? `"Corredera ${hole.slot}"` : '"Pasante"',
        hole.countPerPiece,
        count,
        meters.toFixed(2),
      ].join(','));
    }
  }

  return rows.join('\n');
}

/**
 * Generates standard Metallurgy CSV export that can be re-imported back
 * into this app or merged with other files seamlessly.
 */
export function exportPartsToReimportableCsv(parts: PartRecord[], obraTitle: string = 'OBRA'): string {
  const lines: string[] = [
    `Bulones por Parte ,${obraTitle}          , ,          ,               Fecha ${new Date().toLocaleDateString('es-ES')}`,
    '',
    '    Parte   ,Perfil      ,Cant. Partes,Diametro  ,Agujeros por partes',
  ];

  for (const part of parts) {
    if (part.holes.length === 0) {
      lines.push(`    ${part.partId.padEnd(8)} ,${part.profile.padEnd(20)} ,${String(part.quantity).padEnd(4)} ,        ,`);
      continue;
    }

    // First line with part and first hole
    const firstHole = part.holes[0];
    const firstDiamStr = firstHole.slot ? `${firstHole.diameter.toFixed(1)}(${firstHole.slot})` : `${firstHole.diameter.toFixed(1)}`;
    lines.push(`    ${part.partId.padEnd(8)} ,${part.profile.padEnd(20)} ,${String(part.quantity).padEnd(4)} ,        ,`);
    lines.push(`            ,            ,            ,            ${firstDiamStr.padEnd(16)} , ${firstHole.countPerPiece}`);

    // Subsequent holes for same part
    for (let i = 1; i < part.holes.length; i++) {
      const h = part.holes[i];
      const diamStr = h.slot ? `${h.diameter.toFixed(1)}(${h.slot})` : `${h.diameter.toFixed(1)}`;
      lines.push(`            ,            ,            ,            ${diamStr.padEnd(16)} , ${h.countPerPiece}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generates Matrix CSV (Thickness x Diameters x Meters) for technical reports & spreadsheets
 */
export function exportThicknessMatrixToCsv(
  matrixRows: ThicknessSummaryRow[],
  uniqueDiameters: number[],
  diameterTotals: { [diameter: number]: { holes: number; meters: number } },
  grandTotalHoles: number,
  grandTotalMeters: number,
  obraTitle: string = 'OBRA'
): string {
  const lines: string[] = [
    `"RESUMEN DE PERFORACIONES POR ESPESOR Y DIAMETRO - OBRA: ${obraTitle}"`,
    `"Fecha: ${new Date().toLocaleDateString('es-ES')}"`,
    '',
  ];

  // Header
  const headers = [
    'Espesor (mm)',
    ...uniqueDiameters.map(d => `Ø ${d.toFixed(1)} mm`),
    'Total Agujeros Espesor',
    'Metros a Mecanizar (m)',
    'Marcas Incluidas'
  ];
  lines.push(headers.join(','));

  // Rows
  for (const row of matrixRows) {
    const rowValues = [
      `"${row.thickness.toFixed(1)} mm"`,
      ...uniqueDiameters.map(d => row.holesByDiameter[d] || 0),
      row.totalHolesInThickness,
      row.totalMetersInThickness.toFixed(2),
      `"${row.participatingParts.join('; ')}"`
    ];
    lines.push(rowValues.join(','));
  }

  // Footer Totals Row
  lines.push([
    '"TOTAL AGUJEROS POR DIAMETRO"',
    ...uniqueDiameters.map(d => diameterTotals[d]?.holes || 0),
    grandTotalHoles,
    grandTotalMeters.toFixed(2),
    '""'
  ].join(','));

  // Footer Meters Row
  lines.push([
    '"METROS A MECANIZAR POR DIAMETRO (m)"',
    ...uniqueDiameters.map(d => (diameterTotals[d]?.meters || 0).toFixed(2)),
    '""',
    grandTotalMeters.toFixed(2),
    '""'
  ].join(','));

  return lines.join('\n');
}

