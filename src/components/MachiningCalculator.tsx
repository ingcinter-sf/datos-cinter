import React, { useState } from 'react';
import { 
  Calculator, 
  Clock, 
  DollarSign, 
  Gauge, 
  Settings2, 
  Wrench, 
  Zap, 
  ShieldCheck 
} from 'lucide-react';
import { DiameterSummary, PartRecord } from '../types';

interface MachiningCalculatorProps {
  diameterSummary: DiameterSummary[];
  parts: PartRecord[];
  totalHolesProduction: number;
}

export const MachiningCalculator: React.FC<MachiningCalculatorProps> = ({
  diameterSummary,
  parts,
  totalHolesProduction,
}) => {
  // Machine Type: 'punch' (punzonadora CNC) vs 'drill_radial' (taladro radial/columna) vs 'drill_cnc' (taladrado CNC)
  const [machineType, setMachineType] = useState<'punch' | 'drill_radial' | 'drill_cnc'>('punch');
  const [material, setMaterial] = useState<'a36' | 'stainless' | 'high_strength'>('a36');
  const [plateThickness, setPlateThickness] = useState<number>(3.2); // mm
  const [hourlyRate, setHourlyRate] = useState<number>(35); // USD / EUR / $ por hora taller
  const [costPerHoleExtra, setCostPerHoleExtra] = useState<number>(0.15); // Desgaste de broca / matriz

  // Calculate Machining Time
  const calculateToolStats = () => {
    return diameterSummary.map(item => {
      let secondsPerHole = 3; // default punch
      let rpm = 0;
      let toolLifeHoles = 5000;

      if (machineType === 'punch') {
        // Punching: fast cycle time ~2.5s to 3.5s depending on diameter
        secondsPerHole = item.diameter > 20 ? 4 : 2.8;
        toolLifeHoles = 8000;
      } else if (machineType === 'drill_cnc') {
        // CNC Drilling: tool rotation + feed rate
        const vc = material === 'stainless' ? 18 : 30; // m/min
        rpm = Math.round((1000 * vc) / (Math.PI * item.diameter));
        const feedRateMmMin = rpm * 0.18; // mm/min
        const drillDepth = plateThickness + item.diameter * 0.3; // with tip angle
        const cuttingMinutes = drillDepth / feedRateMmMin;
        secondsPerHole = Math.max(6, Math.round(cuttingMinutes * 60 + 3)); // +3s tool positioning
        toolLifeHoles = 400;
      } else {
        // Manual / Radial drill: Operator positioning + drilling
        const vc = material === 'stainless' ? 14 : 22;
        rpm = Math.round((1000 * vc) / (Math.PI * item.diameter));
        secondsPerHole = Math.max(12, Math.round(plateThickness * 1.8 + item.diameter * 0.8 + 8));
        toolLifeHoles = 200;
      }

      const totalHoles = item.totalHolesProduction;
      const totalSeconds = totalHoles * secondsPerHole;
      const toolCostEstimate = (totalHoles / toolLifeHoles) * (item.diameter * 1.5 + 10);

      return {
        diameter: item.diameter,
        totalHoles,
        secondsPerHole,
        totalSeconds,
        rpm,
        toolCostEstimate,
      };
    });
  };

  const toolStats = calculateToolStats();
  const totalSecondsAll = toolStats.reduce((sum, t) => sum + t.totalSeconds, 0);
  const totalHours = totalSecondsAll / 3600;

  // Add 15% setup & tool change time
  const setupMinutes = diameterSummary.length * 8; // 8 mins per tool setup
  const grandTotalMinutes = (totalSecondsAll / 60) + setupMinutes;
  const grandTotalHours = grandTotalMinutes / 60;

  // Costs
  const laborAndMachineCost = grandTotalHours * hourlyRate;
  const toolWearCost = toolStats.reduce((sum, t) => sum + t.toolCostEstimate, 0) + (totalHolesProduction * costPerHoleExtra);
  const grandTotalCost = laborAndMachineCost + toolWearCost;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              Cálculo de Tiempos de Mecanizado, RPM y Costos de Taller
            </h3>
            <p className="text-xs text-slate-400">
              Estima con precisión de ingeniería el tiempo de ciclo para punzonado o taladrado según máquina, herramental y espesor.
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Machine Type Selection */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Settings2 className="w-4 h-4 text-amber-400" />
            1. Tipo de Máquina / Proceso
          </h4>

          <div className="space-y-2 text-xs">
            <label
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                machineType === 'punch'
                  ? 'bg-amber-500/10 border-amber-500/40 text-white'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40'
              }`}
            >
              <input
                type="radio"
                name="machineType"
                checked={machineType === 'punch'}
                onChange={() => setMachineType('punch')}
                className="mt-0.5 accent-amber-400"
              />
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Punzonadora CNC / Hidráulica
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Geka, Ficep, Peddinghaus (~2.8s por golpe). Ideal para chapas y perfiles conformados.
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                machineType === 'drill_cnc'
                  ? 'bg-amber-500/10 border-amber-500/40 text-white'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40'
              }`}
            >
              <input
                type="radio"
                name="machineType"
                checked={machineType === 'drill_cnc'}
                onChange={() => setMachineType('drill_cnc')}
                className="mt-0.5 accent-amber-400"
              />
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-blue-400" />
                  Taladrado CNC Automático
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Vigas y perfiles pesados con avance regulado y mecha de carburo / insertos.
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                machineType === 'drill_radial'
                  ? 'bg-amber-500/10 border-amber-500/40 text-white'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40'
              }`}
            >
              <input
                type="radio"
                name="machineType"
                checked={machineType === 'drill_radial'}
                onChange={() => setMachineType('drill_radial')}
                className="mt-0.5 accent-amber-400"
              />
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                  Taladro Radial / Magnético / Manual
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Trazado manual, centro punto y taladrado tradicional con operario.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Material & Thickness */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            2. Material y Espesor
          </h4>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Calidad de Acero
            </label>
            <select
              value={material}
              onChange={e => setMaterial(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="a36">Acero al Carbono Estructural (A36 / F-24)</option>
              <option value="high_strength">Acero Alta Resistencia (F-36 / A572 Gr.50)</option>
              <option value="stainless">Acero Inoxidable (AISI 304 / 316)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Espesor de Chapa / Perfil: <strong className="text-amber-400">{plateThickness} mm</strong>
            </label>
            <input
              type="range"
              min="1"
              max="25"
              step="0.5"
              value={plateThickness}
              onChange={e => setPlateThickness(parseFloat(e.target.value))}
              className="w-full accent-amber-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>1 mm (Chapa fina)</span>
              <span>12 mm (Placa 1/2")</span>
              <span>25 mm (Placa 1")</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1">
              Cotas de seguridad estándar:
            </span>
            <div className="p-2 rounded bg-slate-950/50 text-[11px] text-slate-300 font-mono">
              Distancia mínima al borde libre: <strong className="text-amber-300">{(plateThickness * 1.5).toFixed(1)} mm</strong>
            </div>
          </div>
        </div>

        {/* Cost Parameters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            3. Tarifas de Producción
          </h4>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Costo Hora Taller ($/hora)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-500 font-bold">$</span>
              <input
                type="number"
                min="5"
                value={hourlyRate}
                onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)}
                className="w-full pl-7 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Consumible por Agujero ($/perforación)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-500 font-bold">$</span>
              <input
                type="number"
                step="0.05"
                min="0"
                value={costPerHoleExtra}
                onChange={e => setCostPerHoleExtra(parseFloat(e.target.value) || 0)}
                className="w-full pl-7 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-amber-400"
              />
            </div>
            <span className="text-[10px] text-slate-500">Aceite de corte, fluido refrigerante y desgaste de broca.</span>
          </div>
        </div>
      </div>

      {/* KPI Results Summary */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/30 rounded-2xl p-6 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
          <div className="sm:pr-4">
            <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              Tiempo de Ciclo Neto
            </div>
            <div className="text-3xl font-black text-white font-mono">
              {(totalSecondsAll / 60).toFixed(0)} <span className="text-xs text-slate-400">min</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Solo maquinado efectivo
            </div>
          </div>

          <div className="sm:px-4 pt-4 sm:pt-0">
            <div className="text-xs text-amber-400 font-medium mb-1 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Tiempo Total con Setups
            </div>
            <div className="text-3xl font-black text-amber-300 font-mono">
              {grandTotalHours < 1
                ? `${grandTotalMinutes.toFixed(0)} min`
                : `${grandTotalHours.toFixed(1)} hrs`}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Incluye {setupMinutes} min de cambio de brocas/matrices
            </div>
          </div>

          <div className="sm:px-4 pt-4 sm:pt-0">
            <div className="text-xs text-emerald-400 font-medium mb-1 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" />
              Costo Total Estimado
            </div>
            <div className="text-3xl font-black text-emerald-300 font-mono">
              ${grandTotalCost.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Mano de obra + máquina + desgaste
            </div>
          </div>

          <div className="sm:pl-4 pt-4 sm:pt-0">
            <div className="text-xs text-slate-400 font-medium mb-1">
              Costo Unitario Promedio
            </div>
            <div className="text-3xl font-black text-white font-mono">
              ${totalHolesProduction > 0 ? (grandTotalCost / totalHolesProduction).toFixed(2) : '0.00'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Por cada perforación terminada
            </div>
          </div>
        </div>
      </div>

      {/* Tool by Tool Detail Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-amber-400" />
          Rendimiento y Tiempos Detallados por Diámetro
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-sans font-semibold uppercase text-[11px]">
                <th className="py-2.5 px-3">Herramienta</th>
                <th className="py-2.5 px-3 text-right">Cantidad de Agujeros</th>
                <th className="py-2.5 px-3 text-right">Tiempo por Agujero</th>
                <th className="py-2.5 px-3 text-right">Tiempo Total Diámetro</th>
                {machineType !== 'punch' && (
                  <th className="py-2.5 px-3 text-right">RPM Recomendado</th>
                )}
                <th className="py-2.5 px-3 text-right">Costo Estimado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {toolStats.map(stat => (
                <tr key={stat.diameter} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-amber-400">Ø {stat.diameter.toFixed(1)} mm</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-white">
                    {stat.totalHoles}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {stat.secondsPerHole} s
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-300 font-bold">
                    {(stat.totalSeconds / 60).toFixed(1)} min
                  </td>
                  {machineType !== 'punch' && (
                    <td className="py-2.5 px-3 text-right text-blue-300">
                      {stat.rpm} rpm
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                    ${((stat.totalSeconds / 3600) * hourlyRate + stat.totalHoles * costPerHoleExtra).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
