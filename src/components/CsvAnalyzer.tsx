import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  Search, 
  Plus, 
  Trash2, 
  Wrench, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PartRecord, DiameterSummary } from '../types';
import { parseMetallurgyCsv, exportPartsToCsv } from '../utils/csvParser';

interface CsvAnalyzerProps {
  parts: PartRecord[];
  setParts: React.Dispatch<React.SetStateAction<PartRecord[]>>;
  diameterSummary: DiameterSummary[];
  headerMetadata: string[];
  totalPartsCount: number;
  totalHolesProduction: number;
  onFileLoaded: (text: string, filename: string) => void;
}

export const CsvAnalyzer: React.FC<CsvAnalyzerProps> = ({
  parts,
  setParts,
  diameterSummary,
  headerMetadata,
  totalPartsCount,
  totalHolesProduction,
  onFileLoaded,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiameterFilter, setSelectedDiameterFilter] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Part Form State
  const [newPartId, setNewPartId] = useState('');
  const [newProfile, setNewProfile] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newHoles, setNewHoles] = useState<{ diameter: number; count: number }[]>([
    { diameter: 14, count: 2 },
  ]);

  // Handle file upload (CSV, TXT, XLSX)
  const handleFileUpload = async (file: File) => {
    try {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const csvContent = XLSX.utils.sheet_to_csv(sheet);
        onFileLoaded(csvContent, file.name);
      } else {
        const text = await file.text();
        onFileLoaded(text, file.name);
      }
    } catch (err) {
      console.error('Error leyendo archivo:', err);
      alert('Hubo un error al leer el archivo. Asegúrate de que sea un formato válido (CSV, TXT, Excel).');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Update part quantity
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

  // Add hole to existing part
  const handleAddHoleToPart = (partId: string) => {
    setParts(prev =>
      prev.map(p => {
        if (p.partId === partId) {
          const newHole = {
            id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            diameter: 14,
            countPerPiece: 1,
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

  // Remove hole from part
  const handleRemoveHole = (partId: string, holeId: string) => {
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

  // Update hole details
  const handleUpdateHole = (partId: string, holeId: string, field: 'diameter' | 'countPerPiece', value: number) => {
    setParts(prev =>
      prev.map(p => {
        if (p.partId === partId) {
          const updatedHoles = p.holes.map(h => {
            if (h.id === holeId) {
              return { ...h, [field]: value };
            }
            return h;
          });
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

  // Delete entire part
  const handleDeletePart = (partId: string) => {
    if (confirm(`¿Estás seguro de eliminar la pieza ${partId}?`)) {
      setParts(prev => prev.filter(p => p.partId !== partId));
    }
  };

  // Submit new part
  const handleCreatePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartId.trim()) return;

    const totalHolesPerPiece = newHoles.reduce((sum, h) => sum + h.count, 0);
    const newRecord: PartRecord = {
      id: `part-${newPartId}-${Date.now()}`,
      partId: newPartId.trim().toUpperCase(),
      profile: newProfile.trim().toUpperCase() || 'CC150',
      quantity: Math.max(1, newQuantity),
      holes: newHoles.map(h => ({
        id: `h-${h.diameter}-${Math.random().toString(36).slice(2, 6)}`,
        diameter: h.diameter,
        countPerPiece: h.count,
        type: 'pasante',
      })),
      totalHolesPerPiece,
      totalHolesAllPieces: totalHolesPerPiece * Math.max(1, newQuantity),
    };

    setParts(prev => [...prev, newRecord]);
    setNewPartId('');
    setNewProfile('');
    setNewQuantity(1);
    setNewHoles([{ diameter: 14, count: 2 }]);
    setShowAddPartModal(false);
  };

  // Export functions
  const handleExportCsv = () => {
    const csvContent = exportPartsToCsv(parts);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `perforaciones_metalurgica_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Piezas y Perforaciones
    const partsData: any[] = [];
    parts.forEach(part => {
      part.holes.forEach(hole => {
        partsData.push({
          'Parte / Marca': part.partId,
          'Perfil / Sección': part.profile,
          'Cant. Partes': part.quantity,
          'Diámetro (mm)': hole.diameter,
          'Agujeros por Pieza': hole.countPerPiece,
          'Total Agujeros Producción': hole.countPerPiece * part.quantity,
        });
      });
    });
    const ws1 = XLSX.utils.json_to_sheet(partsData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Detalle por Pieza');

    // Sheet 2: Resumen por Diámetro / Herramental
    const toolingData = diameterSummary.map(d => ({
      'Diámetro (mm)': d.diameter,
      'Total Agujeros Lote': d.totalHolesProduction,
      'Herramienta Sugerida': d.suggestedTool,
      'RPM Sugerido (Acero)': d.recommendedRpm,
      'Piezas Afectadas': d.participatingParts.join(', '),
    }));
    const ws2 = XLSX.utils.json_to_sheet(toolingData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen Herramental');

    XLSX.writeFile(wb, `resumen_perforaciones_${Date.now()}.xlsx`);
  };

  // Filter parts
  const filteredParts = parts.filter(part => {
    const matchesSearch =
      part.partId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.profile.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDiameter =
      selectedDiameterFilter === null ||
      part.holes.some(h => h.diameter === selectedDiameterFilter);

    return matchesSearch && matchesDiameter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Dropzone */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dropzone Card */}
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`lg:col-span-2 border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
            isDragging
              ? 'border-amber-400 bg-amber-500/10'
              : 'border-slate-700 hover:border-amber-500/60 bg-slate-900/60 hover:bg-slate-900'
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

          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform mb-3">
            <Upload className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-slate-100 mb-1">
            Arrastra tu archivo CSV, Planilla Excel o TXT aquí
          </h3>
          <p className="text-xs text-slate-400 max-w-md mb-3">
            Procesa de forma automática columnas de <strong className="text-slate-300">Parte, Perfil, Cant. Partes, Diámetro y Agujeros</strong> con relleno hacia abajo automático para filas de perforaciones secundarias.
          </p>

          <div className="flex items-center gap-2 text-[11px] text-amber-300/80 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Compatible con exportaciones de Tekla, Bocad, SDS/2, Ficep, Peddinghaus y Excel
          </div>
        </div>

        {/* File Header Metadata Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-300 font-bold text-sm mb-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Encabezado de Planilla</span>
            </div>
            {headerMetadata.length > 0 ? (
              <div className="space-y-1.5 text-xs text-slate-400 bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 font-mono">
                {headerMetadata.map((meta, idx) => (
                  <div key={idx} className="truncate text-slate-300">
                    {meta}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-lg">
                No se detectó cabecera secundaria o el archivo comienza directamente en la tabla.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setShowAddPartModal(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva Pieza
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                title="Exportar CSV limpio"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={handleExportExcel}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 transition-colors flex items-center gap-1 cursor-pointer"
                title="Exportar a Microsoft Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                Excel (.xlsx)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1">Piezas a Fabricar</div>
          <div className="text-2xl sm:text-3xl font-black text-white flex items-baseline gap-2">
            {totalPartsCount}
            <span className="text-xs font-semibold text-slate-400">unidades</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            En {parts.length} marcas distintas
          </div>
        </div>

        <div className="bg-slate-900 border border-amber-500/20 bg-amber-500/[0.02] p-4 rounded-xl">
          <div className="text-xs text-amber-400 font-medium mb-1 flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5" />
            Total Perforaciones
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300 flex items-baseline gap-2">
            {totalHolesProduction}
            <span className="text-xs font-semibold text-amber-400/80">agujeros</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Suma total requerida en taller
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1">Herramental / Diámetros</div>
          <div className="text-2xl sm:text-3xl font-black text-white flex items-baseline gap-2">
            {diameterSummary.length}
            <span className="text-xs font-semibold text-slate-400">medidas</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {diameterSummary.map(d => `Ø${d.diameter}`).join(', ') || 'Sin perforaciones'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1">Promedio por Pieza</div>
          <div className="text-2xl sm:text-3xl font-black text-white flex items-baseline gap-2">
            {totalPartsCount > 0 ? (totalHolesProduction / totalPartsCount).toFixed(1) : 0}
            <span className="text-xs font-semibold text-slate-400">perf / pza</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Densidad de mecanizado
          </div>
        </div>
      </div>

      {/* Tooling / Brocas Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Resumen de Producción por Diámetro de Perforación
              </h3>
              <p className="text-xs text-slate-400">
                Determina cuántos taladros/punzonados se ejecutarán con cada herramienta y sus parámetros sugeridos.
              </p>
            </div>
          </div>

          {selectedDiameterFilter !== null && (
            <button
              onClick={() => setSelectedDiameterFilter(null)}
              className="text-xs text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer"
            >
              Limpiar filtro de diámetro (Ø{selectedDiameterFilter}mm)
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Diámetro</th>
                <th className="py-2.5 px-3 text-right">Agujeros Totales (Lote)</th>
                <th className="py-2.5 px-3">Herramienta Sugerida</th>
                <th className="py-2.5 px-3 text-right">RPM Sugerido (Acero)</th>
                <th className="py-2.5 px-3">Piezas que lo usan</th>
                <th className="py-2.5 px-3 text-center">Filtro Rápido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {diameterSummary.map(item => {
                const isSelected = selectedDiameterFilter === item.diameter;
                return (
                  <tr
                    key={item.diameter}
                    className={`transition-colors ${
                      isSelected ? 'bg-amber-500/10 font-bold' : 'hover:bg-slate-800/40 text-slate-200'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 text-xs">
                        Ø {item.diameter.toFixed(1)} mm
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-sm font-black text-slate-100">
                      {item.totalHolesProduction}
                      <span className="text-[10px] font-normal text-slate-400 ml-1">agujeros</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-300">
                      {item.suggestedTool}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      ~{item.recommendedRpm} rpm
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <div className="flex flex-wrap gap-1">
                        {item.participatingParts.map(p => (
                          <span
                            key={p}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() =>
                          setSelectedDiameterFilter(isSelected ? null : item.diameter)
                        }
                        className={`px-2 py-1 rounded text-[11px] font-sans font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {isSelected ? 'Activo' : 'Ver Piezas'}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {diameterSummary.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
                    No se han cargado datos de perforaciones todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parts Breakdown & Detail */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        {/* Search & Filter Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Detalle por Pieza / Marca
            </h3>
            <p className="text-xs text-slate-400">
              Listado individual de piezas con desglose de agujeros y cálculo del total por lote.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por Marca o Perfil..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-amber-400 w-52 sm:w-64"
              />
            </div>
          </div>
        </div>

        {/* Parts Cards / Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredParts.map(part => (
            <div
              key={part.id}
              className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 transition-all"
            >
              {/* Part Header */}
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-amber-400 tracking-wide font-mono">
                      {part.partId}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {part.profile}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Total: <strong className="text-slate-200">{part.totalHolesPerPiece} agujeros</strong> por pieza
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Quantity Editor */}
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 font-medium">Cant. Partes</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        value={part.quantity}
                        onChange={e => handleUpdateQuantity(part.partId, parseInt(e.target.value, 10))}
                        className="w-16 px-2 py-1 text-xs font-bold text-center bg-slate-900 border border-slate-700 rounded text-amber-300 focus:outline-none focus:border-amber-400 font-mono"
                      />
                      <span className="text-[10px] text-slate-400">u.</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeletePart(part.partId)}
                    className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Eliminar pieza"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Holes List in this Part */}
              <div className="py-3 space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Perforaciones especificadas:</span>
                  <button
                    onClick={() => handleAddHoleToPart(part.partId)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Agregar diámetro
                  </button>
                </div>

                <div className="space-y-1.5">
                  {part.holes.map(hole => (
                    <div
                      key={hole.id}
                      className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-800 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Ø
                          <input
                            type="number"
                            step="0.5"
                            value={hole.diameter}
                            onChange={e =>
                              handleUpdateHole(part.partId, hole.id, 'diameter', parseFloat(e.target.value))
                            }
                            className="w-12 bg-transparent text-amber-300 font-bold ml-1 focus:outline-none focus:underline"
                          />
                          mm
                        </span>

                        <span className="text-slate-300">
                          <input
                            type="number"
                            min="1"
                            value={hole.countPerPiece}
                            onChange={e =>
                              handleUpdateHole(part.partId, hole.id, 'countPerPiece', parseInt(e.target.value, 10))
                            }
                            className="w-10 bg-slate-800 px-1.5 py-0.5 rounded text-center text-slate-200 border border-slate-700"
                          />{' '}
                          agujeros / pza
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-sans text-[11px]">
                          Lote ({part.quantity}u):{' '}
                          <strong className="text-slate-100 font-mono text-xs">
                            {hole.countPerPiece * part.quantity}
                          </strong>
                        </span>

                        {part.holes.length > 1 && (
                          <button
                            onClick={() => handleRemoveHole(part.partId, hole.id)}
                            className="text-slate-500 hover:text-red-400 p-0.5 cursor-pointer"
                            title="Quitar perforación"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Part Total Footer */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <span className="text-slate-400">Total en las {part.quantity} piezas:</span>
                <span className="font-mono font-black text-amber-300 text-sm">
                  {part.totalHolesAllPieces} perforaciones
                </span>
              </div>
            </div>
          ))}

          {filteredParts.length === 0 && (
            <div className="col-span-2 py-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-sm">No se encontraron piezas que coincidan con la búsqueda.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add New Part */}
      {showAddPartModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-400" />
              Agregar Nueva Pieza Manual
            </h3>

            <form onSubmit={handleCreatePart} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Identificador / Marca de Pieza (ej: N29005)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej: N29005"
                  value={newPartId}
                  onChange={e => setNewPartId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 font-mono uppercase focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Perfil / Sección
                  </label>
                  <input
                    type="text"
                    placeholder="ej: CC150-2-20*70"
                    value={newProfile}
                    onChange={e => setNewProfile(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Cantidad a Fabricar
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newQuantity}
                    onChange={e => setNewQuantity(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Holes in New Part */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Perforaciones por pieza
                </label>
                <div className="space-y-2">
                  {newHoles.map((h, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-400">Diámetro (mm):</span>
                        <input
                          type="number"
                          step="0.5"
                          value={h.diameter}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            setNewHoles(prev =>
                              prev.map((item, i) => (i === idx ? { ...item, diameter: val } : item))
                            );
                          }}
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 font-mono"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-400">Cantidad x pza:</span>
                        <input
                          type="number"
                          min="1"
                          value={h.count}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            setNewHoles(prev =>
                              prev.map((item, i) => (i === idx ? { ...item, count: val } : item))
                            );
                          }}
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setNewHoles(prev => [...prev, { diameter: 15, count: 4 }])}
                  className="mt-2 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar otro diámetro
                </button>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPartModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md cursor-pointer"
                >
                  Guardar Pieza
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
