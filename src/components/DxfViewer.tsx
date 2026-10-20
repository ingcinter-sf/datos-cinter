import React, { useState, useRef, useEffect } from 'react';
import { 
  Compass, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Upload, 
  Layers, 
  Wrench, 
  Check, 
  ArrowRight, 
  Info, 
  MousePointer,
  AlertTriangle,
  FileCode,
  FileText
} from 'lucide-react';
import { DxfParsedDrawing } from '../types';
import { parseDxfContent } from '../utils/dxfParser';
import { SAMPLE_DXF_N29000, SAMPLE_DXF_BASE_PLATE } from '../utils/sampleData';

interface DxfViewerProps {
  onImportHolesToCsv?: (partId: string, profile: string, holes: { diameter: number; count: number }[]) => void;
  onNavigateToTab?: (tab: 'csv' | 'dxf' | 'ai') => void;
}

export const DxfViewer: React.FC<DxfViewerProps> = ({ onImportHolesToCsv, onNavigateToTab }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [dxfData, setDxfData] = useState<DxfParsedDrawing>(() =>
    parseDxfContent(SAMPLE_DXF_N29000, 'N29000_CC150.dxf')
  );

  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({});
  const [hoveredHole, setHoveredHole] = useState<{ id: string; x: number; y: number; diameter: number } | null>(null);
  const [selectedHole, setSelectedHole] = useState<{ id: string; x: number; y: number; diameter: number } | null>(null);
  const [importedSuccess, setImportedSuccess] = useState(false);

  // DWG Binary Alert State
  const [dwgFileInfo, setDwgFileInfo] = useState<{
    filename: string;
    version: string;
    sizeKb: number;
    extractedTexts: string[];
  } | null>(null);

  // Viewport transformation: scale and pan offset
  const [transform, setTransform] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Initialize active layers whenever dxfData changes
  useEffect(() => {
    const initialLayers: Record<string, boolean> = {};
    dxfData.layers.forEach(l => {
      initialLayers[l] = true;
    });
    setActiveLayers(initialLayers);
    fitToScreen();
  }, [dxfData]);

  // Fit drawing to canvas bounds
  const fitToScreen = () => {
    if (!containerRef.current) return;
    const { width: containerW, height: containerH } = containerRef.current.getBoundingClientRect();
    const { bounds } = dxfData;

    const padding = 60;
    const drawingW = bounds.width;
    const drawingH = bounds.height;

    const scaleX = (containerW - padding * 2) / drawingW;
    const scaleY = (containerH - padding * 2) / drawingH;
    const scale = Math.min(scaleX, scaleY, 2.5);

    const centerX = bounds.minX + drawingW / 2;
    const centerY = bounds.minY + drawingH / 2;

    const offsetX = containerW / 2 - centerX * scale;
    const offsetY = containerH / 2 + centerY * scale;

    setTransform({ scale, offsetX, offsetY });
  };

  const cadToCanvas = (x: number, y: number) => {
    return {
      cx: x * transform.scale + transform.offsetX,
      cy: transform.offsetY - y * transform.scale,
    };
  };

  const canvasToCad = (cx: number, cy: number) => {
    return {
      x: (cx - transform.offsetX) / transform.scale,
      y: (transform.offsetY - cy) / transform.scale,
    };
  };

  // Render CAD entities onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = containerRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw coordinate grid
    const gridSize = 50 * transform.scale;
    if (gridSize > 15) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const startX = (transform.offsetX % gridSize);
      const startY = (transform.offsetY % gridSize);

      ctx.beginPath();
      for (let x = startX; x < rect.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
      }
      for (let y = startY; y < rect.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
      }
      ctx.stroke();
    }

    // Render CAD entities
    dxfData.entities.forEach(ent => {
      if (activeLayers[ent.layer] === false) return;

      if (ent.type === 'LINE') {
        const p1 = cadToCanvas(ent.start.x, ent.start.y);
        const p2 = cadToCanvas(ent.end.x, ent.end.y);

        ctx.beginPath();
        ctx.moveTo(p1.cx, p1.cy);
        ctx.lineTo(p2.cx, p2.cy);

        if (ent.layer.toLowerCase().includes('eje')) {
          ctx.strokeStyle = '#60a5fa';
          ctx.setLineDash([8, 4, 2, 4]);
          ctx.lineWidth = 1.2;
        } else {
          ctx.strokeStyle = '#e2e8f0';
          ctx.setLineDash([]);
          ctx.lineWidth = 2;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (ent.type === 'LWPOLYLINE') {
        if (ent.vertices.length < 2) return;
        ctx.beginPath();
        const first = cadToCanvas(ent.vertices[0].x, ent.vertices[0].y);
        ctx.moveTo(first.cx, first.cy);

        for (let i = 1; i < ent.vertices.length; i++) {
          const p = cadToCanvas(ent.vertices[i].x, ent.vertices[i].y);
          ctx.lineTo(p.cx, p.cy);
        }
        if (ent.closed) ctx.closePath();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (ent.type === 'ARC') {
        const c = cadToCanvas(ent.center.x, ent.center.y);
        const r = ent.radius * transform.scale;
        const startRad = (-ent.startAngle * Math.PI) / 180;
        const endRad = (-ent.endAngle * Math.PI) / 180;

        ctx.beginPath();
        ctx.arc(c.cx, c.cy, r, startRad, endRad, true);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
        const pos = cadToCanvas(ent.position.x, ent.position.y);
        const fontPx = Math.max(10, Math.min(32, ent.height * transform.scale));
        ctx.font = `600 ${fontPx}px monospace`;
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(ent.text, pos.cx, pos.cy);
      } else if (ent.type === 'CIRCLE') {
        const c = cadToCanvas(ent.center.x, ent.center.y);
        const r = ent.radius * transform.scale;

        let strokeColor = '#f59e0b';
        let glowColor = 'rgba(245, 158, 11, 0.4)';

        if (Math.abs(ent.diameter - 14) < 0.1) {
          strokeColor = '#06b6d4';
          glowColor = 'rgba(6, 182, 212, 0.4)';
        } else if (Math.abs(ent.diameter - 18) < 0.1) {
          strokeColor = '#ec4899';
          glowColor = 'rgba(236, 72, 153, 0.4)';
        } else if (Math.abs(ent.diameter - 22) < 0.1) {
          strokeColor = '#a855f7';
          glowColor = 'rgba(168, 85, 247, 0.4)';
        }

        const isHovered = hoveredHole && Math.abs(hoveredHole.x - ent.center.x) < 1 && Math.abs(hoveredHole.y - ent.center.y) < 1;
        const isSelected = selectedHole && Math.abs(selectedHole.x - ent.center.x) < 1 && Math.abs(selectedHole.y - ent.center.y) < 1;

        ctx.beginPath();
        ctx.arc(c.cx, c.cy, r + 3, 0, Math.PI * 2);
        ctx.fillStyle = isHovered || isSelected ? 'rgba(255, 255, 255, 0.2)' : glowColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(c.cx, c.cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = isHovered || isSelected ? '#ffffff' : strokeColor;
        ctx.lineWidth = isHovered || isSelected ? 3 : 2;
        ctx.fillStyle = isHovered || isSelected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(15, 23, 42, 0.85)';
        ctx.fill();
        ctx.stroke();

        // Crosshairs
        const markSize = Math.max(3, r * 0.6);
        ctx.strokeStyle = isHovered || isSelected ? '#ffffff' : strokeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(c.cx - markSize, c.cy);
        ctx.lineTo(c.cx + markSize, c.cy);
        ctx.moveTo(c.cx, c.cy - markSize);
        ctx.lineTo(c.cx, c.cy + markSize);
        ctx.stroke();

        if (r > 12) {
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = isHovered || isSelected ? '#ffffff' : strokeColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`Ø${ent.diameter}`, c.cx, c.cy - r - 6);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      }
    });

    ctx.restore();
  }, [dxfData, activeLayers, transform, hoveredHole, selectedHole]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.max(0.1, Math.min(10, transform.scale * zoomFactor));

    const cadPos = canvasToCad(mouseX, mouseY);
    const newOffsetX = mouseX - cadPos.x * newScale;
    const newOffsetY = mouseY + cadPos.y * newScale;

    setTransform({
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY,
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      setTransform(prev => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy,
      }));
      return;
    }

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cadPos = canvasToCad(mouseX, mouseY);

    const hit = dxfData.detectedHoles.find(h => {
      const dist = Math.hypot(h.center.x - cadPos.x, h.center.y - cadPos.y);
      return dist <= (h.diameter / 2) + 5;
    });

    if (hit) {
      setHoveredHole({ id: hit.id, x: hit.center.x, y: hit.center.y, diameter: hit.diameter });
    } else {
      setHoveredHole(null);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cadPos = canvasToCad(mouseX, mouseY);

    const hit = dxfData.detectedHoles.find(h => {
      const dist = Math.hypot(h.center.x - cadPos.x, h.center.y - cadPos.y);
      return dist <= (h.diameter / 2) + 5;
    });

    if (hit) {
      setSelectedHole({ id: hit.id, x: hit.center.x, y: hit.center.y, diameter: hit.diameter });
    } else {
      setSelectedHole(null);
    }
  };

  // Upload CAD file: Handles both DXF and DWG gracefully
  const handleUploadCadFile = async (file: File) => {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.dwg')) {
      // Analyze DWG binary header
      try {
        const buffer = await file.arrayBuffer();
        const headerBytes = new Uint8Array(buffer.slice(0, 6));
        const headerString = String.fromCharCode(...headerBytes);

        let dwgVersionName = 'AutoCAD';
        if (headerString.startsWith('AC1032')) dwgVersionName = 'AutoCAD 2018 - 2024';
        else if (headerString.startsWith('AC1027')) dwgVersionName = 'AutoCAD 2013 - 2017';
        else if (headerString.startsWith('AC1024')) dwgVersionName = 'AutoCAD 2010 - 2012';
        else if (headerString.startsWith('AC1021')) dwgVersionName = 'AutoCAD 2007 - 2009';
        else if (headerString.startsWith('AC1018')) dwgVersionName = 'AutoCAD 2004 - 2006';

        // Extract any legible ASCII strings from the DWG (piece names, diameters)
        const textDecoder = new TextDecoder('latin1');
        const contentStr = textDecoder.decode(buffer);
        const matches = Array.from(contentStr.matchAll(/([A-Z0-9_\-\*]{3,20})/g))
          .map(m => m[1])
          .filter(t => !t.startsWith('AC10') && (t.includes('N2') || t.includes('CC') || t.includes('PL') || t.includes('DIA') || t.includes('PERF')))
          .slice(0, 10);

        setDwgFileInfo({
          filename: file.name,
          version: dwgVersionName,
          sizeKb: Math.round(file.size / 1024),
          extractedTexts: matches,
        });
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // Process DXF
    try {
      setDwgFileInfo(null);
      const text = await file.text();
      const parsed = parseDxfContent(text, file.name);
      setDxfData(parsed);
      setSelectedHole(null);
      setHoveredHole(null);
    } catch (err) {
      console.error('Error parseando DXF:', err);
      alert('No se pudo procesar el archivo DXF. Asegúrate de que sea un archivo DXF ASCII.');
    }
  };

  const handleTransferToCsv = () => {
    if (!onImportHolesToCsv) return;

    let partId = dxfData.filename.replace(/\.[^/.]+$/, '').toUpperCase();
    if (partId.includes('N29000')) partId = 'N29000';
    if (partId.includes('BASE')) partId = 'PB-1';

    const holesData = dxfData.holeSummaryByDiameter.map(h => ({
      diameter: h.diameter,
      count: h.count,
    }));

    onImportHolesToCsv(partId, 'CC150-2-20*70', holesData);
    setImportedSuccess(true);
    setTimeout(() => setImportedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Controller Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100 font-mono">
                {dxfData.filename}
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                DXF CAD
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Dimensiones: {dxfData.bounds.width.toFixed(1)} mm × {dxfData.bounds.height.toFixed(1)} mm | {dxfData.detectedHoles.length} perforaciones detectadas
            </p>
          </div>
        </div>

        {/* Action presets and custom upload */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setDwgFileInfo(null);
              setDxfData(parseDxfContent(SAMPLE_DXF_N29000, 'N29000_CC150.dxf'));
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors font-medium cursor-pointer"
          >
            Plano N29000 (CC150)
          </button>
          <button
            onClick={() => {
              setDwgFileInfo(null);
              setDxfData(parseDxfContent(SAMPLE_DXF_BASE_PLATE, 'Placa_Base_PB1.dxf'));
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors font-medium cursor-pointer"
          >
            Placa Base PB-1
          </button>

          <label className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm">
            <Upload className="w-3.5 h-3.5" />
            Subir Plano (DXF o DWG)
            <input
              type="file"
              accept=".dxf,.dwg"
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleUploadCadFile(e.target.files[0]);
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* DWG Binary Notification & Guidance Banner */}
      {dwgFileInfo && (
        <div className="bg-amber-950/40 border-2 border-amber-500/60 rounded-xl p-5 shadow-lg space-y-3 text-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-300">
                Archivo AutoCAD DWG Detectado: <span className="font-mono">{dwgFileInfo.filename}</span> ({dwgFileInfo.version})
              </h4>
              <p className="text-slate-300 leading-relaxed">
                El formato <strong>.dwg</strong> es binario y privativo de AutoCAD. Para que el visor pueda leer las geometrías y contar automáticamente los círculos de perforación, tienes 2 opciones inmediatas y muy sencillas:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-900/90 border border-slate-700 p-3.5 rounded-lg space-y-2">
              <div className="font-bold text-slate-100 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-400" />
                Opción 1: Guardar como DXF en AutoCAD (5 segundos)
              </div>
              <p className="text-slate-400 text-[11px]">
                En AutoCAD o DraftSight: <strong>Archivo &gt; Guardar como... &gt; Tipo: "AutoCAD DXF (*.dxf)"</strong>. Luego sube el archivo .dxf aquí y se visualizará en pantalla completa con todos los agujeros resaltados.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-700 p-3.5 rounded-lg space-y-2">
              <div className="font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Opción 2: Imprimir a PDF o Captura (Con IA)
              </div>
              <p className="text-slate-400 text-[11px]">
                Imprime el plano en PDF o haz una captura de pantalla y súbelo a la pestaña <strong>"Plano PDF / Imagen (IA)"</strong>. Nuestro modelo de visión artificial extraerá todas las piezas y perforaciones directamente del dibujo.
              </p>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('ai')}
                  className="mt-1 text-xs font-bold text-purple-300 hover:text-purple-200 underline flex items-center gap-1 cursor-pointer"
                >
                  Ir al Analizador de Planos PDF / Imagen &rarr;
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Canvas & Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* CAD Canvas Viewer */}
        <div className="lg:col-span-3 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative shadow-inner">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-slate-800 p-1 rounded-lg text-slate-200 shadow-lg">
            <button
              onClick={() => setTransform(t => ({ ...t, scale: Math.min(8, t.scale * 1.2) }))}
              className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer"
              title="Acercar (Zoom +)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.1, t.scale * 0.8) }))}
              className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer"
              title="Alejar (Zoom -)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-700 my-auto"></div>
            <button
              onClick={fitToScreen}
              className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer"
              title="Ajustar al encuadre"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-slate-800 px-3 py-1 rounded-full text-[11px] text-slate-400">
            <MousePointer className="w-3.5 h-3.5 text-amber-400" />
            <span>Arrastrar: Mover plano | Rueda: Zoom | Clic: Inspeccionar perforación</span>
          </div>

          <div className="absolute top-4 right-4 z-10 font-mono text-[11px] bg-slate-900/90 backdrop-blur border border-slate-800 px-2.5 py-1 rounded-lg text-slate-400">
            Escala: {(transform.scale * 100).toFixed(0)}%
          </div>

          <div
            ref={containerRef}
            className="w-full h-[520px] cursor-grab active:cursor-grabbing select-none"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleCanvasClick}
          >
            <canvas ref={canvasRef} className="block w-full h-full" />
          </div>
        </div>

        {/* Right Sidebar: Holes Inspector & Layers */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-amber-400" />
              Perforaciones en este Plano
            </h4>

            <div className="space-y-2">
              {dxfData.holeSummaryByDiameter.map(h => (
                <div
                  key={h.diameter}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        Math.abs(h.diameter - 14) < 0.1
                          ? 'bg-cyan-400'
                          : Math.abs(h.diameter - 15) < 0.1
                          ? 'bg-amber-400'
                          : 'bg-purple-400'
                      }`}
                    ></span>
                    <span className="font-bold text-slate-200">Ø {h.diameter.toFixed(1)} mm</span>
                  </div>
                  <span className="font-bold text-amber-300">
                    {h.count} <span className="font-sans text-[10px] text-slate-400">agujeros</span>
                  </span>
                </div>
              ))}
            </div>

            {selectedHole && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-200 space-y-1">
                <div className="font-bold text-amber-300 font-sans flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" /> Agujero Seleccionado:
                </div>
                <div>Diámetro: <strong>Ø {selectedHole.diameter} mm</strong></div>
                <div>Coordenada X: {selectedHole.x.toFixed(2)} mm</div>
                <div>Coordenada Y: {selectedHole.y.toFixed(2)} mm</div>
              </div>
            )}

            {onImportHolesToCsv && (
              <button
                onClick={handleTransferToCsv}
                className="mt-4 w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {importedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-950" />
                    ¡Transferido a la Planilla!
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Transferir a Planilla de Taller
                  </>
                )}
              </button>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-amber-400" />
              Capas del Archivo (Layers)
            </h4>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {dxfData.layers.map(layer => (
                <label
                  key={layer}
                  className="flex items-center justify-between text-xs text-slate-300 hover:bg-slate-800/60 p-1.5 rounded cursor-pointer"
                >
                  <span className="font-mono truncate">{layer}</span>
                  <input
                    type="checkbox"
                    checked={activeLayers[layer] !== false}
                    onChange={e =>
                      setActiveLayers(prev => ({
                        ...prev,
                        [layer]: e.target.checked,
                      }))
                    }
                    className="accent-amber-400 rounded"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
