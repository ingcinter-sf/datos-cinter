import React, { useMemo } from 'react';
import { 
  BarChart3, 
  Layers, 
  Wrench, 
  Zap,
  Award,
  CircleDot,
  CheckCircle2,
  Boxes,
  Ruler
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

  // 1. PARETO DE DIAMETROS (Tarjetas visuales)
  const paretoData = useMemo(() => {
    const totalHoles = totalHolesProduction || 1;
    const sorted = [...diameterSummary].sort((a, b) => b.totalHolesProduction - a.totalHolesProduction);
    
    return sorted.map(item => {
      const percentage = (item.totalHolesProduction / totalHoles) * 100;
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
        totalMeters: Math.round(meters * 100) / 100,
      };
    });
  }, [diameterSummary, totalHolesProduction, parts]);

  // 2. RANKING Y CONSUMO POR TIPO DE PERFIL (Tarjetas de familia)
  const profileRanking = useMemo(() => {
    const map = new Map<string, {
      profileGroup: string;
      distinctPartsCount: number;
      totalPartsQty: number;
      totalHoles: number;
      totalMeters: number;
    }>();

    parts.forEach(part => {
      const rawProfile = part.profile.trim().toUpperCase();
      let group = 'PLACA / OTRO';
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

      let partMeters = 0;
      part.holes.forEach(h => {
        const th = h.thickness || part.thickness;
        partMeters += (h.countPerPiece * part.quantity * th) / 1000;
      });
      entry.totalMeters += partMeters;
    });

    return Array.from(map.values()).sort((a, b) => b.totalPartsQty - a.totalPartsQty);
  }, [parts]);

  // 4. DISTRIBUCIÓN DE CARGA POR ESPESORES
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

  const topDiameter = paretoData[0];
  const topProfile = profileRanking[0];

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isLight ? 'bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white border-blue-200 shadow-sm' : 'bg-slate-900 border-slate-800 shadow-md'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider ${
                isLight ? 'bg-blue-600 text-white' : 'bg-amber-500 text-slate-950'
              }`}>
                Panel Visual de Taller
              </span>
              <h2 className={`text-xl font-black uppercase tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Resumen Gráfico de Obra: {obraTitle}
              </h2>
            </div>
            <p className={`text-xs mt-1.5 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
              Vista rápida de diámetros principales, familias de perfiles y distribución de espesores para la producción CNC.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl border text-center ${
              isLight ? 'bg-white border-blue-200 text-blue-950 shadow-xs' : 'bg-slate-950 border-amber-500/30 text-amber-300'
            }`}>
              <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Total Perforaciones</div>
              <div className="text-lg font-black font-mono">{totalHolesProduction.toLocaleString()}</div>
            </div>
            <div className={`px-4 py-2 rounded-xl border text-center ${
              isLight ? 'bg-white border-slate-200 text-slate-950 shadow-xs' : 'bg-slate-950 border-slate-800 text-white'
            }`}>
              <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Piezas Totales</div>
              <div className="text-lg font-black font-mono">{totalPartsCount.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 1: DIÁMETROS PRINCIPALES (TARJETAS VISUALES) */}
      <div className={`p-6 rounded-2xl border shadow-sm ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        <div className="mb-5 pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className={`text-base font-black flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <CircleDot className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
              1. Diámetros de Perforación Frecuentes (Herramientas CNC)
            </h3>
            <p className={`text-xs font-medium mt-0.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
              Tarjetas ordenadas por mayor demanda en la obra para preparar brocas y punzones.
            </p>
          </div>
          {topDiameter && (
            <span className={`text-xs font-bold px-3 py-1 rounded-full font-mono ${
              isLight ? 'bg-blue-100 text-blue-900' : 'bg-amber-500/20 text-amber-300'
            }`}>
              Principal: Ø {topDiameter.diameter} mm ({topDiameter.percentage}%)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {paretoData.map((item, idx) => (
            <div key={item.diameter} className={`p-4 rounded-xl border transition-all relative overflow-hidden ${
              isLight ? 'bg-slate-50 border-slate-300 hover:border-blue-500 shadow-xs' : 'bg-slate-950 border-slate-800 hover:border-amber-500/40'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  idx === 0 
                    ? (isLight ? 'bg-blue-600 text-white' : 'bg-amber-500 text-slate-950')
                    : (isLight ? 'bg-slate-200 text-slate-800 font-semibold' : 'bg-slate-800 text-slate-300')
                }`}>
                  #{idx + 1} Prioridad
                </span>
                <span className="text-xs font-mono font-bold text-blue-700 dark:text-amber-400">
                  {item.percentage}% del total
                </span>
              </div>

              <div className={`text-3xl font-black font-mono tracking-tight my-2 ${isLight ? 'text-slate-950' : 'text-white'}`}>
                Ø {item.diameter} <span className={`text-sm font-sans font-semibold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>mm</span>
              </div>

              <div className={`text-xs font-semibold mb-3 line-clamp-1 ${isLight ? 'text-slate-800' : 'text-slate-300'}`} title={item.suggestedTool}>
                🔧 {item.suggestedTool}
              </div>

              <div className={`pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono ${
                isLight ? 'text-slate-800 font-medium' : 'text-slate-300'
              }`}>
                <div>
                  <span className={isLight ? 'text-slate-600 font-semibold' : 'text-slate-400'}>Agujeros:</span> <strong className="font-black">{item.totalHolesProduction.toLocaleString()} u.</strong>
                </div>
                <div>
                  <span className={isLight ? 'text-slate-600 font-semibold' : 'text-slate-400'}>Metros:</span> <strong className="font-black">{item.totalMeters} m</strong>
                </div>
              </div>

              {/* Progress bar background indicator */}
              <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${isLight ? 'bg-blue-200' : 'bg-slate-800'}`}>
                <div 
                  className={`h-full ${isLight ? 'bg-blue-600' : 'bg-amber-400'}`} 
                  style={{ width: `${Math.max(item.percentage, 5)}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN 2: RANKING POR FAMILIA DE PERFILES (TARJETAS) */}
      <div className={`p-6 rounded-2xl border shadow-sm ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        <div className="mb-5 pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className={`text-base font-black flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <Boxes className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
              2. Consumo por Tipo de Perfil / Chapa (Familias)
            </h3>
            <p className={`text-xs font-medium mt-0.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
              Distribución del trabajo agrupado por categoría estructural.
            </p>
          </div>
          {topProfile && (
            <span className={`text-xs font-bold px-3 py-1 rounded-full font-mono ${
              isLight ? 'bg-blue-100 text-blue-900' : 'bg-amber-500/20 text-amber-300'
            }`}>
              Mayor volumen: {topProfile.profileGroup}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profileRanking.map((group, idx) => (
            <div key={group.profileGroup} className={`p-5 rounded-xl border transition-all ${
              isLight ? 'bg-slate-50 border-slate-300 shadow-xs' : 'bg-slate-950 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  isLight ? 'bg-indigo-100 text-indigo-900 font-semibold' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  Categoría
                </span>
                <span className={`text-xs font-mono font-bold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                  {group.distinctPartsCount} marcas
                </span>
              </div>

              <div className={`text-xl font-black font-mono tracking-tight mb-4 ${isLight ? 'text-blue-950' : 'text-slate-100'}`}>
                {group.profileGroup}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-center font-mono">
                <div className={`p-2 rounded-lg border ${isLight ? 'bg-white border-slate-200 text-slate-900 shadow-xs' : 'bg-slate-900 border-slate-800 text-slate-100'}`}>
                  <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Piezas</div>
                  <div className="text-sm font-black mt-0.5">{group.totalPartsQty} u.</div>
                </div>
                <div className={`p-2 rounded-lg border ${isLight ? 'bg-white border-slate-200 text-slate-900 shadow-xs' : 'bg-slate-900 border-slate-800 text-slate-100'}`}>
                  <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Agujeros</div>
                  <div className="text-sm font-black mt-0.5 text-blue-700 dark:text-amber-400">{group.totalHoles.toLocaleString()}</div>
                </div>
                <div className={`p-2 rounded-lg border ${isLight ? 'bg-white border-slate-200 text-slate-900 shadow-xs' : 'bg-slate-900 border-slate-800 text-slate-100'}`}>
                  <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Metros</div>
                  <div className="text-sm font-black mt-0.5">{group.totalMeters.toFixed(1)} m</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN 4: DISTRIBUCIÓN DE CARGA POR ESPESORES */}
      <div className={`p-6 rounded-2xl border shadow-sm ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        <div className="mb-5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className={`text-base font-black flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            <Ruler className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
            4. Distribución de Carga por Espesores (mm)
          </h3>
          <p className={`text-xs font-medium mt-0.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
            Comparativa visual del metraje a mecanizar agrupado por espesor nominal.
          </p>
        </div>

        <div className="space-y-4">
          {thicknessDistribution.map(item => {
            const widthPct = Math.round((item.totalMeters / maxThicknessMeters) * 100);
            return (
              <div key={item.thickness} className={`p-4 rounded-xl border ${
                isLight ? 'bg-slate-50 border-slate-300 shadow-xs' : 'bg-slate-950 border-slate-800'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-lg text-sm font-black font-mono ${
                      isLight ? 'bg-blue-600 text-white shadow-xs' : 'bg-amber-500 text-slate-950'
                    }`}>
                      {item.thickness} mm
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                        Espesor Nominal ({item.distinctParts} marcas de piezas)
                      </div>
                      <div className={`text-[11px] font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                        {item.partsCount} piezas totales fabricadas
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <div className={`px-3 py-1 rounded-lg border ${isLight ? 'bg-white border-slate-300 text-slate-900 font-medium' : 'bg-slate-900 border-slate-800 text-slate-100'}`}>
                      <span className={isLight ? 'text-slate-700 font-bold' : 'text-slate-400'}>Agujeros:</span> <strong className="font-black text-blue-700 dark:text-amber-400">{item.totalHoles.toLocaleString()}</strong>
                    </div>
                    <div className={`px-3 py-1 rounded-lg border ${isLight ? 'bg-white border-slate-300 text-slate-900 font-medium' : 'bg-slate-900 border-slate-800 text-slate-100'}`}>
                      <span className={isLight ? 'text-slate-700 font-bold' : 'text-slate-400'}>Metros:</span> <strong className="font-black">{item.totalMeters} m</strong>
                    </div>
                  </div>
                </div>

                {/* Friendly Visual Progress Bar */}
                <div className={`w-full h-3.5 rounded-full overflow-hidden border ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-slate-800 border-slate-700'}`}>
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
