import React, { useState, useEffect } from 'react';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  User,
  CalendarCheck,
  BookOpenCheck,
  ClipboardList,
  Wallet,
  Save,
  Trash2,
  Phone,
  FileText,
  ThumbsUp,
  TrendingUp,
  ShieldAlert,
  Plus,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import {
  Student,
  StudentCustomField,
  GradeGroup,
  AttendanceRecord,
  EvaluationCategory,
  EvaluationActivity,
  GradeEntry,
  AcademicPeriod,
  CourseAssignment,
  TeacherProfile,
  ObservationRecord,
  ObservationType,
  EventCollection,
  EventPaymentItem,
} from '../../types/schema';
import {
  calculateStudentAttendanceSummary,
  calculateStudentPeriodGrade,
  formatScaleLabel,
  formatCOP,
} from '../../utils/academicCalculations';
import {
  getObservationCategoryLabel,
  SimplifiedObservationCategory,
} from '../module4/CourseObserverPanel';
import {
  ModalDialog,
  InputField,
  SelectField,
  TextareaField,
  Button,
  ConfirmDeleteModal,
} from '../ui/DesignSystem';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  group?: GradeGroup;
  customFields: StudentCustomField[];
  attendanceRecords?: AttendanceRecord[];
  categories?: EvaluationCategory[];
  activities?: EvaluationActivity[];
  gradeEntries?: GradeEntry[];
  periods?: AcademicPeriod[];
  courses?: CourseAssignment[];
  observations?: ObservationRecord[];
  eventCollections?: EventCollection[];
  eventPaymentItems?: EventPaymentItem[];
  teacherProfile?: TeacherProfile | null;
  teacherId?: string;
  onNotify: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

