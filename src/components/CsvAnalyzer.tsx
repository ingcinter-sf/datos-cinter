import React, { useState, useRef, useMemo, useEffect } from 'react';
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
  ChevronDown,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  EyeOff,
  FolderPlus,
  BookOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { GerdauCatalogModal } from './GerdauCatalogModal';
import { PartRecord, DiameterSummary } from '../types';
import { 
  parseMetallurgyCsv, 
  exportPartsToCsv, 
  exportPartsToReimportableCsv, 
  ParseResult, 
  mergePartRecords, 
  calculateSummaries,
  getWProfileOptions
} from '../utils/csvParser';

interface CsvAnalyzerProps {
  parts: PartRecord[];
  setParts: React.Dispatch<React.SetStateAction<PartRecord[]>>;
  diameterSummary: DiameterSummary[];
  totalPartsCount: number;
  totalHolesProduction: number;
  onFileLoaded: (text: string, filename: string) => void;
  onMultipleFilesLoaded?: (filesData: { content: string; filename: string }[], mode: 'replace' | 'append') => void;
  onClearAll?: () => void;
  onLoadSample?: (type: 'vmc' | 'n29000') => void;
  rawCsvText?: string;
  loadedFiles?: string[];
  theme?: 'light' | 'dark';
}

type SortField = 'partId' | 'profile' | 'quantity' | 'totalHolesPerPiece' | 'totalHolesAllPieces';
type SortDirection = 'asc' | 'desc';

