import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import {
  FileSpreadsheet,
  Camera,
  Download,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Student } from '../../types/schema';
import { ModalDialog, Button } from '../ui/DesignSystem';

export interface DraftStudentRow {
  tempId: string;
  lastName: string;
  firstName: string;
  documentType: Student['documentType'];
  documentNumber: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
}

interface StudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'excel' | 'photo';
  teacherId: string;
  academicYearId: string;
  gradeGroupId: string;
  courseDisplayName: string;
  onNotify: (title: string, detail?: string, type?: 'success' | 'error' | 'info') => void;
}

const VALID_DOC_TYPES: Student['documentType'][] = [
  'RC',
  'TI',
  'CC',
  'CE',
  'PPT',
  'NES',
  'Otro',
];

function normalizeDocType(raw?: string): Student['documentType'] {
  if (!raw) return 'TI';
  const upper = raw.trim().toUpperCase();
  if (VALID_DOC_TYPES.includes(upper as Student['documentType'])) {
    return upper as Student['documentType'];
  }
  return 'TI';
}

export const StudentImportModal: React.FC<StudentImportModalProps> = ({
  isOpen,
  onClose,
  mode,
  teacherId,
  academicYearId,
  gradeGroupId,
  courseDisplayName,
  onNotify,
}) => {
  const [rows, setRows] = useState<DraftStudentRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const resetAll = () => {
    setRows([]);
    setErrorMsg(null);
    setPreviewImage(null);
    setIsProcessing(false);
  };

  // Descargar plantilla de ejemplo en Excel (.xlsx)
  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        Apellidos: 'Gómez Pérez',
        Nombres: 'Juan Camilo',
        'Tipo Documento': 'TI',
        'Número Documento': '1023456789',
        Acudiente: 'María Elena Pérez',
        'Teléfono Acudiente': '3101234567',
        'Correo Acudiente': 'maria.perez@correo.com',
      },
      {
        Apellidos: 'Rodríguez López',
        Nombres: 'Valentina Sofía',
        'Tipo Documento': 'TI',
        'Número Documento': '1023987654',
        Acudiente: 'Carlos Rodríguez',
        'Teléfono Acudiente': '3159876543',
        'Correo Acudiente': 'carlos.rod@correo.com',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estudiantes');
    XLSX.writeFile(workbook, 'Plantilla_Estudiantes_Mi_Aula_Digital.xlsx');
  };

  // Procesar archivo Excel subido por el docente
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          workbook.Sheets[firstSheet],
          { defval: '' }
        );

        const extracted: DraftStudentRow[] = [];

        jsonRows.forEach((r, idx) => {
          const keys = Object.keys(r);
          const findVal = (patterns: string[]) => {
            const k = keys.find((key) =>
              patterns.some((p) => key.toLowerCase().includes(p))
            );
            return k ? String(r[k] ?? '').trim() : '';
          };

          let lastName = findVal(['apellido', 'apellidos', 'lastname']);
          let firstName = findVal(['nombre', 'nombres', 'firstname']);

          // Si el archivo tiene una sola columna "Estudiante" o "Nombre Completo"
          if (!lastName && firstName.includes(' ')) {
            const parts = firstName.split(/\s+/);
            if (parts.length >= 3) {
              lastName = parts.slice(0, 2).join(' ');
              firstName = parts.slice(2).join(' ');
            } else {
              lastName = parts[0];
              firstName = parts.slice(1).join(' ');
            }
          }

          if (firstName || lastName) {
            extracted.push({
              tempId: `xl_${Date.now()}_${idx}`,
              lastName: lastName || 'Sin Apellido',
              firstName: firstName || 'Sin Nombre',
              documentType: normalizeDocType(findVal(['tipo', 'td', 'doctype'])),
              documentNumber: findVal(['documento', 'numero', 'número', 'identificacion', 'id']),
              guardianName: findVal(['acudiente', 'padre', 'madre']),
              guardianPhone: findVal(['telefono', 'teléfono', 'celular', 'whatsapp']),
              guardianEmail: findVal(['correo', 'email']),
            });
          }
        });

        if (extracted.length === 0) {
          setErrorMsg(
            'No se encontraron filas con nombres o apellidos en el archivo Excel. Descarga la plantilla de ejemplo para guiar el formato.'
          );
        } else {
          setRows(extracted);
        }
      } catch {
        setErrorMsg('No se pudo leer el archivo Excel. Verifica que sea un archivo .xlsx o .csv válido.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Optimizar/redimensionar imagen en el navegador para evitar excesos de peso o tiempos de espera
  const compressImageToDataUrl = (file: File): Promise<{ dataUrl: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const originalDataUrl = String(reader.result || '');
        const img = new Image();
        img.onload = () => {
          try {
            const MAX_DIM = 1600;
            let width = img.width;
            let height = img.height;
            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/jpeg', 0.85);
              resolve({ dataUrl: compressed, mimeType: 'image/jpeg' });
              return;
            }
          } catch {
            // Si falla canvas, usar imagen original
          }
          resolve({
            dataUrl: originalDataUrl,
            mimeType: file.type || 'image/jpeg',
          });
        };
        img.onerror = () => {
          resolve({
            dataUrl: originalDataUrl,
            mimeType: file.type || 'image/jpeg',
          });
        };
        img.src = originalDataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  // Procesar foto o imagen de lista con IA (Gemini en el servidor)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const { dataUrl, mimeType } = await compressImageToDataUrl(file);
      setPreviewImage(dataUrl);

      const response = await fetch('/api/ai/extract-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType,
        }),
      });

      const rawText = await response.text();
      let payload: { students?: Array<Partial<DraftStudentRow>>; error?: string } = {};

      try {
        payload = JSON.parse(rawText);
      } catch {
        throw new Error(
          'El servidor tardó demasiado o estaba reiniciándose al procesar la foto. Por favor intenta subir la foto nuevamente.'
        );
      }

      if (!response.ok) {
        throw new Error(
          payload.error || 'No se pudo procesar la imagen con IA.'
        );
      }

      const aiStudents: Array<Partial<DraftStudentRow>> =
        payload.students || [];

      if (aiStudents.length === 0) {
        setErrorMsg(
          'La IA no detectó nombres legibles en la imagen. Puedes agregar filas manualmente en la tabla o intentar con una foto más clara.'
        );
        setRows([
          {
            tempId: `ai_empty_${Date.now()}`,
            lastName: '',
            firstName: '',
            documentType: 'TI',
            documentNumber: '',
            guardianName: '',
            guardianPhone: '',
            guardianEmail: '',
          },
        ]);
      } else {
        setRows(
          aiStudents.map((st, idx) => ({
            tempId: `ai_${Date.now()}_${idx}`,
            lastName: String(st.lastName || '').trim(),
            firstName: String(st.firstName || '').trim(),
            documentType: normalizeDocType(st.documentType),
            documentNumber: String(st.documentNumber || '').trim(),
            guardianName: String(st.guardianName || '').trim(),
            guardianPhone: String(st.guardianPhone || '').trim(),
            guardianEmail: '',
          }))
        );
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error de conexión al analizar la foto de la lista.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRowChange = (
    tempId: string,
    field: keyof DraftStudentRow,
    value: string
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, [field]: value } : r))
    );
  };

  const handleAddBlankRow = () => {
    setRows((prev) => [
      ...prev,
      {
        tempId: `manual_row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        lastName: '',
        firstName: '',
        documentType: 'TI',
        documentNumber: '',
        guardianName: '',
        guardianPhone: '',
        guardianEmail: '',
      },
    ]);
  };

  const handleRemoveRow = (tempId: string) => {
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const handleConfirmImport = async () => {
    const validRows = rows.filter(
      (r) => r.firstName.trim().length > 0 && r.lastName.trim().length > 0
    );

    if (validRows.length === 0) {
      setErrorMsg(
        'Debes tener al menos un estudiante con Nombres y Apellidos completos antes de confirmar.'
      );
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const batch = writeBatch(db);

      validRows.forEach((r, idx) => {
        const studentId = `stu_${Date.now()}_${idx}_${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        const studentRef = doc(db, 'students', studentId);

        batch.set(studentRef, {
          teacherId,
          academicYearId,
          gradeGroupId,
          firstName: r.firstName.trim().slice(0, 120),
          lastName: r.lastName.trim().slice(0, 120),
          documentType: normalizeDocType(r.documentType),
          documentNumber: r.documentNumber.trim().slice(0, 50),
          guardianName: r.guardianName.trim().slice(0, 150),
          guardianPhone: r.guardianPhone.trim().slice(0, 50),
          guardianEmail: r.guardianEmail.trim().slice(0, 150),
          status: 'Activo',
          customValues: {},
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      onNotify(
        'Estudiantes cargados con éxito',
        `Se agregaron ${validRows.length} estudiantes a ${courseDisplayName}.`
      );
      resetAll();
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'students');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={() => {
        resetAll();
        onClose();
      }}
      title={
        mode === 'excel'
          ? `Cargar Estudiantes desde Excel · ${courseDisplayName}`
          : `Reconocimiento de Lista por Foto con IA · ${courseDisplayName}`
      }
      subtitle="Revisa, corrige, agrega o elimina filas en la tabla editable antes de guardar definitivamente."
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {mode === 'excel' ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-teal-800" />
                <span>Paso 1: Descarga la plantilla o sube tu listado en Excel</span>
              </p>
              <p className="text-xs text-slate-600">
                Acepta archivos `.xlsx`, `.xls` o `.csv`. Reconoce columnas de Apellidos, Nombres, Documento y Acudiente.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadTemplate}
                leftIcon={<Download className="w-4 h-4 text-teal-800" />}
              >
                Descargar Plantilla Ejemplo
              </Button>

              <label className="min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-800 text-white hover:bg-teal-900 text-sm font-medium inline-flex items-center gap-2 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>Subir Excel</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-800" />
                <span>Paso 1: Toma una foto o sube una imagen de tu lista impresa o manuscrita</span>
              </p>
              <p className="text-xs text-slate-600">
                La inteligencia artificial leerá los nombres y apellidos y te mostrará la tabla editable abajo para que verifiques antes de guardar.
              </p>
            </div>

            <label className="min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-800 text-white hover:bg-teal-900 text-sm font-medium inline-flex items-center gap-2 cursor-pointer shrink-0 transition-colors">
              <Camera className="w-4 h-4" />
              <span>{isProcessing ? 'Analizando con IA...' : 'Subir o Tomar Foto'}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                disabled={isProcessing}
                className="hidden"
              />
            </label>
          </div>
        )}

        {previewImage && mode === 'photo' && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-4">
            <img
              src={previewImage}
              alt="Vista previa de lista subida"
              referrerPolicy="no-referrer"
              className="h-16 w-24 object-cover rounded-lg border border-slate-200 shrink-0"
            />
            <div className="text-xs text-slate-600">
              {isProcessing ? (
                <span className="font-semibold text-teal-800">
                  Extrayendo nombres y apellidos de la imagen con IA...
                </span>
              ) : (
                <span>
                  Imagen analizada. Revisa y corrige cualquier letra en la tabla de abajo antes de confirmar.
                </span>
              )}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tabla Editable de Revisión Previa */}
        {rows.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900 font-display">
                Paso 2: Tabla Editable de Revisión ({rows.length} estudiantes detectados)
              </h4>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddBlankRow}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Agregar fila adicional
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-[340px]">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Apellidos *</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Nombres *</th>
                    <th className="py-2.5 px-3 min-w-[90px]">Tipo Doc</th>
                    <th className="py-2.5 px-3 min-w-[130px]">N° Documento</th>
                    <th className="py-2.5 px-3 min-w-[150px]">Acudiente</th>
                    <th className="py-2.5 px-3 min-w-[120px]">Teléfono</th>
                    <th className="py-2.5 px-3 text-center">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((r, index) => (
                    <tr key={r.tempId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono tabular-nums text-slate-500">
                        {index + 1}
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={r.lastName}
                          onChange={(e) =>
                            handleRowChange(r.tempId, 'lastName', e.target.value)
                          }
                          placeholder="Apellidos"
                          className="w-full min-h-[38px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={r.firstName}
                          onChange={(e) =>
                            handleRowChange(r.tempId, 'firstName', e.target.value)
                          }
                          placeholder="Nombres"
                          className="w-full min-h-[38px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={r.documentType}
                          onChange={(e) =>
                            handleRowChange(
                              r.tempId,
                              'documentType',
                              e.target.value
                            )
                          }
                          className="w-full min-h-[38px] rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 bg-white"
                        >
                          {VALID_DOC_TYPES.map((dt) => (
                            <option key={dt} value={dt}>
                              {dt}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={r.documentNumber}
                          onChange={(e) =>
                            handleRowChange(
                              r.tempId,
                              'documentNumber',
                              e.target.value
                            )
                          }
                          placeholder="Documento"
                          className="w-full min-h-[38px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-mono text-slate-900 focus:border-teal-700 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={r.guardianName}
                          onChange={(e) =>
                            handleRowChange(
                              r.tempId,
                              'guardianName',
                              e.target.value
                            )
                          }
                          placeholder="Nombre acudiente"
                          className="w-full min-h-[38px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={r.guardianPhone}
                          onChange={(e) =>
                            handleRowChange(
                              r.tempId,
                              'guardianPhone',
                              e.target.value
                            )
                          }
                          placeholder="Celular"
                          className="w-full min-h-[38px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-mono text-slate-900 focus:border-teal-700 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(r.tempId)}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetAll();
                  onClose();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmImport}
                isLoading={isSaving}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Confirmar y Guardar {rows.length} Estudiantes
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModalDialog>
  );
};
