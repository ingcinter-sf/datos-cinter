import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Compass, 
  Printer, 
  Wrench,
  Sun,
  Moon,
  Edit3,
  Check,
  RotateCcw
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'csv' | 'dxf' | 'ai' | 'calculator' | 'print';
  setActiveTab: (tab: 'csv' | 'dxf' | 'ai' | 'calculator' | 'print') => void;
  totalParts: number;
  totalHoles: number;
  onLoadSample: (type: 'vmc' | 'n29000') => void;
  onClearAll?: () => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  totalParts,
  totalHoles,
  onLoadSample,
  onClearAll,
  projectName,
  onProjectNameChange,
  theme,
  onToggleTheme,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(projectName);

  const isLight = theme === 'light';

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      onProjectNameChange(tempTitle.trim());
    } else {
      setTempTitle(projectName);
    }
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setTempTitle(projectName);
      setIsEditingTitle(false);
    }
  };

  return (
    <header className={`print:hidden ${isLight ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-slate-900 border-slate-800 text-white shadow-md'} border-b sticky top-0 z-50 transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            {/* CINTER Official Logo Container */}
            <div className={`h-11 px-2 py-1 rounded-lg flex items-center justify-center transition-all ${
              isLight ? 'bg-blue-50/70 border border-blue-100 shadow-xs' : 'bg-white p-1 rounded-lg shadow-sm border border-slate-700'
            }`}>
              <img 
                src="/assets/aistudio/ImagotipoV_06__1__39317061.png" 
                alt="CINTER Logo" 
                className="h-9 w-auto max-w-[110px] object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-black text-lg tracking-tight ${isLight ? 'text-blue-900' : 'text-slate-100'}`}>
                  CINTER <span className={isLight ? 'text-blue-600 font-extrabold' : 'text-amber-400 font-extrabold'}>- Fábrica</span>
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  isLight 
                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  CONTROL DE PROCESOS
                </span>
              </div>
              <p className={`text-xs hidden sm:block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Análisis de Perforaciones
              </p>
            </div>
          </div>

          {/* Center: EDITABLE PROJECT TITLE ("por defecto el nombre del archivo y editable a gusto") */}
          <div className="flex-1 max-w-md mx-2 hidden md:block">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
              isLight 
                ? 'bg-slate-50 border-slate-300 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100' 
                : 'bg-slate-950 border-slate-700 focus-within:border-amber-400'
            }`}>
              <span className={`text-[10px] uppercase tracking-wider font-bold shrink-0 ${isLight ? 'text-blue-700' : 'text-amber-400'}`}>
                Obra / Archivo:
              </span>

              {isEditingTitle ? (
                <div className="flex items-center gap-1.5 w-full">
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    placeholder="Escriba el nombre de obra o archivo..."
                    className={`w-full text-xs font-bold font-mono bg-transparent outline-none ${
                      isLight ? 'text-slate-900' : 'text-amber-300'
                    }`}
                  />
                  <button
                    onClick={handleSaveTitle}
                    className={`p-1 rounded cursor-pointer ${isLight ? 'bg-blue-600 text-white' : 'bg-amber-500 text-slate-950'}`}
                    title="Guardar nombre"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => {
                    setTempTitle(projectName);
                    setIsEditingTitle(true);
                  }}
                  className="flex items-center justify-between w-full cursor-pointer group"
                  title="Haga clic para editar el nombre del proyecto u obra a su gusto"
                >
                  <span className={`text-xs font-bold font-mono truncate ${isLight ? 'text-slate-800 group-hover:text-blue-600' : 'text-slate-200 group-hover:text-amber-300'}`}>
                    {projectName || 'Sin título'}
                  </span>
                  <Edit3 className={`w-3.5 h-3.5 shrink-0 ml-1 transition-opacity opacity-40 group-hover:opacity-100 ${
                    isLight ? 'text-blue-600' : 'text-amber-400'
                  }`} />
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats & Controls */}
          <div className="flex items-center gap-2">
            {/* Quick Stats Pill */}
            <div className={`hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg border text-xs ${
              isLight 
                ? 'bg-slate-50 border-slate-200 text-slate-700' 
                : 'bg-slate-800/80 border-slate-700/60 text-slate-200'
            }`}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Piezas:</span>
                <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{totalParts}</span>
              </div>
              <div className={`h-3 w-px ${isLight ? 'bg-slate-300' : 'bg-slate-700'}`}></div>
              <div className="flex items-center gap-1.5">
                <Wrench className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Agujeros:</span>
                <span className={`font-bold ${isLight ? 'text-blue-700' : 'text-amber-300'}`}>{totalHoles}</span>
              </div>
            </div>

            {/* Clear / New Sheet Button */}
            {totalParts > 0 && onClearAll && (
              <button
                onClick={() => {
                  if (confirm('¿Vaciar la planilla actual para comenzar de cero con un archivo nuevo?')) {
                    onClearAll();
                  }
                }}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  isLight 
                    ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700' 
                    : 'bg-rose-950/40 hover:bg-rose-900/60 border-rose-800 text-rose-300'
                }`}
                title="Vaciar planilla y empezar en blanco"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpiar Planilla</span>
              </button>
            )}

            {/* THEME SWITCHER BUTTON (TEMA CLARO / TEMA OSCURO) */}
            <button
              onClick={onToggleTheme}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                isLight 
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' 
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
              title={isLight ? 'Cambiar a Tema Oscuro (Industrial / Ámbar)' : 'Cambiar a Tema Claro (Blanco / Azul Cinter)'}
            >
              {isLight ? (
                <>
                  <Moon className="w-4 h-4 text-blue-700" />
                  <span className="hidden sm:inline">Tema Oscuro</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Tema Claro</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile editable project title */}
        <div className="block md:hidden pb-2">
          <div className={`flex items-center justify-between px-2.5 py-1 rounded border text-xs ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}>
            <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-blue-700' : 'text-amber-400'}`}>
              Obra:
            </span>
            <input
              type="text"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              className={`text-xs font-bold font-mono bg-transparent outline-none text-right w-48 ${
                isLight ? 'text-slate-900' : 'text-slate-200'
              }`}
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className={`flex space-x-1 sm:space-x-2 border-t pt-1 pb-2 overflow-x-auto ${
          isLight ? 'border-slate-200' : 'border-slate-800/80'
        }`}>
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all duration-200 whitespace-nowrap cursor-pointer ${
              activeTab === 'csv'
                ? isLight
                  ? 'bg-blue-600 text-white border-blue-500 shadow-[0_4px_14px_rgba(37,99,235,0.18)]'
                  : 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_4px_14px_rgba(251,191,36,0.22)]'
                : isLight
                  ? 'bg-white/90 text-slate-600 border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-[0_3px_10px_rgba(59,130,246,0.1)]'
                  : 'bg-slate-900 text-slate-300 border-slate-700 shadow-[0_1px_2px_rgba(2,6,23,0.4)] hover:border-amber-500/40 hover:bg-slate-800 hover:text-amber-200 hover:shadow-[0_3px_10px_rgba(251,191,36,0.12)]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Planilla CSV / Excel
          </button>

          <button
            onClick={() => setActiveTab('print')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all duration-200 whitespace-nowrap cursor-pointer ${
              activeTab === 'print'
                ? isLight
                  ? 'bg-blue-600 text-white border-blue-500 shadow-[0_4px_14px_rgba(37,99,235,0.18)]'
                  : 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_4px_14px_rgba(251,191,36,0.22)]'
                : isLight
                  ? 'bg-white/90 text-slate-600 border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-[0_3px_10px_rgba(59,130,246,0.1)]'
                  : 'bg-slate-900 text-slate-300 border-slate-700 shadow-[0_1px_2px_rgba(2,6,23,0.4)] hover:border-amber-500/40 hover:bg-slate-800 hover:text-amber-200 hover:shadow-[0_3px_10px_rgba(251,191,36,0.12)]'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span className="flex items-center gap-1.5">
              <span>RESUMEN PERFORACIONES</span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded font-mono ${
                activeTab === 'print' 
                  ? isLight ? 'bg-blue-800 text-blue-100' : 'bg-slate-950 text-amber-400'
                  : isLight ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {projectName}
              </span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('dxf')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all duration-200 whitespace-nowrap cursor-pointer ${
              activeTab === 'dxf'
                ? isLight 
                  ? 'bg-blue-600 text-white border-blue-500 shadow-[0_4px_14px_rgba(37,99,235,0.18)]'
                  : 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_4px_14px_rgba(251,191,36,0.22)]'
                : isLight
                  ? 'bg-white/90 text-slate-600 border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-[0_3px_10px_rgba(59,130,246,0.1)]'
                  : 'bg-slate-900 text-slate-300 border-slate-700 shadow-[0_1px_2px_rgba(2,6,23,0.4)] hover:border-amber-500/40 hover:bg-slate-800 hover:text-amber-200 hover:shadow-[0_3px_10px_rgba(251,191,36,0.12)]'
            }`}
          >
            <Compass className="w-4 h-4" />
            Visor CAD (DXF)
          </button>
        </nav>
      </div>
    </header>
  );
};
