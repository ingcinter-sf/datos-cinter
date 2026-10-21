import React, { useState, useRef, useMemo } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  Plus, 
  Trash2, 
  Wrench, 
  ClipboardCopy, 
  CheckCircle2, 
  AlertCircle,
  Settings2,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  EyeOff,
  FolderPlus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PartRecord, DiameterSummary } from '../types';
import { parseMetallurgyCsv, exportPartsToCsv, ParseResult, mergePartRecords, calculateSummaries } from '../utils/csvParser';

interface CsvAnalyzerProps {
  parts: PartRecord[];
  setParts: React.Dispatch<React.SetStateAction<PartRecord[]>>;
  diameterSummary: DiameterSummary[];
  totalPartsCount: number;
  totalHolesProduction: number;
  onFileLoaded: (text: string, filename: string) => void;
  onMultipleFilesLoaded?: (filesData: { content: string; filename: string }[], mode: 'replace' | 'append') => void;
  rawCsvText?: string;
  loadedFiles?: string[];
  theme?: 'light' | 'dark';
}

type SortField = 'partId' | 'profile' | 'quantity' | 'totalHolesPerPiece' | 'totalHolesAllPieces';
type SortDirection = 'asc' | 'desc';

export const CsvAnalyzer: React.FC<CsvAnalyzerProps> = ({
  parts,
  setParts,
  diameterSummary,
  totalPartsCount,
  totalHolesProduction,
  onFileLoaded,
  onMultipleFilesLoaded,
  rawCsvText = '',
  loadedFiles = ['ep14_84099c8a.csv (VMC)'],
  theme = 'light',
}) => {
  const isLight = theme === 'light';
  const [isDragging, setIsDragging] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [pasteMode, setPasteMode] = useState<'replace' | 'append'>('append');
  const [showColumnAdjuster, setShowColumnAdjuster] = useState(false);
  const [lastParseResult, setLastParseResult] = useState<ParseResult | null>(null);

  // New features requested by user:
  const [omitNoHoles, setOmitNoHoles] = useState(false); // "omitir piezas sin perforacion"
  const [omitCorrederas, setOmitCorrederas] = useState(false); // "a los agujeros colisos los llamaremos correderas y agregamos un casillero para omitir tambien"
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPieceType, setSelectedPieceType] = useState<string>('all');
  const [selectedProfileFilter, setSelectedProfileFilter] = useState<string>('all');
  const [selectedDiameterFilter, setSelectedDiameterFilter] = useState<number | 'all' | 'slots'>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('partId');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Upload mode: 'replace' | 'append'
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('append');

  // Manual Column Mapping overrides
  const [colMapping, setColMapping] = useState({
    parte: 0,
    perfil: 1,
    cantPartes: 2,
    diametro: 3,
    agujerosPorParte: 4,
  });

  const [delimiterOverride, setDelimiterOverride] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read single file with encoding fallback
  const readFileWithFallback = async (file: File): Promise<string> => {
    try {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        return XLSX.utils.sheet_to_csv(sheet);
      }

      const textUtf8 = await file.text();
      if (textUtf8.includes('')) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsText(file, 'ISO-8859-1');
        });
      }
      return textUtf8;
    } catch {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file, 'ISO-8859-1');
      });
    }
  };

  // Multiple files upload handler
  const handleFilesUpload = async (files: FileList | File[]) => {
    try {
      const filesArray = Array.from(files);
      if (filesArray.length === 0) return;

      const loadedList: { content: string; filename: string }[] = [];

      for (const file of filesArray) {
        const text = await readFileWithFallback(file);
        loadedList.push({ content: text, filename: file.name });
      }

      if (onMultipleFilesLoaded) {
        onMultipleFilesLoaded(loadedList, uploadMode);
      } else {
        // Fallback internal combine
        let currentCombinedParts = uploadMode === 'append' ? [...parts] : [];
        for (const item of loadedList) {
          const parsed = parseMetallurgyCsv(item.content);
          currentCombinedParts = mergePartRecords(currentCombinedParts, parsed.parts);
          setLastParseResult(parsed);
        }
        setParts(currentCombinedParts);
      }

      setCurrentPage(1);
    } catch (err) {
      console.error('Error procesando archivos:', err);
      alert('Hubo un error al procesar uno de los archivos. Asegúrate de que sean formatos compatibles (CSV, TXT, Excel).');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  // Process pasted text from Excel or CSV
  const handleProcessPastedText = () => {
    if (!pasteContent.trim()) return;
    const parsed = parseMetallurgyCsv(pasteContent);
    setLastParseResult(parsed);
    setColMapping(parsed.detectedColumns);
    setDelimiterOverride(parsed.delimiterUsed);

    if (pasteMode === 'append') {
      const merged = mergePartRecords(parts, parsed.parts);
      setParts(merged);
    } else {
      setParts(parsed.parts);
    }

    setCurrentPage(1);
    setShowPasteModal(false);
  };

  // Re-run parser with custom column mapping
  const handleApplyCustomMapping = () => {
    if (!rawCsvText && !pasteContent) return;
    const textToReparse = rawCsvText || pasteContent;
    const parsed = parseMetallurgyCsv(textToReparse, colMapping, delimiterOverride || undefined);
    setParts(parsed.parts);
    setLastParseResult(parsed);
    setCurrentPage(1);
  };

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Helper to extract piece category from partId or profile
  const getPieceCategory = (partId: string, profile: string): string => {
    const pUpper = partId.toUpperCase();
    const profUpper = profile.toUpperCase();

    if (profUpper.startsWith('PL') || pUpper.startsWith('PL')) return 'PL'; // Planchuela / Chapa
    if (profUpper.startsWith('LP') || profUpper.startsWith('PLP')) return 'LP'; // Conformado
    if (profUpper.startsWith('L') && !profUpper.startsWith('LP')) return 'L'; // Ángulo
    if (profUpper.startsWith('W') || profUpper.startsWith('HI') || profUpper.startsWith('IPE') || profUpper.startsWith('UPN')) return 'VIGA'; // Viga/Columna
    if (profUpper.includes('ARAND') || profUpper.includes('TUERCA') || profUpper.includes('RW')) return 'ACC'; // Accesorios
    return 'OTROS';
  };

  // Unique profiles list for filter dropdown
  const uniqueProfiles = useMemo(() => {
    const set = new Set<string>();
    parts.forEach(p => {
      if (p.profile) set.add(p.profile);
    });
    return Array.from(set).sort();
  }, [parts]);

  // Update part quantity in table
  const handleUpdateQuantity = (partId: string, newQty: number) => {
    const qty = Math.max(1, newQty || 1);
    setParts(prev =>
      prev.map(p => {
        if (p.partId === partId) {
          const totalHolesPerPiece = p.holes.reduce((sum, h) => sum + h.countPerPiece, 0);
          return {
            ...p,
            quantity: qty,
            totalHolesAllPieces: totalHolesPerPiece * qty,
          };
        }
        return p;
      })
    );
  };

  // Update hole count in table
  const handleUpdateHoleCount = (partId: string, holeId: string, count: number) => {
    const validCount = Math.max(0, count || 0);
    setParts(prev =>
      prev.map(p => {
        if (p.partId === partId) {
          const updatedHoles = p.holes.map(h => (h.id === holeId ? { ...h, countPerPiece: validCount } : h));
          const totalHolesPerPiece = updatedHoles.reduce((s, h) => s + h.countPerPiece, 0);
          return {
            ...p,
            holes: updatedHoles,
            totalHolesPerPiece,
            totalHolesAllPieces: totalHolesPerPiece * p.quantity,
          };
        }
        return p;
      })
    );
  };

  // Add new hole to part
  const handleAddHoleToPart = (partId: string) => {
    const diamStr = prompt('Ingrese el nuevo diámetro en mm (ej: 14, 17.5, 21):', '17.5');
    if (!diamStr) return;
    const diam = parseFloat(diamStr.replace(',', '.'));
    if (isNaN(diam) || diam <= 0) return;

    setParts(prev =>
      prev.map(p => {
        if (p.partId === partId) {
          const newHole = {
            id: `h-${diam}-${Date.now()}`,
            diameter: diam,
            countPerPiece: 2,
            type: 'pasante' as const,
          };
          const updatedHoles = [...p.holes, newHole];
          const totalHolesPerPiece = updatedHoles.reduce((s, h) => s + h.countPerPiece, 0);
          return {
            ...p,
            holes: updatedHoles,
            totalHolesPerPiece,
            totalHolesAllPieces: totalHolesPerPiece * p.quantity,
          };
        }
        return p;
      })
    );
  };

  // Delete hole
  const handleDeleteHole = (partId: string, holeId: string) => {
    setParts(prev =>
      prev.map(p => {
        if (p.partId === partId) {
          const updatedHoles = p.holes.filter(h => h.id !== holeId);
          const totalHolesPerPiece = updatedHoles.reduce((s, h) => s + h.countPerPiece, 0);
          return {
            ...p,
            holes: updatedHoles,
            totalHolesPerPiece,
            totalHolesAllPieces: totalHolesPerPiece * p.quantity,
          };
        }
        return p;
      })
    );
  };

  // Delete piece
  const handleDeletePart = (partId: string) => {
    if (confirm(`¿Eliminar la pieza ${partId} de la planilla?`)) {
      setParts(prev => prev.filter(p => p.partId !== partId));
    }
  };

  // Filter & Search Logic
  const filteredParts = useMemo(() => {
    return parts
      .map(part => {
        if (!omitCorrederas) return part;
        const nonCorrederas = part.holes.filter(h => h.type !== 'corredera' && !h.slot);
        const totalHolesPerPiece = nonCorrederas.reduce((s, h) => s + h.countPerPiece, 0);
        return {
          ...part,
          holes: nonCorrederas,
          totalHolesPerPiece,
          totalHolesAllPieces: totalHolesPerPiece * part.quantity,
        };
      })
      .filter(part => {
        // 1. Omit pieces without holes
        if (omitNoHoles && part.holes.length === 0) {
          return false;
        }

        // 2. Search term (partId or profile)
        const matchSearch =
          searchTerm === '' ||
          part.partId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.profile.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchSearch) return false;

        // 3. Piece type filter
        if (selectedPieceType !== 'all') {
          const cat = getPieceCategory(part.partId, part.profile);
          if (cat !== selectedPieceType) return false;
        }

        // 4. Profile / section filter
        if (selectedProfileFilter !== 'all' && part.profile !== selectedProfileFilter) {
          return false;
        }

        // 5. Diameter filter
        if (selectedDiameterFilter !== 'all') {
          if (selectedDiameterFilter === 'slots') {
            return part.holes.some(h => Boolean(h.slot) || h.type === 'corredera');
          }
          return part.holes.some(h => Math.abs(h.diameter - (selectedDiameterFilter as number)) < 0.05);
        }

        return true;
      });
  }, [parts, omitNoHoles, omitCorrederas, searchTerm, selectedPieceType, selectedProfileFilter, selectedDiameterFilter]);

  // Sorted parts
  const sortedParts = useMemo(() => {
    const list = [...filteredParts];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'partId') {
        comparison = a.partId.localeCompare(b.partId, undefined, { numeric: true });
      } else if (sortField === 'profile') {
        comparison = a.profile.localeCompare(b.profile, undefined, { numeric: true });
      } else if (sortField === 'quantity') {
        comparison = a.quantity - b.quantity;
      } else if (sortField === 'totalHolesPerPiece') {
        comparison = a.totalHolesPerPiece - b.totalHolesPerPiece;
      } else if (sortField === 'totalHolesAllPieces') {
        comparison = a.totalHolesAllPieces - b.totalHolesAllPieces;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [filteredParts, sortField, sortDirection]);

  // Filtered summaries (reflects active filters and omit toggle)
  const activeSummaries = useMemo(() => {
    return calculateSummaries(filteredParts);
  }, [filteredParts]);

  // Paginated parts
  const totalPages = Math.max(1, Math.ceil(sortedParts.length / pageSize));
  const paginatedParts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedParts.slice(start, start + pageSize);
  }, [sortedParts, currentPage, pageSize]);

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const excelRows: any[] = [];
    sortedParts.forEach(part => {
      if (part.holes.length === 0) {
        excelRows.push({
          'Marca / Pieza': part.partId,
          'Perfil': part.profile,
          'Cant. Piezas': part.quantity,
          'Diámetro (mm)': 'Sin perforaciones',
          'Tipo / Ranura': '-',
          'Agujeros por Pieza': 0,
          'Total Agujeros Lote': 0,
          'Subtotal Agujeros Pieza': 0,
          'Gran Total Pieza': 0,
        });
        return;
      }

      part.holes.forEach((hole, idx) => {
        excelRows.push({
          'Marca / Pieza': idx === 0 ? part.partId : '',
          'Perfil': idx === 0 ? part.profile : '',
          'Cant. Piezas': idx === 0 ? part.quantity : '',
          'Diámetro (mm)': `Ø ${hole.diameter.toFixed(1)}`,
          'Tipo / Ranura': hole.slot ? `Corredera ${hole.slot}` : 'Pasante',
          'Agujeros por Pieza': hole.countPerPiece,
          'Total Agujeros Lote': hole.countPerPiece * part.quantity,
          'Subtotal Agujeros Pieza': idx === 0 ? part.totalHolesPerPiece : '',
          'Gran Total Pieza': idx === 0 ? part.totalHolesAllPieces : '',
        });
      });
    });

    excelRows.push({
      'Marca / Pieza': 'TOTALES GENERALES',
      'Perfil': '',
      'Cant. Piezas': activeSummaries.totalPartsCount,
      'Diámetro (mm)': `${activeSummaries.diameterSummary.length} medidas`,
      'Tipo / Ranura': '',
      'Agujeros por Pieza': '',
      'Total Agujeros Lote': activeSummaries.totalHolesProduction,
      'Subtotal Agujeros Pieza': '',
      'Gran Total Pieza': activeSummaries.totalHolesProduction,
    });

    const ws1 = XLSX.utils.json_to_sheet(excelRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Planilla Perforaciones');

    const summaryRows = activeSummaries.diameterSummary.map(d => ({
      'Diámetro (mm)': `Ø ${d.diameter.toFixed(1)}`,
      'Total Agujeros a Perforar': d.totalHolesProduction,
      'Herramienta Sugerida': d.suggestedTool,
      'RPM Sugerido (Acero)': d.recommendedRpm,
      'Piezas que lo usan': d.participatingParts.length,
    }));
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Herramental por Diámetro');

    XLSX.writeFile(wb, `Planilla_Perforaciones_${Date.now()}.xlsx`);
  };

  // Export to CSV
  const handleExportCsv = () => {
    const csvContent = exportPartsToCsv(sortedParts);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Planilla_Perforaciones_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyTable = () => {
    const csvContent = exportPartsToCsv(sortedParts);
    navigator.clipboard.writeText(csvContent);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const sampleColumns = lastParseResult?.sampleRows?.[0] || ['Col 0', 'Col 1', 'Col 2', 'Col 3', 'Col 4'];
  const countNoHoles = parts.filter(p => p.holes.length === 0).length;
  const countCorrederas = useMemo(() => {
    return parts.reduce((sum, p) => {
      const pSlots = p.holes.filter(h => h.type === 'corredera' || Boolean(h.slot));
      return sum + pSlots.reduce((s, h) => s + (h.countPerPiece * p.quantity), 0);
    }, 0);
  }, [parts]);

  return (
    <div className="space-y-6">
      {/* Upload Zone & Action Buttons */}
      <div className={`border rounded-xl p-5 shadow-sm space-y-4 transition-colors ${
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}>
        {/* Upload Mode Selector & File List */}
        <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 border-b text-xs ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Modo de Carga:</span>
            <div className={`flex items-center p-1 rounded-lg border ${
              isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-950 border-slate-800'
            }`}>
              <button
                onClick={() => setUploadMode('append')}
                className={`px-3 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                  uploadMode === 'append'
                    ? isLight ? 'bg-blue-600 text-white shadow-xs' : 'bg-amber-500 text-slate-950 shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Añadir más archivos y sumar cantidades a la lista actual"
              >
                + Añadir a lo existente (Unificar)
              </button>
              <button
                onClick={() => setUploadMode('replace')}
                className={`px-3 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                  uploadMode === 'replace'
                    ? isLight ? 'bg-blue-600 text-white shadow-xs' : 'bg-amber-500 text-slate-950 shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Reemplazar todo con los nuevos archivos"
              >
                Reemplazar todo
              </button>
            </div>
          </div>

          {/* Loaded Files Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>Archivos en lote:</span>
            {loadedFiles.map((fn, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 rounded font-mono text-[11px] border flex items-center gap-1 ${
                  isLight ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <FileSpreadsheet className={`w-3 h-3 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
                {fn}
              </span>
            ))}
          </div>
        </div>

        {/* Dropzone & Buttons */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Dropzone Area with MULTIPLE file support */}
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer flex items-center justify-center gap-4 ${
              isDragging
                ? isLight ? 'border-blue-500 bg-blue-50/70' : 'border-amber-400 bg-amber-500/10'
                : isLight ? 'border-slate-300 hover:border-blue-500 bg-slate-50/80 hover:bg-blue-50/20' : 'border-slate-700 hover:border-amber-500/60 bg-slate-950/40 hover:bg-slate-950/80'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={e => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesUpload(e.target.files);
                }
              }}
              accept=".csv,.txt,.xlsx,.xls,.tsv"
              className="hidden"
            />

            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
              isLight ? 'bg-blue-100 border-blue-200 text-blue-600' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              <FolderPlus className="w-5 h-5" />
            </div>

            <div>
              <div className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                <span>Subir 1 o varios archivos CSV / Excel juntos</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                  isLight ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  Selección múltiple admitida
                </span>
              </div>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {uploadMode === 'append'
                  ? 'Los archivos nuevos se sumarán a la planilla actual (unifica marcas repetidas sumando cantidades).'
                  : 'Los archivos nuevos reemplazarán la planilla actual.'}
              </p>
            </div>
          </div>

          {/* Quick Paste & Manual Adjust Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPasteModal(true)}
              className={`px-3.5 py-2.5 rounded-lg font-medium text-xs flex items-center gap-2 transition-colors cursor-pointer border ${
                isLight 
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <ClipboardCopy className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
              <span>Pegar desde Excel (Ctrl+V)</span>
            </button>

            <button
              onClick={() => setShowColumnAdjuster(!showColumnAdjuster)}
              className={`px-3 py-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                showColumnAdjuster
                  ? isLight ? 'bg-blue-600 text-white font-bold border-blue-600' : 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                  : isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Ajustar qué columna corresponde a cada dato"
            >
              <Settings2 className="w-4 h-4" />
              <span>Mapear Columnas</span>
            </button>
          </div>
        </div>

        {/* Column Mapping Adjuster Drawer */}
        {showColumnAdjuster && (
          <div className="pt-4 border-t border-slate-800 bg-slate-950/60 p-4 rounded-xl border space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" />
                Mapeador Manual de Columnas
              </h4>
              <button
                onClick={handleApplyCustomMapping}
                className="text-xs font-bold px-3 py-1 rounded bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Aplicar Cambios
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Columna Pieza / Marca:</label>
                <select
                  value={colMapping.parte}
                  onChange={e => setColMapping(prev => ({ ...prev, parte: parseInt(e.target.value, 10) }))}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
                >
                  {sampleColumns.map((c, i) => (
                    <option key={i} value={i}>Columna {i + 1}: "{c}"</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Columna Perfil:</label>
                <select
                  value={colMapping.perfil}
                  onChange={e => setColMapping(prev => ({ ...prev, perfil: parseInt(e.target.value, 10) }))}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
                >
                  {sampleColumns.map((c, i) => (
                    <option key={i} value={i}>Columna {i + 1}: "{c}"</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Columna Cantidad:</label>
                <select
                  value={colMapping.cantPartes}
                  onChange={e => setColMapping(prev => ({ ...prev, cantPartes: parseInt(e.target.value, 10) }))}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
                >
                  {sampleColumns.map((c, i) => (
                    <option key={i} value={i}>Columna {i + 1}: "{c}"</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Columna Diámetro:</label>
                <select
                  value={colMapping.diametro}
                  onChange={e => setColMapping(prev => ({ ...prev, diametro: parseInt(e.target.value, 10) }))}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
                >
                  {sampleColumns.map((c, i) => (
                    <option key={i} value={i}>Columna {i + 1}: "{c}"</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Columna Agujeros:</label>
                <select
                  value={colMapping.agujerosPorParte}
                  onChange={e => setColMapping(prev => ({ ...prev, agujerosPorParte: parseInt(e.target.value, 10) }))}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
                >
                  {sampleColumns.map((c, i) => (
                    <option key={i} value={i}>Columna {i + 1}: "{c}"</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Production Summary Cards (Dynamically reflects filters and omit toggle) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border ${
          isLight ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className={`text-xs font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Total Piezas a Fabricar</div>
          <div className={`text-2xl sm:text-3xl font-black font-mono flex items-baseline gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {activeSummaries.totalPartsCount.toLocaleString()}
            <span className={`text-xs font-semibold font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>unidades</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            En {filteredParts.length} marcas {omitNoHoles && countNoHoles > 0 ? `(${countNoHoles} lisas omitidas)` : ''}
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${
          isLight 
            ? 'bg-blue-50/70 border-blue-200 shadow-sm text-blue-950' 
            : 'bg-slate-900 border-amber-500/30 bg-amber-500/[0.03]'
        }`}>
          <div className={`text-xs font-bold mb-1 flex items-center gap-1.5 ${isLight ? 'text-blue-800' : 'text-amber-400'}`}>
            <Wrench className="w-3.5 h-3.5" />
            GRAN TOTAL DE PERFORACIONES
          </div>
          <div className={`text-2xl sm:text-3xl font-black font-mono flex items-baseline gap-2 ${isLight ? 'text-blue-900' : 'text-amber-300'}`}>
            {activeSummaries.totalHolesProduction.toLocaleString()}
            <span className={`text-xs font-semibold font-sans ${isLight ? 'text-blue-700' : 'text-amber-400'}`}>agujeros</span>
          </div>
          <div className={`text-[11px] mt-1 ${isLight ? 'text-blue-800/70' : 'text-slate-400'}`}>
            Cubicación de producción activa
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${
          isLight ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className={`text-xs font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Diámetros Requeridos</div>
          <div className={`text-2xl sm:text-3xl font-black font-mono flex items-baseline gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {activeSummaries.diameterSummary.length}
            <span className={`text-xs font-semibold font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>medidas</span>
          </div>
          <div className={`text-[11px] mt-1 font-mono truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {activeSummaries.diameterSummary.map(d => `Ø${d.diameter}`).join(', ') || 'Sin perforaciones'}
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${
          isLight ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className={`text-xs font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Promedio por Pieza</div>
          <div className={`text-2xl sm:text-3xl font-black font-mono flex items-baseline gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {activeSummaries.totalPartsCount > 0 ? (activeSummaries.totalHolesProduction / activeSummaries.totalPartsCount).toFixed(1) : '0'}
            <span className={`text-xs font-semibold font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>agujeros / pza</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Densidad de mecanizado activo
          </div>
        </div>
      </div>

      {/* FILTERS & SEARCH CONTROL PANEL */}
      <div className={`border rounded-xl p-4 shadow-sm space-y-3 ${
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={`text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide ${
            isLight ? 'text-slate-800' : 'text-slate-200'
          }`}>
            <Filter className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
            Filtros y Búsqueda Avanzada
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* OMIT PIECES WITHOUT HOLES CHECKBOX */}
            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
              isLight 
                ? 'bg-slate-50 border-slate-300 hover:border-blue-400 text-slate-700' 
                : 'bg-slate-950 border-slate-800 hover:border-amber-500/40 text-slate-200'
            }`}>
              <input
                type="checkbox"
                checked={omitNoHoles}
                onChange={e => {
                  setOmitNoHoles(e.target.checked);
                  setCurrentPage(1);
                }}
                className={isLight ? 'accent-blue-600 w-4 h-4 rounded cursor-pointer' : 'accent-amber-400 w-4 h-4 rounded cursor-pointer'}
              />
              <span className="flex items-center gap-1.5">
                <EyeOff className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
                Omitir piezas sin perforación
                {countNoHoles > 0 && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    isLight ? 'bg-blue-100 text-blue-800' : 'bg-slate-800 text-amber-300'
                  }`}>
                    {countNoHoles} lisas
                  </span>
                )}
              </span>
            </label>

            {/* OMIT CORREDERAS (SLOTTED HOLES) CHECKBOX */}
            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
              isLight 
                ? 'bg-slate-50 border-slate-300 hover:border-purple-400 text-slate-700' 
                : 'bg-slate-950 border-slate-800 hover:border-purple-500/40 text-slate-200'
            }`}>
              <input
                type="checkbox"
                checked={omitCorrederas}
                onChange={e => {
                  setOmitCorrederas(e.target.checked);
                  setCurrentPage(1);
                }}
                className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-purple-600" />
                Omitir correderas
                {countCorrederas > 0 && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    isLight ? 'bg-purple-100 text-purple-800' : 'bg-slate-800 text-purple-300'
                  }`}>
                    {countCorrederas} u.
                  </span>
                )}
              </span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Free Search */}
          <div>
            <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Buscar por Pieza o Perfil:</label>
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
              <input
                type="text"
                placeholder="ej: A80000, LP70, PL6.4..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className={`w-full pl-8 pr-3 py-1.5 rounded-lg border font-mono ${
                  isLight 
                    ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white' 
                    : 'bg-slate-950 border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400'
                }`}
              />
            </div>
          </div>

          {/* 2. Filter by Piece Type */}
          <div>
            <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Tipo de Pieza:</label>
            <select
              value={selectedPieceType}
              onChange={e => {
                setSelectedPieceType(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg border ${
                isLight 
                  ? 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500' 
                  : 'bg-slate-950 border-slate-700 text-slate-200 focus:outline-none focus:border-amber-400'
              }`}
            >
              <option value="all">Todos los Tipos</option>
              <option value="PL">Planchuelas / Chapas (PL)</option>
              <option value="LP">Conformados (LP / PLP)</option>
              <option value="L">Ángulos (L)</option>
              <option value="VIGA">Vigas / Columnas (W, HI, IPE, CHS)</option>
              <option value="ACC">Arandelas y Accesorios (ARAND, TUERCA)</option>
              <option value="OTROS">Otros perfiles</option>
            </select>
          </div>

          {/* 3. Filter by Specific Profile / Section */}
          <div>
            <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Perfil / Sección:</label>
            <select
              value={selectedProfileFilter}
              onChange={e => {
                setSelectedProfileFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg border ${
                isLight 
                  ? 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500' 
                  : 'bg-slate-950 border-slate-700 text-slate-200 focus:outline-none focus:border-amber-400'
              }`}
            >
              <option value="all">Todos los Perfiles ({uniqueProfiles.length})</option>
              {uniqueProfiles.map(prof => (
                <option key={prof} value={prof}>
                  {prof}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Filter by Diameter */}
          <div>
            <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Diámetro de Broca / Punzón:</label>
            <select
              value={selectedDiameterFilter}
              onChange={e => {
                const val = e.target.value;
                setSelectedDiameterFilter(val === 'all' || val === 'slots' ? val : parseFloat(val));
                setCurrentPage(1);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg border ${
                isLight 
                  ? 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500' 
                  : 'bg-slate-950 border-slate-700 text-slate-200 focus:outline-none focus:border-amber-400'
              }`}
            >
              <option value="all">Todos los Diámetros</option>
              {diameterSummary.map(d => (
                <option key={d.diameter} value={d.diameter}>
                  Ø {d.diameter.toFixed(1)} mm ({d.totalHolesProduction.toLocaleString()} ag.)
                </option>
              ))}
              <option value="slots">Solo Correderas (Ranuradas)</option>
            </select>
          </div>
        </div>
      </div>

      {/* MAIN CONSOLIDATED METALLURGY TABLE */}
      <div className={`border rounded-xl p-5 shadow-sm space-y-4 ${
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}>
        {/* Table Title & Action Bar */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${
              isLight ? 'text-slate-900' : 'text-slate-100'
            }`}>
              <FileSpreadsheet className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
              Planilla Consolidada de Piezas, Diámetros y Perforaciones
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Mostrando {sortedParts.length} piezas resultantes (haz clic en las cabeceras para ordenar).
            </p>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTable}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                isLight 
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Copiar contenido de la tabla"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              {copySuccess ? '¡Copiado!' : 'Copiar'}
            </button>

            <button
              onClick={handleExportCsv}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                isLight 
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>

            <button
              onClick={handleExportExcel}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Descargar Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Master Table with Clickable Sort Headers */}
        <div className={`overflow-x-auto border rounded-lg ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`font-bold border-b text-[11px] uppercase tracking-wider select-none ${
                isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-300 border-slate-800'
              }`}>
                {/* Sortable: Marca / Pieza */}
                <th
                  onClick={() => handleSort('partId')}
                  className={`py-3 px-3 w-32 cursor-pointer transition-colors ${
                    isLight ? 'hover:text-blue-600' : 'hover:text-amber-400'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>Marca / Pieza</span>
                    {sortField === 'partId' ? (
                      sortDirection === 'asc' ? <ArrowUp className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} /> : <ArrowDown className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* Sortable: Perfil */}
                <th
                  onClick={() => handleSort('profile')}
                  className={`py-3 px-3 w-44 cursor-pointer transition-colors ${
                    isLight ? 'hover:text-blue-600' : 'hover:text-amber-400'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>Perfil / Sección</span>
                    {sortField === 'profile' ? (
                      sortDirection === 'asc' ? <ArrowUp className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} /> : <ArrowDown className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* Sortable: Cant. Piezas */}
                <th
                  onClick={() => handleSort('quantity')}
                  className={`py-3 px-3 text-center w-24 cursor-pointer transition-colors ${
                    isLight ? 'hover:text-blue-600' : 'hover:text-amber-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Cant.</span>
                    {sortField === 'quantity' ? (
                      sortDirection === 'asc' ? <ArrowUp className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} /> : <ArrowDown className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* Diámetros */}
                <th className="py-3 px-3">Diámetros de Perforación</th>

                {/* Sortable: Agujeros x Pieza */}
                <th
                  onClick={() => handleSort('totalHolesPerPiece')}
                  className={`py-3 px-3 text-right w-36 cursor-pointer transition-colors ${
                    isLight ? 'hover:text-blue-600' : 'hover:text-amber-400'
                  }`}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Agujeros x Pza</span>
                    {sortField === 'totalHolesPerPiece' ? (
                      sortDirection === 'asc' ? <ArrowUp className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} /> : <ArrowDown className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* Sortable: Total Agujeros Lote */}
                <th
                  onClick={() => handleSort('totalHolesAllPieces')}
                  className={`py-3 px-3 text-right w-44 cursor-pointer transition-colors ${
                    isLight ? 'hover:text-blue-600' : 'hover:text-amber-400'
                  }`}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Lote</span>
                    {sortField === 'totalHolesAllPieces' ? (
                      sortDirection === 'asc' ? <ArrowUp className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} /> : <ArrowDown className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>

                <th className="py-3 px-3 text-center w-16">Acción</th>
              </tr>
            </thead>
            <tbody className={`font-mono divide-y ${
              isLight ? 'divide-slate-200' : 'divide-slate-800/80'
            }`}>
              {paginatedParts.map(part => (
                <tr key={part.id} className={`transition-colors group ${
                  isLight ? 'hover:bg-blue-50/40' : 'hover:bg-slate-800/30'
                }`}>
                  {/* Marca / Pieza */}
                  <td className={`py-3.5 px-3 font-bold text-sm align-top ${
                    isLight ? 'text-blue-700' : 'text-amber-400'
                  }`}>
                    {part.partId}
                  </td>

                  {/* Perfil */}
                  <td className={`py-3.5 px-3 font-sans font-semibold align-top ${
                    isLight ? 'text-slate-800' : 'text-slate-300'
                  }`}>
                    {part.profile}
                  </td>

                  {/* Cant. Piezas */}
                  <td className="py-3.5 px-3 text-center align-top">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}>
                      <input
                        type="number"
                        min="1"
                        value={part.quantity}
                        onChange={e => handleUpdateQuantity(part.partId, parseInt(e.target.value, 10))}
                        className={`w-14 text-center font-bold bg-transparent focus:outline-none ${
                          isLight ? 'text-slate-900' : 'text-amber-300'
                        }`}
                      />
                      <span className="text-[10px] text-slate-500 font-sans">u.</span>
                    </div>
                  </td>

                  {/* Diámetros & Agujeros Breakdown */}
                  <td className="py-3.5 px-3 align-top">
                    {part.holes.length > 0 ? (
                      <div className="space-y-1.5">
                        {part.holes.map(hole => (
                          <div
                            key={hole.id}
                            className={`flex items-center justify-between px-2.5 py-1 rounded border text-xs ${
                              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800/80'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1 ${
                                  hole.slot
                                    ? isLight ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : Math.abs(hole.diameter - 14) < 0.1
                                    ? isLight ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    : Math.abs(hole.diameter - 17.5) < 0.1
                                    ? isLight ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : isLight ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                Ø {hole.diameter.toFixed(1)} mm
                                {hole.slot && (
                                  <span className={`text-[10px] font-sans font-normal ${isLight ? 'text-purple-700' : 'text-purple-200'}`}>
                                    (Corredera {hole.slot})
                                  </span>
                                )}
                              </span>

                              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                                <input
                                  type="number"
                                  min="0"
                                  value={hole.countPerPiece}
                                  onChange={e => handleUpdateHoleCount(part.partId, hole.id, parseInt(e.target.value, 10))}
                                  className={`w-10 px-1 py-0.5 rounded text-center font-bold border ${
                                    isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                                  }`}
                                />{' '}
                                <span className={`font-sans text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>agujeros/pza</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`font-sans text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                Lote:{' '}
                                <strong className={`font-mono text-xs ${isLight ? 'text-slate-900 font-bold' : 'text-slate-200'}`}>
                                  {(hole.countPerPiece * part.quantity).toLocaleString()}
                                </strong>
                              </span>
                              {part.holes.length > 1 && (
                                <button
                                  onClick={() => handleDeleteHole(part.partId, hole.id)}
                                  className="text-slate-600 hover:text-red-400 p-0.5 cursor-pointer"
                                  title="Eliminar diámetro"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        <button
                          onClick={() => handleAddHoleToPart(part.partId)}
                          className="text-[10px] text-amber-400 hover:text-amber-300 font-sans font-medium flex items-center gap-1 cursor-pointer pt-0.5"
                        >
                          <Plus className="w-3 h-3" /> Agregar otro diámetro
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">
                        Sin perforaciones especificadas
                      </span>
                    )}
                  </td>

                  {/* Agujeros x Pieza */}
                  <td className="py-3.5 px-3 text-right align-top">
                    <div className="text-sm font-bold text-slate-200">
                      {part.totalHolesPerPiece}{' '}
                      <span className="text-[10px] font-sans text-slate-400 font-normal">agujeros</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-sans">por cada pieza</div>
                  </td>

                  {/* Total Agujeros Lote */}
                  <td className="py-3.5 px-3 text-right align-top">
                    <div className="text-base font-black text-amber-300">
                      {part.totalHolesAllPieces.toLocaleString()}{' '}
                      <span className="text-[10px] font-sans text-amber-400/80 font-normal">perforaciones</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-sans">
                      ({part.quantity} piezas × {part.totalHolesPerPiece} ag.)
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-3 text-center align-top">
                    <button
                      onClick={() => handleDeletePart(part.partId)}
                      className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Eliminar pieza"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {sortedParts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-400">No se encontraron piezas con los filtros activos.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Intenta restablecer el buscador o desmarcar "Omitir piezas sin perforación".
                    </p>
                  </td>
                </tr>
              )}
            </tbody>

            {/* TOTALS FOOTER (Reflects filtered/omitted dataset) */}
            {sortedParts.length > 0 && (
              <tfoot>
                <tr className="bg-slate-950 border-t-2 border-amber-500/50 font-mono text-sm">
                  <td colSpan={2} className="py-4 px-3 font-black text-amber-400 font-sans tracking-wide">
                    TOTALES DE PRODUCCIÓN ({sortedParts.length} piezas listadas):
                  </td>
                  <td className="py-4 px-3 text-center font-black text-white text-base">
                    {activeSummaries.totalPartsCount.toLocaleString()} <span className="text-xs font-sans text-slate-400">u.</span>
                  </td>
                  <td className="py-4 px-3 font-sans text-xs text-slate-300">
                    <div className="flex flex-wrap gap-1.5">
                      {activeSummaries.diameterSummary.map(d => (
                        <span
                          key={d.diameter}
                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[11px]"
                        >
                          <strong>Ø{d.diameter}mm:</strong> {d.totalHolesProduction.toLocaleString()} ag.
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-3 text-right text-xs font-sans text-slate-400">
                    Gran Total:
                  </td>
                  <td className="py-4 px-3 text-right font-black text-amber-300 text-lg">
                    {activeSummaries.totalHolesProduction.toLocaleString()}{' '}
                    <span className="text-xs font-sans text-amber-400/80 font-semibold">agujeros</span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Filas por página:</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>Todas ({sortedParts.length})</option>
              </select>
              <span>
                Página {currentPage} de {totalPages} ({sortedParts.length} piezas en total)
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 bg-slate-950 border border-slate-800 rounded font-mono font-bold text-amber-400">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: PASTE FROM EXCEL OR TEXT */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ClipboardCopy className="w-5 h-5 text-amber-400" />
                Pegar Datos Directamente desde Excel o Archivo de Texto
              </h3>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-400 font-semibold">Acción al procesar:</span>
              <label className="flex items-center gap-1.5 text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="pasteMode"
                  checked={pasteMode === 'append'}
                  onChange={() => setPasteMode('append')}
                  className="accent-amber-400"
                />
                Sumar a las piezas existentes (+ Unificar)
              </label>
              <label className="flex items-center gap-1.5 text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="pasteMode"
                  checked={pasteMode === 'replace'}
                  onChange={() => setPasteMode('replace')}
                  className="accent-amber-400"
                />
                Reemplazar todo
              </label>
            </div>

            <textarea
              rows={8}
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
              placeholder={`Parte ,Perfil ,Cant. Partes,Diametro ,Agujeros por partes\nA80000 ,PL7.9*64 ,82 , ,\n , , , 17.5 , 2\nA80001 ,LP70*60*3.2 ,1 , ,\n , , , 14.0 , 4`}
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                Detecta tabulaciones, comas o puntos y comas automáticamente.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleProcessPastedText}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Procesar y Unificar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
