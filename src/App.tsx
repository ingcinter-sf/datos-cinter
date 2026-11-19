import { useState, useMemo, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { ObrasHome } from './components/ObrasHome';
import { CsvAnalyzer } from './components/CsvAnalyzer';
import { ResumenPerforacionesReport } from './components/ResumenPerforacionesReport';
import { WorkshopAnalytics } from './components/WorkshopAnalytics';
import { parseMetallurgyCsv, mergePartRecords } from './utils/csvParser';
import { SAMPLE_METALLURGY_CSV, SAMPLE_METALLURGY_VMC } from './utils/sampleData';
import {
  getPortalStoragePrefix,
  loadObrasFromStorage,
  saveObrasToStorage,
  loadLastFolderSyncAt,
  saveLastFolderSyncAt,
} from './utils/obraStorage';
import { readSpreadsheetFileAsText, readImageFileAsDataUrl, ScannedObraFolder } from './utils/folderScanner';
import { PartRecord, DiameterSummary, ObraProject, FolderSyncResult } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'csv' | 'print' | 'analytics'>('home');
  
  // Theme state: 'light' (white background & blue accents) vs 'dark' (slate-950 & amber)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('cinter_portal_theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('cinter_portal_theme', next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Unique storage prefix per folder path to keep separate portal copies isolated
  const storagePrefix = useMemo(() => getPortalStoragePrefix(), []);

  const [obras, setObras] = useState<ObraProject[]>([]);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [activeObraId, setActiveObraId] = useState<string | null>(null);

  const [lastSyncResult, setLastSyncResult] = useState<FolderSyncResult | null>(null);
  const [recentlyChangedMap, setRecentlyChangedMap] = useState<Record<string, 'created' | 'updated'>>({});
  const [lastFolderSyncAt, setLastFolderSyncAt] = useState<string | null>(() => loadLastFolderSyncAt(storagePrefix));

  // Load saved obras from IndexedDB / localStorage on mount
  useEffect(() => {
    let cancelled = false;
    loadObrasFromStorage(storagePrefix).then((loaded) => {
      if (cancelled) return;
      setObras(loaded);
      setIsStorageLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storagePrefix]);

  // Persist obras automatically whenever they change (only after initial load completes)
  useEffect(() => {
    if (!isStorageLoaded) return;
    saveObrasToStorage(storagePrefix, obras);
  }, [storagePrefix, obras, isStorageLoaded]);

  const activeObra = useMemo(
    () => obras.find(o => o.id === activeObraId) || null,
    [obras, activeObraId]
  );

  const parts = activeObra?.parts || [];
  const headerMetadata = activeObra?.headerMetadata || [];
  const projectName = activeObra?.name || 'Nueva Obra';
  const rawCsvText = activeObra?.rawCsvText || '';
  const loadedFiles = activeObra?.loadedFiles || [];

  const updateActiveObra = useCallback(
    (updater: (obra: ObraProject) => ObraProject) => {
      if (!activeObraId) return;
      setObras(prev =>
        prev.map(o => (o.id === activeObraId ? updater(o) : o))
      );
    },
    [activeObraId]
  );

  // Compatible React.Dispatch<React.SetStateAction<PartRecord[]>> for CsvAnalyzer
  const setParts: React.Dispatch<React.SetStateAction<PartRecord[]>> = useCallback(
    (value) => {
      updateActiveObra((obra) => {
        const nextParts = typeof value === 'function' ? value(obra.parts) : value;
        return {
          ...obra,
          parts: nextParts,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateActiveObra]
  );

  const setProjectName = useCallback(
    (newName: string) => {
      updateActiveObra((obra) => ({
        ...obra,
        name: newName,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateActiveObra]
  );

  // Clear all parts inside the currently active obra
  const handleClearAll = () => {
    updateActiveObra((obra) => ({
      ...obra,
      parts: [],
      headerMetadata: [],
      rawCsvText: '',
      loadedFiles: [],
      updatedAt: new Date().toISOString(),
    }));
  };

  // Recalculate summary metrics for the active obra
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

  // Select an obra card from Home
  const handleSelectObra = (obraId: string, targetTab: 'csv' | 'print' | 'analytics' = 'csv') => {
    setActiveObraId(obraId);
    setActiveTab(targetTab);
  };

  // Create a new manual obra card
  const handleCreateManualObra = (name: string) => {
    const newId = `obra-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newObra: ObraProject = {
      id: newId,
      name,
      parts: [],
      headerMetadata: [],
      rawCsvText: '',
      loadedFiles: [],
      updatedAt: new Date().toISOString(),
      sourceType: 'manual',
    };
    setObras(prev => [...prev, newObra]);
    setRecentlyChangedMap(prev => ({ ...prev, [newId]: 'created' }));
    setActiveObraId(newId);
    setActiveTab('csv');
  };

  // Delete an obra card
  const handleDeleteObra = (obraId: string) => {
    setObras(prev => prev.filter(o => o.id !== obraId));
    if (activeObraId === obraId) {
      setActiveObraId(null);
      setActiveTab('home');
    }
  };

  // Sync folders from "calculadora/" (updates existing cards and creates new cards for newly detected folders)
  const handleSyncFolders = async (scannedFolders: ScannedObraFolder[]): Promise<FolderSyncResult> => {
    const createdNames: string[] = [];
    const updatedNames: string[] = [];
    const skippedEmptyFolders: string[] = [];
    const changeBadges: Record<string, 'created' | 'updated'> = {};
    let totalFilesProcessed = 0;

    // Parse all scanned folders first
    const parsedFoldersData: {
      folderName: string;
      logoDataUrl?: string;
      parts: PartRecord[];
      headerMetadata: string[];
      rawCsvText: string;
      loadedFiles: string[];
    }[] = [];

    for (const folder of scannedFolders) {
      if (folder.files.length === 0) {
        skippedEmptyFolders.push(folder.folderName);
      }

      let logoDataUrl: string | undefined;
      if (folder.logoFile) {
        try {
          logoDataUrl = await readImageFileAsDataUrl(folder.logoFile);
        } catch (err) {
          console.error('Error reading logo image for', folder.folderName, err);
        }
      }

      let combinedParts: PartRecord[] = [];
      let combinedMetadata: string[] = [];
      let lastRawText = '';
      const fileNames: string[] = [];

      for (const file of folder.files) {
        const text = await readSpreadsheetFileAsText(file);
        const parsed = parseMetallurgyCsv(text);
        combinedParts = mergePartRecords(combinedParts, parsed.parts);
        if (parsed.headerMetadata.length > 0) {
          combinedMetadata = Array.from(new Set([...combinedMetadata, ...parsed.headerMetadata]));
        }
        lastRawText = text;
        fileNames.push(file.name);
        totalFilesProcessed += 1;
      }

      parsedFoldersData.push({
        folderName: folder.folderName,
        logoDataUrl,
        parts: combinedParts,
        headerMetadata: combinedMetadata,
        rawCsvText: lastRawText,
        loadedFiles: fileNames,
      });
    }

    const nextObras = [...obras];

    for (const item of parsedFoldersData) {
      const normalizedFolder = item.folderName.trim().toLowerCase();
      const existingIndex = nextObras.findIndex(
        o =>
          (o.folderName && o.folderName.trim().toLowerCase() === normalizedFolder) ||
          o.name.trim().toLowerCase() === normalizedFolder
      );

      if (existingIndex !== -1) {
        const existing = nextObras[existingIndex];
        nextObras[existingIndex] = {
          ...existing,
          folderName: item.folderName,
          logoDataUrl: item.logoDataUrl !== undefined ? item.logoDataUrl : existing.logoDataUrl,
          parts: item.parts,
          headerMetadata: item.headerMetadata,
          rawCsvText: item.rawCsvText,
          loadedFiles: item.loadedFiles,
          updatedAt: new Date().toISOString(),
          sourceType: 'folder',
        };
        updatedNames.push(existing.name);
        changeBadges[existing.id] = 'updated';
      } else {
        // New folder detected -> create a new obra card automatically!
        const newId = `obra-folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newObra: ObraProject = {
          id: newId,
          name: item.folderName,
          folderName: item.folderName,
          logoDataUrl: item.logoDataUrl,
          parts: item.parts,
          headerMetadata: item.headerMetadata,
          rawCsvText: item.rawCsvText,
          loadedFiles: item.loadedFiles,
          updatedAt: new Date().toISOString(),
          sourceType: 'folder',
        };
        nextObras.push(newObra);
        createdNames.push(item.folderName);
        changeBadges[newId] = 'created';
      }
    }

    setObras(nextObras);
    setRecentlyChangedMap(changeBadges);
    const syncNow = new Date().toISOString();
    setLastFolderSyncAt(syncNow);
    saveLastFolderSyncAt(storagePrefix, syncNow);
    const result: FolderSyncResult = {
      createdNames,
      updatedNames,
      totalFilesProcessed,
      skippedEmptyFolders,
    };
    setLastSyncResult(result);
    return result;
  };

  // Load preset sample data into the active obra OR as a new card if called from Home
  const handleLoadSample = (type: 'vmc' | 'n29000' = 'vmc') => {
    const targetData = type === 'vmc' ? SAMPLE_METALLURGY_VMC : SAMPLE_METALLURGY_CSV;
    const parsed = parseMetallurgyCsv(targetData);
    const sampleName = type === 'vmc' ? 'VMC_Ejemplo' : 'N29000_Ejemplo';
    const sampleFile = type === 'vmc' ? 'ep14_84099c8a.csv (VMC)' : 'N29000_CC150.csv';

    if (activeObraId) {
      updateActiveObra((obra) => ({
        ...obra,
        parts: parsed.parts,
        headerMetadata: parsed.headerMetadata,
        rawCsvText: targetData,
        loadedFiles: [sampleFile],
        updatedAt: new Date().toISOString(),
      }));
      setActiveTab('csv');
    } else {
      const newId = `obra-sample-${Date.now()}`;
      const newObra: ObraProject = {
        id: newId,
        name: sampleName,
        parts: parsed.parts,
        headerMetadata: parsed.headerMetadata,
        rawCsvText: targetData,
        loadedFiles: [sampleFile],
        updatedAt: new Date().toISOString(),
        sourceType: 'manual',
      };
      setObras(prev => [...prev, newObra]);
      setActiveObraId(newId);
      setActiveTab('csv');
    }
  };

  // When a user drops/uploads a single CSV/Excel file inside CsvAnalyzer
  const handleFileLoaded = (rawContent: string, filename: string) => {
    const parsed = parseMetallurgyCsv(rawContent);
    const defaultName = filename.replace(/\.[^/.]+$/, '');

    updateActiveObra((obra) => ({
      ...obra,
      parts: parsed.parts,
      headerMetadata: parsed.headerMetadata,
      rawCsvText: rawContent,
      name: obra.sourceType === 'manual' && obra.parts.length === 0 ? defaultName : obra.name,
      loadedFiles: [filename],
      updatedAt: new Date().toISOString(),
    }));
    setActiveTab('csv');
  };

  // When a user drops/uploads multiple CSV/Excel files inside CsvAnalyzer
  const handleMultipleFilesLoaded = (filesData: { content: string; filename: string }[], mode: 'replace' | 'append') => {
    updateActiveObra((obra) => {
      const effectiveMode = obra.parts.length === 0 ? 'replace' : mode;
      let combinedParts = effectiveMode === 'append' ? [...obra.parts] : [];
      let combinedMetadata = effectiveMode === 'append' ? [...obra.headerMetadata] : [];
      const newFileNames = filesData.map(f => f.filename);

      for (const item of filesData) {
        const parsed = parseMetallurgyCsv(item.content);
        combinedParts = mergePartRecords(combinedParts, parsed.parts);
        if (parsed.headerMetadata.length > 0) {
          combinedMetadata = Array.from(new Set([...combinedMetadata, ...parsed.headerMetadata]));
        }
      }

      const nextName =
        effectiveMode === 'replace' && obra.sourceType === 'manual' && obra.parts.length === 0 && filesData.length > 0
          ? filesData[0].filename.replace(/\.[^/.]+$/, '')
          : obra.name;

      return {
        ...obra,
        name: nextName,
        parts: combinedParts,
        headerMetadata: combinedMetadata,
        rawCsvText: filesData[filesData.length - 1]?.content || obra.rawCsvText,
        loadedFiles: effectiveMode === 'append'
          ? Array.from(new Set([...obra.loadedFiles, ...newFileNames]))
          : newFileNames,
        updatedAt: new Date().toISOString(),
      };
    });
    setActiveTab('csv');
  };

  return (
    <div className={`min-h-screen print:min-h-0 print:bg-white print:text-black print:p-0 print:m-0 ${
      theme === 'light' 
        ? 'bg-slate-100 text-slate-900' 
        : 'bg-slate-950 text-slate-100'
    } flex flex-col font-sans transition-colors duration-200 selection:bg-blue-600 selection:text-white`}>
      {/* Navigation with Home (Obras), Theme Switcher, CINTER Logo, and Editable Project Title */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasActiveObra={Boolean(activeObra)}
        totalObras={obras.length}
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
        {(activeTab === 'home' || !activeObra) && (
          <ObrasHome
            obras={obras}
            activeObraId={activeObraId}
            onSelectObra={handleSelectObra}
            onCreateManualObra={handleCreateManualObra}
            onDeleteObra={handleDeleteObra}
            onSyncFolders={handleSyncFolders}
            onLoadSampleAsObra={handleLoadSample}
            lastSyncResult={lastSyncResult}
            onDismissSyncResult={() => setLastSyncResult(null)}
            recentlyChangedMap={recentlyChangedMap}
            lastFolderSyncAt={lastFolderSyncAt}
            theme={theme}
          />
        )}

        {activeTab === 'csv' && activeObra && (
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

        {activeTab === 'print' && activeObra && (
          <ResumenPerforacionesReport
            parts={parts}
            diameterSummary={diameterSummary}
            totalPartsCount={totalPartsCount}
            totalHolesProduction={totalHolesProduction}
            headerMetadata={headerMetadata}
            obraTitle={projectName}
            obraLogoUrl={activeObra.logoDataUrl}
            theme={theme}
          />
        )}

        {activeTab === 'analytics' && activeObra && (
          <WorkshopAnalytics
            parts={parts}
            diameterSummary={diameterSummary}
            totalPartsCount={totalPartsCount}
            totalHolesProduction={totalHolesProduction}
            obraTitle={projectName}
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
          <span>Formatos admitidos: CSV, TXT, Excel (.xlsx, .xls)</span>
        </div>
      </footer>
    </div>
  );
}
