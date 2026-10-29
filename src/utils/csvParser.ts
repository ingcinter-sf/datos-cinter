import { PartRecord, DiameterSummary, ThicknessSummaryRow } from '../types';
import { GERDAU_W_CATALOG, findGerdauProfile, normalizeGerdauKey, GerdauProfile } from '../data/gerdauProfiles';

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
  // (HI/HF/H/I/WF)<altura>-<espesor1>-<espesor2>*<ancho_ala>
  // El sistema asume siempre alma al menor espesor y ala al mayor espesor
  const hiMatch = p.match(/^(?:HI|HF|H|I|WF)\d*(?:\.\d+)?-(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?:\*(\d+(?:\.\d+)?))?/);
  if (hiMatch) {
    const v1 = parseFloat(hiMatch[1]);
    const v2 = parseFloat(hiMatch[2]);
    const web = Math.min(v1, v2);    // Alma = menor espesor
    const flange = Math.max(v1, v2); // Ala = mayor espesor
    return {
      primary: web,
      web,
      flange,
      isDualThickness: true,
    };
  }

  // 2. Wide flange W & Bearing Pile HP profiles from Gerdau official catalog (MAR 2023)
  const gerdauDirect = findGerdauProfile(p);
  if (gerdauDirect) {
    const web = Math.min(gerdauDirect.tw, gerdauDirect.tf);    // Alma = menor espesor
    const flange = Math.max(gerdauDirect.tw, gerdauDirect.tf); // Ala = mayor espesor
    return {
      primary: web,
      web,
      flange,
      isDualThickness: true,
    };
  }

  const wKey = p.replace(/X/g, '*').replace(',', '.');
  if (wKey.startsWith('W') || wKey.startsWith('HP')) {
    if (W_PROFILES_CATALOG[wKey]) {
      const match = W_PROFILES_CATALOG[wKey];
      const web = Math.min(match.web, match.flange);    // Alma = menor espesor
      const flange = Math.max(match.web, match.flange); // Ala = mayor espesor
      return {
        primary: web,
        web,
        flange,
        isDualThickness: true,
      };
    }
    // Match by nominal peralte if exact weight is not in dictionary
    const nominalMatch = wKey.match(/^(?:W|HP)(\d+)/);
    if (nominalMatch) {
      const nom = parseInt(nominalMatch[1], 10);
      let t1 = 5.8, t2 = 9.3;
      if (nom <= 150) { t1 = 5.8; t2 = 9.3; }
      else if (nom <= 200) { t1 = 6.2; t2 = 10.2; }
      else if (nom <= 250) { t1 = 6.6; t2 = 10.7; }
      else if (nom <= 310) { t1 = 6.6; t2 = 11.2; }
      else if (nom <= 360) { t1 = 7.2; t2 = 11.6; }
      else if (nom <= 410) { t1 = 7.7; t2 = 12.8; }
      else if (nom <= 460) { t1 = 8.0; t2 = 13.3; }
      else if (nom <= 530) { t1 = 9.0; t2 = 12.4; }
      else { t1 = 10.0; t2 = 14.5; }
      const web = Math.min(t1, t2);
      const flange = Math.max(t1, t2);
      return { primary: web, web, flange, isDualThickness: true };
    }
  }

  const single = extractProfileThickness(profile);
  return { primary: single };
}

/**
 * Standard Gerdau / ASTM A6 / AISC Wide Flange (W) and Bearing Pile (HP) catalog
 * Populated from official Gerdau brochure (March 2023 edition)
 */
export const W_PROFILES_CATALOG: Record<string, { web: number; flange: number; d?: number; bf?: number; weight?: number }> = (() => {
  const cat: Record<string, { web: number; flange: number; d?: number; bf?: number; weight?: number }> = {};
  
  for (const p of GERDAU_W_CATALOG) {
    const val = { web: p.tw, flange: p.tf, d: p.d, bf: p.bf, weight: p.massKgM };
    const prefix = p.type; // 'W' | 'HP'

    // Form: W150*13, W150*13.0, W150X13, etc.
    cat[`${prefix}${p.nominalSeries}*${p.massKgM}`] = val;
    cat[`${prefix}${p.nominalSeries}*${p.massKgM.toFixed(1)}`] = val;
    cat[`${prefix}${p.nominalSeries}*${p.massKgM.toString().replace('.', ',')}`] = val;
    if (Number.isInteger(p.massKgM)) {
      cat[`${prefix}${p.nominalSeries}*${p.massKgM}`] = val;
    }
    // Also without type prefix if just e.g. "W150"
    if (prefix === 'HP') {
      cat[`W${p.nominalSeries}*${p.massKgM}`] = val;
    }

    // Imperial Caliber (e.g. "W6*8.5", "W6*12", "HP8*36", etc.)
    const impClean = p.caliberInch.toUpperCase().replace(/\s+/g, '').replace('X', '*').replace(',', '.');
    cat[impClean] = val;
  }

  return cat;
})();

