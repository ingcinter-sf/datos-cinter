import React from 'react';
import { 
  FileSpreadsheet, 
  Compass, 
  Sparkles, 
  Calculator, 
  Printer, 
  Layers,
  Wrench
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'csv' | 'dxf' | 'ai' | 'calculator' | 'print';
  setActiveTab: (tab: 'csv' | 'dxf' | 'ai' | 'calculator' | 'print') => void;
  totalParts: number;
  totalHoles: number;
  onLoadSample: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  totalParts,
  totalHoles,
  onLoadSample,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-xl">
              <Layers className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-100">
                  Metal<span className="text-amber-400">Metric</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Taller & CAD
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Análisis de Perforaciones en Planillas CSV & Planos DXF/PDF
              </p>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-400">Piezas:</span>
              <span className="font-bold text-slate-100">{totalParts}</span>
            </div>
            <div className="h-3 w-px bg-slate-700"></div>
            <div className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Total Agujeros:</span>
              <span className="font-bold text-amber-300">{totalHoles}</span>
            </div>
          </div>

          {/* Right Action: Load Sample */}
          <div className="flex items-center gap-2">
            <button
              onClick={onLoadSample}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Cargar ejemplo real de taller (N29000 & N29001)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Ejemplo N29000/N29001</span>
              <span className="sm:hidden">Ejemplo</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 border-t border-slate-800/80 pt-1 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'csv'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Planilla CSV / Excel
          </button>

          <button
            onClick={() => setActiveTab('dxf')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'dxf'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Compass className="w-4 h-4" />
            Visor CAD (DXF)
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400 group-hover:text-purple-300" />
            Plano PDF / Imagen (IA)
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'calculator'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calculator className="w-4 h-4" />
            Tiempos & Costos
          </button>

          <button
            onClick={() => setActiveTab('print')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'print'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Printer className="w-4 h-4" />
            Orden de Taller
          </button>
        </nav>
      </div>
    </header>
  );
};
