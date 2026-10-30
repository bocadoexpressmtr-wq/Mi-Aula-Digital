import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STUDENT_LIST_SCHEMA = {
  type: Type.ARRAY,
  description: 'Lista de estudiantes extraídos de la imagen.',
  items: {
    type: Type.OBJECT,
    properties: {
      firstName: {
        type: Type.STRING,
        description: 'Nombres del estudiante (ej. Juan Camilo)',
      },
      lastName: {
        type: Type.STRING,
        description: 'Apellidos del estudiante (ej. Gómez Pérez)',
      },
      documentType: {
        type: Type.STRING,
        description:
          'Tipo de documento si aparece: RC, TI, CC, CE, PPT, NES u Otro. Por defecto TI.',
      },
      documentNumber: {
        type: Type.STRING,
        description: 'Número de documento si aparece en la imagen.',
      },
      guardianName: {
        type: Type.STRING,
        description: 'Nombre del acudiente si aparece.',
      },
      guardianPhone: {
        type: Type.STRING,
        description: 'Teléfono si aparece.',
      },
    },
    required: ['firstName', 'lastName'],
  },
};

const OCR_PROMPT =
  'Analiza esta imagen o fotografía de una lista escolar de estudiantes en Colombia. ' +
  'Extrae cada estudiante encontrado separando claramente sus nombres (firstName) y sus apellidos (lastName). ' +
  'Si la lista está en formato "APELLIDOS NOMBRES" (muy común en planillas escolares colombianas), sepáralos adecuadamente para que lastName contenga los apellidos y firstName contenga los nombres. ' +
  'Ignora números de orden al inicio de cada fila (ej. 1, 2, 01, 02) y casillas de verificación. ' +
  'Si aparecen tipo de documento (RC, TI, CC, CE, PPT, NES), número de documento, nombre del acudiente o teléfono, extráelos también; si no aparecen, déjalos como cadena vacía.';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Permitir imágenes base64 de listas de clase hasta 30MB
  app.use(express.json({ limit: '30mb' }));

  app.post('/api/ai/extract-students', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error:
            'La clave GEMINI_API_KEY no está configurada en el entorno del servidor.',
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const { imageBase64, mimeType } = req.body || {};
      if (!imageBase64 || !mimeType) {
        res.status(400).json({
          error: 'Debes adjuntar una imagen válida de la lista de estudiantes.',
        });
        return;
      }

      const cleanBase64 = String(imageBase64).replace(
        /^data:[^;]+;base64,/,
        ''
      );

      // Modelos en orden de velocidad y disponibilidad con respaldo automático
      const modelsToTry: Array<{ name: string; useLowThinking: boolean }> = [
        { name: 'gemini-3.1-flash-lite', useLowThinking: false },
        { name: 'gemini-3.8-flash', useLowThinking: true },
        { name: 'gemini-flash-latest', useLowThinking: false },
      ];

      let rawText = '[]';
      let lastError: unknown = null;
      let succeeded = false;

      for (const candidate of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: candidate.name,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64,
                  },
                },
                {
                  text: OCR_PROMPT,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: STUDENT_LIST_SCHEMA,
              ...(candidate.useLowThinking
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          });

          if (response.text) {
            rawText = response.text.trim();
            succeeded = true;
            break;
          }
        } catch (err) {
          lastError = err;
          console.warn(
            `Model ${candidate.name} failed during OCR extraction, trying next fallback:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      if (!succeeded && lastError) {
        throw lastError;
      }

      const cleanedJson = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let parsedStudents = [];
      try {
        parsedStudents = JSON.parse(cleanedJson);
      } catch {
        parsedStudents = [];
      }

      res.json({
        students: Array.isArray(parsedStudents) ? parsedStudents : [],
      });
    } catch (error: unknown) {
      console.error('Error extracting students with Gemini:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Error al procesar la imagen con IA.';
      res.status(500).json({ error: message });
    }
  });

  // Manejador de errores JSON para rutas /api/* (evita que Express devuelva HTML <!DOCTYPE html>)
  app.use(
    '/api',
    (
      err: Error & { status?: number; type?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('API middleware error:', err);
      const status = err.status || 500;
      const msg =
        err.type === 'entity.too.large'
          ? 'La imagen es demasiado pesada. Intenta con una foto más liviana.'
          : err.message || 'Error interno en el servidor.';
      res.status(status).json({ error: msg });
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mi Aula Digital server running on http://localhost:${PORT}`);
  });
}

startServer();
