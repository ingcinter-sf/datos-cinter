import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Layers, 
  Wrench, 
  Maximize2, 
  ArrowRight,
  Info
} from 'lucide-react';
import { BlueprintAnalysisResult, PartRecord } from '../types';

interface BlueprintAiAnalyzerProps {
  currentCsvParts: PartRecord[];
  onImportAiParts: (parts: any[]) => void;
}

export const BlueprintAiAnalyzer: React.FC<BlueprintAiAnalyzerProps> = ({
  currentCsvParts,
  onImportAiParts,
}) => {
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    type: string;
    previewUrl: string;
    base64: string;
  } | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [analysisResult, setAnalysisResult] = useState<BlueprintAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [imported, setImported] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sample technical drawing
  const loadSampleDrawing = () => {
    // Generate an illustrative canvas drawing representing Piece N29000 & N29001
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark technical drawing style
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1200, 700);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1200; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 700);
      ctx.stroke();
    }
    for (let y = 0; y < 700; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1200, y);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 1140, 640);

    // Title Block (Cajetín)
    ctx.strokeRect(750, 520, 420, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('ESTRUCTURAS METALÚRGICAS BUYANOR', 770, 550);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('PLANO DE TALLER: BUY-PL-29000-REV3', 770, 580);
    ctx.fillText('PIEZAS: N29000 y N29001 (PERFIL CC150-2-20*70)', 770, 605);
    ctx.fillText('MATERIAL: ACERO F-24 / ASTM A36 - ESPESOR: 2.0 mm', 770, 630);
    ctx.fillText('FECHA: 16.10.2026 | ESCALA: 1:10', 770, 655);

    // Draw Piece 1: N29000
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.strokeRect(100, 120, 950, 140);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('PIEZA N29000 (CANT: 5) - PERFIL CC150-2-20*70', 100, 100);

    // Axis line
    ctx.strokeStyle = '#60a5fa';
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(80, 190);
    ctx.lineTo(1070, 190);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2 holes of Ø14mm (left)
    const drawHole = (x: number, y: number, r: number, diamText: string, color: string) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(x - r - 4, y);
      ctx.lineTo(x + r + 4, y);
      ctx.moveTo(x, y - r - 4);
      ctx.lineTo(x, y + r + 4);
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(diamText, x - 18, y - r - 6);
    };

    // Holes for N29000
    drawHole(180, 155, 9, '2x Ø14', '#06b6d4');
    drawHole(180, 225, 9, '', '#06b6d4');

    // 8 holes of Ø15mm
    const xCoords15 = [320, 480, 680, 900];
    xCoords15.forEach(x => {
      drawHole(x, 155, 10, x === 320 ? '8x Ø15' : '', '#f59e0b');
      drawHole(x, 225, 10, '', '#f59e0b');
    });

    // Draw Piece 2: N29001
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.strokeRect(100, 340, 950, 140);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('PIEZA N29001 (CANT: 5) - PERFIL CC150-2-20*70 (10x Ø15mm)', 100, 320);

    // 10 holes of Ø15mm
    const xCoordsN29001 = [180, 340, 520, 720, 920];
    xCoordsN29001.forEach(x => {
      drawHole(x, 375, 10, x === 180 ? '10x Ø15' : '', '#f59e0b');
      drawHole(x, 445, 10, '', '#f59e0b');
    });

    const dataUrl = canvas.toDataURL('image/png');
    setSelectedFile({
      name: 'PLANO_TALLER_N29000_N29001.png',
      type: 'image/png',
      previewUrl: dataUrl,
      base64: dataUrl,
    });
    setAnalysisResult(null);
    setErrorMsg('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedFile({
          name: file.name,
          type: file.type || 'image/png',
          previewUrl: reader.result as string,
          base64: reader.result as string,
        });
        setAnalysisResult(null);
        setErrorMsg('');
      };
      reader.readAsDataURL(file);
    }
  };

  // Run Gemini Vision Analysis
  const handleAnalyzeWithAi = async () => {
    if (!selectedFile) return;

    setAnalyzing(true);
    setErrorMsg('');
    setProgressStep('Cargando documento y enviando a Gemini 3.8 Flash...');

    try {
      const stepTimer1 = setTimeout(() => {
        setProgressStep('Inspeccionando cajetín, marcas de pieza y perfiles...');
      }, 1200);

      const stepTimer2 = setTimeout(() => {
        setProgressStep('Detectando cotas de perforación, diámetros y patrones de agujeros...');
      }, 2600);

      const res = await fetch('/api/analyze-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedFile.base64,
          mimeType: selectedFile.type,
          additionalNotes: 'Taller metalúrgico. Perforaciones en perfiles conformados CC150 y placas.',
        }),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || json.details || 'Error al comunicarse con la IA');
      }

      setAnalysisResult(json.data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al analizar el plano. Por favor verifica la conexión.');
    } finally {
      setAnalyzing(false);
      setProgressStep('');
    }
  };

  // Compare AI detected holes with CSV spreadsheet parts
  const reconcileWithCsv = () => {
    if (!analysisResult) return [];

    const comparisons: {
      partId: string;
      inDrawing: boolean;
      inCsv: boolean;
      drawingHolesTotal: number;
      csvHolesTotal: number;
      status: 'match' | 'diff' | 'missing';
      details: string;
    }[] = [];

    // Check all parts from drawing
    analysisResult.parts.forEach(aiPart => {
      const csvPart = currentCsvParts.find(
        p => p.partId.toLowerCase() === aiPart.partId.toLowerCase()
      );

      if (csvPart) {
        const drawingTotal = aiPart.totalHolesPerPiece;
        const csvTotal = csvPart.totalHolesPerPiece;
        const isMatch = drawingTotal === csvTotal;

        comparisons.push({
          partId: aiPart.partId,
          inDrawing: true,
          inCsv: true,
          drawingHolesTotal: drawingTotal,
          csvHolesTotal: csvTotal,
          status: isMatch ? 'match' : 'diff',
          details: isMatch
            ? `Coincidencia exacta: ${drawingTotal} agujeros por pieza en plano y en CSV`
            : `Discrepancia: Plano tiene ${drawingTotal} agujeros pero CSV tiene ${csvTotal}`,
        });
      } else {
        comparisons.push({
          partId: aiPart.partId,
          inDrawing: true,
          inCsv: false,
          drawingHolesTotal: aiPart.totalHolesPerPiece,
          csvHolesTotal: 0,
          status: 'missing',
          details: 'Presente en el plano pero no figura en la planilla CSV actual',
        });
      }
    });

    return comparisons;
  };

  const handleImportToCsv = () => {
    if (!analysisResult) return;
    onImportAiParts(analysisResult.parts);
    setImported(true);
    setTimeout(() => setImported(false), 3000);
  };

  const comparisonList = reconcileWithCsv();

  return (
    <div className="space-y-6">
      {/* Top Banner & File Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Análisis Inteligente de Planos Técnicos (PDF o Imagen)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sube planos digitalizados, capturas de CAD o archivos PDF para extraer automáticamente el rótulo, piezas y contabilizar perforaciones.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSampleDrawing}
              className="text-xs px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors cursor-pointer"
            >
              Cargar Plano de Ejemplo (N29000 & N29001)
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Subir Plano (PDF / PNG / JPG)
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Blueprint Preview + Analysis Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Blueprint Viewer */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-inner min-h-[460px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-xs">
              <span className="font-mono text-slate-300 flex items-center gap-1.5 font-bold">
                <FileText className="w-4 h-4 text-purple-400" />
                {selectedFile ? selectedFile.name : 'Ningún plano seleccionado'}
              </span>
              {selectedFile && (
                <span className="text-slate-500 font-mono text-[11px]">
                  Vista previa de dibujo
                </span>
              )}
            </div>

            {selectedFile ? (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg overflow-hidden flex items-center justify-center p-2 min-h-[380px] max-h-[500px]">
                <img
                  src={selectedFile.previewUrl}
                  alt="Plano metalúrgico"
                  className="max-h-[460px] w-auto object-contain rounded border border-slate-800"
                />
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="h-[380px] border-2 border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:border-purple-500/50 transition-colors"
              >
                <Upload className="w-10 h-10 text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">
                  Selecciona o arrastra un plano aquí
                </p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Formatos admitidos: Planos exportados a PDF, imágenes de AutoCAD, fotos de planos de taller (JPG/PNG).
                </p>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    loadSampleDrawing();
                  }}
                  className="mt-4 text-xs text-purple-400 hover:text-purple-300 underline font-medium"
                >
                  O haz clic aquí para probar con el plano de muestra
                </button>
              </div>
            )}
          </div>

          {/* Analyze Button */}
          {selectedFile && (
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Listo para inspeccionar perforaciones con visión artificial
              </span>
              <button
                onClick={handleAnalyzeWithAi}
                disabled={analyzing}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizando Plano...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analizar Perforaciones con IA
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right: Analysis Results & Reconciliation */}
        <div className="lg:col-span-5 space-y-4">
          {analyzing && (
            <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-6 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
              <h4 className="text-sm font-bold text-white">
                Analizando Geometría y Perforaciones
              </h4>
              <p className="text-xs text-purple-300/80 font-mono">
                {progressStep}
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-4 text-xs text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong>Error en el análisis:</strong> {errorMsg}
              </div>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-4">
              {/* Project / Title Block Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm text-xs">
                <div className="font-bold text-slate-200 text-sm flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
                  <FileText className="w-4 h-4 text-purple-400" />
                  Rótulo del Plano
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 block font-sans">Proyecto:</span>
                    <strong className="text-slate-100">{analysisResult.projectInfo.projectName || 'Sin especificar'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Plano Nº:</span>
                    <strong className="text-slate-100">{analysisResult.projectInfo.drawingNumber || 'BUY-PL-29000'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Material:</span>
                    <strong className="text-slate-100">{analysisResult.projectInfo.material || 'Acero A36'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">Espesor:</span>
                    <strong className="text-slate-100">{analysisResult.projectInfo.thickness || '2.0 mm'}</strong>
                  </div>
                </div>
              </div>

              {/* Detected Parts & Holes Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm text-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-400" />
                    Piezas y Agujeros Detectados
                  </div>
                  <button
                    onClick={handleImportToCsv}
                    className="text-[11px] font-bold px-2.5 py-1 rounded bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {imported ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> ¡Importado!
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3.5 h-3.5" /> Enviar a Planilla
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-2">
                  {analysisResult.parts.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-lg font-mono space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-slate-200">
                        <span className="font-bold text-amber-400 text-sm">{p.partId}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                          {p.profile} | Cant: {p.quantity}u
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 space-y-0.5 pl-2 border-l-2 border-amber-500/40">
                        {p.holes.map((h, hIdx) => (
                          <div key={hIdx} className="flex justify-between">
                            <span>
                              • {h.countPerPiece}x <strong>Ø{h.diameter}mm</strong> ({h.type || 'pasante'})
                            </span>
                            <span className="text-slate-500">
                              Total lote: {h.countPerPiece * p.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-1 text-[11px] text-right font-bold text-slate-300">
                        Total en la pieza: <span className="text-amber-300">{p.totalHolesPerPiece} perforaciones</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cruce Plano vs Planilla CSV */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm text-xs space-y-3">
                <div className="font-bold text-slate-200 text-sm flex items-center gap-2 pb-2 border-b border-slate-800">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Cruce: Plano vs Planilla CSV
                </div>

                <div className="space-y-1.5">
                  {comparisonList.map((comp, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                        comp.status === 'match'
                          ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                          : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                      }`}
                    >
                      {comp.status === 'match' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <div className="font-bold font-mono">Pieza {comp.partId}</div>
                        <div className="text-[11px]">{comp.details}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Observations */}
              {analysisResult.technicalObservations && analysisResult.technicalObservations.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm text-xs space-y-2">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5 text-amber-400">
                    <Info className="w-4 h-4" /> Observaciones Metalúrgicas para Fabricación
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                    {analysisResult.technicalObservations.map((obs, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {obs}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!selectedFile && !analyzing && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 text-center text-slate-500 text-xs">
              Sube o carga un plano para ver el desglose automatizado de perforaciones y su comparación con la planilla CSV.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