interface MultiSelectFilterProps {
  label: string;
  options: { id: string; label: string; count?: number }[];
  selected: string[] | null;
  onChange: (val: string[] | null) => void;
  isLight: boolean;
  searchable?: boolean;
  unit?: string;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  options,
  selected,
  onChange,
  isLight,
  searchable = false,
  unit = 'pzas'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const allSelected = selected === null || (options.length > 0 && selected.length === options.length);
  const noneSelected = selected !== null && selected.length === 0;
  const countSelected = selected === null ? options.length : selected.length;

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q));
  }, [options, query]);

  const handleToggle = (id: string) => {
    const current = selected === null ? options.map(o => o.id) : [...selected];
    const exists = current.includes(id);
    let next: string[];
    if (exists) {
      next = current.filter(item => item !== id);
    } else {
      next = [...current, id];
    }
    if (next.length === options.length) {
      onChange(null); // All selected
    } else {
      onChange(next);
    }
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleDeselectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Button summary text
  const getButtonText = () => {
    if (options.length === 0) return 'Sin opciones';
    if (allSelected) return `Todos (${options.length})`;
    if (noneSelected) return 'Ninguno seleccionado (0)';
    if (countSelected === 1) {
      const match = options.find(o => selected?.includes(o.id));
      return match ? match.label : '1 seleccionado';
    }
    if (countSelected === 2) {
      const matches = options.filter(o => selected?.includes(o.id));
      if (matches.length === 2) {
        return `${matches[0].id}, ${matches[1].id}`;
      }
    }
    return `${countSelected} de ${options.length} seleccionados`;
  };

  const isFiltered = !allSelected;

  return (
    <div className="relative" ref={containerRef}>
      <label className={`block font-semibold mb-1 text-xs flex items-center justify-between ${
        isLight ? 'text-slate-600' : 'text-slate-400'
      }`}>
        <span>{label}:</span>
        {isFiltered && (
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
            isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-950/80 text-amber-300'
          }`}>
            {countSelected}/{options.length}
          </span>
        )}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full px-2.5 py-1.5 rounded-lg border text-left flex items-center justify-between gap-1.5 transition-colors cursor-pointer text-xs ${
          isFiltered
            ? isLight
              ? 'bg-amber-50/70 border-amber-300 text-slate-900 shadow-xs'
              : 'bg-amber-950/30 border-amber-600/60 text-amber-200'
            : isLight
            ? 'bg-slate-50 border-slate-300 hover:border-blue-400 text-slate-900'
            : 'bg-slate-950 border-slate-700 hover:border-amber-400 text-slate-200'
        }`}
      >
        <span className="truncate font-medium">{getButtonText()}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-blue-600 dark:text-amber-400' : 'text-slate-400'}`} />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className={`absolute z-30 left-0 mt-1 w-72 sm:w-80 rounded-xl border shadow-xl p-2.5 space-y-2 backdrop-blur-md animate-in fade-in-50 duration-100 ${
          isLight
            ? 'bg-white/98 border-slate-300 text-slate-800 shadow-slate-300/50'
            : 'bg-slate-900/98 border-slate-700 text-slate-100 shadow-black/80'
        }`}>
          {/* Quick Actions (Todos / Ninguno) */}
          <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-800 text-[11px]">
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              {countSelected} de {options.length} activos
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSelectAll}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  isLight
                    ? 'hover:bg-blue-50 text-blue-700 hover:text-blue-900'
                    : 'hover:bg-slate-800 text-amber-300 hover:text-amber-200'
                }`}
              >
                Todos
              </button>
              <span className="text-slate-400">|</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  isLight
                    ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Ninguno
              </button>
            </div>
          </div>

          {/* Search box inside dropdown if many options */}
          {(searchable || options.length > 6) && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar opciones..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className={`w-full pl-7 pr-2 py-1 text-xs rounded-md border font-sans focus:outline-none ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                    : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-amber-400'
                }`}
              />
            </div>
          )}

          {/* Checkboxes List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400 italic">
                No se encontraron opciones
              </div>
            ) : (
              filteredOptions.map(opt => {
                const checked = selected === null || selected.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors select-none ${
                      checked
                        ? isLight
                          ? 'bg-blue-50/60 hover:bg-blue-100/70 text-slate-900'
                          : 'bg-amber-500/10 hover:bg-amber-500/20 text-slate-100'
                        : isLight
                        ? 'hover:bg-slate-100 text-slate-600'
                        : 'hover:bg-slate-800/60 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggle(opt.id)}
                        className={`w-3.5 h-3.5 rounded cursor-pointer ${
                          isLight ? 'accent-blue-600' : 'accent-amber-400'
                        }`}
                      />
                      <span className="truncate font-medium">{opt.label}</span>
                    </div>
                    {opt.count !== undefined && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 ${
                        checked
                          ? isLight ? 'bg-blue-100 text-blue-800' : 'bg-slate-800 text-amber-300'
                          : isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {opt.count.toLocaleString()} {unit}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const CsvAnalyzer: React.FC<CsvAnalyzerProps> = ({
  parts,
  setParts,
  diameterSummary,
  totalPartsCount,
  totalHolesProduction,
  onFileLoaded,
  onMultipleFilesLoaded,
  onClearAll,
  onLoadSample,
  rawCsvText = '',
  loadedFiles = [],
  theme = 'light',
}) => {
  const isLight = theme === 'light';
  const [isDragging, setIsDragging] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [pasteMode, setPasteMode] = useState<'replace' | 'append'>('replace');
  const [showColumnAdjuster, setShowColumnAdjuster] = useState(false);
  const [showGerdauModal, setShowGerdauModal] = useState(false);
  const [lastParseResult, setLastParseResult] = useState<ParseResult | null>(null);

  // New features requested by user:
  const [omitNoHoles, setOmitNoHoles] = useState(false); // "omitir piezas sin perforacion"
  const [omitCorrederas, setOmitCorrederas] = useState(false); // "a los agujeros colisos los llamaremos correderas y agregamos un casillero para omitir tambien"
  const [searchTerm, setSearchTerm] = useState('');
  // Multi-select checkbox filter states (null = all selected)
  const [selectedPieceTypes, setSelectedPieceTypes] = useState<string[] | null>(null);
  const [selectedProfiles, setSelectedProfiles] = useState<string[] | null>(null);
  const [selectedDiameters, setSelectedDiameters] = useState<string[] | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('partId');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Reset all filters to show everything (default view when adding/loading a file)
  const resetAllFilters = () => {
    setOmitNoHoles(false);
    setOmitCorrederas(false);
    setSearchTerm('');
    setSelectedPieceTypes(null);
    setSelectedProfiles(null);
    setSelectedDiameters(null);
    setSortField('partId');
    setSortDirection('asc');
    setCurrentPage(1);
  };

  // Automatically reset filters whenever a new file or batch of files is loaded or changed
  const prevLoadedFilesKey = useRef<string>('');
  useEffect(() => {
    const currentKey = loadedFiles.join('|');
    if (currentKey && currentKey !== prevLoadedFilesKey.current) {
      prevLoadedFilesKey.current = currentKey;
      resetAllFilters();
    }
  }, [loadedFiles]);

  // Upload mode: 'replace' by default (or 'append' if adding to existing)
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');

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

      resetAllFilters();
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

    resetAllFilters();
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

  // Update single thickness
  const handleUpdatePartThickness = (partId: string, newThickness: number) => {
    if (isNaN(newThickness) || newThickness <= 0) return;
    setParts(prev =>
      prev.map(p => {
        if (p.partId === partId) {
          const updatedHoles = p.holes.map(h => ({
            ...h,
            thickness: newThickness,
          }));
          return {
            ...p,
            thickness: newThickness,
            holes: updatedHoles,
          };
        }
        return p;
      })
    );
  };

  // Update dual thickness (web or flange) for built-up beams
  const handleUpdateDualThickness = (partId: string, side: 'web' | 'flange', newThickness: number) => {
    if (isNaN(newThickness) || newThickness <= 0) return;
    setParts(prev =>
      prev.map(p => {
        if (p.partId === partId) {
          const webThickness = side === 'web' ? newThickness : (p.webThickness || p.thickness);
          const flangeThickness = side === 'flange' ? newThickness : (p.flangeThickness || p.thickness);
          const updatedHoles = p.holes.map(h => {
            const loc = (h.location || '').toLowerCase();
            const isFlange = loc === 'alas' || loc === 'ala';
            const hThick = isFlange ? flangeThickness : webThickness;
            return {
              ...h,
              thickness: hThick,
            };
          });
          return {
            ...p,
            webThickness,
            flangeThickness,
            thickness: webThickness,
            holes: updatedHoles,
          };
        }
        return p;
      })
    );
  };

  // Select exact W profile variant from catalog (e.g. W150x13, W150x18, W150x29.8)
  const handleSelectWVariant = (partId: string, newProfile: string, web: number, flange: number) => {
    setParts(prev =>
      prev.map(p => {
        if (p.partId === partId) {
          const updatedHoles = p.holes.map(h => {
            const loc = (h.location || '').toLowerCase();
            const isFlange = loc === 'alas' || loc === 'ala';
            const hThick = isFlange ? flange : web;
            return {
              ...h,
              thickness: hThick,
            };
          });
          return {
            ...p,
            profile: newProfile,
            webThickness: web,
            flangeThickness: flange,
            thickness: web,
            isDualThickness: true,
            holes: updatedHoles,
          };
        }
        return p;
      })
    );
  };

  // Piece categories with exact item counts
  const pieceTypeOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    const ALL_CATS = [
      { id: 'PL', label: 'Planchuelas / Chapas (PL)' },
      { id: 'LP', label: 'Conformados (LP / PLP)' },
      { id: 'L', label: 'Ángulos (L)' },
      { id: 'VIGA', label: 'Vigas / Columnas (W, HI, IPE, CHS)' },
      { id: 'ACC', label: 'Arandelas y Accesorios (ARAND, TUERCA)' },
      { id: 'OTROS', label: 'Otros perfiles' },
    ];
    parts.forEach(p => {
      const cat = getPieceCategory(p.partId, p.profile);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return ALL_CATS.map(c => ({
      id: c.id,
      label: c.label,
      count: counts[c.id] || 0,
    })).filter(c => c.count > 0);
  }, [parts]);

  // Profiles list with piece counts
  const profileOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    parts.forEach(p => {
      const prof = p.profile || 'ESTÁNDAR';
      counts[prof] = (counts[prof] || 0) + 1;
    });
    return Object.keys(counts)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(prof => ({
        id: prof,
        label: prof,
        count: counts[prof],
      }));
  }, [parts]);

  // Count correderas in dataset
  const countCorrederas = useMemo(() => {
    return parts.reduce((sum, p) => {
      const pSlots = p.holes.filter(h => h.type === 'corredera' || Boolean(h.slot));
      return sum + pSlots.reduce((s, h) => s + (h.countPerPiece * p.quantity), 0);
    }, 0);
  }, [parts]);

  // Diameters list with holes production counts
  const diameterOptions = useMemo(() => {
    const list: { id: string; label: string; count: number }[] = [];
    diameterSummary.forEach(d => {
      list.push({
        id: d.diameter.toFixed(1),
        label: `Ø ${d.diameter.toFixed(1)} mm`,
        count: d.totalHolesProduction,
      });
    });
    if (countCorrederas > 0) {
      list.push({
        id: 'correderas',
        label: 'Correderas (Colisos / Ranuras)',
        count: countCorrederas,
      });
    }
    return list;
  }, [diameterSummary, countCorrederas]);

  // Is any filter currently applied?
  const isAnyFilterActive = useMemo(() => {
    return (
      omitNoHoles ||
      omitCorrederas ||
      searchTerm.trim().length > 0 ||
      selectedPieceTypes !== null ||
      selectedProfiles !== null ||
      selectedDiameters !== null
    );
  }, [omitNoHoles, omitCorrederas, searchTerm, selectedPieceTypes, selectedProfiles, selectedDiameters]);

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

        // 3. Piece type filter (checkboxes)
        if (selectedPieceTypes !== null) {
          const cat = getPieceCategory(part.partId, part.profile);
          if (!selectedPieceTypes.includes(cat)) return false;
        }

        // 4. Profile / section filter (checkboxes)
        if (selectedProfiles !== null) {
          if (!selectedProfiles.includes(part.profile)) return false;
        }

        // 5. Diameter filter (checkboxes)
        if (selectedDiameters !== null) {
          if (part.holes.length === 0) return false;
          const hasMatchingHole = part.holes.some(h => {
            if (selectedDiameters.includes('correderas') && (h.type === 'corredera' || Boolean(h.slot))) {
              return true;
            }
            const dKey = h.diameter.toFixed(1);
            return selectedDiameters.includes(dKey);
          });
          if (!hasMatchingHole) return false;
        }

        return true;
      });
  }, [parts, omitNoHoles, omitCorrederas, searchTerm, selectedPieceTypes, selectedProfiles, selectedDiameters]);

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

  // Export to CSV (Re-importable standard format so user can re-import and continue adding data later)
  const handleExportCsv = () => {
    if (sortedParts.length === 0) {
      alert('No hay piezas en la planilla para exportar.');
      return;
    }
    const csvContent = exportPartsToReimportableCsv(sortedParts, 'PLANILLA_PERFORACIONES');
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
            Análisis de producción activo
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

            {/* RESET / SHOW ALL BUTTON IF FILTERED */}
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={resetAllFilters}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border-amber-700/60'
                }`}
                title="Restablecer todos los filtros y volver a mostrar todo"
              >
                <RefreshCw className="w-3 h-3" />
                Mostrar todo
              </button>
            )}
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

          {/* 2. Filter by Piece Type (Multi-select Checkboxes) */}
          <MultiSelectFilter
            label="Tipo de Pieza"
            options={pieceTypeOptions}
            selected={selectedPieceTypes}
            onChange={val => {
              setSelectedPieceTypes(val);
              setCurrentPage(1);
            }}
            isLight={isLight}
            unit="pzas"
          />

          {/* 3. Filter by Specific Profile / Section (Multi-select Checkboxes with Search) */}
          <MultiSelectFilter
            label="Perfil / Sección"
            options={profileOptions}
            selected={selectedProfiles}
            onChange={val => {
              setSelectedProfiles(val);
              setCurrentPage(1);
            }}
            isLight={isLight}
            searchable={true}
            unit="pzas"
          />

          {/* 4. Filter by Diameter (Multi-select Checkboxes) */}
          <MultiSelectFilter
            label="Diámetro de Broca / Punzón"
            options={diameterOptions}
            selected={selectedDiameters}
            onChange={val => {
              setSelectedDiameters(val);
              setCurrentPage(1);
            }}
            isLight={isLight}
            unit="ag."
          />
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

          {/* Export & Manage Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {parts.length > 0 && onClearAll && (
              <button
                onClick={() => {
                  if (confirm('¿Vaciar toda la planilla para cargar un archivo nuevo desde cero?')) {
                    onClearAll();
                  }
                }}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                  isLight 
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200' 
                    : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-900'
                }`}
                title="Vaciar la planilla actual"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Vaciar
              </button>
            )}

            <button
              onClick={handleCopyTable}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                isLight 
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Copiar contenido de la tabla al portapapeles"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              {copySuccess ? '¡Copiado!' : 'Copiar'}
            </button>

            <button
              onClick={handleExportCsv}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                isLight 
                  ? 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-300' 
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
              }`}
              title="Guardar en CSV compatible para re-importar o seguir agregando datos luego"
            >
              <Download className="w-3.5 h-3.5" />
              Guardar CSV
            </button>

            <button
              onClick={handleExportExcel}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Descargar Excel (.xlsx)
            </button>

            <button
              onClick={() => setShowGerdauModal(true)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                isLight 
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300' 
                  : 'bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border-amber-700/70'
              }`}
              title="Abrir catálogo oficial de perfiles W y HP Gerdau (Marzo 2023) con medidas y equivalencias"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-500" />
              <span>Catálogo Gerdau W</span>
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
                    <div className="font-bold text-xs">{part.profile}</div>

                    {/* W Profile Quick Variant Selector */}
                    {(() => {
                      const wOptions = getWProfileOptions(part.profile);
                      if (wOptions.length === 0) return null;
                      const currentNorm = part.profile.toUpperCase().replace(/\s+/g, '').replace('*', 'X');
                      return (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <select
                            value={wOptions.some(o => o.id.toUpperCase() === currentNorm) ? currentNorm : ''}
                            onChange={e => {
                              const found = wOptions.find(o => o.id.toUpperCase() === e.target.value);
                              if (found) {
                                handleSelectWVariant(part.partId, found.id, found.web, found.flange);
                              }
                            }}
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border focus:outline-none cursor-pointer max-w-[210px] ${
                              isLight 
                                ? 'bg-amber-50/80 border-amber-300 text-slate-800 hover:border-amber-400' 
                                : 'bg-slate-900 border-amber-600/50 text-amber-200 hover:border-amber-400'
                            }`}
                            title="Seleccione la variante exacta de peso/metro según catálogo oficial Gerdau (Marzo 2023)"
                          >
                            <option value="">Variante Gerdau ({part.profile})</option>
                            {wOptions.map(opt => (
                              <option key={opt.id} value={opt.id.toUpperCase()}>
                                {opt.id} (Alma {opt.web} / Alas {opt.flange})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setShowGerdauModal(true)}
                            className="text-[9px] font-semibold text-amber-500 hover:underline cursor-pointer"
                            title="Ver catálogo técnico Gerdau MAR 23"
                          >
                            Ver Catálogo
                          </button>
                        </div>
                      );
                    })()}

                    {part.isDualThickness ? (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <div
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                            isLight ? 'bg-sky-50 text-sky-900 border-sky-300' : 'bg-sky-950/70 text-sky-200 border-sky-800'
                          }`}
                          title="Espesor de Alma en mm (editable)"
                        >
                          <span className="font-semibold text-[9px] uppercase">Alma:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="150"
                            value={part.webThickness || part.thickness}
                            onChange={e => handleUpdateDualThickness(part.partId, 'web', parseFloat(e.target.value))}
                            className="w-12 text-center font-bold bg-transparent focus:outline-none"
                          />
                          <span className="text-[9px] text-slate-400">mm</span>
                        </div>
                        <div
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                            isLight ? 'bg-indigo-50 text-indigo-900 border-indigo-300' : 'bg-indigo-950/70 text-indigo-200 border-indigo-800'
                          }`}
                          title="Espesor de Alas en mm (editable)"
                        >
                          <span className="font-semibold text-[9px] uppercase">Alas:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="150"
                            value={part.flangeThickness || part.thickness}
                            onChange={e => handleUpdateDualThickness(part.partId, 'flange', parseFloat(e.target.value))}
                            className="w-12 text-center font-bold bg-transparent focus:outline-none"
                          />
                          <span className="text-[9px] text-slate-400">mm</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-1">
                        <div
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                            isLight ? 'bg-slate-50 text-slate-700 border-slate-300' : 'bg-slate-950 text-slate-300 border-slate-800'
                          }`}
                          title="Espesor de la chapa o perfil en mm (editable con recálculo automático)"
                        >
                          <span className="font-semibold text-[9px] uppercase tracking-wider text-slate-500">Esp:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="250"
                            value={part.thickness}
                            onChange={e => handleUpdatePartThickness(part.partId, parseFloat(e.target.value))}
                            className="w-12 text-center font-bold bg-transparent focus:outline-none focus:text-blue-600 dark:focus:text-amber-400"
                          />
                          <span className="text-[9px] text-slate-400">mm</span>
                        </div>
                      </div>
                    )}
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
                            <div className="flex items-center gap-2 flex-wrap">
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

                              {/* Dual-thickness location badge (read-only informative tag) */}
                              {part.isDualThickness && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold border select-none ${
                                    hole.location === 'alas'
                                      ? isLight
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        : 'bg-indigo-950/60 text-indigo-300 border-indigo-700/60'
                                      : isLight
                                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                                      : 'bg-sky-950/60 text-sky-300 border-sky-700/60'
                                  }`}
                                  title={
                                    hole.location === 'alas'
                                      ? `Perforaciones en Alas (espesor ${hole.thickness || part.flangeThickness} mm)`
                                      : `Perforaciones en Alma (espesor ${hole.thickness || part.webThickness} mm)`
                                  }
                                >
                                  {hole.location === 'alas'
                                    ? `Alas (${hole.thickness || part.flangeThickness}mm)`
                                    : `Alma (${hole.thickness || part.webThickness}mm)`}
                                </span>
                              )}

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
                    <div className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                      {part.totalHolesPerPiece}{' '}
                      <span className={`text-[10px] font-sans font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>agujeros</span>
                    </div>
                    <div className={`text-[10px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>por cada pieza</div>
                    {part.isDualThickness && (
                      <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-800 text-[10px] font-sans space-y-0.5">
                        <div className={isLight ? 'text-sky-800' : 'text-sky-300'}>
                          Alma: <strong className="font-mono">{part.holes.filter(h => h.location !== 'alas').reduce((s, h) => s + h.countPerPiece, 0)}</strong>
                        </div>
                        <div className={isLight ? 'text-indigo-800' : 'text-indigo-300'}>
                          Alas: <strong className="font-mono">{part.holes.filter(h => h.location === 'alas').reduce((s, h) => s + h.countPerPiece, 0)}</strong>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Total Agujeros Lote */}
                  <td className="py-3.5 px-3 text-right align-top">
                    <div className={`text-base font-black ${isLight ? 'text-blue-700' : 'text-amber-300'}`}>
                      {part.totalHolesAllPieces.toLocaleString()}{' '}
                      <span className={`text-[10px] font-sans font-normal ${isLight ? 'text-blue-600/80' : 'text-amber-400/80'}`}>perforaciones</span>
                    </div>
                    <div className={`text-[10px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      ({part.quantity} pzas × {part.totalHolesPerPiece} ag.)
                    </div>
                    {part.isDualThickness && (
                      <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-800 text-[10px] font-sans space-y-0.5">
                        <div className={isLight ? 'text-sky-800' : 'text-sky-300'}>
                          Alma ({part.webThickness}mm): <strong className="font-mono">{(part.holes.filter(h => h.location !== 'alas').reduce((s, h) => s + h.countPerPiece, 0) * part.quantity).toLocaleString()}</strong>
                        </div>
                        <div className={isLight ? 'text-indigo-800' : 'text-indigo-300'}>
                          Alas ({part.flangeThickness}mm): <strong className="font-mono">{(part.holes.filter(h => h.location === 'alas').reduce((s, h) => s + h.countPerPiece, 0) * part.quantity).toLocaleString()}</strong>
                        </div>
                      </div>
                    )}
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

              {parts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center font-sans">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className={`w-12 h-12 rounded-xl mx-auto flex items-center justify-center border ${
                        isLight ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-800 border-slate-700 text-amber-400'
                      }`}>
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <h4 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        La planilla está lista para cargar
                      </h4>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Sube o arrastra tus archivos CSV, TXT o Excel en el panel superior para procesar las marcas, perforaciones y diámetros.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : sortedParts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-400">No se encontraron piezas con los filtros activos.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Intenta restablecer el buscador o desmarcar "Omitir piezas sin perforación".
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>

            {/* TOTALS FOOTER (Reflects filtered/omitted dataset) */}
            {sortedParts.length > 0 && (
              <tfoot>
                <tr className={`border-t-2 font-mono text-sm ${
                  isLight 
                    ? 'bg-blue-900 text-white border-blue-950' 
                    : 'bg-slate-950 border-amber-500/50 text-slate-100'
                }`}>
                  <td colSpan={2} className={`py-4 px-3 font-black font-sans tracking-wide ${
                    isLight ? 'text-blue-100' : 'text-amber-400'
                  }`}>
                    TOTALES DE PRODUCCIÓN ({sortedParts.length} piezas listadas):
                  </td>
                  <td className="py-4 px-3 text-center font-black text-white text-base">
                    {activeSummaries.totalPartsCount.toLocaleString()}{' '}
                    <span className={`text-xs font-sans ${isLight ? 'text-blue-200' : 'text-slate-400'}`}>u.</span>
                  </td>
                  <td className={`py-4 px-3 font-sans text-xs ${isLight ? 'text-blue-100' : 'text-slate-300'}`}>
                    <div className="flex flex-wrap gap-1.5">
                      {activeSummaries.diameterSummary.map(d => (
                        <span
                          key={d.diameter}
                          className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                            isLight 
                              ? 'bg-blue-800 border-blue-700 text-white' 
                              : 'bg-slate-900 border-slate-700 text-slate-200'
                          }`}
                        >
                          <strong>Ø{d.diameter}mm:</strong> {d.totalHolesProduction.toLocaleString()} ag.
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={`py-4 px-3 text-right text-xs font-sans ${isLight ? 'text-blue-200' : 'text-slate-400'}`}>
                    Gran Total:
                  </td>
                  <td className={`py-4 px-3 text-right font-black text-lg ${isLight ? 'text-amber-300' : 'text-amber-300'}`}>
                    {activeSummaries.totalHolesProduction.toLocaleString()}{' '}
                    <span className="text-xs font-sans text-amber-200 font-semibold">agujeros</span>
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

      {/* Official Gerdau Structural W & HP Catalog Modal (Marzo 2023) */}
      <GerdauCatalogModal
        isOpen={showGerdauModal}
        onClose={() => setShowGerdauModal(false)}
        isLight={isLight}
      />
    </div>
  );
};
