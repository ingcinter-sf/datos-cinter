import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  FileSpreadsheet, 
  Layers, 
  Wrench, 
  Ruler, 
  EyeOff, 
  Building2, 
  SlidersHorizontal 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PartRecord, DiameterSummary } from '../types';
import { buildThicknessMatrix } from '../utils/csvParser';

interface ResumenPerforacionesReportProps {
  parts: PartRecord[];
  diameterSummary: DiameterSummary[];
  totalPartsCount: number;
  totalHolesProduction: number;
  headerMetadata: string[];
  obraTitle: string;
}

export const ResumenPerforacionesReport: React.FC<ResumenPerforacionesReportProps> = ({
  parts,
  diameterSummary: initialDiameterSummary,
  totalPartsCount,
  totalHolesProduction: initialTotalHoles,
  headerMetadata,
  obraTitle = 'VMC',
}) => {
  const [omitCorrederas, setOmitCorrederas] = useState(false);

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
          const meters = (totalCount * part.thickness) / 1000;
          list.push({
            partId: part.partId,
            profile: part.profile,
            thickness: part.thickness,
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
    if (correderasSummary.list.length > 0) {
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

  const currentDate = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Top Action Bar (hidden when printing) */}
      <div className="print:hidden bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              RESUMEN DE PERFORACIONES - OBRA: <span className="text-amber-400 font-mono">{obraTitle}</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              CUBICACIÓN POR ESPESOR & METROS
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Matriz de perforaciones clasificada por espesor de chapa/perfil y cálculo de metros lineales a mecanizar de cada diámetro.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Checkbox Omitir Correderas */}
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-xs font-semibold text-slate-200 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={omitCorrederas}
              onChange={e => setOmitCorrederas(e.target.checked)}
              className="accent-amber-400 w-4 h-4 rounded cursor-pointer"
            />
            <span className="flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5 text-purple-400" />
              Omitir correderas
              {correderasSummary.totalCorrederasCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-purple-300 font-mono">
                  {correderasSummary.totalCorrederasCount} u.
                </span>
              )}
            </span>
          </label>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Descargar Excel
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* KPI METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            Obra / Proyecto
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono truncate">
            {obraTitle}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {totalPartsCount.toLocaleString()} piezas totales
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            Total Perforaciones
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {matrixData.grandTotalHoles.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {omitCorrederas ? 'Sin contar correderas' : 'Incluye todas las perforaciones'}
          </div>
        </div>

        <div className="bg-slate-900 border border-amber-500/30 bg-amber-500/[0.04] p-4 rounded-xl">
          <div className="text-xs text-amber-400 font-bold mb-1 flex items-center gap-1">
            <Ruler className="w-3.5 h-3.5" />
            METROS A MECANIZAR
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
            {matrixData.grandTotalMeters.toFixed(2)}{' '}
            <span className="text-sm font-sans text-amber-400 font-semibold">metros</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Longitud lineal acumulada de taladrado
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Variedad de Espesores
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {matrixData.matrixRows.length}{' '}
            <span className="text-xs font-sans text-slate-400">espesores</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            Desde {matrixData.matrixRows[0]?.thickness || 0} mm hasta {matrixData.matrixRows[matrixData.matrixRows.length - 1]?.thickness || 0} mm
          </div>
        </div>
      </div>

      {/* PRINTABLE REPORT SHEET (White industrial format for high-contrast crisp print) */}
      <div className="bg-white text-slate-950 p-6 sm:p-8 rounded-2xl shadow-xl max-w-6xl mx-auto border border-slate-300 print:border-none print:shadow-none print:p-0 print:m-0 font-sans">
        {/* Header Block */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="text-2xl font-black uppercase tracking-tight text-slate-950 flex items-center gap-2">
                <span>RESUMEN DE PERFORACIONES</span>
                <span className="text-amber-600 font-mono font-black">- OBRA: {obraTitle}</span>
              </div>
              <div className="text-xs font-semibold text-slate-600 mt-1 uppercase tracking-wider">
                Cubicación Metalúrgica de Taladrado y Punzonado CNC por Espesor y Diámetro
              </div>
            </div>

            <div className="text-right text-xs space-y-0.5">
              <div><strong>Fecha:</strong> {currentDate}</div>
              <div><strong>Obra / Código:</strong> <span className="font-mono font-bold">{obraTitle}</span></div>
              <div><strong>Condición:</strong> {omitCorrederas ? 'Correderas Omitidas' : 'Completo (Pasantes + Correderas)'}</div>
            </div>
          </div>
        </div>

        {/* 1. MAIN MATRIX TABLE: THICKNESS (ROWS) vs DIAMETER (COLUMNS) */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-amber-600" />
              1. Matriz de Perforaciones: Espesores de Acero vs Diámetros de Herramienta
            </h4>
            <span className="text-[11px] text-slate-600">
              Valores en celdas: <strong>Cantidad de perforaciones</strong>
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-300 rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-300 uppercase text-[10px]">
                  <th className="p-2.5 border-r border-slate-300 w-36">
                    Espesor (mm)
                  </th>
                  {matrixData.uniqueDiameters.map(d => (
                    <th key={d} className="p-2.5 text-center border-r border-slate-300">
                      Ø {d.toFixed(1)} mm
                    </th>
                  ))}
                  <th className="p-2.5 text-right border-r border-slate-300 bg-slate-300/60 w-32">
                    Total Agujeros
                  </th>
                  <th className="p-2.5 text-right bg-amber-100 text-slate-950 font-black w-36">
                    Metros (m)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-xs">
                {matrixData.matrixRows.map((row, idx) => (
                  <tr key={row.thickness} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {/* Espesor Label */}
                    <td className="p-2.5 font-bold text-slate-950 border-r border-slate-300 bg-slate-100/60 font-sans">
                      <span className="font-mono text-sm font-black">{row.thickness.toFixed(1)}</span> mm
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
                          className={`p-2.5 text-center border-r border-slate-300 ${
                            count > 0 ? 'font-bold text-slate-950' : 'text-slate-300'
                          }`}
                        >
                          {count > 0 ? count.toLocaleString() : '-'}
                        </td>
                      );
                    })}

                    {/* Row Total Holes */}
                    <td className="p-2.5 text-right font-bold text-slate-900 border-r border-slate-300 bg-slate-100/40">
                      {row.totalHolesInThickness.toLocaleString()}
                    </td>

                    {/* Row Total Meters */}
                    <td className="p-2.5 text-right font-black text-amber-700 bg-amber-50">
                      {row.totalMetersInThickness.toFixed(2)} m
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* FOOTER TOTALS */}
              <tfoot>
                {/* 1. Total Holes by Diameter */}
                <tr className="bg-slate-200 font-mono font-bold text-slate-950 border-t-2 border-slate-400">
                  <td className="p-2.5 uppercase font-sans text-[11px] font-black border-r border-slate-300">
                    Total Agujeros:
                  </td>
                  {matrixData.uniqueDiameters.map(d => (
                    <td key={d} className="p-2.5 text-center border-r border-slate-300 text-slate-950 font-black">
                      {(diameterTotals[d]?.holes || 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="p-2.5 text-right font-black border-r border-slate-300 bg-slate-300">
                    {matrixData.grandTotalHoles.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-right font-black text-amber-800 bg-amber-200">
                    {matrixData.grandTotalMeters.toFixed(2)} m
                  </td>
                </tr>

                {/* 2. Total Meters to Machine by Diameter */}
                <tr className="bg-amber-100 font-mono font-black text-slate-950 border-t border-amber-300 text-xs">
                  <td className="p-2.5 uppercase font-sans text-[11px] font-black border-r border-slate-300 text-amber-900">
                    Metros a Mecanizar (m):
                  </td>
                  {matrixData.uniqueDiameters.map(d => (
                    <td key={d} className="p-2.5 text-center border-r border-slate-300 text-amber-900 font-bold">
                      {(diameterTotals[d]?.meters || 0).toFixed(2)} m
                    </td>
                  ))}
                  <td className="p-2.5 text-right border-r border-slate-300 font-sans text-[10px] text-slate-600">
                    GRAN TOTAL:
                  </td>
                  <td className="p-2.5 text-right font-black text-amber-900 text-sm bg-amber-300">
                    {matrixData.grandTotalMeters.toFixed(2)} m
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 2. DETAIL OF CORREDERAS (SLOTTED HOLES) */}
        {correderasSummary.list.length > 0 && (
          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-purple-600" />
                2. Detalle de Correderas (Agujeros Ranurados / Colisos)
              </h4>
              <span className="text-[11px] font-bold text-purple-700">
                Total: {correderasSummary.totalCorrederasCount} correderas | {correderasSummary.totalCorrederasMeters.toFixed(2)} metros a mecanizar
              </span>
            </div>

            <table className="w-full text-left text-xs border border-slate-300">
              <thead>
                <tr className="bg-purple-100 text-purple-950 font-bold border-b border-slate-300 uppercase text-[10px]">
                  <th className="p-2 border-r border-slate-300">Marca / Pieza</th>
                  <th className="p-2 border-r border-slate-300">Perfil</th>
                  <th className="p-2 text-center border-r border-slate-300">Espesor</th>
                  <th className="p-2 text-center border-r border-slate-300">Diámetro Base</th>
                  <th className="p-2 text-center border-r border-slate-300">Dimensiones Corredera</th>
                  <th className="p-2 text-center border-r border-slate-300">Cant. x Pieza</th>
                  <th className="p-2 text-right border-r border-slate-300">Total Correderas Lote</th>
                  <th className="p-2 text-right">Metros Lineales (m)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-xs">
                {correderasSummary.list.map((c, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-purple-50/50'}>
                    <td className="p-2 font-bold text-slate-950 border-r border-slate-300">
                      {c.partId}
                    </td>
                    <td className="p-2 text-slate-800 border-r border-slate-300 font-sans">
                      {c.profile}
                    </td>
                    <td className="p-2 text-center border-r border-slate-300">
                      {c.thickness.toFixed(1)} mm
                    </td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold text-slate-900">
                      Ø {c.diameter.toFixed(1)} mm
                    </td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold text-purple-800">
                      {c.slot}
                    </td>
                    <td className="p-2 text-center border-r border-slate-300">
                      {c.countPerPiece}
                    </td>
                    <td className="p-2 text-right font-black text-slate-900 border-r border-slate-300">
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
        )}

        {/* 3. SIGNATURES & QUALITY CONTROL */}
        <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-3 gap-6 text-xs mt-6">
          <div className="border border-slate-300 rounded p-3 text-center">
            <div className="font-bold text-slate-700 uppercase text-[10px] mb-8">
              Jefe de Oficina Técnica / Ingeniería
            </div>
            <div className="border-t border-dashed border-slate-400 pt-1 text-slate-500 text-[10px]">
              Firma y Emisión
            </div>
          </div>

          <div className="border border-slate-300 rounded p-3 text-center">
            <div className="font-bold text-slate-700 uppercase text-[10px] mb-8">
              Supervisor de Mecanizado / CNC
            </div>
            <div className="border-t border-dashed border-slate-400 pt-1 text-slate-500 text-[10px]">
              Firma Recepción de Taller
            </div>
          </div>

          <div className="border border-slate-300 rounded p-3 text-center">
            <div className="font-bold text-slate-700 uppercase text-[10px] mb-8">
              Control de Calidad (QC)
            </div>
            <div className="border-t border-dashed border-slate-400 pt-1 text-slate-500 text-[10px]">
              Verificación de Diámetros y Galgas
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-[10px] text-slate-500 text-center flex justify-between">
          <span>Resumen de Perforaciones emitido automáticamente - Obra: {obraTitle}</span>
          <span>Página 1 de 1</span>
        </div>
      </div>
    </div>
  );
};