type ProfileTab =
  | 'datos'
  | 'asistencia'
  | 'notas'
  | 'observaciones'
  | 'registros';

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  onClose,
  student,
  group,
  customFields,
  attendanceRecords = [],
  categories = [],
  activities = [],
  gradeEntries = [],
  periods = [],
  courses = [],
  observations = [],
  eventCollections = [],
  eventPaymentItems = [],
  teacherProfile,
  teacherId,
  onNotify,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [activeTab, setActiveTab] = useState<ProfileTab>('datos');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentType, setDocumentType] =
    useState<Student['documentType']>('TI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [status, setStatus] = useState<Student['status']>('Activo');
  const [customValues, setCustomValues] = useState<
    Record<string, string | number | boolean>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Estados para registro rápido de observación desde la ficha del estudiante
  const [obsCat, setObsCat] =
    useState<SimplifiedObservationCategory>('positiva');
  const [obsDate, setObsDate] = useState<string>(todayStr);
  const [obsDescription, setObsDescription] = useState<string>('');
  const [obsCommitments, setObsCommitments] = useState<string>('');
  const [obsGuardianNotified, setObsGuardianNotified] =
    useState<boolean>(false);
  const [isSavingObs, setIsSavingObs] = useState(false);

  const sortedCustomFields = [...customFields].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );

  useEffect(() => {
    if (student && isOpen) {
      setActiveTab('datos');
      setFirstName(student.firstName || '');
      setLastName(student.lastName || '');
      setDocumentType(student.documentType || 'TI');
      setDocumentNumber(student.documentNumber || '');
      setGuardianName(student.guardianName || '');
      setGuardianPhone(student.guardianPhone || '');
      setGuardianEmail(student.guardianEmail || '');
      setStatus(student.status || 'Activo');
      setCustomValues({ ...(student.customValues || {}) });
      setObsDescription('');
      setObsCommitments('');
      setObsGuardianNotified(false);
    }
  }, [student, isOpen]);

  if (!student) return null;

  const effectiveTeacherId = teacherId || student.teacherId;

  const handleCustomValueChange = (
    key: string,
    val: string | number | boolean
  ) => {
    setCustomValues((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      onNotify(
        'Campos requeridos',
        'Nombres y apellidos son obligatorios.',
        'error'
      );
      return;
    }

    setIsSaving(true);
    const path = `students/${student.id}`;
    try {
      await updateDoc(doc(db, 'students', student.id), {
        academicYearId: student.academicYearId,
        gradeGroupId: student.gradeGroupId,
        firstName: firstName.trim().slice(0, 120),
        lastName: lastName.trim().slice(0, 120),
        documentType,
        documentNumber: documentNumber.trim().slice(0, 50),
        guardianName: guardianName.trim().slice(0, 150),
        guardianPhone: guardianPhone.trim().slice(0, 50),
        guardianEmail: guardianEmail.trim().slice(0, 150),
        status,
        customValues,
        updatedAt: serverTimestamp(),
      });
      onNotify(
        'Ficha actualizada',
        `Se guardaron los datos de ${lastName.trim()} ${firstName.trim()}.`
      );
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStudent = async () => {
    const path = `students/${student.id}`;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'students', student.id));
      onNotify(
        'Estudiante eliminado',
        `Se eliminó a ${student.lastName} ${student.firstName} del grupo.`
      );
      setConfirmDeleteOpen(false);
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    } finally {
      setIsSaving(false);
    }
  };

  // Datos de Asistencia del estudiante (Fase 2)
  const studentAttendance = attendanceRecords
    .filter((r) => r.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const attSummary = calculateStudentAttendanceSummary(
    student.id,
    studentAttendance
  );

  // Cursos y Periodos del estudiante (Fase 3)
  const studentGroupCourses = courses.filter(
    (c) => c.gradeGroupId === student.gradeGroupId && !c.archived
  );
  const yearPeriods = periods
    .filter((p) => p.academicYearId === student.academicYearId)
    .sort((a, b) => a.number - b.number);

  // Observaciones del estudiante (Fase 4)
  const studentObservations = observations
    .filter((o) => o.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Recaudos y controles del grupo del estudiante (Fase 4)
  const studentCollections = eventCollections
    .filter((ec) => ec.gradeGroupId === student.gradeGroupId)
    .sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));

  const handleQuickAddObservationFromProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsDescription.trim()) return;

    const activePeriod =
      yearPeriods.find((p) => p.isActive) || yearPeriods[0] || periods[0];
    if (!activePeriod) {
      onNotify(
        'Periodo requerido',
        'Configura primero un periodo académico en el Módulo 1.',
        'error'
      );
      return;
    }

    const mappedType: ObservationType =
      obsCat === 'positiva'
        ? 'Reconocimiento Positivo'
        : obsCat === 'mejora'
        ? 'Seguimiento Académico'
        : 'Situación Tipo I';

    setIsSavingObs(true);
    const newId = `obs_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'observations', newId), {
        teacherId: effectiveTeacherId,
        academicYearId: student.academicYearId,
        periodId: activePeriod.id,
        gradeGroupId: student.gradeGroupId,
        courseId: studentGroupCourses[0]?.id || '',
        studentId: student.id,
        date: obsDate,
        type: mappedType,
        description: obsDescription.trim().slice(0, 1500),
        commitments: obsCommitments.trim().slice(0, 1000),
        guardianNotified: obsGuardianNotified,
        status: 'Abierto',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setObsDescription('');
      setObsCommitments('');
      setObsGuardianNotified(false);
      onNotify(
        'Observación guardada',
        `Se registró en el observador de ${student.firstName}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `observations/${newId}`);
    } finally {
      setIsSavingObs(false);
    }
  };

  const handleToggleCollectionStatusInProfile = async (
    col: EventCollection,
    nextStatus: EventPaymentItem['paymentStatus']
  ) => {
    const itemId = `epi_${col.id}_${student.id}`;
    const existing = eventPaymentItems.find((i) => i.id === itemId);
    const amount =
      nextStatus === 'Pagado / Cumplido' ? col.targetAmountCOP || 0 : 0;

    try {
      await setDoc(doc(db, 'event_payment_items', itemId), {
        teacherId: effectiveTeacherId,
        eventCollectionId: col.id,
        gradeGroupId: student.gradeGroupId,
        courseId: col.courseId || '',
        studentId: student.id,
        amountPaidCOP: amount,
        paymentStatus: nextStatus,
        paymentDate: nextStatus === 'Pagado / Cumplido' ? todayStr : '',
        note: existing?.note || '',
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onNotify('Registro actualizado', `Se actualizó "${col.title}".`);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `event_payment_items/${itemId}`
      );
    }
  };

  const tabs: {
    id: ProfileTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'datos', label: 'Datos y Ficha', icon: User },
    {
      id: 'asistencia',
      label: `Asistencia (${attSummary.attendancePercentage}%)`,
      icon: CalendarCheck,
    },
    { id: 'notas', label: 'Notas SIEE', icon: BookOpenCheck },
    {
      id: 'observaciones',
      label: `Observaciones (${studentObservations.length})`,
      icon: ClipboardList,
    },
    {
      id: 'registros',
      label: `Registros (${studentCollections.length})`,
      icon: Wallet,
    },
  ];

  return (
    <>
      <ModalDialog
        isOpen={isOpen}
        onClose={onClose}
        title={`Ficha Estudiantil · ${student.lastName} ${student.firstName}`}
        subtitle={
          group
            ? `Grado ${group.gradeName} · Grupo ${group.groupName} (${group.educationLevel} · Jornada ${group.shift})`
            : 'Expediente individual del estudiante'
        }
        maxWidth="2xl"
      >
        <div className="space-y-6">
          {/* Barra de pestañas de la ficha individual */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* PESTAÑA 1: DATOS Y FICHA PERSONAL */}
          {activeTab === 'datos' && (
            <form onSubmit={handleSaveStudent} className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-900 font-display border-b border-slate-200 pb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-800" />
                  <span>1. Identificación del Estudiante</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Apellidos"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                  <InputField
                    label="Nombres"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                  <SelectField
                    label="Tipo de Documento"
                    value={documentType}
                    onChange={(e) =>
                      setDocumentType(e.target.value as Student['documentType'])
                    }
                    options={[
                      { value: 'TI', label: 'TI · Tarjeta de Identidad' },
                      { value: 'RC', label: 'RC · Registro Civil' },
                      { value: 'CC', label: 'CC · Cédula de Ciudadanía' },
                      { value: 'CE', label: 'CE · Cédula de Extranjería' },
                      {
                        value: 'PPT',
                        label: 'PPT · Permiso por Protección Temporal',
                      },
                      {
                        value: 'NES',
                        label: 'NES · Número Establecido por Secretaría',
                      },
                      { value: 'Otro', label: 'Otro' },
                    ]}
                  />
                  <InputField
                    label="Número de Documento"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="Ej. 1020304050"
                  />
                  <SelectField
                    label="Estado de Matrícula"
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as Student['status'])
                    }
                    options={[
                      { value: 'Activo', label: 'Activo en el aula' },
                      { value: 'Retirado', label: 'Retirado' },
                      {
                        value: 'Trasladado',
                        label: 'Trasladado de grupo/colegio',
                      },
                      { value: 'Desertor', label: 'Desertor' },
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-900 font-display border-b border-slate-200 pb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-teal-800" />
                  <span>2. Datos del Padre de Familia o Acudiente</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <InputField
                    label="Nombre del Acudiente"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="Ej. María Elena Gómez"
                  />
                  <InputField
                    label="Teléfono / WhatsApp"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="Ej. 310 456 7890"
                  />
                  <InputField
                    label="Correo del Acudiente"
                    type="email"
                    value={guardianEmail}
                    onChange={(e) => setGuardianEmail(e.target.value)}
                    placeholder="acudiente@correo.com"
                  />
                </div>
              </div>

              {sortedCustomFields.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 font-display border-b border-slate-200 pb-2">
                    3. Campos Personalizados del Docente
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sortedCustomFields.map((field) => {
                      const val = customValues[field.fieldKey];

                      if (field.fieldType === 'boolean') {
                        return (
                          <div
                            key={field.id}
                            className="flex flex-col gap-1.5 justify-center"
                          >
                            <span className="text-sm font-semibold text-slate-800">
                              {field.label}
                            </span>
                            <label className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white inline-flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(val)}
                                onChange={(e) =>
                                  handleCustomValueChange(
                                    field.fieldKey,
                                    e.target.checked
                                  )
                                }
                                className="h-4 w-4 rounded border-slate-300 text-teal-800"
                              />
                              <span>{val ? 'Sí' : 'No'}</span>
                            </label>
                          </div>
                        );
                      }

                      if (field.fieldType === 'select') {
                        const opts = (field.options || []).map((o) => ({
                          value: o,
                          label: o,
                        }));
                        return (
                          <SelectField
                            key={field.id}
                            label={field.label}
                            value={String(val ?? '')}
                            onChange={(e) =>
                              handleCustomValueChange(
                                field.fieldKey,
                                e.target.value
                              )
                            }
                            options={[
                              { value: '', label: 'Seleccionar...' },
                              ...opts,
                            ]}
                            required={field.required}
                          />
                        );
                      }

                      return (
                        <InputField
                          key={field.id}
                          label={field.label}
                          type={
                            field.fieldType === 'number'
                              ? 'number'
                              : field.fieldType === 'date'
                              ? 'date'
                              : 'text'
                          }
                          value={String(val ?? '')}
                          onChange={(e) =>
                            handleCustomValueChange(
                              field.fieldKey,
                              field.fieldType === 'number'
                                ? Number(e.target.value)
                                : e.target.value
                            )
                          }
                          required={field.required}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setConfirmDeleteOpen(true)}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                >
                  Eliminar estudiante
                </Button>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cerrar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSaving}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Guardar ficha
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* PESTAÑA 2: HISTORIAL Y RESUMEN DE ASISTENCIA DEL ESTUDIANTE */}
          {activeTab === 'asistencia' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Presentes</p>
                  <p className="text-lg font-bold font-mono text-emerald-700 mt-0.5">
                    {attSummary.presentCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Con Excusa</p>
                  <p className="text-lg font-bold font-mono text-teal-800 mt-0.5">
                    {attSummary.excusedAbsenceCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Sin Excusa</p>
                  <p className="text-lg font-bold font-mono text-red-700 mt-0.5">
                    {attSummary.unexcusedAbsenceCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Llegadas Tarde</p>
                  <p className="text-lg font-bold font-mono text-amber-700 mt-0.5">
                    {attSummary.lateCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 col-span-2 sm:col-span-1">
                  <p className="text-xs text-slate-500">% Asistencia</p>
                  <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                    {attSummary.attendancePercentage}%
                  </p>
                </div>
              </div>

              {studentAttendance.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-500">
                  Aún no hay registros de asistencia para este estudiante.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white max-h-[300px] overflow-y-auto">
                  {studentAttendance.map((rec) => {
                    const crs = courses.find((c) => c.id === rec.courseId);
                    return (
                      <div
                        key={rec.id}
                        className="p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            <span className="font-mono">{rec.date}</span> ·{' '}
                            {crs?.displayName || 'Curso'}
                          </p>
                          {rec.note && (
                            <p className="text-slate-500 mt-0.5">
                              Motivo: {rec.note}
                            </p>
                          )}
                        </div>
                        <span
                          className={`font-bold ${
                            rec.status === 'Presente'
                              ? 'text-emerald-700'
                              : rec.status === 'Excusa'
                              ? 'text-teal-800'
                              : rec.status === 'Tardanza'
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}
                        >
                          {rec.status === 'Excusa'
                            ? 'Ausente con excusa'
                            : rec.status === 'Ausente'
                            ? 'Ausente sin excusa'
                            : rec.status === 'Tardanza'
                            ? 'Llegada tarde'
                            : rec.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 3: RESUMEN DE CALIFICACIONES Y DESEMPEÑO SIEE DEL ESTUDIANTE */}
          {activeTab === 'notas' && (
            <div className="space-y-4">
              {studentGroupCourses.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                  No hay cursos asignados a este grupo todavía.
                </div>
              ) : (
                studentGroupCourses.map((crs) => {
                  const crsEntries = gradeEntries.filter(
                    (e) =>
                      e.courseId === crs.id && e.studentId === student.id
                  );

                  return (
                    <div
                      key={crs.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
                    >
                      <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                        <h5 className="text-sm font-bold text-slate-900 font-display">
                          {crs.displayName}
                        </h5>
                        <span className="text-xs text-slate-500 font-mono">
                          {crsEntries.length} notas registradas
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                        {yearPeriods.map((per) => {
                          const pCats = categories.filter(
                            (c) =>
                              c.courseId === crs.id && c.periodId === per.id
                          );
                          const pActs = activities.filter(
                            (a) =>
                              a.courseId === crs.id && a.periodId === per.id
                          );
                          const pEnts = gradeEntries.filter(
                            (e) =>
                              e.courseId === crs.id && e.periodId === per.id
                          );
                          const sum = calculateStudentPeriodGrade(
                            student.id,
                            pCats,
                            pActs,
                            pEnts,
                            teacherProfile
                          );

                          return (
                            <div
                              key={per.id}
                              className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs"
                            >
                              <p className="font-semibold text-slate-700">
                                {per.name} ({per.weightPercentage}%)
                              </p>
                              <p className="text-base font-bold font-mono text-slate-900 mt-1">
                                {sum.finalPeriodScore !== null
                                  ? sum.finalPeriodScore.toFixed(2)
                                  : 'Pendiente'}
                              </p>
                              {sum.scaleLevel && (
                                <p className="text-[11px] font-semibold text-teal-800">
                                  {formatScaleLabel(
                                    sum.scaleLevel,
                                    teacherProfile
                                  )}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {crsEntries.length > 0 && (
                        <div className="pt-2 space-y-1">
                          <p className="text-[11px] font-semibold text-slate-500">
                            Detalle de actividades calificadas:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                            {crsEntries.map((ent) => {
                              const act = activities.find(
                                (a) => a.id === ent.activityId
                              );
                              return (
                                <div
                                  key={ent.id}
                                  className="flex items-center justify-between rounded bg-slate-50 px-2.5 py-1.5 border border-slate-100"
                                >
                                  <span className="truncate text-slate-700">
                                    {act?.title || 'Actividad'}
                                  </span>
                                  <span className="font-mono font-bold text-slate-900 ml-2 shrink-0">
                                    {ent.score.toFixed(1)} ({ent.nationalScaleLevel})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* PESTAÑA 4: OBSERVADOR DEL ESTUDIANTE + REGISTRO EN POCOS TOQUES (FASE 4 ACTIVA) */}
          {activeTab === 'observaciones' && (
            <div className="space-y-5">
              {/* Formulario directo en pocos toques */}
              <form
                onSubmit={handleQuickAddObservationFromProfile}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h5 className="text-xs font-bold text-slate-900 font-display">
                    Nueva observación rápida para {student.firstName}
                  </h5>
                  <input
                    type="date"
                    value={obsDate}
                    onChange={(e) => setObsDate(e.target.value)}
                    className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setObsCat('positiva')}
                    className={`min-h-[40px] rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      obsCat === 'positiva'
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Positiva</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setObsCat('mejora')}
                    className={`min-h-[40px] rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      obsCat === 'mejora'
                        ? 'border-amber-600 bg-amber-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>De mejora</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setObsCat('convivencia')}
                    className={`min-h-[40px] rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      obsCat === 'convivencia'
                        ? 'border-red-700 bg-red-700 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Convivencia</span>
                  </button>
                </div>

                <TextareaField
                  label="Descripción *"
                  rows={2}
                  placeholder="Describe la actitud, logro o situación..."
                  value={obsDescription}
                  onChange={(e) => setObsDescription(e.target.value)}
                  required
                />

                <InputField
                  label="Compromisos y acuerdos con acudiente (Opcional)"
                  placeholder="Ej. Revisión semanal de actividades en casa"
                  value={obsCommitments}
                  onChange={(e) => setObsCommitments(e.target.value)}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={obsGuardianNotified}
                      onChange={(e) => setObsGuardianNotified(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-800"
                    />
                    <span>Acudiente informado</span>
                  </label>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSavingObs}
                    leftIcon={<Plus className="w-4 h-4" />}
                    className="text-xs"
                  >
                    Guardar en Observador
                  </Button>
                </div>
              </form>

              {/* Historial de Observaciones del Estudiante */}
              {studentObservations.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                  Aún no hay observaciones registradas para {student.firstName}.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {studentObservations.map((obs) => {
                    const info = getObservationCategoryLabel(obs.type);
                    return (
                      <div
                        key={obs.id}
                        className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-bold px-2 py-0.5 rounded ${
                              info.category === 'positiva'
                                ? 'bg-emerald-50 text-emerald-800'
                                : info.category === 'mejora'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-red-50 text-red-800'
                            }`}
                          >
                            {info.shortLabel} · {info.detailLabel}
                          </span>
                          <span className="font-mono text-slate-500">
                            {obs.date}
                          </span>
                        </div>
                        <p className="text-slate-800">{obs.description}</p>
                        {obs.commitments && (
                          <p className="text-teal-900 bg-teal-50/70 px-2.5 py-1.5 rounded border border-teal-100">
                            <strong>Compromiso:</strong> {obs.commitments}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 5: REGISTROS, RECAUDOS Y ENTREGAS DEL ESTUDIANTE (FASE 4 ACTIVA) */}
          {activeTab === 'registros' && (
            <div className="space-y-4">
              {studentCollections.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                  Aún no hay controles de recaudo ni de entrega de documentos en este grupo.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                  {studentCollections.map((col) => {
                    const item = eventPaymentItems.find(
                      (i) =>
                        i.eventCollectionId === col.id &&
                        i.studentId === student.id
                    );
                    const status = item?.paymentStatus || 'Pendiente';
                    const isMoney =
                      col.eventType === 'Recaudo de Dinero' &&
                      (col.targetAmountCOP || 0) > 0;

                    return (
                      <div
                        key={col.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-900 font-display">
                            {col.title}
                          </p>
                          <p className="text-slate-600">
                            {isMoney ? (
                              <>
                                Valor cuota:{' '}
                                <strong className="font-mono">
                                  {formatCOP(col.targetAmountCOP)}
                                </strong>{' '}
                                · Pagado:{' '}
                                <strong className="font-mono text-emerald-800">
                                  {formatCOP(item?.amountPaidCOP || 0)}
                                </strong>
                              </>
                            ) : (
                              <>Tipo: {col.eventType}</>
                            )}
                          </p>
                          {item?.note && (
                            <p className="font-mono text-[11px] text-slate-500">
                              Historial: {item.note}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleCollectionStatusInProfile(
                                col,
                                'Pagado / Cumplido'
                              )
                            }
                            className={`min-h-[38px] px-3 rounded-lg font-bold border cursor-pointer ${
                              status === 'Pagado / Cumplido'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            {isMoney ? 'Pagado' : 'Entregó'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleCollectionStatusInProfile(
                                col,
                                'Pendiente'
                              )
                            }
                            className={`min-h-[38px] px-3 rounded-lg font-bold border cursor-pointer ${
                              status === 'Pendiente'
                                ? 'bg-red-700 text-white border-red-700'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            {isMoney ? 'Pendiente' : 'No entregó'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </ModalDialog>

      <ConfirmDeleteModal
        isOpen={confirmDeleteOpen}
        title="Eliminar estudiante del grupo"
        itemName={`${student.lastName} ${student.firstName}`}
        description="Se eliminará la ficha de este estudiante. Si solo se retiró del colegio pero quieres conservar su historial, cámbiale el estado a 'Retirado' en lugar de borrarlo."
        isLoading={isSaving}
        onConfirm={handleDeleteStudent}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
};
