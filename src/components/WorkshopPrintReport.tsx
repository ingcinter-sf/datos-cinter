import React from 'react';
import { Printer, Download, CheckSquare, Layers, Wrench, ShieldCheck } from 'lucide-react';
import { PartRecord, DiameterSummary } from '../types';
import defaultLogo from '@/public/assets/aistudio/ImagotipoV_06__1__39317061.png';

interface WorkshopPrintReportProps {
  parts: PartRecord[];
  diameterSummary: DiameterSummary[];
  totalPartsCount: number;
  totalHolesProduction: number;
  headerMetadata: string[];
}

export const WorkshopPrintReport: React.FC<WorkshopPrintReportProps> = ({
  parts,
  diameterSummary,
  totalPartsCount,
  totalHolesProduction,
  headerMetadata,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const logoSrc = typeof window !== 'undefined' ? (localStorage.getItem('cinter_custom_logo') || defaultLogo) : defaultLogo;

  return (
    <div className="space-y-6">
      {/* Top Action Bar (hidden when printing) */}
      <div className="print:hidden bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Printer className="w-4 h-4 text-amber-400" />
            Hoja de Ruta y Orden de Perforado para Taller
          </h3>
          <p className="text-xs text-slate-400">
            Formato normalizado listo para imprimir o guardar como PDF para entregar a los operarios de máquina.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-md cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Imprimir / Guardar como PDF
        </button>
      </div>

      {/* Printable Sheet (White paper theme for clean print) */}
      <div className="bg-white text-slate-900 p-8 sm:p-10 rounded-2xl shadow-xl max-w-4xl mx-auto border border-slate-300 print:border-none print:shadow-none print:p-0 print:m-0 font-sans">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-5 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img 
                src={logoSrc} 
                alt="CINTER Logo" 
                className="h-12 w-auto object-contain"
              />
              <div>
                <div className="text-xl font-black uppercase tracking-tight text-slate-950">
                  CINTER <span className="text-blue-600">- Fábrica</span>
                </div>
                <div className="text-xs font-semibold text-slate-600 mt-0.5 uppercase tracking-wider">
                  Orden de Fabricación - Hoja de Perforado y Punzonado CNC
                </div>
              </div>
            </div>

            <div className="text-right text-xs space-y-0.5">
              <div><strong>Fecha de Emisión:</strong> {currentDate}</div>
              <div><strong>Estado:</strong> LISTO PARA PRODUCCIÓN</div>
            </div>
          </div>

          {headerMetadata.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] text-slate-700 font-mono">
              <strong>Referencia del Plano / Archivo:</strong> {headerMetadata.join(' | ')}
            </div>
          )}
        </div>

        {/* General Production Metrics Box */}
        <div className="grid grid-cols-4 gap-4 p-4 rounded-lg bg-slate-100 border border-slate-300 mb-6 text-center">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">Total Piezas</div>
            <div className="text-2xl font-black text-slate-900">{totalPartsCount} u.</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">Total Perforaciones</div>
            <div className="text-2xl font-black text-amber-700">{totalHolesProduction}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">Marcas Distintas</div>
            <div className="text-2xl font-black text-slate-900">{parts.length}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">Diámetros Requeridos</div>
            <div className="text-base font-black text-slate-900 mt-1">
              {diameterSummary.map(d => `Ø${d.diameter}`).join(', ') || '-'}
            </div>
          </div>
        </div>

        {/* Required Tooling Checklist */}
        <div className="mb-6">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1">
            <Wrench className="w-3.5 h-3.5 text-amber-600" />
            1. Herramental a Preparar en Carro de Taller
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {diameterSummary.map(d => (
              <div
                key={d.diameter}
                className="border border-slate-300 p-2.5 rounded bg-slate-50 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm">Ø {d.diameter.toFixed(1)} mm</div>
                  <div className="text-[10px] text-slate-600">{d.suggestedTool}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-slate-900">{d.totalHolesProduction}</div>
                  <div className="text-[9px] text-slate-500 uppercase">agujeros</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Parts Table */}
        <div className="mb-8">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1">
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            2. Detalle de Piezas y Agujeros a Ejecutar
          </h4>

          <table className="w-full text-left text-xs border border-slate-300">
            <thead>
              <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300 uppercase text-[10px]">
                <th className="p-2 border-r border-slate-300">Marca / Pieza</th>
                <th className="p-2 border-r border-slate-300">Perfil</th>
                <th className="p-2 text-center border-r border-slate-300">Cant.</th>
                <th className="p-2 border-r border-slate-300">Detalle de Agujeros / Pieza</th>
                <th className="p-2 text-right border-r border-slate-300">Total Agujeros</th>
                <th className="p-2 text-center w-24">VºBº Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {parts.map((p, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-2.5 font-bold font-mono text-sm text-slate-950 border-r border-slate-300">
                    {p.partId}
                  </td>
                  <td className="p-2.5 font-semibold text-slate-800 border-r border-slate-300">
                    {p.profile}
                  </td>
                  <td className="p-2.5 text-center font-bold font-mono text-slate-900 border-r border-slate-300">
                    {p.quantity} u.
                  </td>
                  <td className="p-2.5 border-r border-slate-300">
                    {p.holes.length > 0 ? (
                      <div className="space-y-0.5">
                        {p.holes.map((h, hIdx) => (
                          <div key={hIdx} className="font-mono text-[11px] text-slate-800">
                            <strong>{h.countPerPiece}x</strong> Ø{h.diameter.toFixed(1)} mm
                            {h.slot && <span className="text-slate-600 font-sans ml-1">(Coliso {h.slot})</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Sin perforaciones</span>
                    )}
                  </td>
                  <td className="p-2.5 text-right font-black font-mono text-sm text-slate-950 border-r border-slate-300">
                    {p.totalHolesAllPieces}
                  </td>
                  <td className="p-2.5 text-center">
                    <div className="w-5 h-5 border-2 border-slate-400 mx-auto rounded"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quality Control & Signatures Block */}
        <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs">
          <div className="border border-slate-300 rounded p-4 text-center">
            <div className="font-bold text-slate-700 uppercase text-[10px] mb-8">
              Operador de Taladrado / Punzonado
            </div>
            <div className="border-t border-dashed border-slate-400 pt-2 text-slate-500">
              Firma y Aclaración
            </div>
          </div>

          <div className="border border-slate-300 rounded p-4 text-center">
            <div className="font-bold text-slate-700 uppercase text-[10px] mb-8">
              Responsable de Control de Calidad (QC)
            </div>
            <div className="border-t border-dashed border-slate-400 pt-2 text-slate-500">
              Firma y Medición de Galgas / Calibre
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-[10px] text-slate-500 text-center flex justify-between">
          <span>Generado automáticamente por MetalMetric CAD & Perforaciones</span>
          <span>Página 1 de 1</span>
        </div>
      </div>
    </div>
  );
};