/**
 * Returns list of official Gerdau catalog variants for a given W or HP series (e.g. "W150", "W200", "HP200"...)
 */
export function getWProfileOptions(profileName: string): Array<{
  id: string;
  label: string;
  web: number;
  flange: number;
  d?: number;
  bf?: number;
  weight?: number;
}> {
  if (!profileName) return [];
  const clean = profileName.toUpperCase().replace(/\s+/g, '');
  const match = clean.match(/^(?:W|HP)(\d+)/);
  if (!match) return [];
  const nomSeries = parseInt(match[1], 10);
  
  // Query Gerdau official database for this series
  const gerdauVariants = GERDAU_W_CATALOG.filter(p => p.nominalSeries === nomSeries);
  if (gerdauVariants.length > 0) {
    return gerdauVariants.map(p => ({
      id: `${p.type}${p.nominalSeries}x${p.massKgM}`,
      label: `${p.designation} (${p.caliberInch}) - Alma: ${p.tw}mm, Alas: ${p.tf}mm [${p.massKgM} kg/m]${p.isCustomOrder ? ' *' : ''}`,
      web: p.tw,
      flange: p.tf,
      d: p.d,
      bf: p.bf,
      weight: p.massKgM
    }));
  }

  // Fallback if not found in Gerdau series
  const series = `W${nomSeries}`;
  const options: Array<{ id: string; label: string; web: number; flange: number }> = [];
  const seen = new Set<string>();

  for (const [key, val] of Object.entries(W_PROFILES_CATALOG)) {
    if (key.startsWith(series + '*')) {
      const weight = key.replace(series + '*', '');
      const numWeight = parseFloat(weight);
      const weightLabel = numWeight.toString();
      if (!seen.has(weightLabel)) {
        seen.add(weightLabel);
        options.push({
          id: `${series}x${weightLabel}`,
          label: `${series}x${weightLabel} (Alma: ${val.web}mm, Alas: ${val.flange}mm)`,
          web: val.web,
          flange: val.flange,
        });
      }
    }
  }
  return options;
}

// Known unmistakable decimal structural steel plate gauges (standard inch conversions)
export const KNOWN_EXACT_DECIMAL_GAUGES: number[] = [
  3.2, 4.8, 6.4, 7.9, 9.5, 12.7, 15.9, 19.1, 22.2, 25.4,
  31.7, 31.75, 31.8,  // 1-1/4" (31.75 mm)
  38.1,                // 1-1/2" (38.10 mm)
  44.45, 44.5,         // 1-3/4" (44.45 mm)
  50.8,                // 2" (50.80 mm)
  57.15, 57.2,         // 2-1/4" (57.15 mm)
  63.5,                // 2-1/2" (63.50 mm)
  69.85,               // 2-3/4" (69.85 mm)
  76.2,                // 3" (76.20 mm)
  88.9,                // 3-1/2" (88.90 mm)
  101.6                // 4" (101.60 mm)
];

export function isKnownSteelGauge(val: number): boolean {
  return KNOWN_EXACT_DECIMAL_GAUGES.some(g => Math.abs(val - g) <= 0.15);
}

/**
 * Parse dimension part supporting decimals or fractions like 1-1/4, 1 1/2, 3/4
 */
