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
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PartRecord, DiameterSummary } from '../types';
import { parseMetallurgyCsv, exportPartsToCsv, ParseResult } from '../utils/csvParser';

interface CsvAnalyzerProps {
  parts: PartRecord[];
  setParts: React.Dispatch<React.SetStateAction<PartRecord[]>>;
  diameterSummary: DiameterSummary[];
  totalPartsCount: number;
  totalHolesProduction: number;
  onFileLoaded: (text: string, filename: string) => void;
  rawCsvText?: string;
}

export const CsvAnalyzer: React.FC<CsvAnalyzerProps> = ({
  parts,
  setParts,
  diameterSummary,
  totalPartsCount,
  totalHolesProduction,
  onFileLoaded,
  rawCsvText = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [showColumnAdjuster, setShowColumnAdjuster] = useState(false);
  const [lastParseResult, setLastParseResult] = useState<ParseResult | null>(null);

  // Search, Filter & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiameterFilter, setSelectedDiameterFilter] = useState<number | 'all' | 'slots' | 'no-holes'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

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

  // Robust file reader supporting both UTF-8 and ANSI / ISO-8859-1 (Latin-1)
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

  const handleFileUpload = async (file: File) => {
    try {
      const text = await readFileWithFallback(file);
      const parsed = parseMetallurgyCsv(text);
      setLastParseResult(parsed);
      setColMapping(parsed.detectedColumns);
      setDelimiterOverride(parsed.delimiterUsed);
      setCurrentPage(1);
      onFileLoaded(text, file.name);
    } catch (err) {
      console.error('Error procesando archivo:', err);
      alert('Hubo un error al leer el archivo. Intenta usar el botón "Pegar Texto de Excel" para copiar y pegar directamente.');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Process pasted text from Excel or CSV
  const handleProcessPastedText = () => {
    if (!pasteContent.trim()) return;
    const parsed = parseMetallurgyCsv(pasteContent);
    setLastParseResult(parsed);
    setColMapping(parsed.detectedColumns);
    setDelimiterOverride(parsed.delimiterUsed);
    setCurrentPage(1);
    onFileLoaded(pasteContent, 'datos_pegados.csv');
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

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const excelRows: any[] = [];
    parts.forEach(part => {
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
          'Tipo / Ranura': hole.slot ? `Coliso ${hole.slot}` : 'Pasante',
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
      'Cant. Piezas': totalPartsCount,
      'Diámetro (mm)': `${diameterSummary.length} medidas`,
      'Tipo / Ranura': '',
      'Agujeros por Pieza': '',
      'Total Agujeros Lote': totalHolesProduction,
      'Subtotal Agujeros Pieza': '',
      'Gran Total Pieza': totalHolesProduction,
    });

    const ws1 = XLSX.utils.json_to_sheet(excelRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Planilla Perforaciones');

    const summaryRows = diameterSummary.map(d => ({
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
    const csvContent = exportPartsToCsv(parts);
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
    const csvContent = exportPartsToCsv(parts);
    navigator.clipboard.writeText(csvContent);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Filter & Search Logic
  const filteredParts = useMemo(() => {
    return parts.filter(part => {
      const matchSearch =
        searchTerm === '' ||
        part.partId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.profile.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (selectedDiameterFilter === 'all') return true;
      if (selectedDiameterFilter === 'slots') {
        return part.holes.some(h => Boolean(h.slot) || h.type === 'coliso');
      }
      if (selectedDiameterFilter === 'no-holes') {
        return part.holes.length === 0;
      }
      return part.holes.some(h => Math.abs(h.diameter - selectedDiameterFilter) < 0.05);
    });
  }, [parts, searchTerm, selectedDiameterFilter]);

  // Paginated parts
  const totalPages = Math.max(1, Math.ceil(filteredParts.length / pageSize));
  const paginatedParts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredParts.slice(start, start + pageSize);
  }, [filteredParts, currentPage, pageSize]);

  const sampleColumns = lastParseResult?.sampleRows?.[0] || ['Col 0', 'Col 1', 'Col 2', 'Col 3', 'Col 4'];

  return (
    <div className="space-y-6">
      {/* Upload Zone & Action Buttons */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Dropzone Area */}
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
                ? 'border-amber-400 bg-amber-500/10'
                : 'border-slate-700 hover:border-amber-500/60 bg-slate-950/40 hover:bg-slate-950/80'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              accept=".csv,.txt,.xlsx,.xls,.tsv"
              className="hidden"
            />

            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Upload className="w-5 h-5" />
            </div>

            <div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Subir o arrastrar archivo CSV o Excel</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Coma o Punto y Coma
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Detecta automáticamente columnas de Pieza, Perfil, Cantidad, Diámetros y Agujeros por parte.
              </p>
            </div>
          </div>

          {/* Quick Paste & Manual Adjust Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPasteModal(true)}
              className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ClipboardCopy className="w-4 h-4 text-amber-400" />
              <span>Pegar desde Excel (Ctrl+V)</span>
            </button>

            <button
              onClick={() => setShowColumnAdjuster(!showColumnAdjuster)}
              className={`px-3 py-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                showColumnAdjuster
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
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
          <div className="mt-4 pt-4 border-t border-slate-800 bg-slate-950/60 p-4 rounded-xl border space-y-3">
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

      {/* KPI Production Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1">Total Piezas a Fabricar</div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono flex items-baseline gap-2">
            {totalPartsCount.toLocaleString()}
            <span className="text-xs font-semibold text-slate-400 font-sans">unidades</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            En {parts.length} marcas distintas
          </div>
        </div>

        <div className="bg-slate-900 border border-amber-500/30 bg-amber-500/[0.03] p-4 rounded-xl">
          <div className="text-xs text-amber-400 font-bold mb-1 flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            GRAN TOTAL DE PERFORACIONES
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono flex items-baseline gap-2">
            {totalHolesProduction.toLocaleString()}
            <span className="text-xs font-semibold text-amber-400 font-sans">agujeros</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Cubicación total para todo el lote
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1">Diámetros de Perforación</div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono flex items-baseline gap-2">
            {diameterSummary.length}
            <span className="text-xs font-semibold text-slate-400 font-sans">medidas</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono truncate">
            {diameterSummary.map(d => `Ø${d.diameter}`).join(', ') || 'Sin perforaciones'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1">Promedio por Pieza</div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono flex items-baseline gap-2">
            {totalPartsCount > 0 ? (totalHolesProduction / totalPartsCount).toFixed(1) : '0'}
            <span className="text-xs font-semibold text-slate-400 font-sans">agujeros / pza</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Densidad de taladrado/punzonado
          </div>
        </div>
      </div>

      {/* MAIN CONSOLIDATED METALLURGY TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        {/* Table Title, Filter & Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-400" />
              Planilla Consolidada de Piezas, Diámetros y Perforaciones
            </h3>
            <p className="text-xs text-slate-400">
              Mostrando {filteredParts.length} de {parts.length} piezas analizadas.
            </p>
          </div>

          {/* Search & Diameter Quick Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por Pieza (ej: A80000) o Perfil..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 w-52 sm:w-60 font-mono"
              />
            </div>

            {/* Quick Diameter Dropdown */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedDiameterFilter}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedDiameterFilter(val === 'all' || val === 'slots' || val === 'no-holes' ? val : parseFloat(val));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-400"
              >
                <option value="all">Todos los Diámetros</option>
                {diameterSummary.map(d => (
                  <option key={d.diameter} value={d.diameter}>
                    Solo Ø {d.diameter.toFixed(1)} mm ({d.totalHolesProduction.toLocaleString()} ag.)
                  </option>
                ))}
                <option value="slots">Solo Perforaciones Colisas (Ranuradas)</option>
                <option value="no-holes">Solo Piezas sin perforaciones</option>
              </select>
            </div>

            {/* Export Actions */}
            <button
              onClick={handleCopyTable}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
              title="Copiar contenido de la tabla"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              {copySuccess ? '¡Copiado!' : 'Copiar'}
            </button>

            <button
              onClick={handleExportCsv}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>

            <button
              onClick={handleExportExcel}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Descargar Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Master Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-300 font-bold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 w-32">Marca / Pieza</th>
                <th className="py-3 px-3 w-40">Perfil / Sección</th>
                <th className="py-3 px-3 text-center w-24">Cant. Piezas</th>
                <th className="py-3 px-3">Diámetros de Perforación</th>
                <th className="py-3 px-3 text-right w-36">Agujeros x Pieza</th>
                <th className="py-3 px-3 text-right w-44">Total Agujeros Lote</th>
                <th className="py-3 px-3 text-center w-16">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {paginatedParts.map(part => (
                <tr key={part.id} className="hover:bg-slate-800/30 transition-colors group">
                  {/* Marca / Pieza */}
                  <td className="py-3.5 px-3 font-bold text-amber-400 text-sm align-top">
                    {part.partId}
                  </td>

                  {/* Perfil */}
                  <td className="py-3.5 px-3 text-slate-300 font-sans font-semibold align-top">
                    {part.profile}
                  </td>

                  {/* Cant. Piezas */}
                  <td className="py-3.5 px-3 text-center align-top">
                    <div className="inline-flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      <input
                        type="number"
                        min="1"
                        value={part.quantity}
                        onChange={e => handleUpdateQuantity(part.partId, parseInt(e.target.value, 10))}
                        className="w-14 text-center font-bold text-amber-300 bg-transparent focus:outline-none"
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
                            className="flex items-center justify-between bg-slate-950/70 px-2.5 py-1 rounded border border-slate-800/80 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1 ${
                                  hole.slot
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : Math.abs(hole.diameter - 14) < 0.1
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    : Math.abs(hole.diameter - 17.5) < 0.1
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                Ø {hole.diameter.toFixed(1)} mm
                                {hole.slot && (
                                  <span className="text-[10px] font-sans font-normal text-purple-200">
                                    (Coliso {hole.slot})
                                  </span>
                                )}
                              </span>

                              <span className="text-slate-300">
                                <input
                                  type="number"
                                  min="0"
                                  value={hole.countPerPiece}
                                  onChange={e => handleUpdateHoleCount(part.partId, hole.id, parseInt(e.target.value, 10))}
                                  className="w-10 bg-slate-900 border border-slate-700 px-1 py-0.5 rounded text-center text-slate-100 font-bold"
                                />{' '}
                                <span className="text-slate-400 font-sans text-[11px]">agujeros/pza</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-sans text-[11px]">
                                Lote:{' '}
                                <strong className="text-slate-200 font-mono text-xs">
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

              {filteredParts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-400">No se encontraron piezas que coincidan con la búsqueda.</p>
                  </td>
                </tr>
              )}
            </tbody>

            {/* TOTALS FOOTER */}
            {parts.length > 0 && (
              <tfoot>
                <tr className="bg-slate-950 border-t-2 border-amber-500/50 font-mono text-sm">
                  <td colSpan={2} className="py-4 px-3 font-black text-amber-400 font-sans tracking-wide">
                    TOTALES GENERALES DE PRODUCCIÓN:
                  </td>
                  <td className="py-4 px-3 text-center font-black text-white text-base">
                    {totalPartsCount.toLocaleString()} <span className="text-xs font-sans text-slate-400">u.</span>
                  </td>
                  <td className="py-4 px-3 font-sans text-xs text-slate-300">
                    <div className="flex flex-wrap gap-1.5">
                      {diameterSummary.map(d => (
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
                    {totalHolesProduction.toLocaleString()}{' '}
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
                <option value={400}>Todas ({filteredParts.length})</option>
              </select>
              <span>
                Página {currentPage} de {totalPages} ({filteredParts.length} piezas en total)
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

            <p className="text-xs text-slate-400">
              Selecciona las celdas en tu Excel (o copia el texto del CSV/TXT), presiona <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">Ctrl + C</kbd> y pégalas aquí con <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">Ctrl + V</kbd>:
            </p>

            <textarea
              rows={8}
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
              placeholder={`Bulones por Parte ,VMC , , , Fecha 18.09.2026\nParte ,Perfil ,Cant. Partes,Diametro ,Agujeros por partes\nA80000 ,PL7.9*64 ,82 , ,\n , , , 17.5 , 2\nA80001 ,LP70*60*3.2 ,1 , ,\n , , , 14.0 , 4`}
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
                  Procesar y Generar Planilla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
