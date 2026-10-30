import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  FileSpreadsheet, 
  Layers, 
  Wrench, 
  Ruler, 
  EyeOff, 
  Building2, 
  SlidersHorizontal,
  Edit2,
  Check,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PartRecord, DiameterSummary } from '../types';
import { buildThicknessMatrix, exportPartsToReimportableCsv, exportThicknessMatrixToCsv } from '../utils/csvParser';
import defaultLogo from '@/public/assets/aistudio/ImagotipoV_06__1__39317061.png';

interface ResumenPerforacionesReportProps {
  parts: PartRecord[];
  diameterSummary: DiameterSummary[];
  totalPartsCount: number;
  totalHolesProduction: number;
  headerMetadata: string[];
  obraTitle: string;
  theme?: 'light' | 'dark';
  onObraTitleChange?: (title: string) => void;
}

export const ResumenPerforacionesReport: React.FC<ResumenPerforacionesReportProps> = ({
  parts,
  totalPartsCount,
  obraTitle = 'VMC',
  theme = 'light',
  onObraTitleChange,
}) => {
  const [omitCorrederas, setOmitCorrederas] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(obraTitle);

  const logoSrc = typeof window !== 'undefined' ? (localStorage.getItem('cinter_custom_logo') || defaultLogo) : defaultLogo;

  const isLight = theme === 'light';

  // Build Thickness Matrix dynamically based on omitCorrederas toggle
  const matrixData = useMemo(() => {
    return buildThicknessMatrix(parts, omitCorrederas);
  }, [parts, omitCorrederas]);

  // Calculate total meters and holes by diameter
  const diameterTotals = useMemo(() => {
    const totals: {
      [diameter: number]: {
        holes: number;
        meters: number;
      };
    } = {};

    matrixData.uniqueDiameters.forEach(d => {
      totals[d] = { holes: 0, meters: 0 };
    });

    matrixData.matrixRows.forEach(row => {
      matrixData.uniqueDiameters.forEach(d => {
        const count = row.holesByDiameter[d] || 0;
        totals[d].holes += count;
        totals[d].meters += (count * row.thickness) / 1000;
      });
    });

    return totals;
  }, [matrixData]);

  // Count correderas in dataset
  const correderasSummary = useMemo(() => {
    const list: {
      partId: string;
      profile: string;
      thickness: number;
      diameter: number;
      slot: string;
      countPerPiece: number;
      totalCount: number;
      meters: number;
    }[] = [];

    parts.forEach(part => {
      part.holes.forEach(hole => {
        if (hole.type === 'corredera' || hole.slot) {
          const totalCount = hole.countPerPiece * part.quantity;
          const hostThickness = hole.thickness || part.thickness;
          const meters = (totalCount * hostThickness) / 1000;
          list.push({
            partId: part.partId,
            profile: part.profile,
            thickness: hostThickness,
            diameter: hole.diameter,
            slot: hole.slot || `${hole.diameter}x${hole.diameter * 2}`,
            countPerPiece: hole.countPerPiece,
            totalCount,
            meters: Math.round(meters * 100) / 100,
          });
        }
      });
    });

    const totalCorrederasCount = list.reduce((sum, c) => sum + c.totalCount, 0);
    const totalCorrederasMeters = list.reduce((sum, c) => sum + c.meters, 0);

    return { list, totalCorrederasCount, totalCorrederasMeters };
  }, [parts]);

  const handlePrint = () => {
    window.print();
  };

  const handleSaveTitle = () => {
    if (tempTitle.trim() && onObraTitleChange) {
      onObraTitleChange(tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  // Export Matrix to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Matrix Sheet
    const matrixRowsExport: any[] = [];
    matrixData.matrixRows.forEach(row => {
      const rowObj: any = {
        'Espesor de Chapa / Perfil (mm)': `${row.thickness.toFixed(1)} mm`,
      };

      matrixData.uniqueDiameters.forEach(d => {
        rowObj[`Ø ${d.toFixed(1)} mm`] = row.holesByDiameter[d] || 0;
      });

      rowObj['Total Agujeros Espesor'] = row.totalHolesInThickness;
      rowObj['Metros a Mecanizar (m)'] = row.totalMetersInThickness.toFixed(2);
      rowObj['Marcas / Piezas de este espesor'] = row.participatingParts.slice(0, 10).join(', ') + (row.participatingParts.length > 10 ? '...' : '');

      matrixRowsExport.push(rowObj);
    });

    // Totals Rows
    const totalHolesRow: any = {
      'Espesor de Chapa / Perfil (mm)': 'TOTAL AGUJEROS POR DIÁMETRO',
    };
    matrixData.uniqueDiameters.forEach(d => {
      totalHolesRow[`Ø ${d.toFixed(1)} mm`] = diameterTotals[d]?.holes || 0;
    });
    totalHolesRow['Total Agujeros Espesor'] = matrixData.grandTotalHoles;
    totalHolesRow['Metros a Mecanizar (m)'] = matrixData.grandTotalMeters.toFixed(2);
    matrixRowsExport.push(totalHolesRow);

    const totalMetersRow: any = {
      'Espesor de Chapa / Perfil (mm)': 'METROS A MECANIZAR POR DIÁMETRO (m)',
    };
    matrixData.uniqueDiameters.forEach(d => {
      totalMetersRow[`Ø ${d.toFixed(1)} mm`] = (diameterTotals[d]?.meters || 0).toFixed(2);
    });
    totalMetersRow['Total Agujeros Espesor'] = '-';
    totalMetersRow['Metros a Mecanizar (m)'] = matrixData.grandTotalMeters.toFixed(2);
    matrixRowsExport.push(totalMetersRow);

    const ws1 = XLSX.utils.json_to_sheet(matrixRowsExport);
    XLSX.utils.book_append_sheet(wb, ws1, `Resumen Espesores - ${obraTitle}`);

    // 2. Correderas Sheet
    if (!omitCorrederas && correderasSummary.list.length > 0) {
      const correderasRows = correderasSummary.list.map(c => ({
        'Marca / Pieza': c.partId,
        'Perfil': c.profile,
        'Espesor (mm)': c.thickness,
        'Diámetro Base': `Ø ${c.diameter.toFixed(1)}`,
        'Medidas Corredera': c.slot,
        'Correderas por Pieza': c.countPerPiece,
        'Total Correderas Lote': c.totalCount,
        'Metros Perforados (m)': c.meters.toFixed(2),
      }));
      const ws2 = XLSX.utils.json_to_sheet(correderasRows);
      XLSX.utils.book_append_sheet(wb, ws2, 'Detalle Correderas');
    }

    XLSX.writeFile(wb, `Resumen_Perforaciones_${obraTitle}_${Date.now()}.xlsx`);
  };

  // Export full parts and holes in re-importable metallurgy CSV format (to continue adding data later)
  const handleExportReimportableCsv = () => {
    if (parts.length === 0) {
      alert('No hay piezas cargadas para exportar.');
      return;
    }
    const csvContent = exportPartsToReimportableCsv(parts, obraTitle);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Planilla_${obraTitle.replace(/\s+/g, '_')}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Export thickness matrix as CSV
  const handleExportMatrixCsv = () => {
    const csvContent = exportThicknessMatrixToCsv(
      matrixData.matrixRows,
      matrixData.uniqueDiameters,
      diameterTotals,
      matrixData.grandTotalHoles,
      matrixData.grandTotalMeters,
      obraTitle
    );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Matriz_Espesores_${obraTitle.replace(/\s+/g, '_')}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const currentDate = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Top Action Bar (hidden when printing) */}
      <div className={`print:hidden rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border transition-colors ${
        isLight 
          ? 'bg-white border-slate-200 shadow-sm' 
          : 'bg-slate-900 border-slate-800 shadow-sm'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              <Building2 className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
              RESUMEN DE PERFORACIONES - OBRA:
              
              {isEditingTitle ? (
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                    autoFocus
                    className={`font-mono font-bold text-sm px-2 py-0.5 rounded border outline-none ${
                      isLight ? 'bg-blue-50 border-blue-400 text-blue-900' : 'bg-slate-950 border-amber-400 text-amber-300'
                    }`}
                  />
                  <button 
                    onClick={handleSaveTitle}
                    className={`p-1 rounded ${isLight ? 'bg-blue-600 text-white' : 'bg-amber-500 text-slate-950'}`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span 
                  onClick={() => {
                    setTempTitle(obraTitle);
                    setIsEditingTitle(true);
                  }}
                  className={`font-mono font-extrabold cursor-pointer group flex items-center gap-1 underline decoration-dotted decoration-blue-400 ${
                    isLight ? 'text-blue-700 hover:text-blue-900' : 'text-amber-400 hover:text-amber-300'
                  }`}
                  title="Clic para editar el nombre de la obra"
                >
                  {obraTitle}
                  <Edit2 className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                </span>
              )}
            </h3>

            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              isLight 
                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              CINTER · ANÁLISIS DE PERFORACIONES POR ESPESOR & METROS
            </span>
          </div>
          <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Matriz de perforaciones clasificada por espesor de chapa/perfil y cálculo de metros lineales a mecanizar de cada diámetro.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Checkbox Omitir Correderas */}
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
            isLight 
              ? 'bg-slate-50 border-slate-300 hover:border-blue-400 text-slate-700' 
              : 'bg-slate-950 border-slate-800 hover:border-amber-500/40 text-slate-200'
          }`}>
            <input
              type="checkbox"
              checked={omitCorrederas}
              onChange={e => setOmitCorrederas(e.target.checked)}
              className={isLight ? 'accent-blue-600 w-4 h-4 rounded cursor-pointer' : 'accent-amber-400 w-4 h-4 rounded cursor-pointer'}
            />
            <span className="flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5 text-purple-600" />
              Omitir correderas
              {correderasSummary.totalCorrederasCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  isLight ? 'bg-purple-100 text-purple-800' : 'bg-slate-800 text-purple-300'
                }`}>
                  {correderasSummary.totalCorrederasCount} u.
                </span>
              )}
            </span>
          </label>

          {/* Guardar en CSV (Re-importable para seguir agregando datos luego) */}
          <button
            onClick={handleExportReimportableCsv}
            className={`px-3.5 py-1.5 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer border ${
              isLight 
                ? 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-300' 
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
            }`}
            title="Descarga la planilla en formato CSV compatible para poder abrirlo o seguir agregándole datos y archivos después"
          >
            <Download className="w-4 h-4" />
            Guardar en CSV
          </button>

          <button
            onClick={handleExportMatrixCsv}
            className={`px-3 py-1.5 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 border cursor-pointer ${
              isLight 
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Descargar la matriz de espesores y diámetros como CSV"
          >
            <Download className="w-3.5 h-3.5" />
            CSV Matriz
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Descargar Excel
          </button>

          <button
            onClick={handlePrint}
            className={`px-3.5 py-1.5 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer ${
              isLight 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            <Printer className="w-4 h-4" />
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* KPI METRICS CARDS (Screen view) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
        <div className={`p-4 rounded-xl border ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className={`text-xs font-semibold mb-1 flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <Building2 className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
            Obra / Proyecto
          </div>
          <div className={`text-2xl font-black font-mono truncate ${isLight ? 'text-blue-700' : 'text-amber-400'}`}>
            {obraTitle}
          </div>
          <div className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
            {totalPartsCount.toLocaleString()} piezas totales
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className={`text-xs font-semibold mb-1 flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <Wrench className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
            Total Perforaciones
          </div>
          <div className={`text-2xl font-black font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {matrixData.grandTotalHoles.toLocaleString()}
          </div>
          <div className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {omitCorrederas ? 'Sin contar correderas' : 'Incluye todas las perforaciones'}
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${
          isLight 
            ? 'bg-blue-50/70 border-blue-200 shadow-sm' 
            : 'bg-slate-900 border-amber-500/30 bg-amber-500/[0.04]'
        }`}>
          <div className={`text-xs font-bold mb-1 flex items-center gap-1 ${isLight ? 'text-blue-800' : 'text-amber-400'}`}>
            <Ruler className="w-3.5 h-3.5" />
            METROS A MECANIZAR
          </div>
          <div className={`text-2xl sm:text-3xl font-black font-mono ${isLight ? 'text-blue-900' : 'text-amber-300'}`}>
            {matrixData.grandTotalMeters.toFixed(2)}{' '}
            <span className={`text-sm font-sans font-semibold ${isLight ? 'text-blue-700' : 'text-amber-400'}`}>m</span>
          </div>
          <div className={`text-[11px] mt-1 ${isLight ? 'text-blue-800/80' : 'text-slate-400'}`}>
            Longitud lineal acumulada
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className={`text-xs font-semibold mb-1 flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            Variedad de Espesores
          </div>
          <div className={`text-2xl font-black font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {matrixData.matrixRows.length}{' '}
            <span className={`text-xs font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>espesores</span>
          </div>
          <div className={`text-[11px] mt-1 font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {matrixData.matrixRows[0]?.thickness || 0} mm a {matrixData.matrixRows[matrixData.matrixRows.length - 1]?.thickness || 0} mm
          </div>
        </div>
      </div>

      {/* PRINTABLE REPORT SHEET: SIMPLIFIED, CRISP, LIGHT-THEME FOR SHOP FLOOR & PDF */}
      <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-lg max-w-6xl mx-auto border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-full font-sans">
        
        {/* Header Block with CINTER Official Logo & Obra Title */}
        <div className="border-b-2 border-blue-900 pb-4 mb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            {/* CINTER Logo */}
            <div className="h-14 w-auto flex items-center justify-center bg-white">
              <img 
                src={logoSrc} 
                alt="CINTER Logo" 
                className="h-12 w-auto object-contain"
              />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black uppercase tracking-tight text-blue-950 flex items-center gap-2">
                <span>RESUMEN DE PERFORACIONES</span>
              </div>
              <div className="text-sm font-black text-blue-700 tracking-wide font-mono">
                OBRA / PROYECTO: {obraTitle}
              </div>
              <div className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">
                Análisis de Perforaciones de Taladrado y Punzonado CNC por Espesor y Diámetro
              </div>
            </div>
          </div>

          {/* Metadata Badge Box */}
          <div className="text-right text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-0.5 print:bg-transparent print:border-none print:p-0">
            <div><strong>Fecha:</strong> {currentDate}</div>
            <div><strong>Total Piezas:</strong> {totalPartsCount.toLocaleString()} u.</div>
            <div><strong>Condición:</strong> {omitCorrederas ? 'Correderas Omitidas' : 'Pasantes + Correderas'}</div>
          </div>
        </div>

        {/* 1. MAIN MATRIX TABLE: THICKNESS (ROWS) vs DIAMETER (COLUMNS) */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-blue-700" />
              1. Matriz de Perforaciones: Espesores de Acero vs Diámetros de Herramienta
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">
              Valores en celdas: <strong>Cantidad de agujeros</strong>
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-300 rounded-md">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-blue-900 text-white font-bold uppercase text-[10px]">
                  <th className="p-2 border-r border-blue-800 w-32">
                    Espesor (mm)
                  </th>
                  {matrixData.uniqueDiameters.map(d => (
                    <th key={d} className="p-2 text-center border-r border-blue-800">
                      Ø {d.toFixed(1)}
                    </th>
                  ))}
                  <th className="p-2 text-right border-r border-blue-800 bg-blue-950/80 w-28">
                    Total Agujeros
                  </th>
                  <th className="p-2 text-right bg-blue-800 text-white font-black w-32">
                    Metros (m)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-xs">
                {matrixData.matrixRows.map((row, idx) => (
                  <tr key={row.thickness} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                    {/* Espesor Label */}
                    <td className="p-2 font-bold text-slate-900 border-r border-slate-300 bg-slate-100/70 font-sans">
                      <span className="font-mono text-xs font-black text-blue-900">{row.thickness.toFixed(1)}</span> mm
                      <span className="text-[10px] text-slate-500 block font-normal font-sans">
                        ({row.participatingParts.length} marcas)
                      </span>
                    </td>

                    {/* Holes count per diameter */}
                    {matrixData.uniqueDiameters.map(d => {
                      const count = row.holesByDiameter[d] || 0;
                      return (
                        <td
                          key={d}
                          className={`p-2 text-center border-r border-slate-200 ${
                            count > 0 ? 'font-bold text-slate-950' : 'text-slate-300'
                          }`}
                        >
                          {count > 0 ? count.toLocaleString() : '-'}
                        </td>
                      );
                    })}

                    {/* Row Total Holes */}
                    <td className="p-2 text-right font-bold text-slate-900 border-r border-slate-300 bg-slate-100/60">
                      {row.totalHolesInThickness.toLocaleString()}
                    </td>

                    {/* Row Total Meters */}
                    <td className="p-2 text-right font-black text-blue-800 bg-blue-50/60">
                      {row.totalMetersInThickness.toFixed(2)} m
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* FOOTER TOTALS */}
              <tfoot>
                {/* 1. Total Holes by Diameter */}
                <tr className="bg-slate-200 font-mono font-bold text-slate-950 border-t-2 border-slate-400">
                  <td className="p-2 uppercase font-sans text-[10px] font-black border-r border-slate-300">
                    Total Agujeros:
                  </td>
                  {matrixData.uniqueDiameters.map(d => (
                    <td key={d} className="p-2 text-center border-r border-slate-300 text-slate-950 font-black">
                      {(diameterTotals[d]?.holes || 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="p-2 text-right font-black border-r border-slate-300 bg-slate-300">
                    {matrixData.grandTotalHoles.toLocaleString()}
                  </td>
                  <td className="p-2 text-right font-black text-blue-900 bg-blue-100">
                    {matrixData.grandTotalMeters.toFixed(2)} m
                  </td>
                </tr>

                {/* 2. Total Meters to Machine by Diameter */}
                <tr className="bg-blue-100/90 font-mono font-black text-blue-950 border-t border-blue-200 text-xs">
                  <td className="p-2 uppercase font-sans text-[10px] font-black border-r border-blue-200 text-blue-900">
                    Metros a Mecanizar (m):
                  </td>
                  {matrixData.uniqueDiameters.map(d => (
                    <td key={d} className="p-2 text-center border-r border-blue-200 text-blue-900 font-bold">
                      {(diameterTotals[d]?.meters || 0).toFixed(2)} m
                    </td>
                  ))}
                  <td className="p-2 text-right border-r border-blue-200 font-sans text-[10px] text-blue-800">
                    GRAN TOTAL:
                  </td>
                  <td className="p-2 text-right font-black text-blue-950 text-xs bg-blue-200">
                    {matrixData.grandTotalMeters.toFixed(2)} m
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 2. DETAIL OF CORREDERAS (SLOTTED HOLES) */}
        {!omitCorrederas && correderasSummary.list.length > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-300 pb-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-purple-700" />
                2. Detalle de Correderas (Agujeros Ranurados)
              </h4>
              <span className="text-[11px] font-bold text-purple-800">
                Total: {correderasSummary.totalCorrederasCount.toLocaleString()} correderas | {correderasSummary.totalCorrederasMeters.toFixed(2)} metros a mecanizar
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-300 rounded-md">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-purple-900 text-white font-bold uppercase text-[10px]">
                    <th className="p-2 border-r border-purple-800">Marca / Pieza</th>
                    <th className="p-2 border-r border-purple-800">Perfil</th>
                    <th className="p-2 text-center border-r border-purple-800">Espesor</th>
                    <th className="p-2 text-center border-r border-purple-800">Diámetro Base</th>
                    <th className="p-2 text-center border-r border-purple-800">Dimensiones Corredera</th>
                    <th className="p-2 text-center border-r border-purple-800">Cant. x Pza</th>
                    <th className="p-2 text-right border-r border-purple-800">Total Correderas Lote</th>
                    <th className="p-2 text-right">Metros Lineales (m)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-xs">
                  {correderasSummary.list.map((c, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-purple-50/40'}>
                      <td className="p-2 font-bold text-slate-900 border-r border-slate-200">
                        {c.partId}
                      </td>
                      <td className="p-2 text-slate-800 border-r border-slate-200 font-sans">
                        {c.profile}
                      </td>
                      <td className="p-2 text-center border-r border-slate-200">
                        {c.thickness.toFixed(1)} mm
                      </td>
                      <td className="p-2 text-center border-r border-slate-200 font-bold text-slate-900">
                        Ø {c.diameter.toFixed(1)}
                      </td>
                      <td className="p-2 text-center border-r border-slate-200 font-bold text-purple-900 font-mono">
                        {c.slot}
                      </td>
                      <td className="p-2 text-center border-r border-slate-200">
                        {c.countPerPiece}
                      </td>
                      <td className="p-2 text-right font-black text-slate-900 border-r border-slate-200">
                        {c.totalCount.toLocaleString()}
                      </td>
                      <td className="p-2 text-right font-bold text-purple-900">
                        {c.meters.toFixed(2)} m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Note / Document Footer (No signature boxes as requested by user) */}
        <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-500 text-center flex flex-col sm:flex-row justify-between items-center gap-1">
          <span>CINTER S.A. · Documento de Análisis de Perforaciones emitido automáticamente · Obra: {obraTitle}</span>
          <span>Fecha de emisión: {currentDate}</span>
        </div>
      </div>
    </div>
  );
};