function parseDimensionPart(raw: string): number | null {
  const s = raw.trim().replace(/"$/, '');
  // Compound fraction: "1-1/4" or "1 1/2"
  const compound = s.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
  if (compound) {
    const whole = parseFloat(compound[1]);
    const num = parseFloat(compound[2]);
    const den = parseFloat(compound[3]);
    if (den > 0) return Math.round((whole + num / den) * 25.4 * 10) / 10;
  }
  // Simple fraction: "3/4" or "1/2"
  const simple = s.match(/^(\d+)\/(\d+)$/);
  if (simple) {
    const num = parseFloat(simple[1]);
    const den = parseFloat(simple[2]);
    if (den > 0) return Math.round((num / den) * 25.4 * 10) / 10;
  }
  const val = parseFloat(s);
  return isNaN(val) ? null : val;
}

export function extractProfileThickness(profile: string): number {
  if (!profile) return 6.4;
  const rawClean = profile.trim().toUpperCase();
  const pNoSpace = rawClean.replace(/\s+/g, '');

  // 1. Built-up I beam HI250-4.8-6.4*200 -> web 4.8
  const hiMatch = pNoSpace.match(/^(?:HI|HF|H|I|WF)\d*(?:\.\d+)?-(\d+(?:\.\d+)?)/);
  if (hiMatch) return parseFloat(hiMatch[1]);

  // 2. Wide flange W profiles from ASTM A6 / AISC / Gerdau catalog
  const wKey = pNoSpace.replace(/X/g, '*').replace(',', '.');
  if (wKey.startsWith('W')) {
    if (W_PROFILES_CATALOG[wKey]) {
      return W_PROFILES_CATALOG[wKey].web;
    }
    const nominalMatch = wKey.match(/^W(\d+)/);
    if (nominalMatch) {
      const nom = parseInt(nominalMatch[1], 10);
      if (nom <= 150) return 5.8;
      if (nom <= 200) return 6.2;
      if (nom <= 250) return 6.6;
      if (nom <= 310) return 6.6;
      if (nom <= 360) return 7.2;
      if (nom <= 410) return 7.7;
      if (nom <= 460) return 8.0;
      if (nom <= 530) return 9.0;
      return 10.0;
    }
  }

  // 3. Cold-formed C / CC / U / CF / Z / ZP channels with hyphens:
  // e.g. CC180-2-20*70 -> thickness 2 mm (height 180, thickness 2, lip 20, flange 70)
  // e.g. CC180-3.2-23*65 -> thickness 3.2 mm (height 180, thickness 3.2, lip 23, flange 65)
  // e.g. CC150-2-20*70 -> thickness 2 mm
  // e.g. C180-2-20*70 -> thickness 2 mm
  // e.g. Z200-2.5-20*75 -> thickness 2.5 mm
  // e.g. CC180-2*70 -> thickness 2 mm
  const ccHyphenMatch = pNoSpace.match(/^(?:ZZ|Z|CC|C|U|CF|ZP)\d*(?:\.\d+)?-(\d+(?:\.\d+)?)-/);
  if (ccHyphenMatch) {
    const t = parseFloat(ccHyphenMatch[1]);
    if (t > 0 && t <= 50) return t;
  }
  const ccHyphenShort = pNoSpace.match(/^(?:CC|C|U|CF|Z|ZP)\d*(?:\.\d+)?-(\d+(?:\.\d+)?)\*/);
  if (ccHyphenShort) {
    const t = parseFloat(ccHyphenShort[1]);
    if (t > 0 && t <= 50) return t;
  }

  // 4. Folded profiles with hyphens: LP70-3.2*60, PLP130-3.2*65
  const lpHyphenMatch = pNoSpace.match(/^(?:LP|PLP)\d*(?:\.\d+)?-(\d+(?:\.\d+)?)/);
  if (lpHyphenMatch) {
    const t = parseFloat(lpHyphenMatch[1]);
    if (t > 0 && t <= 50) return t;
  }

  // 5. Folded profile with 3 parts e.g. LP70*60*3.2, PLP130*65*3.2, CHS168*4.8
  const lp3Match = pNoSpace.match(/^(?:LP|PLP|CHS)\d+(?:\.\d+)?\*\d+(?:\.\d+)?\*(\d+(?:\.\d+)?)$/);
  if (lp3Match) {
    const t = parseFloat(lp3Match[1]);
    if (t > 0 && t <= 50) return t;
  }

  // 6. Folded profile with 2 parts e.g. LP45*3.2 or CHS168*4.8
  const lp2Match = pNoSpace.match(/^(?:LP|PLP|CHS)\d+(?:\.\d+)?\*(\d+(?:\.\d+)?)$/);
  if (lp2Match) {
    const t = parseFloat(lp2Match[1]);
    if (t > 0 && t <= 50) return t;
    return 3.2;
  }

  // 7. C channel with asterisks: CC200*70*20*2 or C200*70*2.5
  const cMatch = pNoSpace.match(/^(?:CC|C|U|CF|Z|ZP)\d+(?:\.\d+)?\*\d+(?:\.\d+)?(?:\*\d+(?:\.\d+)?)?\*(\d+(?:\.\d+)?)$/);
  if (cMatch) {
    const t = parseFloat(cMatch[1]);
    if (t > 0 && t <= 50) return t;
  }
  if (pNoSpace.startsWith('C') || pNoSpace.startsWith('CC') || pNoSpace.startsWith('U')) {
    if (pNoSpace.startsWith('UPN')) {
      const sizeMatch = pNoSpace.match(/UPN(\d+)/);
      const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 200;
      if (size <= 140) return 7.0;
      if (size <= 200) return 8.5;
      return 10.0;
    }
    const c2 = pNoSpace.match(/^(?:CC|C)\d+(?:\.\d+)?\*(\d+(?:\.\d+)?)$/);
    if (c2) {
      const t = parseFloat(c2[1]);
      if (t <= 50) return t;
      return 2.5;
    }
  }

  // 8. Angle L: L57*4.8, L64*6.4, L89*6.4, L100*100*10
  const l3Match = pNoSpace.match(/^L\d+(?:\.\d+)?\*\d+(?:\.\d+)?\*(\d+(?:\.\d+)?)$/);
  if (l3Match) {
    const t = parseFloat(l3Match[1]);
    if (t > 0 && t <= 50) return t;
  }
  const l2Match = pNoSpace.match(/^L\d+(?:\.\d+)?\*(\d+(?:\.\d+)?)$/);
  if (l2Match) {
    const t = parseFloat(l2Match[1]);
    if (t > 0 && t <= 50) return t;
  }

  // 9. Plate PL:
  // Can be:
  // - 3 dimensions: PL38.1*300*600, PL12.7*250*400, PL6.4-250*400
  // - 2 dimensions: PL31.7*400, PL38.1*450, PL50.8*500, PL7.9*70, PL12.7*220
  // - Hyphenated: PL6.4-200, PL12.7-250
  if (pNoSpace.startsWith('PL')) {
    const afterPl = rawClean.replace(/^PL\s*/, '');
    const rawParts = afterPl.split(/[*xX]/);
    // If it has hyphen inside like "6.4-253*350"
    const parsedDims: number[] = [];
    for (const part of rawParts) {
      if (part.includes('-')) {
        const sub = part.split('-');
        for (const s of sub) {
          const d = parseDimensionPart(s);
          if (d !== null && d > 0) parsedDims.push(d);
        }
      } else {
        const d = parseDimensionPart(part);
        if (d !== null && d > 0) parsedDims.push(d);
      }
    }

    if (parsedDims.length >= 3) {
      // With 3 dimensions (thickness * width * length), thickness is either the 1st or the smallest dimension <= 100mm
      const candidate = parsedDims[0] <= 100 ? parsedDims[0] : Math.min(...parsedDims);
      return candidate <= 120 ? candidate : 6.4;
    }

    if (parsedDims.length === 2) {
      const [dimA, dimB] = parsedDims;
      const minDim = Math.min(dimA, dimB);
      const maxDim = Math.max(dimA, dimB);

      // A. Unmistakable decimal heavy plate gauges (31.7, 38.1, 44.5, 50.8, 63.5, 76.2, etc.)
      if (isKnownSteelGauge(minDim)) {
        return minDim;
      }

      // B. Standard light to medium plate (<= 25.4 mm / 1 inch)
      if (minDim <= 25.4) {
        return minDim;
      }

      // C. Heavy metric plates (30, 35, 40, 50 mm) where aspect ratio width/thickness is >= 2.5
      if (minDim <= 50.0 && maxDim >= minDim * 2.5) {
        return minDim;
      }

      // D. Otherwise, planar dimensions of a cut gusset plate (e.g. 253*350)
      return 6.4;
    }

    if (parsedDims.length === 1) {
      const d = parsedDims[0];
      if (isKnownSteelGauge(d) || d <= 100) return d;
    }

    return 6.4;
  }

  // 8. General fallback for any other profile with asterisks:
  const allNums = rawClean.split('*').map(parseDimensionPart).filter((n): n is number => n !== null && n > 0);
  const knownGauges = allNums.filter(n => isKnownSteelGauge(n));
  if (knownGauges.length > 0) {
    return Math.min(...knownGauges);
  }
  const realisticThick = allNums.filter(n => n <= 38.1);
  if (realisticThick.length > 0) {
    return Math.min(...realisticThick);
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
  customColMap?: { parte: number; perfil: number; cantPartes: number; diametro: number; agujerosPorParte: number; ubicacion?: number },
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
  let colMap = customColMap ? { ...customColMap, ubicacion: customColMap.ubicacion ?? -1, espesor: (customColMap as any).espesor ?? -1 } : {
    parte: -1,
    perfil: -1,
    cantPartes: -1,
    diametro: -1,
    agujerosPorParte: -1,
    ubicacion: -1,
    espesor: -1,
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

      const locIdx = normCells.findIndex((c, idx) =>
        idx !== pIdx && idx !== perfIdx && (c === 'cara' || c === 'ubicacion' || c === 'face' || c === 'location' || c === 'lado' || c === 'ala' || c === 'alma')
      );

      const thickIdx = normCells.findIndex((c, idx) =>
        idx !== pIdx && idx !== perfIdx && (
          c === 'espesor' || c === 'esp' || c === 'thickness' || c === 'thk' || c === 'grosor' || c === 'e' || c === 't' ||
          c.includes('espesor') || c.includes('thick')
        )
      );

      const foundCount = [pIdx, perfIdx, qtyIdx, dIdx, hIdx].filter(idx => idx !== -1).length;
      if (foundCount >= 2) {
        tableHeaderIndex = i;
        colMap.parte = pIdx !== -1 ? pIdx : 0;
        colMap.perfil = perfIdx !== -1 ? perfIdx : 1;
        colMap.cantPartes = qtyIdx !== -1 ? qtyIdx : 2;
        colMap.diametro = dIdx !== -1 ? dIdx : 3;
        colMap.agujerosPorParte = hIdx !== -1 ? hIdx : 4;
        colMap.ubicacion = locIdx;
        colMap.espesor = thickIdx;
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
      ubicacion: -1,
      espesor: -1,
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
    const rawLoc = colMap.ubicacion !== undefined && colMap.ubicacion >= 0 && colMap.ubicacion < cells.length ? cells[colMap.ubicacion] : '';
    const rawThick = (colMap as any).espesor !== undefined && (colMap as any).espesor >= 0 && (colMap as any).espesor < cells.length ? cells[(colMap as any).espesor] : '';

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
        const parsedRowThick = parseFlexibleNumber(rawThick);

        let webT = thickInfo.web;
        let flangeT = thickInfo.flange;

        if (thickInfo.isDualThickness && webT && flangeT) {
          const minT = Math.min(webT, flangeT);
          const maxT = Math.max(webT, flangeT);
          webT = minT;
          flangeT = maxT;
        }

        const primaryThick = parsedRowThick > 0
          ? parsedRowThick
          : (thickInfo.isDualThickness && flangeT ? flangeT : thickInfo.primary);

        currentPartRecord = {
          id: `part-${rawPart}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          partId: rawPart,
          profile: rawProfile || 'ESTÁNDAR',
          thickness: primaryThick,
          webThickness: webT,
          flangeThickness: flangeT,
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
    const parsedRowThick = parseFlexibleNumber(rawThick);

    if (currentPartRecord && numDiam > 0 && numHoles > 0) {
      // Check for slot / corredera notation e.g. "14.0(14.0x30.0)" or "17.5(40.0x17.5)"
      const slotMatch = rawDiam.match(/\(([^)]+)\)/);
      const slot = slotMatch ? slotMatch[1] : undefined;
      const holeType = slot ? ('corredera' as const) : ('pasante' as const);

      // Determine thickness and location using the universal thickness rule:
      let holeThickness = parsedRowThick > 0 ? parsedRowThick : currentPartRecord.thickness;
      let location: string | undefined = undefined;

      if (currentPartRecord.isDualThickness && currentPartRecord.webThickness && currentPartRecord.flangeThickness) {
        // Regla general para TODAS las piezas:
        // Alma = menor espesor (webT)
        // Ala = mayor espesor (flangeT)
        const webT = Math.min(currentPartRecord.webThickness, currentPartRecord.flangeThickness);
        const flangeT = Math.max(currentPartRecord.webThickness, currentPartRecord.flangeThickness);
        currentPartRecord.webThickness = webT;
        currentPartRecord.flangeThickness = flangeT;

        const normLoc = rawLoc.toLowerCase().trim();

        if (parsedRowThick > 0) {
          // La regla del espesor: si la fila del CSV especifica espesor,
          // se asume Ala al mayor espesor y Alma al menor espesor
          if (Math.abs(parsedRowThick - flangeT) <= Math.abs(parsedRowThick - webT)) {
            holeThickness = flangeT;
            location = 'alas';
          } else {
            holeThickness = webT;
            location = 'alma';
          }
        } else if (normLoc.includes('ala') || normLoc.includes('flange') || normLoc === 'u' || normLoc === 'o') {
          holeThickness = flangeT;
          location = 'alas';
        } else if (normLoc.includes('alma') || normLoc.includes('web') || normLoc === 'v') {
          holeThickness = webT;
          location = 'alma';
        } else {
          // Si no hay espesor ni cara en la fila, se aplica la regla según el espesor de la pieza:
          if (currentPartRecord.thickness >= flangeT - 0.1) {
            holeThickness = flangeT;
            location = 'alas';
          } else {
            holeThickness = webT;
            location = 'alma';
          }
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

