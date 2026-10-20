import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware for parsing JSON (allow large payloads for CAD images/drawings)
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Initialize Google Gen AI server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API: Analyze Blueprint using Gemini 3.8 Flash Vision
app.post('/api/analyze-blueprint', async (req, res) => {
  try {
    const { imageBase64, mimeType, additionalNotes } = req.body;

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'Falta la imagen o archivo del plano en base64.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

    const prompt = `Eres un ingeniero experto en cálculo de estructuras metálicas, calderería y fabricación CNC en talleres metalúrgicos.
Analiza detenidamente este plano técnico / dibujo de taller / tabla de perforaciones.
Tu objetivo es identificar todas las piezas, perfiles, espesores y contabilizar con máxima precisión todas las perforaciones (agujeros/taladros/punzonados) por diámetro y por pieza.

Instrucciones:
1. Revisa el cajetín / rótulo (título de proyecto, número de plano, pieza/marca, material, fecha, revisado).
2. Examina las vistas (planta, alzado, corte, detalles) y cotas.
3. Busca textos de cotas típicos como "2x Ø14", "4 taladros D15", "Ø15.0 PASANTE", "Coliso 15x30", tablas de agujeros ("Hole schedule" / "Tabla de bulones").
4. Para cada pieza identificada, extrae:
   - Identificador o Marca de pieza (ej: N29000, P-1, Cartela C1, etc.)
   - Perfil o sección (ej: CC150-2-20*70, IPE 200, Placa e=12.7mm, etc.)
   - Cantidad de piezas a fabricar (si no se especifica, asumir 1)
   - Lista detallada de perforaciones:
     * Diametro en mm (ej: 14, 15, 18, 22)
     * Cantidad de agujeros de ese diámetro por CADA pieza
     * Tipo: pasante (cilíndrico normal), avellanado, roscado, coliso (ranura/slotted)
     * Ubicación aproximada (ej: en alma, en ala, en extremos, centro)
5. Proporciona observaciones técnicas metalúrgicas (ej: verificar distancia al borde mínima según norma CIRSOC / AISC, recomendación de broca vs punzonadora CNC, etc.).

Devuelve los datos estrictamente en formato JSON con la siguiente estructura:
{
  "projectInfo": {
    "projectName": string,
    "drawingNumber": string,
    "material": string,
    "thickness": string,
    "scale": string,
    "notes": string
  },
  "parts": [
    {
      "partId": string,
      "profile": string,
      "quantity": number,
      "holes": [
        {
          "diameter": number,
          "countPerPiece": number,
          "type": "pasante" | "coliso" | "roscado" | "avellanado",
          "location": string
        }
      ],
      "totalHolesPerPiece": number,
      "totalHolesAllPieces": number
    }
  ],
  "holeSummaryByDiameter": [
    {
      "diameter": number,
      "totalHolesInDrawing": number,
      "suggestedTool": string
    }
  ],
  "technicalObservations": [string],
  "confidenceScore": number
}

${additionalNotes ? `Nota adicional del operador: ${additionalNotes}` : ''}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // Clean possible markdown code fences if any
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error procesando plano con Gemini:', error);
    return res.status(500).json({
      error: 'Error al analizar el plano con IA.',
      details: error?.message || String(error),
    });
  }
});

// Setup Vite middleware in development or serve static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MetalMetric Server escuchando en http://0.0.0.0:${PORT}`);
  });
}

startServer();
