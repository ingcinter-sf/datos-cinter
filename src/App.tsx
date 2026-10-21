import { useState, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { CsvAnalyzer } from './components/CsvAnalyzer';
import { DxfViewer } from './components/DxfViewer';
import { BlueprintAiAnalyzer } from './components/BlueprintAiAnalyzer';
import { MachiningCalculator } from './components/MachiningCalculator';
import { ResumenPerforacionesReport } from './components/ResumenPerforacionesReport';
import { parseMetallurgyCsv, mergePartRecords } from './utils/csvParser';
import { SAMPLE_METALLURGY_CSV, SAMPLE_METALLURGY_VMC } from './utils/sampleData';
import { PartRecord, DiameterSummary } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'csv' | 'dxf' | 'ai' | 'calculator' | 'print'>('csv');

  // Initialize with the user's real project (VMC with A80000, 370 parts, 26,954 holes)
  const initialData = useMemo(() => parseMetallurgyCsv(SAMPLE_METALLURGY_VMC), []);
  const [parts, setParts] = useState<PartRecord[]>(initialData.parts);
  const [headerMetadata, setHeaderMetadata] = useState<string[]>(initialData.headerMetadata);
  const [obraTitle, setObraTitle] = useState<string>(initialData.obraTitle || 'VMC');
  const [rawCsvText, setRawCsvText] = useState<string>(SAMPLE_METALLURGY_VMC);

  // Recalculate summary metrics whenever parts change
  const { totalPartsCount, totalHolesProduction, diameterSummary } = useMemo(() => {
    const totalParts = parts.reduce((sum, p) => sum + p.quantity, 0);
    const totalHoles = parts.reduce((sum, p) => sum + p.totalHolesAllPieces, 0);

    const map = new Map<number, {
      perPieceSum: number;
      productionSum: number;
      parts: Set<string>;
    }>();

    for (const part of parts) {
      for (const hole of part.holes) {
        if (!map.has(hole.diameter)) {
          map.set(hole.diameter, {
            perPieceSum: 0,
            productionSum: 0,
            parts: new Set(),
          });
        }
        const item = map.get(hole.diameter)!;
        item.perPieceSum += hole.countPerPiece;
        item.productionSum += hole.countPerPiece * part.quantity;
        item.parts.add(part.partId);
      }
    }

    const dSummary: DiameterSummary[] = Array.from(map.entries())
      .map(([diameter, data]) => {
        const vc = 28;
        const recommendedRpm = Math.round((1000 * vc) / (Math.PI * diameter));
        const timePerHoleSeconds = Math.max(8, Math.round(diameter * 0.9));

        return {
          diameter,
          totalHolesPerPieceSum: data.perPieceSum,
          totalHolesProduction: data.productionSum,
          participatingParts: Array.from(data.parts),
          suggestedTool: diameter <= 26 ? `Broca / Punzón Ø${diameter}mm` : `Fresa / Mecha especial Ø${diameter}mm`,
          recommendedRpm,
          estimatedTimeSeconds: data.productionSum * timePerHoleSeconds,
        };
      })
      .sort((a, b) => a.diameter - b.diameter);

    return {
      totalPartsCount: totalParts,
      totalHolesProduction: totalHoles,
      diameterSummary: dSummary,
    };
  }, [parts]);

  const [loadedFiles, setLoadedFiles] = useState<string[]>(['ep14_84099c8a.csv (VMC)']);

  // Load preset sample data
  const handleLoadSample = (type: 'vmc' | 'n29000' = 'vmc') => {
    const targetData = type === 'vmc' ? SAMPLE_METALLURGY_VMC : SAMPLE_METALLURGY_CSV;
    const parsed = parseMetallurgyCsv(targetData);
    setParts(parsed.parts);
    setHeaderMetadata(parsed.headerMetadata);
    setRawCsvText(targetData);
    setObraTitle(parsed.obraTitle || (type === 'vmc' ? 'VMC' : 'N29000'));
    setLoadedFiles([type === 'vmc' ? 'ep14_84099c8a.csv (VMC)' : 'N29000_CC150.csv']);
    setActiveTab('csv');
  };

  // When a user drops/uploads a single CSV/Excel file
  const handleFileLoaded = (rawContent: string, filename: string) => {
    setRawCsvText(rawContent);
    const parsed = parseMetallurgyCsv(rawContent);
    setParts(parsed.parts);
    setHeaderMetadata(parsed.headerMetadata);
    setObraTitle(parsed.obraTitle || 'OBRA');
    setLoadedFiles([filename]);
    setActiveTab('csv');
  };

  // When a user drops/uploads multiple CSV/Excel files at once or appends to existing
  const handleMultipleFilesLoaded = (filesData: { content: string; filename: string }[], mode: 'replace' | 'append') => {
    let combinedParts = mode === 'append' ? [...parts] : [];
    const newFileNames = filesData.map(f => f.filename);
    let detectedObra = obraTitle;

    for (const item of filesData) {
      const parsed = parseMetallurgyCsv(item.content);
      combinedParts = mergePartRecords(combinedParts, parsed.parts);
      if (parsed.obraTitle && parsed.obraTitle !== 'OBRA GENERAL') {
        detectedObra = parsed.obraTitle;
      }
    }

    setParts(combinedParts);
    setObraTitle(detectedObra);
    setLoadedFiles(prev => (mode === 'append' ? Array.from(new Set([...prev, ...newFileNames])) : newFileNames));
    setActiveTab('csv');
  };

  // Import holes from DXF Drawing into parts list
  const handleImportFromDxf = (partId: string, profile: string, holes: { diameter: number; count: number }[]) => {
    setParts(prev => {
      // Check if part already exists
      const existingIdx = prev.findIndex(p => p.partId.toLowerCase() === partId.toLowerCase());
      const newHoleDetails = holes.map(h => ({
        id: `h-dxf-${h.diameter}-${Math.random().toString(36).slice(2, 6)}`,
        diameter: h.diameter,
        countPerPiece: h.count,
        type: 'pasante' as const,
      }));
      const totalPerPiece = newHoleDetails.reduce((sum, h) => sum + h.countPerPiece, 0);

      if (existingIdx !== -1) {
        const updated = [...prev];
        const existing = updated[existingIdx];
        updated[existingIdx] = {
          ...existing,
          holes: newHoleDetails,
          totalHolesPerPiece: totalPerPiece,
          totalHolesAllPieces: totalPerPiece * existing.quantity,
        };
        return updated;
      } else {
        const newRecord: PartRecord = {
          id: `part-${partId}-${Date.now()}`,
          partId: partId.toUpperCase(),
          profile: profile || 'CC150',
          thickness: 6.4,
          quantity: 5,
          holes: newHoleDetails,
          totalHolesPerPiece: totalPerPiece,
          totalHolesAllPieces: totalPerPiece * 5,
        };
        return [...prev, newRecord];
      }
    });
  };

  // Import detected parts from AI Blueprint analysis
  const handleImportFromAi = (aiParts: any[]) => {
    const converted: PartRecord[] = aiParts.map(p => {
      const holes = (p.holes || []).map((h: any) => ({
        id: `h-ai-${h.diameter}-${Math.random().toString(36).slice(2, 6)}`,
        diameter: Number(h.diameter) || 14,
        countPerPiece: Number(h.countPerPiece) || 1,
        type: h.type || 'pasante',
      }));
      const totalHolesPerPiece = holes.reduce((sum: number, h: any) => sum + h.countPerPiece, 0);
      const qty = Number(p.quantity) || 1;

      return {
        id: `part-ai-${p.partId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        partId: String(p.partId || 'PIEZA-IA').toUpperCase(),
        profile: String(p.profile || 'ESTÁNDAR'),
        thickness: 6.4,
        quantity: qty,
        holes,
        totalHolesPerPiece,
        totalHolesAllPieces: totalHolesPerPiece * qty,
      };
    });

    setParts(prev => {
      // Merge or append
      const existingMap = new Map(prev.map(p => [p.partId.toUpperCase(), p]));
      converted.forEach(cp => {
        existingMap.set(cp.partId.toUpperCase(), cp);
      });
      return Array.from(existingMap.values());
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalParts={totalPartsCount}
        totalHoles={totalHolesProduction}
        onLoadSample={handleLoadSample}
        obraTitle={obraTitle}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'csv' && (
          <CsvAnalyzer
            parts={parts}
            setParts={setParts}
            diameterSummary={diameterSummary}
            totalPartsCount={totalPartsCount}
            totalHolesProduction={totalHolesProduction}
            onFileLoaded={handleFileLoaded}
            onMultipleFilesLoaded={handleMultipleFilesLoaded}
            rawCsvText={rawCsvText}
            loadedFiles={loadedFiles}
          />
        )}

        {activeTab === 'dxf' && (
          <DxfViewer 
            onImportHolesToCsv={handleImportFromDxf} 
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'ai' && (
          <BlueprintAiAnalyzer
            currentCsvParts={parts}
            onImportAiParts={handleImportFromAi}
          />
        )}

        {activeTab === 'calculator' && (
          <MachiningCalculator
            diameterSummary={diameterSummary}
            parts={parts}
            totalHolesProduction={totalHolesProduction}
          />
        )}

        {activeTab === 'print' && (
          <ResumenPerforacionesReport
            parts={parts}
            diameterSummary={diameterSummary}
            totalPartsCount={totalPartsCount}
            totalHolesProduction={totalHolesProduction}
            headerMetadata={headerMetadata}
            obraTitle={obraTitle}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="print:hidden border-t border-slate-900 bg-slate-950/80 py-4 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>MetalMetric - Software de Cubicaje de Perforaciones y Planos Metalúrgicos</span>
          <span>Compatibilidad: CSV, TXT, Excel, AutoCAD DXF, Planos PDF</span>
        </div>
      </footer>
    </div>
  );
}
