import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  BookOpen, 
  FileText, 
  Check, 
  Download, 
  Layers, 
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
  Scale
} from 'lucide-react';
import { 
  GERDAU_W_CATALOG, 
  GERDAU_EUROPEAN_SUBSTITUTIONS, 
  GERDAU_STEEL_SPECS,
  GerdauProfile,
  EuropeanSubstitution
} from '../data/gerdauProfiles';

interface GerdauCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLight?: boolean;
  onSelectProfile?: (profile: GerdauProfile) => void;
}

export const GerdauCatalogModal: React.FC<GerdauCatalogModalProps> = ({
  isOpen,
  onClose,
  isLight = false,
  onSelectProfile
}) => {
  const [activeTab, setActiveTab] = useState<'profiles' | 'substitutions' | 'specs'>('profiles');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<number | 'all' | 'HP'>('all');
  const [selectedEuroType, setSelectedEuroType] = useState<'ALL' | 'IPN' | 'IPE' | 'HEA' | 'HEB'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Series buttons
  const seriesOptions: Array<{ id: number | 'all' | 'HP'; label: string }> = [
    { id: 'all', label: 'Todos (83)' },
    { id: 150, label: 'W 150 (6)' },
    { id: 200, label: 'W 200 (14)' },
    { id: 250, label: 'W 250 (17)' },
    { id: 310, label: 'W 310 (23)' },
    { id: 360, label: 'W 360 (12)' },
    { id: 410, label: 'W 410 (7)' },
    { id: 460, label: 'W 460 (8)' },
    { id: 530, label: 'W 530 (10)' },
    { id: 610, label: 'W 610 (11)' },
    { id: 'HP', label: 'Pilotes HP (8)' }
  ];

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return GERDAU_W_CATALOG.filter(p => {
      // Series filter
      if (selectedSeries === 'HP') {
        if (p.type !== 'HP') return false;
      } else if (selectedSeries !== 'all') {
        if (p.nominalSeries !== selectedSeries) return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().replace(/\s+/g, '');
      const des = p.designation.toLowerCase().replace(/\s+/g, '');
      const cal = p.caliberInch.toLowerCase().replace(/\s+/g, '');
      const text = `${des} ${cal} ${p.massKgM} ${p.d} ${p.bf} tw${p.tw} tf${p.tf}`.toLowerCase();
      return text.includes(q);
    });
  }, [selectedSeries, searchQuery]);

  // Filtered substitutions
  const filteredSubs = useMemo(() => {
    return GERDAU_EUROPEAN_SUBSTITUTIONS.filter(s => {
      if (selectedEuroType !== 'ALL' && s.type !== selectedEuroType) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return s.europeanProfile.toLowerCase().includes(q) ||
             s.gerdauOptions.some(opt => opt.toLowerCase().includes(q));
    });
  }, [selectedEuroType, searchQuery]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-100'
        }`}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/80 border-slate-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm ${
              isLight ? 'bg-amber-500 text-slate-900' : 'bg-amber-400 text-slate-950'
            }`}>
              W
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">
                  Catálogo Oficial de Perfiles W y HP - Gerdau (Marzo 2023)
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isLight ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-blue-950/80 text-blue-300 border-blue-800'
                }`}>
                  Folleto Oficial Guardado
                </span>
              </div>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Norma IRAM-IAS U 500-215 / ASTM A6/A6M • Calidad F-36 (IRAM-IAS U 500-503: Fy ≥ 355 MPa, Fu ≥ 490 MPa)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/public/assets/aistudio/Folleto_Perfiles_W_Gerdau__MAR_23__62cef43f.pdf"
              target="_blank"
              rel="noreferrer"
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
                isLight 
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm' 
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-600'
              }`}
              title="Abrir folleto técnico PDF original de Gerdau"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ver Folleto PDF</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={`flex border-b px-4 sm:px-6 gap-2 sm:gap-4 overflow-x-auto ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}>
          <button
            onClick={() => setActiveTab('profiles')}
            className={`py-3 px-2 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'profiles'
                ? isLight 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Perfiles W y HP Gerdau ({GERDAU_W_CATALOG.length})
          </button>

          <button
            onClick={() => setActiveTab('substitutions')}
            className={`py-3 px-2 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'substitutions'
                ? isLight 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="w-4 h-4" />
            Sustitución Perfiles Europeos ({GERDAU_EUROPEAN_SUBSTITUTIONS.length})
          </button>

          <button
            onClick={() => setActiveTab('specs')}
            className={`py-3 px-2 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'specs'
                ? isLight 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Acero F-36, Soldadura y Tolerancias
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'profiles' && (
            <>
              {/* Search & Series filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar por designación (ej: W 150x18, W 8x24, HP 200, alma 5.8...)"
                    className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border focus:outline-none transition-all ${
                      isLight 
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500' 
                        : 'bg-slate-800 border-slate-700 text-slate-100 focus:bg-slate-900 focus:border-amber-400'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="text-xs font-medium text-slate-400">
                  Mostrando <strong className={isLight ? 'text-slate-900' : 'text-slate-100'}>{filteredProfiles.length}</strong> perfiles
                </div>
              </div>

              {/* Series Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {seriesOptions.map(s => {
                  const isActive = selectedSeries === s.id;
                  return (
                    <button
                      key={s.id.toString()}
                      onClick={() => setSelectedSeries(s.id)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? isLight
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                          : isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>

              {/* Table */}
              <div className={`border rounded-xl overflow-hidden shadow-sm ${
                isLight ? 'border-slate-200' : 'border-slate-800'
              }`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className={`text-[11px] font-semibold uppercase tracking-wider border-b ${
                      isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-800/90 text-slate-300 border-slate-700'
                    }`}>
                      <tr>
                        <th className="py-2.5 px-3">Medida (mm x kg/m)</th>
                        <th className="py-2.5 px-3">Calibre (in x lb/ft)</th>
                        <th className="py-2.5 px-3 text-center">Masa (kg/m)</th>
                        <th className="py-2.5 px-3 text-center bg-sky-500/10 text-sky-500 font-bold">
                          Espesor Alma (tw)
                        </th>
                        <th className="py-2.5 px-3 text-center bg-indigo-500/10 text-indigo-500 font-bold">
                          Espesor Ala (tf)
                        </th>
                        <th className="py-2.5 px-3 text-center">Altura d (mm)</th>
                        <th className="py-2.5 px-3 text-center">Ancho bf (mm)</th>
                        <th className="py-2.5 px-3 text-center">Área (cm²)</th>
                        <th className="py-2.5 px-3 text-center">Ix (cm⁴)</th>
                        <th className="py-2.5 px-3 text-center">Wx (cm³)</th>
                        <th className="py-2.5 px-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-mono ${
                      isLight ? 'divide-slate-200' : 'divide-slate-800'
                    }`}>
                      {filteredProfiles.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-8 text-center text-slate-400">
                            No se encontraron perfiles con el criterio de búsqueda.
                          </td>
                        </tr>
                      ) : (
                        filteredProfiles.map((p, idx) => {
                          const isCopied = copiedId === p.designation;
                          return (
                            <tr
                              key={`${p.designation}-${idx}`}
                              className={`transition-colors ${
                                isLight 
                                  ? idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/60'
                                  : idx % 2 === 0 ? 'bg-slate-900 hover:bg-slate-800/60' : 'bg-slate-900/40 hover:bg-slate-800/60'
                              }`}
                            >
                              <td className="py-2.5 px-3 font-sans font-bold whitespace-nowrap">
                                <span className={isLight ? 'text-slate-900' : 'text-slate-100'}>
                                  {p.designation}
                                </span>
                                {p.isH && (
                                  <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-500 font-bold">
                                    H
                                  </span>
                                )}
                                {p.isCustomOrder && (
                                  <span className="ml-1 text-[9px] text-amber-500" title="Producido bajo pedido especial">
                                    *
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                                {p.caliberInch}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold">
                                {p.massKgM.toFixed(1)}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold bg-sky-500/10 text-sky-600 dark:text-sky-300">
                                {p.tw} mm
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                                {p.tf} mm
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {p.d}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {p.bf}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-400">
                                {p.areaCm2.toFixed(1)}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-400">
                                {p.Ix.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-400">
                                {p.Wx.toFixed(1)}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap font-sans">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleCopy(`${p.designation} (Alma: ${p.tw}mm, Alas: ${p.tf}mm)`, p.designation)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                                      isCopied
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : isLight
                                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                    }`}
                                    title="Copiar medidas técnicas"
                                  >
                                    {isCopied ? <Check className="w-3 h-3 inline" /> : 'Copiar'}
                                  </button>

                                  {onSelectProfile && (
                                    <button
                                      onClick={() => onSelectProfile(p)}
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                                    >
                                      Aplicar
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'substitutions' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border text-xs leading-relaxed ${
                isLight ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-amber-950/30 border-amber-800/60 text-amber-200'
              }`}>
                <strong>Criterio Oficial de Gerdau para sustitución:</strong> Estas tablas sirven como orientación para escoger perfiles laminados W Gerdau que sustituyen a perfiles laminados de norma europea (IPN, IPE, HEA y HEB). El criterio adoptado para la sustitución es <strong>inercia Ix igual o mayor al perfil original, altura d similar, y masa lineal menor al original</strong>, logrando un ahorro sustancial de acero y costos sin perder capacidad portante.
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Tipo de perfil europeo:</span>
                {(['ALL', 'IPN', 'IPE', 'HEA', 'HEB'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setSelectedEuroType(t)}
                    className={`text-xs font-bold px-3 py-1 rounded-lg border transition-colors cursor-pointer ${
                      selectedEuroType === t
                        ? isLight
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-amber-400 text-slate-950 border-amber-400'
                        : isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    {t === 'ALL' ? 'Todos' : t}
                  </button>
                ))}
              </div>

              {/* Grid of substitutions */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredSubs.map((sub, idx) => (
                  <div
                    key={`${sub.europeanProfile}-${idx}`}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                      isLight ? 'bg-white border-slate-200' : 'bg-slate-800/60 border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b pb-2 border-slate-700/30">
                      <div>
                        <span className="font-bold text-sm text-amber-500">
                          {sub.europeanProfile}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          Masa: {sub.massKgM} kg/m • Altura: {sub.d} mm • Ix: {sub.Ix.toLocaleString()} cm⁴
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        sub.type === 'IPN' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                        sub.type === 'IPE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                        'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      }`}>
                        {sub.type}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Sustitución Gerdau Recomendada:
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {sub.gerdauOptions.map(opt => (
                          <span
                            key={opt}
                            className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                              isLight 
                                ? 'bg-sky-50 text-sky-800 border-sky-200' 
                                : 'bg-sky-950/80 text-sky-300 border-sky-800'
                            }`}
                          >
                            {opt}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="space-y-5 text-xs">
              {/* Steel Specs */}
              <div className={`p-4 rounded-xl border space-y-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700'
              }`}>
                <h4 className="font-bold text-sm flex items-center gap-2 text-amber-400">
                  <ShieldCheck className="w-4 h-4" />
                  Calidad y Propiedades Mecánicas del Acero
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className={`p-3 rounded-lg border ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}>
                    <span className="text-slate-400 text-[10px] uppercase block">Designación</span>
                    <strong className="text-sm font-bold text-sky-400">{GERDAU_STEEL_SPECS.steelGrade}</strong>
                    <p className="text-[10px] text-slate-500 mt-0.5">Certificado F-36 según norma IRAM-IAS U 500-503</p>
                  </div>

                  <div className={`p-3 rounded-lg border ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}>
                    <span className="text-slate-400 text-[10px] uppercase block">Límite de Fluencia (Fy)</span>
                    <strong className="text-sm font-bold text-emerald-400">≥ {GERDAU_STEEL_SPECS.yieldStrengthMinMpa} MPa</strong>
                    <p className="text-[10px] text-slate-500 mt-0.5">(36 kg/mm² aprox)</p>
                  </div>

                  <div className={`p-3 rounded-lg border ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}>
                    <span className="text-slate-400 text-[10px] uppercase block">Resistencia Tracción (Fu) y Alargamiento</span>
                    <strong className="text-sm font-bold text-amber-400">≥ {GERDAU_STEEL_SPECS.tensileStrengthMinMpa} MPa • {GERDAU_STEEL_SPECS.elongationMinPercent}% min</strong>
                    <p className="text-[10px] text-slate-500 mt-0.5">Cumple también ASTM A572 Gr. 50 y ASTM A992</p>
                  </div>
                </div>
              </div>

              {/* Welding */}
              <div className={`p-4 rounded-xl border space-y-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700'
              }`}>
                <h4 className="font-bold text-sm text-sky-400">Recomendaciones de Soldadura y Bulonería</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div className={`p-2.5 rounded-lg border text-center ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}>
                    <span className="text-[10px] font-sans text-slate-400 block">Electrodo Revestido</span>
                    <strong className="text-sm text-sky-400">{GERDAU_STEEL_SPECS.welding.stickElectrode}</strong>
                  </div>
                  <div className={`p-2.5 rounded-lg border text-center ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}>
                    <span className="text-[10px] font-sans text-slate-400 block">MIG / MAG</span>
                    <strong className="text-sm text-sky-400">{GERDAU_STEEL_SPECS.welding.migMag}</strong>
                  </div>
                  <div className={`p-2.5 rounded-lg border text-center ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}>
                    <span className="text-[10px] font-sans text-slate-400 block">Arco Sumergido</span>
                    <strong className="text-sm text-sky-400">{GERDAU_STEEL_SPECS.welding.submergedArc}</strong>
                  </div>
                  <div className={`p-2.5 rounded-lg border text-center ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}>
                    <span className="text-[10px] font-sans text-slate-400 block">Bulonería</span>
                    <strong className="text-sm text-amber-400">{GERDAU_STEEL_SPECS.welding.bolts}</strong>
                  </div>
                </div>
              </div>

              {/* Tolerances */}
              <div className={`p-4 rounded-xl border space-y-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700'
              }`}>
                <h4 className="font-bold text-sm text-slate-200">Tolerancias Dimensionales de Laminación (ASTM A6/A6M & IRAM)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between py-1 border-b border-slate-700/40">
                    <span className="text-slate-400">Masa lineal:</span>
                    <strong className="font-mono">{GERDAU_STEEL_SPECS.tolerances.linearMass}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/40">
                    <span className="text-slate-400">Longitud estándar comercial:</span>
                    <strong className="font-mono">{GERDAU_STEEL_SPECS.standardCommercialLength}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/40">
                    <span className="text-slate-400">Centrado del alma:</span>
                    <strong className="font-mono">{GERDAU_STEEL_SPECS.tolerances.webCentering}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/40">
                    <span className="text-slate-400">Tolerancia de altura (d):</span>
                    <strong className="font-mono">{GERDAU_STEEL_SPECS.tolerances.depthTolerances}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/40">
                    <span className="text-slate-400">Tolerancia de ancho del ala (bf):</span>
                    <strong className="font-mono">{GERDAU_STEEL_SPECS.tolerances.flangeWidthTolerances}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/40">
                    <span className="text-slate-400">Paralelismo de alas:</span>
                    <strong className="font-mono">{GERDAU_STEEL_SPECS.tolerances.outOfParallelism}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between text-xs ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-800/80 border-slate-700 text-slate-400'
        }`}>
          <div>
            Fuente: Folleto Perfiles W Gerdau MAR 23 (Planta Pérez, Santa Fe, Argentina).
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-lg font-bold border transition-colors cursor-pointer ${
              isLight 
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
            }`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
