import React, { useState } from 'react';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Save,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { StudentCustomField } from '../../types/schema';
import {
  ModalDialog,
  InputField,
  SelectField,
  Button,
  ConfirmDeleteModal,
} from '../ui/DesignSystem';

interface CustomFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherId: string;
  customFields: StudentCustomField[];
  onNotify: (title: string, detail?: string, type?: 'success' | 'error' | 'info') => void;
}

const DEFAULT_FIELDS_SUMMARY = [
  'Nombres',
  'Apellidos',
  'Tipo de documento (RC, TI, CC, CE, PPT, NES)',
  'Número de documento',
  'Nombre del acudiente',
  'Teléfono del acudiente',
  'Correo del acudiente',
];

export const CustomFieldsModal: React.FC<CustomFieldsModalProps> = ({
  isOpen,
  onClose,
  teacherId,
  customFields,
  onNotify,
}) => {
  const [editingField, setEditingField] = useState<StudentCustomField | null>(null);
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<StudentCustomField['fieldType']>('text');
  const [optionsText, setOptionsText] = useState('');
  const [required, setRequired] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<StudentCustomField | null>(null);

  const sortedFields = [...customFields].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );

  const resetForm = () => {
    setEditingField(null);
    setLabel('');
    setFieldType('text');
    setOptionsText('');
    setRequired(false);
  };

  const handleStartEdit = (field: StudentCustomField) => {
    setEditingField(field);
    setLabel(field.label);
    setFieldType(field.fieldType);
    setOptionsText((field.options || []).join(', '));
    setRequired(field.required);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    setIsSaving(true);
    const parsedOptions =
      fieldType === 'select'
        ? optionsText
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
            .slice(0, 30)
        : [];

    try {
      if (editingField) {
        const path = `student_custom_fields/${editingField.id}`;
        try {
          await updateDoc(doc(db, 'student_custom_fields', editingField.id), {
            fieldKey: editingField.fieldKey,
            label: label.trim().slice(0, 120),
            fieldType,
            options: parsedOptions,
            required,
            order: editingField.order ?? 0,
            updatedAt: serverTimestamp(),
          });
          onNotify('Campo actualizado', `Se actualizó el campo "${label.trim()}".`);
          resetForm();
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        const cleanSlug = label
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 40);
        const fieldKey = `${cleanSlug || 'campo'}_${Date.now().toString(36)}`;
        const newId = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const nextOrder =
          sortedFields.length > 0
            ? Math.max(...sortedFields.map((f) => f.order ?? 0)) + 1
            : 1;

        const path = `student_custom_fields/${newId}`;
        try {
          await setDoc(doc(db, 'student_custom_fields', newId), {
            teacherId,
            fieldKey,
            label: label.trim().slice(0, 120),
            fieldType,
            options: parsedOptions,
            required,
            order: nextOrder,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          onNotify('Campo personalizado creado', `Se añadió "${label.trim()}" a la ficha estudiantil.`);
          resetForm();
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveField = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedFields.length) return;

    const current = sortedFields[index];
    const neighbor = sortedFields[targetIndex];

    const currentOrder = index + 1;
    const neighborOrder = targetIndex + 1;

    try {
      await updateDoc(doc(db, 'student_custom_fields', current.id), {
        fieldKey: current.fieldKey,
        label: current.label,
        fieldType: current.fieldType,
        options: current.options || [],
        required: current.required,
        order: neighborOrder,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'student_custom_fields', neighbor.id), {
        fieldKey: neighbor.fieldKey,
        label: neighbor.label,
        fieldType: neighbor.fieldType,
        options: neighbor.options || [],
        required: neighbor.required,
        order: currentOrder,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `student_custom_fields/${current.id}`
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!fieldToDelete) return;
    const path = `student_custom_fields/${fieldToDelete.id}`;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'student_custom_fields', fieldToDelete.id));
      onNotify('Campo eliminado', `Se eliminó "${fieldToDelete.label}".`);
      setFieldToDelete(null);
      if (editingField?.id === fieldToDelete.id) {
        resetForm();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    } finally {
      setIsSaving(false);
    }
  };

  const fieldTypeLabel = (type: StudentCustomField['fieldType']) => {
    switch (type) {
      case 'text':
        return 'Texto';
      case 'number':
        return 'Número';
      case 'date':
        return 'Fecha';
      case 'select':
        return 'Lista de opciones';
      case 'boolean':
        return 'Sí / No';
      default:
        return type;
    }
  };

  return (
    <>
      <ModalDialog
        isOpen={isOpen}
        onClose={() => {
          resetForm();
          onClose();
        }}
        title="Campos Personalizables de Estudiantes"
        subtitle="Añade, renombra, reordena o elimina campos adicionales para tus fichas estudiantiles."
        maxWidth="2xl"
      >
        <div className="space-y-6">
          {/* Campos base incluidos por defecto */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-bold text-slate-900 font-display">
              Campos base incluidos por defecto en todos los cursos:
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {DEFAULT_FIELDS_SUMMARY.join(' · ')}
            </p>
          </div>

          {/* Formulario para crear o renombrar campo */}
          <form
            onSubmit={handleSaveField}
            className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-teal-800" />
                <span>
                  {editingField
                    ? `Editando campo: ${editingField.label}`
                    : 'Crear nuevo campo personalizado'}
                </span>
              </h4>
              {editingField && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Nombre del campo"
                placeholder="Ej. EPS, Barrio, Transporte Escolar, PIAR..."
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
              <SelectField
                label="Tipo de dato"
                value={fieldType}
                onChange={(e) =>
                  setFieldType(e.target.value as StudentCustomField['fieldType'])
                }
                options={[
                  { value: 'text', label: 'Texto (Ej. Barrio, Observación corta)' },
                  { value: 'number', label: 'Número (Ej. Edad, Estrato, Hermanos)' },
                  { value: 'date', label: 'Fecha (Ej. Fecha de matrícula)' },
                  { value: 'select', label: 'Lista de opciones desplegable' },
                  { value: 'boolean', label: 'Sí / No (Ej. ¿Tiene PIAR?, ¿Restaurante?)' },
                ]}
              />
            </div>

            {fieldType === 'select' && (
              <InputField
                label="Opciones de la lista (separadas por coma)"
                placeholder="Ej. Urbano, Rural, Veredal"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                helperText="Escribe cada opción separada por una coma."
                required
              />
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
                />
                <span>Marcar como campo obligatorio en la ficha</span>
              </label>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSaving}
                leftIcon={
                  editingField ? (
                    <Save className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )
                }
              >
                {editingField ? 'Guardar cambios del campo' : 'Agregar campo'}
              </Button>
            </div>
          </form>

          {/* Lista de campos personalizados creados */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 font-display">
              Tus campos personalizados ({sortedFields.length})
            </h4>

            {sortedFields.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
                Aún no has creado campos adicionales. Usa el formulario de arriba si necesitas agregar datos como EPS, RH, PIAR, Barrio o Ruta Escolar.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {sortedFields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400 tabular-nums">
                          #{idx + 1}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {field.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span>Tipo: {fieldTypeLabel(field.fieldType)}</span>
                        {field.required && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="text-teal-800 font-medium">
                              Obligatorio
                            </span>
                          </>
                        )}
                        {field.fieldType === 'select' &&
                          field.options &&
                          field.options.length > 0 && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span>Opciones: {field.options.join(', ')}</span>
                            </>
                          )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveField(idx, 'up')}
                        disabled={idx === 0}
                        className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                        title="Subir posición"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveField(idx, 'down')}
                        disabled={idx === sortedFields.length - 1}
                        className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                        title="Bajar posición"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(field)}
                        className="min-h-[38px] px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Renombrar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFieldToDelete(field)}
                        className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                        title="Eliminar campo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalDialog>

      <ConfirmDeleteModal
        isOpen={Boolean(fieldToDelete)}
        title="Eliminar campo personalizado"
        itemName={fieldToDelete?.label || ''}
        description="El campo dejará de mostrarse en las fichas de estudiantes. ¿Confirmas su eliminación?"
        isLoading={isSaving}
        onConfirm={handleConfirmDelete}
        onCancel={() => setFieldToDelete(null)}
      />
    </>
  );
};
