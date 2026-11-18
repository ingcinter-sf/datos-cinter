import React, { useRef, useState, useMemo } from 'react';
import {
  FolderSync,
  FolderPlus,
  FolderOpen,
  FileSpreadsheet,
  Printer,
  BarChart3,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  Sparkles,
  Wrench,
  Ruler,
  Package,
  RefreshCw,
  AlertCircle,
  X,
  FolderTree
} from 'lucide-react';
import { ObraProject, FolderSyncResult } from '../types';
import { groupDirectoryInputFiles, scanDroppedItems, ScannedObraFolder } from '../utils/folderScanner';

interface ObrasHomeProps {
  obras: ObraProject[];
  activeObraId: string | null;
  onSelectObra: (obraId: string, targetTab?: 'csv' | 'print' | 'analytics') => void;
  onCreateManualObra: (name: string) => void;
  onDeleteObra: (obraId: string) => void;
  onSyncFolders: (scannedFolders: ScannedObraFolder[]) => Promise<FolderSyncResult>;
  onLoadSampleAsObra: (type: 'vmc' | 'n29000') => void;
  lastSyncResult: FolderSyncResult | null;
  onDismissSyncResult: () => void;
  recentlyChangedMap: Record<string, 'created' | 'updated'>;
  theme: 'light' | 'dark';
}

