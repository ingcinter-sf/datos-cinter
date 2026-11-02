import React, { useMemo, useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Layers, 
  Wrench, 
  PieChart, 
  CheckCircle2, 
  AlertTriangle,
  Award,
  Zap,
  Filter
} from 'lucide-react';
import { PartRecord, DiameterSummary } from '../types';

interface WorkshopAnalyticsProps {
  parts: PartRecord[];
  diameterSummary: DiameterSummary[];
  totalPartsCount: number;
  totalHolesProduction: number;
  obraTitle: string;
  theme?: 'light' | 'dark';
}

export const WorkshopAnalytics: React.FC<WorkshopAnalyticsProps> = ({
  parts,
  diameterSummary,
  totalPartsCount,
  totalHolesProduction,
  obraTitle,
  theme = 'light',
}) => {
  const isLight = theme === 'light';

  // 1. PARETO DE DIAMETROS (Opción 1)
  const paretoData = useMemo(() => {
    const totalHoles = totalHolesProduction || 1;
    const sorted = [...diameterSummary].sort((a, b) => b.totalHolesProduction - a.totalHolesProduction);
    
    let cumulative = 0;
    return sorted.map(item => {
      const percentage = (item.totalHolesProduction / totalHoles) * 100;
      cumulative += percentage;
      // Calculate total meters drilled for this diameter
      let meters = 0;
      parts.forEach(part => {
        part.holes.forEach(hole => {
          if (hole.diameter === item.diameter) {
            const th = hole.thickness || part.thickness;
            meters += (hole.countPerPiece * part.quantity * th) / 1000;
          }
        });
      });

      return {
        ...item,
        percentage: Math.round(percentage * 10) / 10,
        cumulativePercentage: Math.round(Math.min(100, cumulative) * 10) / 10,
        totalMeters: Math.round(meters * 100) / 100,
      };
    });
  }, [diameterSummary, totalHolesProduction, parts]);

  // 2. RANKING Y CONSUMO POR TIPO DE PERFIL (Opción 2)
  const profileRanking = useMemo(() => {
    const map = new Map<string, {
      profileGroup: string;
      distinctPartsCount: number;
      totalPartsQty: number;
      totalHoles: number;
      totalMeters: number;
    }>();

    parts.forEach(part => {
      // Extract profile category prefix (e.g. W, HP, PL, HI, HF, Z, ZZ, etc.)
      const rawProfile = part.profile.trim().toUpperCase();
      let group = 'OTRO / PLACA';
      if (rawProfile.startsWith('W ')) group = 'PERFIL W';
      else if (rawProfile.startsWith('HP')) group = 'PERFIL HP';
      else if (rawProfile.startsWith('HI')) group = 'PERFIL HI';
      else if (rawProfile.startsWith('HF')) group = 'PERFIL HF';
      else if (rawProfile.startsWith('Z') || rawProfile.startsWith('ZZ')) group = 'PERFIL Z / ZZ';
      else if (rawProfile.startsWith('PL') || rawProfile.includes('*') || rawProfile.includes('X')) {
        if (rawProfile.startsWith('PL')) group = 'CHAPA PL';
        else group = 'PERFIL / CHAPA';
      }

      if (!map.has(group)) {
        map.set(group, {
          profileGroup: group,
          distinctPartsCount: 0,
          totalPartsQty: 0,
          totalHoles: 0,
          totalMeters: 0,
        });
      }

      const entry = map.get(group)!;
      entry.distinctPartsCount += 1;
      entry.totalPartsQty += part.quantity;
      entry.totalHoles += part.totalHolesAllPieces;

      // calculate meters for this part
      let partMeters = 0;
      part.holes.forEach(h => {
        const th = h.thickness || part.thickness;
        partMeters += (h.countPerPiece * part.quantity * th) / 1000;
      });
      entry.totalMeters += partMeters;
    });

    return Array.from(map.values()).sort((a, b) => b.totalPartsQty - a.totalPartsQty);
  }, [parts]);

  // 4. DISTRIBUCIÓN DE CARGA POR ESPESORES (Opción 4)
  const thicknessDistribution = useMemo(() => {
    const map = new Map<number, {
      thickness: number;
      partsCount: number;
      totalHoles: number;
      totalMeters: number;
      partsList: Set<string>;
    }>();

    parts.forEach(part => {
      const th = part.thickness;
      if (!map.has(th)) {
        map.set(th, {
          thickness: th,
          partsCount: 0,
          totalHoles: 0,
          totalMeters: 0,
          partsList: new Set(),
        });
      }
      const entry = map.get(th)!;
      entry.partsCount += part.quantity;
      entry.totalHoles += part.totalHolesAllPieces;
      entry.partsList.add(part.partId);

      let partMeters = 0;
      part.holes.forEach(h => {
        const hTh = h.thickness || th;
        partMeters += (h.countPerPiece * part.quantity * hTh) / 1000;
      });
      entry.totalMeters += partMeters;
    });

    return Array.from(map.values())
      .map(item => ({
        ...item,
        distinctParts: item.partsList.size,
        totalMeters: Math.round(item.totalMeters * 100) / 100,
      }))
      .sort((a, b) => a.thickness - b.thickness);
  }, [parts]);

  const maxThicknessMeters = useMemo(() => {
    return Math.max(...thicknessDistribution.map(t => t.totalMeters), 1);
  }, [thicknessDistribution]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header Info Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isLight ? 'bg-gradient-to-r from-blue-50 via-indigo-50/40 to-white border-blue-200 shadow-sm' : 'bg-slate-900 border-slate-800 shadow-md'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                isLight ? 'bg-blue-600 text-white' : 'bg-amber-500 text-slate-950'
              }`}>
                Módulo Analítico
              </span>
              <h2 className={`text-xl font-black uppercase tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Análisis de Datos y Estadísticas de Taller
              </h2>
            </div>
            <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Obra actual: <strong className="font-mono">{obraTitle}</strong> — {totalPartsCount} piezas totales, {totalHolesProduction.toLocaleString()} perforaciones analizadas.
            </p>
          </div>

          <div className={`px-4 py-2 rounded-xl border flex items-center gap-3 text-xs ${
            isLight ? 'bg-white border-blue-200 text-blue-900' : 'bg-slate-950 border-amber-500/30 text-amber-300'
          }`}>
            <Zap className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
            <div>
              <div className="font-bold">Optimización CNC Activa</div>
              <div className="text-[10px] opacity-80">Parámetros de brocas y espesores listos</div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. ANÁLISIS DE PARETO DE DIÁMETROS (Opción 1) */}
      <div className={`p-6 rounded-2xl border shadow-sm ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black flex items-center gap-2">
              <BarChart3 className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
              1. Análisis de Pareto de Diámetros (Optimización de Herramientas CNC)
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Distribución de perforaciones por diámetro y porcentaje acumulado para alistamiento de brocas y punzones (Ley 80/20).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className={`border-b uppercase tracking-wider text-[11px] ${
                isLight ? 'bg-blue-50/70 border-blue-200 text-blue-900' : 'bg-slate-950 border-slate-800 text-amber-400'
              }`}>
                <th className="py-3 px-3">Diámetro</th>
                <th className="py-3 px-3">Herramienta Sugerida</th>
                <th className="py-3 px-3 text-right">Agujeros (Producción)</th>
                <th className="py-3 px-3 text-right">% del Total</th>
                <th className="py-3 px-3 text-right">% Acumulado</th>
                <th className="py-3 px-3 text-right">Metros Lineales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paretoData.map((row, idx) => (
                <tr key={row.diameter} className={`transition-colors ${
                  isLight ? 'hover:bg-blue-50/40' : 'hover:bg-slate-800/40'
                }`}>
                  <td className="py-3 px-3 font-bold text-sm">
                    Ø {row.diameter} mm
                  </td>
                  <td className="py-3 px-3 font-sans font-medium text-slate-700 dark:text-slate-300">
                    {row.suggestedTool}
                  </td>
                  <td className="py-3 px-3 text-right font-bold">
                    {row.totalHolesProduction.toLocaleString()} u.
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-blue-600 dark:text-amber-400">
                    {row.percentage}%
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      row.cumulativePercentage <= 80 
                        ? (isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950 text-emerald-300')
                        : (isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300')
                    }`}>
                      {row.cumulativePercentage}% {row.cumulativePercentage <= 80 ? '(80% Clave)' : ''}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                    {row.totalMeters.toFixed(2)} m
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. RANKING Y CONSUMO POR TIPO DE PERFIL / CHAPA (Opción 2) */}
      <div className={`p-6 rounded-2xl border shadow-sm ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black flex items-center gap-2">
              <Award className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
              2. Ranking y Consumo por Familia de Perfiles / Chapas
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Agrupamiento de carga de trabajo por tipo de perfil estructural (W, HP, HI, HF, Z, Chapas).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profileRanking.map((group, idx) => (
            <div key={group.profileGroup} className={`p-4 rounded-xl border transition-all ${
              isLight ? 'bg-slate-50 border-slate-200 hover:border-blue-300' : 'bg-slate-950 border-slate-800 hover:border-amber-500/40'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  isLight ? 'bg-blue-100 text-blue-800' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  #{idx + 1} Familia
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {group.distinctPartsCount} marcas únicas
                </span>
              </div>
              
              <div className={`text-lg font-black font-mono tracking-tight mb-3 ${isLight ? 'text-blue-950' : 'text-slate-100'}`}>
                {group.profileGroup}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-center">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Piezas</div>
                  <div className="text-sm font-black font-mono">{group.totalPartsQty} u.</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Agujeros</div>
                  <div className="text-sm font-black font-mono text-blue-600 dark:text-amber-400">{group.totalHoles.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Metros</div>
                  <div className="text-sm font-black font-mono">{group.totalMeters.toFixed(1)} m</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. DISTRIBUCIÓN DE CARGA POR ESPESORES (Opción 4) */}
      <div className={`p-6 rounded-2xl border shadow-sm ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black flex items-center gap-2">
              <Layers className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
              4. Distribución de Carga por Rango de Espesores
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Volumen de perforación y metraje acumulado agrupado según el espesor nominal de la chapa o perfil.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {thicknessDistribution.map(item => {
            const widthPct = Math.round((item.totalMeters / maxThicknessMeters) * 100);
            return (
              <div key={item.thickness} className={`p-4 rounded-xl border ${
                isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-lg text-sm font-black font-mono ${
                      isLight ? 'bg-blue-600 text-white shadow-xs' : 'bg-amber-500 text-slate-950'
                    }`}>
                      {item.thickness} mm
                    </span>
                    <span className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      Espesor Nominal ({item.distinctParts} marcas de piezas)
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div><span className="text-slate-500">Total Piezas:</span> <strong className="font-black">{item.partsCount} u.</strong></div>
                    <div><span className="text-slate-500">Agujeros:</span> <strong className="font-black text-blue-600 dark:text-amber-400">{item.totalHoles.toLocaleString()}</strong></div>
                    <div><span className="text-slate-500">Metros:</span> <strong className="font-black">{item.totalMeters} m</strong></div>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className={`w-full h-2.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isLight ? 'bg-blue-600' : 'bg-amber-400'
                    }`}
                    style={{ width: `${Math.max(widthPct, 4)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
