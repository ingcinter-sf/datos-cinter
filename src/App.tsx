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
  
  // Theme state: 'light' (white background & blue accents) vs 'dark' (slate-950 & amber)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Initialize clean: NO pre-loaded data on startup (user starts with empty slate)
  const [parts, setParts] = useState<PartRecord[]>([]);
  const [headerMetadata, setHeaderMetadata] = useState<string[]>([]);
  
  // Project Name: defaults to 'Nueva Obra' until first file is added, and is fully editable anytime
  const [projectName, setProjectName] = useState<string>('Nueva Obra');
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [loadedFiles, setLoadedFiles] = useState<string[]>([]);

  // Clear all data (blank slate)
  const handleClearAll = () => {
    setParts([]);
    setHeaderMetadata([]);
    setProjectName('Nueva Obra');
    setRawCsvText('');
    setLoadedFiles([]);
  };

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

  // Load preset sample data if user explicitly requests it
  const handleLoadSample = (type: 'vmc' | 'n29000' = 'vmc') => {
    const targetData = type === 'vmc' ? SAMPLE_METALLURGY_VMC : SAMPLE_METALLURGY_CSV;
    const parsed = parseMetallurgyCsv(targetData);
    setParts(parsed.parts);
    setHeaderMetadata(parsed.headerMetadata);
    setRawCsvText(targetData);
    setProjectName(type === 'vmc' ? 'ep14_84099c8a (VMC)' : 'N29000_CC150');
    setLoadedFiles([type === 'vmc' ? 'ep14_84099c8a.csv (VMC)' : 'N29000_CC150.csv']);
    setActiveTab('csv');
  };

  // When a user drops/uploads a single CSV/Excel file
  const handleFileLoaded = (rawContent: string, filename: string) => {
    setRawCsvText(rawContent);
    const parsed = parseMetallurgyCsv(rawContent);
    setParts(parsed.parts);
    setHeaderMetadata(parsed.headerMetadata);
    
    // Set project name by default to the name of the file added (clean filename without extension)
    const defaultName = filename.replace(/\.[^/.]+$/, '');
    setProjectName(defaultName);
    setLoadedFiles([filename]);
    setActiveTab('csv');
  };

  // When a user drops/uploads multiple CSV/Excel files at once or appends to existing
  const handleMultipleFilesLoaded = (filesData: { content: string; filename: string }[], mode: 'replace' | 'append') => {
    // If there were no parts loaded yet, always start fresh
    const effectiveMode = parts.length === 0 ? 'replace' : mode;
    let combinedParts = effectiveMode === 'append' ? [...parts] : [];
    const newFileNames = filesData.map(f => f.filename);

    for (const item of filesData) {
      const parsed = parseMetallurgyCsv(item.content);
      combinedParts = mergePartRecords(combinedParts, parsed.parts);
    }

    setParts(combinedParts);
    
    // If replacing or initial load, set default title to the first file uploaded
    if (effectiveMode === 'replace' && filesData.length > 0) {
      const firstDefaultName = filesData[0].filename.replace(/\.[^/.]+$/, '');
      setProjectName(firstDefaultName);
    }

    setLoadedFiles(prev => (effectiveMode === 'append' ? Array.from(new Set([...prev, ...newFileNames])) : newFileNames));
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
      const existingMap = new Map(prev.map(p => [p.partId.toUpperCase(), p]));
      converted.forEach(cp => {
        existingMap.set(cp.partId.toUpperCase(), cp);
      });
      return Array.from(existingMap.values());
    });
  };

  return (
    <div className={`min-h-screen print:min-h-0 print:bg-white print:text-black print:p-0 print:m-0 ${
      theme === 'light' 
        ? 'bg-slate-100 text-slate-900' 
        : 'bg-slate-950 text-slate-100'
    } flex flex-col font-sans transition-colors duration-200 selection:bg-blue-600 selection:text-white`}>
      {/* Navigation with Theme Switcher, CINTER Logo, and Editable Project Title */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalParts={totalPartsCount}
        totalHoles={totalHolesProduction}
        onLoadSample={handleLoadSample}
        onClearAll={handleClearAll}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 print:p-0 print:m-0 print:max-w-none print:w-full">
        {activeTab === 'csv' && (
          <CsvAnalyzer
            parts={parts}
            setParts={setParts}
            diameterSummary={diameterSummary}
            totalPartsCount={totalPartsCount}
            totalHolesProduction={totalHolesProduction}
            onFileLoaded={handleFileLoaded}
            onMultipleFilesLoaded={handleMultipleFilesLoaded}
            onClearAll={handleClearAll}
            onLoadSample={handleLoadSample}
            rawCsvText={rawCsvText}
            loadedFiles={loadedFiles}
            theme={theme}
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
            obraTitle={projectName}
            onObraTitleChange={setProjectName}
            theme={theme}
          />
        )}
      </main>

      {/* Footer */}
      <footer className={`print:hidden border-t py-4 text-xs text-center transition-colors ${
        theme === 'light' 
          ? 'border-slate-200 bg-white/90 text-slate-500' 
          : 'border-slate-900 bg-slate-950/80 text-slate-500'
      }`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-medium">CINTER S.A. - Plataforma de Análisis de Perforaciones y Planos Metalúrgicos</span>
          <span>Formatos admitidos: CSV, TXT, Excel (.xlsx, .xls), AutoCAD DXF, Planos PDF</span>
        </div>
      </footer>
    </div>
  );
}
