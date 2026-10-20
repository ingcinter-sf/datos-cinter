export interface HoleDetail {
  id: string;
  diameter: number; // in mm, e.g. 14, 15
  countPerPiece: number; // e.g. 2 or 8
  type?: 'pasante' | 'coliso' | 'roscado' | 'avellanado';
  location?: string;
}

export interface PartRecord {
  id: string;
  partId: string; // e.g. "N29000", "N29001"
  profile: string; // e.g. "CC150-2-20*70"
  quantity: number; // Cant. Partes e.g. 5
  holes: HoleDetail[];
  totalHolesPerPiece: number;
  totalHolesAllPieces: number;
  notes?: string;
}

export interface DiameterSummary {
  diameter: number;
  totalHolesPerPieceSum: number;
  totalHolesProduction: number;
  participatingParts: string[];
  suggestedTool: string;
  recommendedRpm?: number;
  estimatedTimeSeconds?: number;
}

export interface RawCsvRow {
  parte?: string;
  perfil?: string;
  cantPartes?: string | number;
  diametro?: string | number;
  agujerosPorParte?: string | number;
  [key: string]: any;
}

// DXF CAD Types
export interface DxfPoint {
  x: number;
  y: number;
  z?: number;
}

export interface DxfCircle {
  type: 'CIRCLE';
  center: DxfPoint;
  radius: number;
  diameter: number;
  layer: string;
  color?: string;
}

export interface DxfLine {
  type: 'LINE';
  start: DxfPoint;
  end: DxfPoint;
  layer: string;
}

export interface DxfArc {
  type: 'ARC';
  center: DxfPoint;
  radius: number;
  startAngle: number;
  endAngle: number;
  layer: string;
}

export interface DxfPolyline {
  type: 'LWPOLYLINE';
  vertices: DxfPoint[];
  closed: boolean;
  layer: string;
}

export interface DxfText {
  type: 'TEXT' | 'MTEXT';
  position: DxfPoint;
  text: string;
  height: number;
  layer: string;
}

export type DxfEntity = DxfCircle | DxfLine | DxfArc | DxfPolyline | DxfText;

export interface DxfParsedDrawing {
  filename: string;
  entities: DxfEntity[];
  layers: string[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  detectedHoles: {
    id: string;
    center: DxfPoint;
    diameter: number;
    layer: string;
  }[];
  holeSummaryByDiameter: {
    diameter: number;
    count: number;
  }[];
}

// AI Blueprint Analysis Result
export interface BlueprintAnalysisResult {
  projectInfo: {
    projectName: string;
    drawingNumber: string;
    material: string;
    thickness: string;
    scale: string;
    notes: string;
  };
  parts: {
    partId: string;
    profile: string;
    quantity: number;
    holes: {
      diameter: number;
      countPerPiece: number;
      type: string;
      location: string;
    }[];
    totalHolesPerPiece: number;
    totalHolesAllPieces: number;
  }[];
  holeSummaryByDiameter: {
    diameter: number;
    totalHolesInDrawing: number;
    suggestedTool: string;
  }[];
  technicalObservations: string[];
  confidenceScore?: number;
}