export const ObrasHome: React.FC<ObrasHomeProps> = ({
  obras,
  activeObraId,
  onSelectObra,
  onCreateManualObra,
  onDeleteObra,
  onSyncFolders,
  onLoadSampleAsObra,
  lastSyncResult,
  onDismissSyncResult,
  recentlyChangedMap,
  theme,
}) => {
  const isLight = theme === 'light';
  const dirInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewObraInput, setShowNewObraInput] = useState(false);
  const [newObraName, setNewObraName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsSyncing(true);
    setSyncError(null);
    try {
      const grouped = groupDirectoryInputFiles(files);
      if (grouped.length === 0) {
        setSyncError('No se encontraron archivos CSV, TXT o Excel (.xlsx/.xls) dentro de la carpeta seleccionada.');
      } else {
        await onSyncFolders(grouped);
      }
    } catch (err) {
      console.error('Error sincronizando carpeta:', err);
      setSyncError('Ocurrió un error al leer los archivos de la carpeta seleccionada.');
    } finally {
      setIsSyncing(false);
      if (dirInputRef.current) {
        dirInputRef.current.value = '';
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setIsSyncing(true);
    setSyncError(null);

    try {
      const scanned = await scanDroppedItems(e.dataTransfer);
      if (scanned.length === 0) {
        setSyncError('No se detectaron carpetas de obra ni archivos CSV/Excel válidos al soltar.');
      } else {
        await onSyncFolders(scanned);
      }
    } catch (err) {
      console.error('Error al procesar carpeta arrastrada:', err);
      setSyncError('No se pudo leer la carpeta arrastrada. Prueba usando el botón "Actualizar desde carpeta".');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateManual = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newObraName.trim();
    if (!trimmed) return;
    onCreateManualObra(trimmed);
    setNewObraName('');
    setShowNewObraInput(false);
  };

  const filteredObras = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? obras.filter(o =>
          o.name.toLowerCase().includes(q) ||
          (o.folderName && o.folderName.toLowerCase().includes(q)) ||
          o.loadedFiles.some(f => f.toLowerCase().includes(q))
        )
      : obras;

    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [obras, searchQuery]);

  // Global stats across all obras
  const globalStats = useMemo(() => {
    let totalParts = 0;
    let totalHoles = 0;
    let totalMeters = 0;

    for (const obra of obras) {
      for (const p of obra.parts) {
        totalParts += p.quantity;
        totalHoles += p.totalHolesAllPieces;
        for (const h of p.holes) {
          const th = h.thickness || p.thickness;
          totalMeters += (h.countPerPiece * p.quantity * th) / 1000;
        }
      }
    }

    return {
      totalObras: obras.length,
      totalParts,
      totalHoles,
      totalMeters: Math.round(totalMeters * 100) / 100,
    };
  }, [obras]);

  return (
    <div className="space-y-6 pb-10">
      {/* Hidden Directory Input */}
      <input
        ref={dirInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as any)}
        onChange={handleDirectorySelect}
        className="hidden"
      />

      {/* Top Hero & Folder Sync Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-6 transition-all ${
          isDragging
            ? isLight
              ? 'border-blue-600 bg-blue-50/90 shadow-lg scale-[1.005]'
              : 'border-amber-400 bg-amber-500/10 shadow-lg scale-[1.005]'
            : isLight
            ? 'border-blue-200 bg-white shadow-sm'
            : 'border-slate-800 bg-slate-900/90 shadow-md'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md ${
                  isLight ? 'bg-blue-600 text-white' : 'bg-amber-500 text-slate-950'
                }`}
              >
                Inicio · Gestión por Carpetas
              </span>
              <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Portal de Obras — Carpeta Calculadora
              </h1>
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Organiza tus obras en subcarpetas dentro de <strong className="font-mono">calculadora/</strong> (ej.{' '}
              <span className="font-mono font-semibold">MASA</span>, <span className="font-mono font-semibold">PAE</span>).
              Al presionar <strong>Actualizar carpeta</strong> o arrastrar tu carpeta <span className="font-mono">calculadora</span> aquí,
              se actualizan los CSV nuevos y <strong>se crean tarjetas automáticamente para las carpetas nuevas</strong>.
            </p>
          </div>

          {/* Primary Sync & Manual Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => dirInputRef.current?.click()}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60 ${
                isLight
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FolderSync className="w-4 h-4" />
              )}
              <span>{isSyncing ? 'Leyendo carpetas...' : 'Actualizar desde Carpeta'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNewObraInput(prev => !prev)}
              className={`px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm border flex items-center gap-1.5 transition-colors cursor-pointer ${
                isLight
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Obra Manual</span>
            </button>
          </div>
        </div>

        {/* Drag hint strip */}
        <div
          className={`mt-4 pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
            isLight ? 'border-slate-100 text-slate-600' : 'border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <FolderTree className={`w-4 h-4 shrink-0 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
            <span>
              Tip: También puedes <strong>arrastrar y soltar</strong> la carpeta <span className="font-mono font-bold">calculadora</span> entera (o una carpeta de obra nueva) directamente sobre este recuadro.
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] shrink-0">
            <span>Obras: <strong>{globalStats.totalObras}</strong></span>
            <span>·</span>
            <span>Piezas: <strong>{globalStats.totalParts.toLocaleString()}</strong></span>
            <span>·</span>
            <span>Metros: <strong>{globalStats.totalMeters} m</strong></span>
          </div>
        </div>

        {/* Inline New Manual Obra Form */}
        {showNewObraInput && (
          <form
            onSubmit={handleCreateManual}
            className={`mt-4 p-3 rounded-xl border flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${
              isLight ? 'bg-blue-50/70 border-blue-200' : 'bg-slate-950 border-slate-800'
            }`}
          >
            <input
              type="text"
              value={newObraName}
              onChange={(e) => setNewObraName(e.target.value)}
              placeholder="Nombre de la nueva obra (ej. NAVE_SUR, MASA_2)..."
              autoFocus
              className={`flex-1 px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium outline-none ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  : 'bg-slate-900 border-slate-700 text-white focus:border-amber-400'
              }`}
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  isLight ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                Crear Tarjeta
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewObraInput(false);
                  setNewObraName('');
                }}
                className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                  isLight ? 'bg-white border border-slate-300 text-slate-700' : 'bg-slate-800 text-slate-300'
                }`}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Error Message Banner */}
      {syncError && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm ${
            isLight
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-rose-950/50 border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{syncError}</span>
          </div>
          <button onClick={() => setSyncError(null)} className="p-1 rounded hover:bg-black/10 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sync Result Summary Banner */}
      {lastSyncResult && (
        <div
          className={`p-4 rounded-xl border flex items-start sm:items-center justify-between gap-3 text-xs sm:text-sm ${
            isLight
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
            <div className="space-y-0.5">
              <div className="font-bold">
                Actualización completada ({lastSyncResult.totalFilesProcessed} archivos procesados)
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-90">
                {lastSyncResult.createdNames.length > 0 && (
                  <span>
                    ✨ <strong>Nuevas tarjetas creadas ({lastSyncResult.createdNames.length}):</strong>{' '}
                    {lastSyncResult.createdNames.join(', ')}
                  </span>
                )}
                {lastSyncResult.updatedNames.length > 0 && (
                  <span>
                    🔄 <strong>Obras actualizadas ({lastSyncResult.updatedNames.length}):</strong>{' '}
                    {lastSyncResult.updatedNames.join(', ')}
                  </span>
                )}
                {lastSyncResult.skippedEmptyFolders.length > 0 && (
                  <span>
                    📁 Carpetas sin CSV: {lastSyncResult.skippedEmptyFolders.join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onDismissSyncResult}
            className="p-1 rounded hover:bg-black/10 cursor-pointer shrink-0"
            title="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Bar (if > 0 obras) */}
      {obras.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className={`text-sm sm:text-base font-black uppercase tracking-wide flex items-center gap-2 ${
            isLight ? 'text-slate-800' : 'text-slate-200'
          }`}>
            <FolderOpen className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
            <span>Obras Registradas ({filteredObras.length})</span>
          </h2>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar obra o archivo CSV..."
              className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none transition-colors ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  : 'bg-slate-900 border-slate-700 text-slate-100 focus:border-amber-400'
              }`}
            />
          </div>
        </div>
      )}

      {/* Empty State or Cards Grid */}
      {obras.length === 0 ? (
        <div
          className={`rounded-2xl border p-8 sm:p-10 text-center space-y-6 ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="max-w-lg mx-auto space-y-3">
            <div
              className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
                isLight ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              <FolderPlus className="w-7 h-7" />
            </div>
            <h3 className={`text-lg font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Todavía no hay obras cargadas en este portal
            </h3>
            <p className={`text-xs sm:text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Selecciona o arrastra tu carpeta <span className="font-mono font-bold">calculadora</span> para crear automáticamente una tarjeta por cada subcarpeta de obra:
            </p>
          </div>

          <div
            className={`max-w-md mx-auto text-left p-4 rounded-xl border font-mono text-xs space-y-1 ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <div>📁 calculadora/</div>
            <div className="pl-4">├── 🌐 portal_metalurgico_offline.html</div>
            <div className="pl-4">├── 📁 MASA/ <span className="opacity-70">(despiece.csv, logo.png...)</span></div>
            <div className="pl-4">└── 📁 PAE/ <span className="opacity-70">(perforaciones.csv, logo.jpg...)</span></div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => dirInputRef.current?.click()}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer ${
                isLight ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              <FolderSync className="w-4 h-4" />
              Seleccionar Carpeta "calculadora"
            </button>
            <button
              type="button"
              onClick={() => onLoadSampleAsObra('vmc')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                isLight
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              Probar con Ejemplo VMC
            </button>
            <button
              type="button"
              onClick={() => onLoadSampleAsObra('n29000')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                isLight
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              Probar con Ejemplo N29000
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredObras.map((obra) => {
            const partsCount = obra.parts.reduce((s, p) => s + p.quantity, 0);
            const holesCount = obra.parts.reduce((s, p) => s + p.totalHolesAllPieces, 0);
            let meters = 0;
            for (const p of obra.parts) {
              for (const h of p.holes) {
                meters += (h.countPerPiece * p.quantity * (h.thickness || p.thickness)) / 1000;
              }
            }
            const roundedMeters = Math.round(meters * 100) / 100;
            const isSelected = activeObraId === obra.id;
            const changeBadge = recentlyChangedMap[obra.id];

            return (
              <div
                key={obra.id}
                className={`rounded-2xl border-2 p-5 flex flex-col justify-between transition-all ${
                  isSelected
                    ? isLight
                      ? 'bg-white border-blue-600 shadow-md ring-2 ring-blue-100'
                      : 'bg-slate-900 border-amber-400 shadow-md ring-2 ring-amber-500/20'
                    : isLight
                    ? 'bg-white border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-md'
                    : 'bg-slate-900 border-slate-800 hover:border-amber-500/50 shadow-sm'
                }`}
              >
                <div>
                  {/* Card Top Meta Row */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 ${
                          obra.sourceType === 'folder'
                            ? isLight
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : isLight
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        <FolderOpen className="w-3 h-3" />
                        {obra.folderName ? `/${obra.folderName}` : 'Manual'}
                      </span>

                      {changeBadge === 'created' && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-600 text-white flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Nueva
                        </span>
                      )}
                      {changeBadge === 'updated' && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-sky-600 text-white">
                          Actualizada
                        </span>
                      )}
                    </div>

                    {/* Delete button with inline confirm */}
                    {confirmDeleteId === obra.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteObra(obra.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                            isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(obra.id)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isLight
                            ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-slate-500 hover:text-rose-400 hover:bg-rose-950/50'
                        }`}
                        title="Eliminar tarjeta de obra"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Obra Logo + Title */}
                  <div
                    onClick={() => onSelectObra(obra.id, 'csv')}
                    className="flex items-center gap-3 mb-4 cursor-pointer group"
                  >
                    {obra.logoDataUrl ? (
                      <div className={`w-14 h-14 rounded-xl border p-1.5 flex items-center justify-center shrink-0 bg-white overflow-hidden transition-transform group-hover:scale-105 ${
                        isLight ? 'border-slate-200 shadow-xs' : 'border-slate-700 shadow-sm'
                      }`}>
                        <img
                          src={obra.logoDataUrl}
                          alt={`Logo ${obra.name}`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                        isLight
                          ? 'bg-blue-50 border-blue-200 text-blue-600'
                          : 'bg-slate-950 border-slate-800 text-amber-400'
                      }`}>
                        <FolderOpen className="w-5 h-5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h3
                        className={`text-lg font-black font-mono tracking-tight truncate ${
                          isLight ? 'text-slate-950 group-hover:text-blue-700' : 'text-white group-hover:text-amber-300'
                        }`}
                        title={obra.name}
                      >
                        {obra.name}
                      </h3>
                      <div className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        Actualizado: {new Date(obra.updatedAt).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-4 font-mono text-center">
                    <div className={`p-2 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                      <div className={`text-[10px] font-sans font-bold uppercase flex items-center justify-center gap-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        <Package className="w-3 h-3" /> Piezas
                      </div>
                      <div className={`text-sm font-black mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {partsCount.toLocaleString()}
                      </div>
                    </div>

                    <div className={`p-2 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                      <div className={`text-[10px] font-sans font-bold uppercase flex items-center justify-center gap-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        <Wrench className="w-3 h-3" /> Aguj.
                      </div>
                      <div className={`text-sm font-black mt-0.5 ${isLight ? 'text-blue-700' : 'text-amber-400'}`}>
                        {holesCount.toLocaleString()}
                      </div>
                    </div>

                    <div className={`p-2 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                      <div className={`text-[10px] font-sans font-bold uppercase flex items-center justify-center gap-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        <Ruler className="w-3 h-3" /> Metros
                      </div>
                      <div className={`text-sm font-black mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {roundedMeters}m
                      </div>
                    </div>
                  </div>

                  {/* Loaded Files Pills */}
                  <div className="mb-4">
                    <div className={`text-[10px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Archivos ({obra.loadedFiles.length}):
                    </div>
                    {obra.loadedFiles.length === 0 ? (
                      <div className={`text-xs italic ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                        Carpeta sin CSV cargados aún
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {obra.loadedFiles.slice(0, 3).map((fname, i) => (
                          <span
                            key={i}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border truncate max-w-[160px] ${
                              isLight
                                ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                                : 'bg-slate-950 border-slate-800 text-slate-300'
                            }`}
                            title={fname}
                          >
                            {fname}
                          </span>
                        ))}
                        {obra.loadedFiles.length > 3 && (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                              isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            +{obra.loadedFiles.length - 3} más
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons Footer */}
                <div className={`pt-3 border-t flex items-center gap-2 ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                  <button
                    type="button"
                    onClick={() => onSelectObra(obra.id, 'csv')}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isLight
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Abrir Planilla</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectObra(obra.id, 'print')}
                    className={`py-2 px-2.5 rounded-xl font-semibold text-xs border flex items-center gap-1 transition-colors cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 hover:bg-blue-50 border-slate-300 text-slate-800 hover:text-blue-700 hover:border-blue-300'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                    title="Ver Resumen de Perforaciones"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Resumen</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectObra(obra.id, 'analytics')}
                    className={`py-2 px-2.5 rounded-xl font-semibold text-xs border flex items-center gap-1 transition-colors cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 hover:bg-blue-50 border-slate-300 text-slate-800 hover:text-blue-700 hover:border-blue-300'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                    title="Ver Análisis de Datos"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
