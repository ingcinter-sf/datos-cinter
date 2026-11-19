import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Printer,
  FileSpreadsheet,
  Wrench,
  Ruler,
  CircleDot,
  Layers,
  EyeOff,
  CheckCircle2,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ObraProject } from '../types';
import defaultLogo from '@/public/assets/aistudio/ImagotipoV_06__1__39317061.png';

interface ResumenGlobalObrasProps {
  obras: ObraProject[];
  theme?: 'light' | 'dark';
  onBack: () => void;
}

interface ObraGlobalStats {
  obraId: string;
  name: string;
  status: 'en_curso' | 'terminada';
  logoDataUrl?: string;
  totalHoles: number;
  totalMeters: number;
  topDiameter: { diameter: number; count: number } | null;
  topThickness: { thickness: number; count: number } | null;
}

export const ResumenGlobalObras: React.FC<ResumenGlobalObrasProps> = ({
  obras,
  theme = 'light',
  onBack,
}) => {
  const isLight = theme === 'light';
  const [statusFilter, setStatusFilter] = useState<'all' | 'en_curso' | 'terminada'>('all');
  const [omitCorrederas, setOmitCorrederas] = useState(false);

  const logoSrc =
    typeof window !== 'undefined'
      ? localStorage.getItem('cinter_custom_logo') || defaultLogo
      : defaultLogo;

  const statusCounts = useMemo(() => {
    let enCurso = 0;
    let terminada = 0;
    for (const o of obras) {
      if (o.status === 'terminada') terminada += 1;
      else enCurso += 1;
    }
    return { all: obras.length, enCurso, terminada };
  }, [obras]);

  const filteredObras = useMemo(() => {
    const list = obras.filter((o) => {
      const st = o.status === 'terminada' ? 'terminada' : 'en_curso';
      if (statusFilter === 'en_curso') return st === 'en_curso';
      if (statusFilter === 'terminada') return st === 'terminada';
      return true;
    });
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [obras, statusFilter]);

  const summary = useMemo(() => {
    const globalDiameters = new Map<number, number>();
    const globalThicknesses = new Map<number, number>();
    let grandTotalHoles = 0;
    let grandTotalMeters = 0;

    const rows: ObraGlobalStats[] = filteredObras.map((obra) => {
      const diamMap = new Map<number, number>();
      const thickMap = new Map<number, number>();
      let obraHoles = 0;
      let obraMeters = 0;

      for (const part of obra.parts) {
        for (const hole of part.holes) {
          if (omitCorrederas && (hole.type === 'corredera' || hole.slot)) continue;

          const count = hole.countPerPiece * part.quantity;
          if (count <= 0) continue;

          const th = hole.thickness || part.thickness;
          const meters = (count * th) / 1000;

          obraHoles += count;
          obraMeters += meters;
          grandTotalHoles += count;
          grandTotalMeters += meters;

          diamMap.set(hole.diameter, (diamMap.get(hole.diameter) || 0) + count);
          thickMap.set(th, (thickMap.get(th) || 0) + count);

          globalDiameters.set(hole.diameter, (globalDiameters.get(hole.diameter) || 0) + count);
          globalThicknesses.set(th, (globalThicknesses.get(th) || 0) + count);
        }
      }

      let topDiameter: { diameter: number; count: number } | null = null;
      for (const [diameter, count] of diamMap.entries()) {
        if (!topDiameter || count > topDiameter.count) {
          topDiameter = { diameter, count };
        }
      }

      let topThickness: { thickness: number; count: number } | null = null;
      for (const [thickness, count] of thickMap.entries()) {
        if (!topThickness || count > topThickness.count) {
          topThickness = { thickness, count };
        }
      }

      return {
        obraId: obra.id,
        name: obra.name,
        status: obra.status === 'terminada' ? 'terminada' : 'en_curso',
        logoDataUrl: obra.logoDataUrl,
        totalHoles: obraHoles,
        totalMeters: Math.round(obraMeters * 100) / 100,
        topDiameter,
        topThickness,
      };
    });

    let globalTopDiameter: { diameter: number; count: number } | null = null;
    for (const [diameter, count] of globalDiameters.entries()) {
      if (!globalTopDiameter || count > globalTopDiameter.count) {
        globalTopDiameter = { diameter, count };
      }
    }

    let globalTopThickness: { thickness: number; count: number } | null = null;
    for (const [thickness, count] of globalThicknesses.entries()) {
      if (!globalTopThickness || count > globalTopThickness.count) {
        globalTopThickness = { thickness, count };
      }
    }

    return {
      rows,
      grandTotalHoles,
      grandTotalMeters: Math.round(grandTotalMeters * 100) / 100,
      globalTopDiameter,
      globalTopThickness,
    };
  }, [filteredObras, omitCorrederas]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const excelRows = summary.rows.map((r) => ({
      Obra: r.name,
      Estado: r.status === 'terminada' ? 'TERMINADA' : 'EN CURSO',
      'Total Perforaciones': r.totalHoles,
      'Metros Mecanizados (m)': Number(r.totalMeters.toFixed(2)),
      'Diámetro Más Usado': r.topDiameter ? `Ø ${r.topDiameter.diameter.toFixed(1)} mm` : '-',
      'Cant. Diámetro Más Usado': r.topDiameter ? r.topDiameter.count : 0,
      'Espesor Más Usado': r.topThickness ? `${r.topThickness.thickness.toFixed(1)} mm` : '-',
      'Cant. Espesor Más Usado': r.topThickness ? r.topThickness.count : 0,
    }));

    excelRows.push({
      Obra: `TOTAL GENERAL (${summary.rows.length} obras)`,
      Estado: statusFilter === 'all' ? 'TODAS' : statusFilter === 'en_curso' ? 'EN CURSO' : 'TERMINADAS',
      'Total Perforaciones': summary.grandTotalHoles,
      'Metros Mecanizados (m)': Number(summary.grandTotalMeters.toFixed(2)),
      'Diámetro Más Usado': summary.globalTopDiameter
        ? `Ø ${summary.globalTopDiameter.diameter.toFixed(1)} mm`
        : '-',
      'Cant. Diámetro Más Usado': summary.globalTopDiameter ? summary.globalTopDiameter.count : 0,
      'Espesor Más Usado': summary.globalTopThickness
        ? `${summary.globalTopThickness.thickness.toFixed(1)} mm`
        : '-',
      'Cant. Espesor Más Usado': summary.globalTopThickness ? summary.globalTopThickness.count : 0,
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen General Obras');
    XLSX.writeFile(wb, `Resumen_General_Obras_${Date.now()}.xlsx`);
  };

  const currentDate = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const filterLabel =
    statusFilter === 'all'
      ? 'Todas las obras'
      : statusFilter === 'en_curso'
      ? 'Solo obras EN CURSO'
      : 'Solo obras TERMINADAS';

  return (
    <div className="space-y-4">
      {/* Top Action Toolbar (hidden on print) */}
      <div
        className={`print:hidden rounded-xl px-4 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border transition-colors ${
          isLight
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-slate-900 border-slate-800 shadow-sm'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              isLight
                ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a Obras</span>
          </button>

          <div
            className={`flex items-center p-0.5 rounded-lg border text-xs ${
              isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-950 border-slate-800'
            }`}
          >
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                statusFilter === 'all'
                  ? isLight
                    ? 'bg-blue-600 text-white'
                    : 'bg-amber-500 text-slate-950'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Todas ({statusCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('en_curso')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                statusFilter === 'en_curso'
                  ? isLight
                    ? 'bg-blue-600 text-white'
                    : 'bg-amber-500 text-slate-950'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              En Curso ({statusCounts.enCurso})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('terminada')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                statusFilter === 'terminada'
                  ? isLight
                    ? 'bg-blue-600 text-white'
                    : 'bg-amber-500 text-slate-950'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Terminadas ({statusCounts.terminada})
            </button>
          </div>

          <label
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
              omitCorrederas
                ? isLight
                  ? 'bg-purple-50 border-purple-300 text-purple-900'
                  : 'bg-purple-500/15 border-purple-500/40 text-purple-200'
                : isLight
                ? 'bg-slate-50 border-slate-300 hover:border-blue-400 text-slate-700'
                : 'bg-slate-950 border-slate-800 hover:border-amber-500/40 text-slate-200'
            }`}
          >
            <input
              type="checkbox"
              checked={omitCorrederas}
              onChange={(e) => setOmitCorrederas(e.target.checked)}
              className={
                isLight
                  ? 'accent-purple-600 w-3.5 h-3.5 rounded cursor-pointer'
                  : 'accent-purple-400 w-3.5 h-3.5 rounded cursor-pointer'
              }
            />
            <span className="flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Omitir correderas
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={summary.rows.length === 0}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className={`px-3.5 py-1.5 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer ${
              isLight
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* PRINTABLE GLOBAL REPORT SHEET */}
      <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-lg max-w-5xl mx-auto border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-full font-sans [print-color-adjust:exact]">
        {/* Header */}
        <div className="border-b-2 border-blue-900 pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-auto flex items-center justify-center bg-white shrink-0">
              <img src={logoSrc} alt="CINTER Logo" className="h-12 w-auto object-contain" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-blue-950">
                RESUMEN GENERAL DE OBRAS
              </h2>
              <div className="text-xs sm:text-sm font-bold text-blue-700">
                Consolidado de Perforaciones, Metros Mecanizados y Medidas Predominantes
              </div>
            </div>
          </div>

          <div className="text-right text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-0.5 print:bg-transparent print:border-none print:p-0">
            <div>
              <strong>Fecha:</strong> {currentDate}
            </div>
            <div>
              <strong>Alcance:</strong> {filterLabel} ({summary.rows.length})
            </div>
            <div>
              <strong>Condición:</strong> {omitCorrederas ? 'Correderas Omitidas' : 'Pasantes + Correderas'}
            </div>
          </div>
        </div>

        {/* Consolidated 4 Core Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3 mb-6">
          <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50">
            <div className="text-[11px] font-bold uppercase text-slate-600 flex items-center gap-1.5 mb-1">
              <Wrench className="w-3.5 h-3.5 text-blue-700" />
              Total Perforaciones
            </div>
            <div className="text-2xl font-black font-mono text-slate-950">
              {summary.grandTotalHoles.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              En {summary.rows.length} {summary.rows.length === 1 ? 'obra' : 'obras'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-blue-300 bg-blue-50">
            <div className="text-[11px] font-bold uppercase text-blue-900 flex items-center gap-1.5 mb-1">
              <Ruler className="w-3.5 h-3.5 text-blue-700" />
              Metros Mecanizados
            </div>
            <div className="text-2xl font-black font-mono text-blue-950">
              {summary.grandTotalMeters.toFixed(2)}{' '}
              <span className="text-xs font-sans font-bold text-blue-800">m</span>
            </div>
            <div className="text-[11px] text-blue-800 mt-0.5">Total acumulado</div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50">
            <div className="text-[11px] font-bold uppercase text-slate-600 flex items-center gap-1.5 mb-1">
              <CircleDot className="w-3.5 h-3.5 text-blue-700" />
              Diámetro Más Usado
            </div>
            <div className="text-2xl font-black font-mono text-slate-950">
              {summary.globalTopDiameter
                ? `Ø ${summary.globalTopDiameter.diameter.toFixed(1)}`
                : '-'}
              {summary.globalTopDiameter && (
                <span className="text-xs font-sans font-semibold text-slate-600 ml-1">mm</span>
              )}
            </div>
            <div className="text-[11px] font-mono font-bold text-blue-800 mt-0.5">
              {summary.globalTopDiameter
                ? `${summary.globalTopDiameter.count.toLocaleString()} ag.`
                : 'Sin datos'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50">
            <div className="text-[11px] font-bold uppercase text-slate-600 flex items-center gap-1.5 mb-1">
              <Layers className="w-3.5 h-3.5 text-blue-700" />
              Espesor Más Usado
            </div>
            <div className="text-2xl font-black font-mono text-slate-950">
              {summary.globalTopThickness
                ? `${summary.globalTopThickness.thickness.toFixed(1)}`
                : '-'}
              {summary.globalTopThickness && (
                <span className="text-xs font-sans font-semibold text-slate-600 ml-1">mm</span>
              )}
            </div>
            <div className="text-[11px] font-mono font-bold text-blue-800 mt-0.5">
              {summary.globalTopThickness
                ? `${summary.globalTopThickness.count.toLocaleString()} ag.`
                : 'Sin datos'}
            </div>
          </div>
        </div>

        {/* Concise Per-Obra Table */}
        <div className="overflow-x-auto border border-slate-300 rounded-md">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-blue-900 text-white font-bold uppercase text-[10px]">
                <th className="p-2.5 border-r border-blue-800">Obra</th>
                <th className="p-2.5 text-center border-r border-blue-800 w-28">Estado</th>
                <th className="p-2.5 text-right border-r border-blue-800 w-36">Total Perforaciones</th>
                <th className="p-2.5 text-right border-r border-blue-800 w-36">Metros Mecanizados</th>
                <th className="p-2.5 text-center border-r border-blue-800">Diámetro Más Usado</th>
                <th className="p-2.5 text-center">Espesor Más Usado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-xs">
              {summary.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center font-sans text-slate-500 italic">
                    No hay obras que coincidan con el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                summary.rows.map((row, idx) => (
                  <tr key={row.obraId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                    <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200">
                      <div className="flex items-center gap-2">
                        {row.logoDataUrl && (
                          <img
                            src={row.logoDataUrl}
                            alt={row.name}
                            className="w-6 h-6 object-contain rounded border border-slate-200 bg-white p-0.5 shrink-0"
                          />
                        )}
                        <span className="font-mono font-black text-blue-950">{row.name}</span>
                      </div>
                    </td>
                    <td className="p-2.5 text-center border-r border-slate-200 font-sans">
                      {row.status === 'terminada' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase">
                          <CheckCircle2 className="w-3 h-3" />
                          Terminada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase">
                          <Clock className="w-3 h-3" />
                          En Curso
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-bold text-slate-900 border-r border-slate-200">
                      {row.totalHoles.toLocaleString()}
                    </td>
                    <td className="p-2.5 text-right font-black text-blue-900 border-r border-slate-200 bg-blue-50/40">
                      {row.totalMeters.toFixed(2)} m
                    </td>
                    <td className="p-2.5 text-center border-r border-slate-200">
                      {row.topDiameter ? (
                        <span>
                          <strong className="text-slate-950">Ø {row.topDiameter.diameter.toFixed(1)} mm</strong>{' '}
                          <span className="text-[11px] text-slate-600">
                            ({row.topDiameter.count.toLocaleString()} ag.)
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      {row.topThickness ? (
                        <span>
                          <strong className="text-slate-950">{row.topThickness.thickness.toFixed(1)} mm</strong>{' '}
                          <span className="text-[11px] text-slate-600">
                            ({row.topThickness.count.toLocaleString()} ag.)
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {summary.rows.length > 0 && (
              <tfoot>
                <tr className="bg-blue-100/90 font-mono font-black text-blue-950 border-t-2 border-blue-900 text-xs">
                  <td colSpan={2} className="p-2.5 uppercase font-sans text-[11px] font-black border-r border-blue-200">
                    TOTAL GENERAL ({summary.rows.length} {summary.rows.length === 1 ? 'obra' : 'obras'}):
                  </td>
                  <td className="p-2.5 text-right border-r border-blue-200">
                    {summary.grandTotalHoles.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-right border-r border-blue-200 bg-blue-200/80">
                    {summary.grandTotalMeters.toFixed(2)} m
                  </td>
                  <td className="p-2.5 text-center border-r border-blue-200">
                    {summary.globalTopDiameter ? (
                      <span>
                        Ø {summary.globalTopDiameter.diameter.toFixed(1)} mm{' '}
                        <span className="text-[11px] font-semibold">
                          ({summary.globalTopDiameter.count.toLocaleString()} ag.)
                        </span>
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="p-2.5 text-center">
                    {summary.globalTopThickness ? (
                      <span>
                        {summary.globalTopThickness.thickness.toFixed(1)} mm{' '}
                        <span className="text-[11px] font-semibold">
                          ({summary.globalTopThickness.count.toLocaleString()} ag.)
                        </span>
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-200 text-[10px] text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-1">
          <span>CINTER S.A. · Resumen General Consolidado de Obras</span>
          <span>Fecha de emisión: {currentDate}</span>
        </div>
      </div>
    </div>
  );
};
