import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Building2, Upload, Trash2, Save } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { TeacherProfile } from '../../types/schema';
import { getScaleThresholds } from '../../utils/academicCalculations';
import {
  ModalDialog,
  InputField,
  Button,
  ConfirmDeleteModal,
} from '../ui/DesignSystem';

interface InstitutionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: TeacherProfile | null;
  onSaved: (message: string) => void;
}

export const InstitutionSettingsModal: React.FC<InstitutionSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaved,
}) => {
  const [fullName, setFullName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [institutionDane, setInstitutionDane] = useState('');
  const [institutionNit, setInstitutionNit] = useState('');
  const [institutionCity, setInstitutionCity] = useState('');
  const [institutionLogoUrl, setInstitutionLogoUrl] = useState('');
  const [gradingScaleMin, setGradingScaleMin] = useState('1.0');
  const [gradingScaleMax, setGradingScaleMax] = useState('5.0');
  const [basicMin, setBasicMin] = useState('3.0');
  const [highMin, setHighMin] = useState('4.0');
  const [superiorMin, setSuperiorMin] = useState('4.6');
  const [customScaleName, setCustomScaleName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);

  useEffect(() => {
    if (profile) {
      const thresholds = getScaleThresholds(profile);
      setFullName(profile.fullName || '');
      setDocumentId(profile.documentId || '');
      setPhone(profile.phone || '');
      setSpecialty(profile.specialty || '');
      setInstitutionName(profile.institutionName || '');
      setInstitutionDane(profile.institutionDane || '');
      setInstitutionNit(profile.institutionNit || '');
      setInstitutionCity(profile.institutionCity || '');
      setInstitutionLogoUrl(profile.institutionLogoUrl || '');
      setGradingScaleMin(String(thresholds.min));
      setGradingScaleMax(String(thresholds.max));
      setBasicMin(String(thresholds.basicMin));
      setHighMin(String(thresholds.highMin));
      setSuperiorMin(String(thresholds.superiorMin));
      setCustomScaleName(profile.customScaleName || '');
    }
  }, [profile, isOpen]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 70000) {
      onSaved(
        'El escudo debe pesar menos de 70 KB para guardarse directamente en la ficha institucional.'
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setInstitutionLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const minVal = parseFloat(gradingScaleMin) || 1.0;
    const maxVal = parseFloat(gradingScaleMax) || 5.0;
    const basicVal = parseFloat(basicMin) || 3.0;
    const highVal = parseFloat(highMin) || 4.0;
    const supVal = parseFloat(superiorMin) || 4.6;

    setIsSaving(true);
    const path = `teachers/${profile.teacherId}`;
    try {
      await updateDoc(doc(db, 'teachers', profile.teacherId), {
        fullName: fullName.trim().slice(0, 150) || 'Docente Titular',
        documentId: documentId.trim().slice(0, 50),
        phone: phone.trim().slice(0, 50),
        specialty: specialty.trim().slice(0, 150),
        institutionName:
          institutionName.trim().slice(0, 200) || 'Institución Educativa',
        institutionDane: institutionDane.trim().slice(0, 50),
        institutionNit: institutionNit.trim().slice(0, 50),
        institutionCity: institutionCity.trim().slice(0, 100),
        institutionLogoUrl: institutionLogoUrl.slice(0, 100000),
        gradingScaleMin: minVal,
        gradingScaleMax: maxVal,
        passingScore: basicVal,
        basicMin: basicVal,
        highMin: highVal,
        superiorMin: supVal,
        customScaleName: customScaleName.trim().slice(0, 100),
        updatedAt: serverTimestamp(),
      });
      onSaved('Configuración institucional y rangos SIEE actualizados.');
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ModalDialog
        isOpen={isOpen}
        onClose={onClose}
        title="Configuración Institucional y Escala SIEE"
        subtitle="Personaliza los datos de tu institución y los rangos de la Escala Nacional (Bajo, Básico, Alto, Superior)."
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-6">
          {/* Escudo / Logo de la Institución */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {institutionLogoUrl ? (
                <img
                  src={institutionLogoUrl}
                  alt="Escudo de la institución"
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-xl object-contain bg-white border border-slate-200 p-1.5 shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                  <Building2 className="w-7 h-7" />
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-slate-900 font-display">
                  Escudo o Logo de la Institución
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Aparecerá en el menú superior y en los boletines formales (Módulo 6).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-2 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-teal-800" />
                <span>Subir escudo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  className="hidden"
                />
              </label>
              {institutionLogoUrl && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmRemoveLogo(true)}
                  className="px-3 text-red-700 border-red-200 hover:bg-red-50"
                  title="Eliminar escudo"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Datos de la Institución */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 font-display border-b border-slate-200 pb-2">
              1. Datos de la Institución Educativa
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Nombre de la Institución / Colegio"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="Ej. Institución Educativa Departamental..."
                required
              />
              <InputField
                label="Municipio y Departamento"
                value={institutionCity}
                onChange={(e) => setInstitutionCity(e.target.value)}
                placeholder="Ej. Medellín, Antioquia"
              />
              <InputField
                label="Código DANE (Opcional)"
                value={institutionDane}
                onChange={(e) => setInstitutionDane(e.target.value)}
                placeholder="Ej. 105001001234"
              />
              <InputField
                label="NIT Institucional (Opcional)"
                value={institutionNit}
                onChange={(e) => setInstitutionNit(e.target.value)}
                placeholder="Ej. 890.900.123-4"
              />
            </div>
          </div>

          {/* Escala de Calificación SIEE (Decreto 1290) y Rangos Configurables */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 font-display border-b border-slate-200 pb-2">
              2. Escala Institucional SIEE y Rangos de Desempeño (Decreto 1290)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <InputField
                label="Nota Mínima"
                type="number"
                step="0.1"
                value={gradingScaleMin}
                onChange={(e) => setGradingScaleMin(e.target.value)}
                helperText="Ej. 1.0"
                required
              />
              <InputField
                label="Desde Básico"
                type="number"
                step="0.1"
                value={basicMin}
                onChange={(e) => setBasicMin(e.target.value)}
                helperText="Aprueba (3.0)"
                required
              />
              <InputField
                label="Desde Alto"
                type="number"
                step="0.1"
                value={highMin}
                onChange={(e) => setHighMin(e.target.value)}
                helperText="Ej. 4.0"
                required
              />
              <InputField
                label="Desde Superior"
                type="number"
                step="0.1"
                value={superiorMin}
                onChange={(e) => setSuperiorMin(e.target.value)}
                helperText="Ej. 4.6"
                required
              />
              <InputField
                label="Nota Máxima"
                type="number"
                step="0.1"
                value={gradingScaleMax}
                onChange={(e) => setGradingScaleMax(e.target.value)}
                helperText="Ej. 5.0"
                required
              />
            </div>

            <InputField
              label="Nombres de escala propia (Opcional · separados por |)"
              value={customScaleName}
              onChange={(e) => setCustomScaleName(e.target.value)}
              placeholder="Ej. Inicial | En Proceso | Logrado | Destacado"
              helperText="Si tu colegio usa etiquetas adicionales (ej. en Preescolar), escríbelas en orden: Bajo | Básico | Alto | Superior."
            />
          </div>

          {/* Datos del Docente */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 font-display border-b border-slate-200 pb-2">
              3. Datos del Docente Titular
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Nombre Completo del Docente"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <InputField
                label="Área o Especialidad Principal"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Ej. Ciencias Naturales y Educación Ambiental"
              />
              <InputField
                label="Cédula / Documento (Para firmas de actas)"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Ej. CC 71.234.567"
              />
              <InputField
                label="Teléfono de Contacto Institucional"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 300 123 4567"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Guardar configuración
            </Button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDeleteModal
        isOpen={confirmRemoveLogo}
        title="Quitar escudo institucional"
        itemName="Escudo actual de la institución"
        description="El escudo dejará de mostrarse en el encabezado y en los boletines hasta que subas uno nuevo."
        onConfirm={() => {
          setInstitutionLogoUrl('');
          setConfirmRemoveLogo(false);
        }}
        onCancel={() => setConfirmRemoveLogo(false)}
      />
    </>
  );
};
