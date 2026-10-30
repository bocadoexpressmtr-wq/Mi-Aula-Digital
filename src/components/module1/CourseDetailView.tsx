import React, { useState } from 'react';
import { doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import {
  ArrowLeft,
  UserPlus,
  FileSpreadsheet,
  Camera,
  SlidersHorizontal,
  Search,
  Users,
  CalendarCheck,
  BookOpenCheck,
  ClipboardList,
  Wallet,
  Eye,
  Phone,
  Table,
  Save,
  X,
  Plus,
  BarChart3,
  Printer,
  Wrench,
  ChevronRight,
  Building2,
  BookOpen,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import {
  CourseAssignment,
  GradeGroup,
  AreaSubject,
  AcademicYear,
  AcademicPeriod,
  Student,
  StudentCustomField,
  AttendanceRecord,
  EvaluationCategory,
  EvaluationActivity,
  GradeEntry,
  ObservationRecord,
  EventCollection,
  EventPaymentItem,
  SupportPlan,
  CalendarEvent,
  GuardianMessage,
  TeacherProfile,
} from '../../types/schema';
import {
  Button,
  InputField,
  SelectField,
  ModalDialog,
  ResponsiveDataView,
  ResponsiveColumn,
} from '../ui/DesignSystem';
import { StudentImportModal } from './StudentImportModal';
import { CustomFieldsModal } from './CustomFieldsModal';
import { StudentProfileModal } from './StudentProfileModal';
import { CourseAttendancePanel } from '../module2/CourseAttendancePanel';
import { CourseGradebookPanel } from '../module3/CourseGradebookPanel';
import { CourseObserverPanel } from '../module4/CourseObserverPanel';
import { CourseEventsPanel } from '../module4/CourseEventsPanel';
import { AnalyticsDashboard } from '../module5/AnalyticsDashboard';
import { ReportsAndBulletinsModule } from '../module6/ReportsAndBulletinsModule';
import { ExtrasModule } from '../module7/ExtrasModule';

interface CourseDetailViewProps {
  course: CourseAssignment;
  group?: GradeGroup;
  subject?: AreaSubject;
  year?: AcademicYear;
  years?: AcademicYear[];
  periods: AcademicPeriod[];
  subjects?: AreaSubject[];
  groups?: GradeGroup[];
  allCourses: CourseAssignment[];
  students: Student[];
  customFields: StudentCustomField[];
  attendanceRecords: AttendanceRecord[];
  categories: EvaluationCategory[];
  activities: EvaluationActivity[];
  gradeEntries: GradeEntry[];
  observations: ObservationRecord[];
  eventCollections: EventCollection[];
  eventPaymentItems: EventPaymentItem[];
  supportPlans?: SupportPlan[];
  calendarEvents?: CalendarEvent[];
  guardianMessages?: GuardianMessage[];
  teacherProfile: TeacherProfile | null;
  teacherId: string;
  initialTab?: InternalCourseTab;
  onSwitchCourse?: (courseId: string) => void;
  onNavigateToGrade?: (gradeName: string) => void;
  onOpenScaleSettings?: () => void;
  onSetActivePeriod?: (periodId: string) => void;
  onBack: () => void;
  onNotify: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

export type InternalCourseTab =
  | 'estudiantes'
  | 'asistencia'
  | 'notas'
  | 'observaciones'
  | 'registros'
  | 'analisis'
  | 'boletines'
  | 'extras';

interface BulkStudentDraft {
  id: string;
  isNew?: boolean;
  lastName: string;
  firstName: string;
  documentType: Student['documentType'];
  documentNumber: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  status: Student['status'];
  customValues: Record<string, string | number | boolean>;
}

export const CourseDetailView: React.FC<CourseDetailViewProps> = ({
  course,
  group,
  subject,
  year,
  years = [],
  periods,
  subjects = [],
  groups = [],
  allCourses,
  students,
  customFields,
  attendanceRecords,
  categories,
  activities,
  gradeEntries,
  observations,
  eventCollections,
  eventPaymentItems,
  supportPlans = [],
  calendarEvents = [],
  guardianMessages = [],
  teacherProfile,
  teacherId,
  initialTab = 'estudiantes',
  onSwitchCourse,
  onNavigateToGrade,
  onOpenScaleSettings,
  onSetActivePeriod,
  onBack,
  onNotify,
}) => {
  const [internalTab, setInternalTab] =
    useState<InternalCourseTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'excel' | 'photo' | null>(null);
  const [customFieldsModalOpen, setCustomFieldsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Modal rápido para asignar otra asignatura a este mismo grupo (ej. si el docente dicta 2 materias en 7-B)
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [selectedExistingSubjectId, setSelectedExistingSubjectId] =
    useState<string>('NEW');
  const [isAddingSubjectToGroup, setIsAddingSubjectToGroup] = useState(false);

  // Modo de Edición de Tabla Completa de Estudiantes en una sola página
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkDrafts, setBulkDrafts] = useState<BulkStudentDraft[]>([]);
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentType, setDocumentType] =
    useState<Student['documentType']>('TI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [customValues, setCustomValues] = useState<
    Record<string, string | number | boolean>
  >({});
  const [isSavingManual, setIsSavingManual] = useState(false);

  const courseStudents = students
    .filter((s) => s.gradeGroupId === course.gradeGroupId)
    .sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
        'es-CO'
      )
    );

  const yearPeriods = periods
    .filter((p) => p.academicYearId === course.academicYearId)
    .sort((a, b) => a.number - b.number);

  const currentActivePeriod =
    yearPeriods.find((p) => p.isActive) || yearPeriods[0] || null;

  const filteredStudents = courseStudents.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      (s.documentNumber || '').toLowerCase().includes(q) ||
      (s.guardianName || '').toLowerCase().includes(q)
    );
  });

  const sortedCustomFields = [...customFields].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );

  // Iniciar el modo de Edición de Tabla Completa con todos los estudiantes del curso
  const handleStartBulkEdit = () => {
    const initialRows: BulkStudentDraft[] = courseStudents.map((s) => ({
      id: s.id,
      isNew: false,
      lastName: s.lastName || '',
      firstName: s.firstName || '',
      documentType: s.documentType || 'TI',
      documentNumber: s.documentNumber || '',
      guardianName: s.guardianName || '',
      guardianPhone: s.guardianPhone || '',
      guardianEmail: s.guardianEmail || '',
      status: s.status || 'Activo',
      customValues: { ...(s.customValues || {}) },
    }));
    if (initialRows.length === 0) {
      initialRows.push({
        id: `stu_${Date.now()}_0`,
        isNew: true,
        lastName: '',
        firstName: '',
        documentType: 'TI',
        documentNumber: '',
        guardianName: '',
        guardianPhone: '',
        guardianEmail: '',
        status: 'Activo',
        customValues: {},
      });
    }
    setBulkDrafts(initialRows);
    setInternalTab('estudiantes');
    setIsBulkEditing(true);
  };

  const handleUpdateBulkRow = (
    rowIndex: number,
    field: keyof Omit<BulkStudentDraft, 'id' | 'isNew' | 'customValues'>,
    value: string
  ) => {
    setBulkDrafts((prev) =>
      prev.map((r, i) => (i === rowIndex ? { ...r, [field]: value } : r))
    );
  };

  const handleUpdateBulkCustomField = (
    rowIndex: number,
    fieldKey: string,
    value: string | number | boolean
  ) => {
    setBulkDrafts((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? {
              ...r,
              customValues: {
                ...r.customValues,
                [fieldKey]: value,
              },
            }
          : r
      )
    );
  };

  const handleAddBulkBlankRow = () => {
    setBulkDrafts((prev) => [
      ...prev,
      {
        id: `stu_${Date.now()}_${prev.length}_${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        isNew: true,
        lastName: '',
        firstName: '',
        documentType: 'TI',
        documentNumber: '',
        guardianName: '',
        guardianPhone: '',
        guardianEmail: '',
        status: 'Activo',
        customValues: {},
      },
    ]);
  };

  const handleBulkKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIdx: number,
    colKey: string
  ) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const next = document.querySelector<HTMLElement>(
        `[data-bulk-row="${rowIdx + 1}"][data-bulk-col="${colKey}"]`
      );
      if (next) {
        next.focus();
        if (next instanceof HTMLInputElement) next.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = document.querySelector<HTMLElement>(
        `[data-bulk-row="${rowIdx - 1}"][data-bulk-col="${colKey}"]`
      );
      if (prev) {
        prev.focus();
        if (prev instanceof HTMLInputElement) prev.select();
      }
    }
  };

  const handleSaveAllBulkChanges = async () => {
    const validRows = bulkDrafts.filter(
      (r) => r.lastName.trim().length > 0 || r.firstName.trim().length > 0
    );
    if (validRows.length === 0) {
      onNotify(
        'Sin datos para guardar',
        'Agrega al menos un estudiante con nombre o apellido.',
        'error'
      );
      return;
    }

    setIsSavingBulk(true);
    try {
      const batch = writeBatch(db);
      validRows.forEach((row) => {
        const ref = doc(db, 'students', row.id);
        const payload = {
          teacherId,
          academicYearId: course.academicYearId,
          gradeGroupId: course.gradeGroupId,
          lastName: (row.lastName.trim() || 'Sin Apellido').slice(0, 120),
          firstName: (row.firstName.trim() || 'Sin Nombre').slice(0, 120),
          documentType: row.documentType,
          documentNumber: row.documentNumber.trim().slice(0, 50),
          guardianName: row.guardianName.trim().slice(0, 150),
          guardianPhone: row.guardianPhone.trim().slice(0, 50),
          guardianEmail: row.guardianEmail.trim().slice(0, 150),
          status: row.status,
          customValues: row.customValues || {},
          updatedAt: serverTimestamp(),
          ...(row.isNew ? { createdAt: serverTimestamp() } : {}),
        };
        batch.set(ref, payload, { merge: true });
      });

      await batch.commit();
      onNotify(
        'Tabla de estudiantes guardada',
        `Se actualizaron los datos de ${validRows.length} estudiantes en una sola operación.`
      );
      setIsBulkEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'students');
    } finally {
      setIsSavingBulk(false);
    }
  };

  const handleCreateManualStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    setIsSavingManual(true);
    const newId = `stu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const path = `students/${newId}`;

    try {
      await setDoc(doc(db, 'students', newId), {
        teacherId,
        academicYearId: course.academicYearId,
        gradeGroupId: course.gradeGroupId,
        firstName: firstName.trim().slice(0, 120),
        lastName: lastName.trim().slice(0, 120),
        documentType,
        documentNumber: documentNumber.trim().slice(0, 50),
        guardianName: guardianName.trim().slice(0, 150),
        guardianPhone: guardianPhone.trim().slice(0, 50),
        guardianEmail: guardianEmail.trim().slice(0, 150),
        status: 'Activo',
        customValues,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onNotify(
        'Estudiante registrado',
        `${lastName.trim()} ${firstName.trim()} fue agregado al curso.`
      );
      setFirstName('');
      setLastName('');
      setDocumentNumber('');
      setGuardianName('');
      setGuardianPhone('');
      setGuardianEmail('');
      setCustomValues({});
      setManualModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setIsSavingManual(false);
    }
  };

  const columns: ResponsiveColumn<Student>[] = [
    {
      key: 'index',
      header: 'N°',
      isNumeric: true,
      render: (stu) => {
        const idx = courseStudents.findIndex((s) => s.id === stu.id);
        return (
          <span className="text-xs text-slate-500">
            {idx >= 0 ? idx + 1 : '—'}
          </span>
        );
      },
    },
    {
      key: 'fullName',
      header: 'Apellidos y Nombres',
      render: (stu) => (
        <button
          type="button"
          onClick={() => setSelectedStudent(stu)}
          className="text-left group cursor-pointer"
        >
          <p className="font-semibold text-slate-900 group-hover:text-teal-800 transition-colors">
            {stu.lastName} {stu.firstName}
          </p>
          {stu.status !== 'Activo' && (
            <span className="text-xs text-amber-700">Estado: {stu.status}</span>
          )}
        </button>
      ),
    },
    {
      key: 'document',
      header: 'Documento',
      isNumeric: true,
      render: (stu) => (
        <span className="text-xs text-slate-700">
          {stu.documentType} {stu.documentNumber || 'Sin número'}
        </span>
      ),
    },
    {
      key: 'guardian',
      header: 'Acudiente y Contacto',
      render: (stu) => (
        <div className="text-xs text-slate-600">
          <p className="font-medium text-slate-800">
            {stu.guardianName || 'Sin registrar'}
          </p>
          {stu.guardianPhone && (
            <p className="font-mono tabular-nums text-slate-500">
              Tel: {stu.guardianPhone}
            </p>
          )}
        </div>
      ),
    },
    ...sortedCustomFields.slice(0, 2).map((cf) => ({
      key: `cf_${cf.id}`,
      header: cf.label,
      render: (stu: Student) => {
        const val = stu.customValues?.[cf.fieldKey];
        if (val === undefined || val === '') {
          return <span className="text-xs text-slate-400">—</span>;
        }
        if (typeof val === 'boolean') {
          return (
            <span className="text-xs text-slate-700">{val ? 'Sí' : 'No'}</span>
          );
        }
        return <span className="text-xs text-slate-700">{String(val)}</span>;
      },
    })),
    {
      key: 'actions',
      header: 'Ficha',
      align: 'right',
      render: (stu) => (
        <Button
          type="button"
          variant="outline"
          onClick={() => setSelectedStudent(stu)}
          leftIcon={<Eye className="w-4 h-4 text-teal-800" />}
          className="text-xs px-3"
        >
          Ver Ficha
        </Button>
      ),
    },
  ];

  const internalNav: {
    id: InternalCourseTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    {
      id: 'estudiantes',
      label: `Estudiantes (${courseStudents.length})`,
      icon: Users,
    },
    {
      id: 'asistencia',
      label: 'Asistencia',
      icon: CalendarCheck,
    },
    {
      id: 'notas',
      label: 'Calificaciones',
      icon: BookOpenCheck,
    },
    {
      id: 'observaciones',
      label: 'Observador',
      icon: ClipboardList,
    },
    {
      id: 'registros',
      label: 'Recaudos y Controles',
      icon: Wallet,
    },
    {
      id: 'analisis',
      label: 'Análisis',
      icon: BarChart3,
    },
    {
      id: 'boletines',
      label: 'Boletines',
      icon: Printer,
    },
    {
      id: 'extras',
      label: 'Planes y Extras',
      icon: Wrench,
    },
  ];

  // Todas las asignaturas/cursos que el docente dicta en este mismo grupo (ej. 7-2)
  const siblingGroupCourses = allCourses.filter(
    (c) => !c.archived && c.gradeGroupId === course.gradeGroupId
  );

  const handleAssignAnotherSubjectToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;

    setIsAddingSubjectToGroup(true);
    try {
      let targetSubjectId = selectedExistingSubjectId;
      let targetSubjectName = '';

      if (selectedExistingSubjectId === 'NEW') {
        if (!newSubjectName.trim()) return;
        targetSubjectId = `subj_${Date.now()}`;
        targetSubjectName = newSubjectName.trim().slice(0, 150);
        const areaVal = (newAreaName.trim() || targetSubjectName).slice(0, 150);
        await setDoc(doc(db, 'areas_subjects', targetSubjectId), {
          teacherId,
          name: targetSubjectName,
          areaName: areaVal,
          weeklyHours: 4,
          educationLevel: group.educationLevel || 'Secundaria',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const foundSubj = subjects.find(
          (s) => s.id === selectedExistingSubjectId
        );
        targetSubjectName = foundSubj?.name || 'Asignatura';
      }

      const existingCourse = siblingGroupCourses.find(
        (c) => c.areaSubjectId === targetSubjectId
      );
      if (existingCourse) {
        setAddSubjectModalOpen(false);
        if (onSwitchCourse) onSwitchCourse(existingCourse.id);
        return;
      }

      const newCourseId = `crs_${Date.now()}`;
      const displayName = `${targetSubjectName} · ${group.gradeName} (${group.groupName})`.slice(
        0,
        200
      );

      await setDoc(doc(db, 'courses', newCourseId), {
        teacherId,
        academicYearId: course.academicYearId,
        gradeGroupId: group.id,
        areaSubjectId: targetSubjectId,
        displayName,
        scheduleSummary: `Jornada ${group.shift}`,
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setAddSubjectModalOpen(false);
      setNewSubjectName('');
      setNewAreaName('');
      onNotify(
        'Asignatura vinculada',
        `Se agregó ${displayName} a este grupo.`
      );
      if (onSwitchCourse) {
        onSwitchCourse(newCourseId);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'courses');
    } finally {
      setIsAddingSubjectToGroup(false);
    }
  };

  const institutionLabel =
    group?.institutionName ||
    teacherProfile?.institutionName ||
    'Institución Educativa';

  return (
    <div className="space-y-5">
      {/* CABECERA COMPACTA DEL GRUPO (Ruta + Título + Selector de Asignatura + Pestañas) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        {/* Fila 1: Ruta de navegación (Miga de pan) + Botón Volver */}
        <nav
          aria-label="Ruta del grupo"
          className="flex flex-wrap items-center justify-between gap-2 text-xs pb-3 border-b border-slate-100"
        >
          <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-teal-800 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-teal-800" />
              <span>{institutionLabel}</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            {group && onNavigateToGrade ? (
              <button
                type="button"
                onClick={() => onNavigateToGrade(group.gradeName)}
                className="font-medium text-slate-700 hover:text-teal-800 cursor-pointer"
              >
                Grado {group.gradeName}
              </button>
            ) : (
              <span className="font-medium text-slate-700">
                Grado {group?.gradeName || '—'}
              </span>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold text-teal-900">
              Grupo {group?.groupName || course.displayName}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {yearPeriods.length > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-teal-700/30 bg-teal-50/80 px-2.5 py-1">
                <span className="h-2 w-2 rounded-full bg-teal-700 shrink-0" />
                <span className="text-[11px] font-semibold text-teal-900">
                  Periodo Actual:
                </span>
                {onSetActivePeriod ? (
                  <select
                    aria-label="Periodo Actual de Trabajo"
                    value={currentActivePeriod?.id || ''}
                    onChange={(e) => onSetActivePeriod(e.target.value)}
                    className="bg-transparent text-xs font-bold text-teal-950 focus:outline-none cursor-pointer"
                  >
                    {yearPeriods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.weightPercentage}%)
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-bold text-teal-950">
                    {currentActivePeriod?.name || 'Periodo 1'}
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                group && onNavigateToGrade
                  ? onNavigateToGrade(group.gradeName)
                  : onBack()
              }
              className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>
                {group && onNavigateToGrade
                  ? `Grado ${group.gradeName}`
                  : 'Todos los grados'}
              </span>
            </button>
          </div>
        </nav>

        {/* Fila 2: Nombre del Grupo a la izquierda + Selector de Asignatura a la derecha */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              {group
                ? `Grupo ${group.groupName} · Grado ${group.gradeName}`
                : course.displayName}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Año {year?.name || 'Activo'}
              {currentActivePeriod ? ` · ${currentActivePeriod.name} en curso` : ''}
              {group ? ` · ${group.educationLevel} · Jornada ${group.shift}` : ''}
              {' · '}
              <span className="font-mono tabular-nums font-semibold text-slate-700">
                {courseStudents.length}
              </span>{' '}
              estudiantes
            </p>
          </div>

          {/* Selector de Asignatura dentro del Grupo */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 inline-flex items-center gap-1 mr-1">
              <BookOpen className="w-3.5 h-3.5 text-teal-800" />
              <span>Asignatura:</span>
            </span>
            {siblingGroupCourses.map((sib) => {
              const sibSubj = subjects.find((s) => s.id === sib.areaSubjectId);
              const isCurrent = sib.id === course.id;
              return (
                <button
                  key={sib.id}
                  type="button"
                  onClick={() => onSwitchCourse && onSwitchCourse(sib.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-teal-800 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {sibSubj?.name || sib.displayName}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setAddSubjectModalOpen(true)}
              className="min-h-[34px] px-2.5 py-1 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:border-teal-700 hover:text-teal-800 text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
              title="Dictar otra asignatura en este grupo"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Otra asignatura</span>
            </button>
          </div>
        </div>

        {/* Fila 3: Pestañas de los Módulos del Grupo */}
        <div className="pt-3 border-t border-slate-100 flex items-center gap-1 overflow-x-auto">
          {internalNav.map((tab) => {
            const Icon = tab.icon;
            const active = internalTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setInternalTab(tab.id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-teal-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PESTAÑA 1: ESTUDIANTES (Los botones de carga y edición viven únicamente aquí) */}
      {internalTab === 'estudiantes' && (
        <div className="space-y-4">
          {isBulkEditing ? (
            /* MODO HOJA DE DATOS EDITABLE COMPLETA EN UNA SOLA PÁGINA */
            <div className="rounded-2xl border border-teal-800/30 bg-white p-4 sm:p-5 space-y-4 shadow-2xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
                    <Table className="w-4 h-4 text-teal-800" />
                    <span>Tabla Editable de Estudiantes ({bulkDrafts.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Usa las flechas <strong>↑</strong> / <strong>↓</strong> o <strong>Enter</strong> para desplazarte entre filas.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddBulkBlankRow}
                    leftIcon={<Plus className="w-3.5 h-3.5 text-teal-800" />}
                  >
                    Agregar fila
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsBulkEditing(false)}
                    leftIcon={<X className="w-3.5 h-3.5" />}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={handleSaveAllBulkChanges}
                    isLoading={isSavingBulk}
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                  >
                    Guardar cambios
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-2.5 min-w-[165px]">Apellidos *</th>
                      <th className="py-2.5 px-2.5 min-w-[165px]">Nombres *</th>
                      <th className="py-2.5 px-2 min-w-[92px]">Tipo Doc</th>
                      <th className="py-2.5 px-2.5 min-w-[135px]">N° Documento</th>
                      <th className="py-2.5 px-2.5 min-w-[165px]">Nombre Acudiente</th>
                      <th className="py-2.5 px-2.5 min-w-[130px]">Teléfono Acudiente</th>
                      <th className="py-2.5 px-2.5 min-w-[165px]">Correo Acudiente</th>
                      <th className="py-2.5 px-2 min-w-[110px]">Estado</th>
                      {sortedCustomFields.map((cf) => (
                        <th
                          key={cf.id}
                          className="py-2.5 px-2.5 min-w-[140px] bg-teal-50/60 text-teal-950"
                        >
                          {cf.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {bulkDrafts.map((row, rIdx) => (
                      <tr key={row.id} className="hover:bg-slate-50/80">
                        <td className="py-1.5 px-2 text-center font-mono text-slate-400">
                          {rIdx + 1}
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            data-bulk-row={rIdx}
                            data-bulk-col="lastName"
                            value={row.lastName}
                            onChange={(e) =>
                              handleUpdateBulkRow(rIdx, 'lastName', e.target.value)
                            }
                            onKeyDown={(e) => handleBulkKeyDown(e, rIdx, 'lastName')}
                            placeholder="Apellidos"
                            className="w-full min-h-[36px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-900 focus:border-teal-700 focus:outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            data-bulk-row={rIdx}
                            data-bulk-col="firstName"
                            value={row.firstName}
                            onChange={(e) =>
                              handleUpdateBulkRow(rIdx, 'firstName', e.target.value)
                            }
                            onKeyDown={(e) => handleBulkKeyDown(e, rIdx, 'firstName')}
                            placeholder="Nombres"
                            className="w-full min-h-[36px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-900 focus:border-teal-700 focus:outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <select
                            data-bulk-row={rIdx}
                            data-bulk-col="documentType"
                            value={row.documentType}
                            onChange={(e) =>
                              handleUpdateBulkRow(
                                rIdx,
                                'documentType',
                                e.target.value
                              )
                            }
                            onKeyDown={(e) =>
                              handleBulkKeyDown(e, rIdx, 'documentType')
                            }
                            className="w-full min-h-[36px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                          >
                            {['TI', 'RC', 'CC', 'CE', 'PPT', 'NES', 'Otro'].map(
                              (dt) => (
                                <option key={dt} value={dt}>
                                  {dt}
                                </option>
                              )
                            )}
                          </select>
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            data-bulk-row={rIdx}
                            data-bulk-col="documentNumber"
                            value={row.documentNumber}
                            onChange={(e) =>
                              handleUpdateBulkRow(
                                rIdx,
                                'documentNumber',
                                e.target.value
                              )
                            }
                            onKeyDown={(e) =>
                              handleBulkKeyDown(e, rIdx, 'documentNumber')
                            }
                            placeholder="N° documento"
                            className="w-full min-h-[36px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-mono text-slate-900 focus:border-teal-700 focus:outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            data-bulk-row={rIdx}
                            data-bulk-col="guardianName"
                            value={row.guardianName}
                            onChange={(e) =>
                              handleUpdateBulkRow(
                                rIdx,
                                'guardianName',
                                e.target.value
                              )
                            }
                            onKeyDown={(e) =>
                              handleBulkKeyDown(e, rIdx, 'guardianName')
                            }
                            placeholder="Nombre acudiente"
                            className="w-full min-h-[36px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            data-bulk-row={rIdx}
                            data-bulk-col="guardianPhone"
                            value={row.guardianPhone}
                            onChange={(e) =>
                              handleUpdateBulkRow(
                                rIdx,
                                'guardianPhone',
                                e.target.value
                              )
                            }
                            onKeyDown={(e) =>
                              handleBulkKeyDown(e, rIdx, 'guardianPhone')
                            }
                            placeholder="Celular"
                            className="w-full min-h-[36px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-mono text-slate-900 focus:border-teal-700 focus:outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="email"
                            data-bulk-row={rIdx}
                            data-bulk-col="guardianEmail"
                            value={row.guardianEmail}
                            onChange={(e) =>
                              handleUpdateBulkRow(
                                rIdx,
                                'guardianEmail',
                                e.target.value
                              )
                            }
                            onKeyDown={(e) =>
                              handleBulkKeyDown(e, rIdx, 'guardianEmail')
                            }
                            placeholder="correo@ejemplo.com"
                            className="w-full min-h-[36px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                          />
                        </td>
                        <td className="p-1.5">
                          <select
                            data-bulk-row={rIdx}
                            data-bulk-col="status"
                            value={row.status}
                            onChange={(e) =>
                              handleUpdateBulkRow(rIdx, 'status', e.target.value)
                            }
                            onKeyDown={(e) => handleBulkKeyDown(e, rIdx, 'status')}
                            className="w-full min-h-[36px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                          >
                            <option value="Activo">Activo</option>
                            <option value="Retirado">Retirado</option>
                            <option value="Trasladado">Trasladado</option>
                          </select>
                        </td>

                        {/* Campos Personalizados en la Tabla Completa */}
                        {sortedCustomFields.map((cf) => {
                          const val = row.customValues?.[cf.fieldKey];
                          const colKey = `cf_${cf.fieldKey}`;
                          if (cf.fieldType === 'boolean') {
                            return (
                              <td
                                key={cf.id}
                                className="p-1.5 bg-teal-50/20 text-center"
                              >
                                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(val)}
                                    onChange={(e) =>
                                      handleUpdateBulkCustomField(
                                        rIdx,
                                        cf.fieldKey,
                                        e.target.checked
                                      )
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-teal-800"
                                  />
                                  <span className="text-xs text-slate-700">
                                    {val ? 'Sí' : 'No'}
                                  </span>
                                </label>
                              </td>
                            );
                          }
                          if (cf.fieldType === 'select') {
                            return (
                              <td key={cf.id} className="p-1.5 bg-teal-50/20">
                                <select
                                  data-bulk-row={rIdx}
                                  data-bulk-col={colKey}
                                  value={String(val ?? '')}
                                  onChange={(e) =>
                                    handleUpdateBulkCustomField(
                                      rIdx,
                                      cf.fieldKey,
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    handleBulkKeyDown(e, rIdx, colKey)
                                  }
                                  className="w-full min-h-[36px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                                >
                                  <option value="">—</option>
                                  {(cf.options || []).map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          }
                          return (
                            <td key={cf.id} className="p-1.5 bg-teal-50/20">
                              <input
                                type={
                                  cf.fieldType === 'date'
                                    ? 'date'
                                    : cf.fieldType === 'number'
                                    ? 'text'
                                    : 'text'
                                }
                                inputMode={
                                  cf.fieldType === 'number' ? 'decimal' : 'text'
                                }
                                data-bulk-row={rIdx}
                                data-bulk-col={colKey}
                                value={String(val ?? '')}
                                onChange={(e) =>
                                  handleUpdateBulkCustomField(
                                    rIdx,
                                    cf.fieldKey,
                                    cf.fieldType === 'number' &&
                                      e.target.value !== ''
                                      ? Number(e.target.value)
                                      : e.target.value
                                  )
                                }
                                onKeyDown={(e) =>
                                  handleBulkKeyDown(e, rIdx, colKey)
                                }
                                placeholder={cf.label}
                                className="w-full min-h-[36px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddBulkBlankRow}
                  leftIcon={<Plus className="w-3.5 h-3.5 text-teal-800" />}
                >
                  Agregar fila
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsBulkEditing(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={handleSaveAllBulkChanges}
                    isLoading={isSavingBulk}
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                  >
                    Guardar cambios ({bulkDrafts.length})
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* BARRA EXCLUSIVA DE LA PESTAÑA DE ESTUDIANTES */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar estudiante en este grupo..."
                    className="min-h-[36px] w-full rounded-lg border border-slate-300 bg-slate-50/60 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-700 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => setManualModalOpen(true)}
                    leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                  >
                    + Estudiante
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setImportMode('excel')}
                    leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-teal-800" />}
                  >
                    Excel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setImportMode('photo')}
                    leftIcon={<Camera className="w-3.5 h-3.5 text-teal-800" />}
                  >
                    Foto IA
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleStartBulkEdit}
                    leftIcon={<Table className="w-3.5 h-3.5 text-teal-800" />}
                  >
                    Editar Tabla
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setCustomFieldsModalOpen(true)}
                    leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                  >
                    Campos ({customFields.length})
                  </Button>
                </div>
              </div>

              <ResponsiveDataView
                data={filteredStudents}
                columns={columns}
                keyExtractor={(stu) => stu.id}
                emptyTitle={
                  searchQuery
                    ? 'Sin coincidencias'
                    : 'Este grupo aún no tiene estudiantes'
                }
                emptyDescription={
                  searchQuery
                    ? 'Prueba con otro nombre o documento.'
                    : 'Agrega estudiantes manualmente, desde Excel o con una foto de la lista.'
                }
                emptyAction={
                  !searchQuery ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => setManualModalOpen(true)}
                        leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                      >
                        + Estudiante
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setImportMode('excel')}
                        leftIcon={
                          <FileSpreadsheet className="w-3.5 h-3.5 text-teal-800" />
                        }
                      >
                        Subir Excel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setImportMode('photo')}
                        leftIcon={<Camera className="w-3.5 h-3.5 text-teal-800" />}
                      >
                        Foto con IA
                      </Button>
                    </div>
                  ) : undefined
                }
                mobileCardRender={(stu) => (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900 font-display">
                          {stu.lastName} {stu.firstName}
                        </p>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">
                          {stu.documentType} {stu.documentNumber || 'Sin documento'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSelectedStudent(stu)}
                        className="text-xs px-3"
                      >
                        Ficha
                      </Button>
                    </div>

                    {(stu.guardianName || stu.guardianPhone) && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <span>Acudiente: {stu.guardianName || '—'}</span>
                        {stu.guardianPhone && (
                          <span className="inline-flex items-center gap-1 font-mono text-teal-800">
                            <Phone className="w-3 h-3" />
                            {stu.guardianPhone}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              />
            </>
          )}
        </div>
      )}

      {/* PESTAÑA 2: ASISTENCIA DIARIA (FASE 2 ACTIVA) */}
      {internalTab === 'asistencia' && (
        <CourseAttendancePanel
          key={`att_${course.id}_${currentActivePeriod?.id || 'default'}`}
          teacherId={teacherId}
          course={course}
          periods={yearPeriods}
          students={students}
          attendanceRecords={attendanceRecords}
          onSelectStudentForProfile={(stu) => setSelectedStudent(stu)}
          onNotify={onNotify}
        />
      )}

      {/* PESTAÑA 3: LIBRO DE CALIFICACIONES SIEE (FASE 3 ACTIVA) */}
      {internalTab === 'notas' && (
        <CourseGradebookPanel
          key={`grades_${course.id}_${currentActivePeriod?.id || 'default'}`}
          teacherId={teacherId}
          course={course}
          periods={yearPeriods}
          students={students}
          categories={categories}
          activities={activities}
          gradeEntries={gradeEntries}
          teacherProfile={teacherProfile}
          onOpenScaleSettings={onOpenScaleSettings}
          onSelectStudentForProfile={(stu) => setSelectedStudent(stu)}
          onNotify={onNotify}
        />
      )}

      {/* PESTAÑA 4: OBSERVADOR DEL CURSO (FASE 4 ACTIVA) */}
      {internalTab === 'observaciones' && (
        <CourseObserverPanel
          key={`obs_${course.id}_${currentActivePeriod?.id || 'default'}`}
          teacherId={teacherId}
          course={course}
          periods={yearPeriods}
          students={students}
          observations={observations}
          onSelectStudentForProfile={(stu) => setSelectedStudent(stu)}
          onNotify={onNotify}
        />
      )}

      {/* PESTAÑA 5: RECAUDOS Y REGISTROS DEL CURSO (FASE 4 ACTIVA) */}
      {internalTab === 'registros' && (
        <CourseEventsPanel
          key={`events_${course.id}`}
          teacherId={teacherId}
          course={course}
          students={students}
          eventCollections={eventCollections}
          eventPaymentItems={eventPaymentItems}
          onSelectStudentForProfile={(stu) => setSelectedStudent(stu)}
          onNotify={onNotify}
        />
      )}

      {/* PESTAÑA 6: ANÁLISIS EXCLUSIVO DEL GRUPO (MÓDULO 5 INTEGRADO EN EL GRUPO) */}
      {internalTab === 'analisis' && (
        <AnalyticsDashboard
          key={`analytics_${course.id}_${currentActivePeriod?.id || 'default'}`}
          teacherId={teacherId}
          teacherProfile={teacherProfile}
          years={years.length > 0 ? years : year ? [year] : []}
          periods={periods}
          subjects={subjects.length > 0 ? subjects : subject ? [subject] : []}
          groups={groups.length > 0 ? groups : group ? [group] : []}
          courses={allCourses}
          students={students}
          customFields={customFields}
          attendanceRecords={attendanceRecords}
          categories={categories}
          activities={activities}
          gradeEntries={gradeEntries}
          observations={observations}
          eventCollections={eventCollections}
          eventPaymentItems={eventPaymentItems}
          lockedGroupId={course.gradeGroupId}
          lockedCourseId={course.id}
          onNotify={onNotify}
        />
      )}

      {/* PESTAÑA 7: BOLETINES Y REPORTES DEL GRUPO (MÓDULO 6 INTEGRADO EN EL GRUPO) */}
      {internalTab === 'boletines' && (
        <ReportsAndBulletinsModule
          key={`reports_${course.id}_${currentActivePeriod?.id || 'default'}`}
          teacherProfile={teacherProfile}
          years={years.length > 0 ? years : year ? [year] : []}
          periods={periods}
          subjects={subjects.length > 0 ? subjects : subject ? [subject] : []}
          groups={groups.length > 0 ? groups : group ? [group] : []}
          courses={allCourses}
          students={students}
          customFields={customFields}
          attendanceRecords={attendanceRecords}
          categories={categories}
          activities={activities}
          gradeEntries={gradeEntries}
          observations={observations}
          eventCollections={eventCollections}
          eventPaymentItems={eventPaymentItems}
          lockedCourseId={course.id}
          onOpenSettings={onOpenScaleSettings || (() => {})}
          onNotify={onNotify}
        />
      )}

      {/* PESTAÑA 8: PLANES DE APOYO, CALENDARIO Y MENSAJES DEL GRUPO (MÓDULO 7 INTEGRADO EN EL GRUPO) */}
      {internalTab === 'extras' && (
        <ExtrasModule
          key={`extras_${course.id}_${currentActivePeriod?.id || 'default'}`}
          teacherId={teacherId}
          teacherProfile={teacherProfile}
          years={years.length > 0 ? years : year ? [year] : []}
          periods={periods}
          subjects={subjects.length > 0 ? subjects : subject ? [subject] : []}
          groups={groups.length > 0 ? groups : group ? [group] : []}
          courses={allCourses}
          students={students}
          customFields={customFields}
          attendanceRecords={attendanceRecords}
          categories={categories}
          activities={activities}
          gradeEntries={gradeEntries}
          observations={observations}
          eventCollections={eventCollections}
          eventPaymentItems={eventPaymentItems}
          supportPlans={supportPlans}
          calendarEvents={calendarEvents}
          guardianMessages={guardianMessages}
          lockedCourseId={course.id}
          onNotify={onNotify}
        />
      )}

      {/* Modal: Asignar otra asignatura a este mismo grupo */}
      <ModalDialog
        isOpen={addSubjectModalOpen}
        onClose={() => setAddSubjectModalOpen(false)}
        title={`Dictar otra asignatura en ${
          group ? `${group.gradeName} (${group.groupName})` : 'este grupo'
        }`}
        subtitle="Los estudiantes del grupo se comparten automáticamente; cada asignatura tendrá sus propias notas y actividades."
      >
        <form onSubmit={handleAssignAnotherSubjectToGroup} className="space-y-4">
          <SelectField
            label="Selecciona una asignatura existente o crea una nueva"
            value={selectedExistingSubjectId}
            onChange={(e) => setSelectedExistingSubjectId(e.target.value)}
            options={[
              { value: 'NEW', label: '+ Crear una nueva asignatura...' },
              ...subjects.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.areaName})`,
              })),
            ]}
          />

          {selectedExistingSubjectId === 'NEW' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Nombre de la Asignatura *"
                placeholder="Ej. Matemáticas, Geometría, Inglés..."
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                required
              />
              <InputField
                label="Área Fundamental (Opcional)"
                placeholder="Ej. Matemáticas"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
              />
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddSubjectModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isAddingSubjectToGroup}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Vincular asignatura al grupo
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Agregar Estudiante Manualmente */}
      <ModalDialog
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title={`Nuevo Estudiante · ${course.displayName}`}
        subtitle="Completa los datos básicos del estudiante y su acudiente."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateManualStudent} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Apellidos *"
              placeholder="Ej. Martínez Rojas"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
            <InputField
              label="Nombres *"
              placeholder="Ej. Laura Sofía"
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
                { value: 'PPT', label: 'PPT · Permiso por Protección Temporal' },
                { value: 'NES', label: 'NES · Número Secretaría' },
                { value: 'Otro', label: 'Otro' },
              ]}
            />
            <InputField
              label="Número de Documento"
              placeholder="Ej. 1034567890"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
            <InputField
              label="Nombre del Acudiente"
              placeholder="Ej. Sandra Rojas"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
            />
            <InputField
              label="Teléfono del Acudiente"
              placeholder="Ej. 312 345 6789"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
            />
          </div>

          <InputField
            label="Correo electrónico del Acudiente"
            type="email"
            placeholder="acudiente@correo.com"
            value={guardianEmail}
            onChange={(e) => setGuardianEmail(e.target.value)}
          />

          {sortedCustomFields.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <p className="text-xs font-bold text-slate-900 font-display">
                Campos personalizados adicionales
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sortedCustomFields.map((field) => {
                  const val = customValues[field.fieldKey];
                  if (field.fieldType === 'boolean') {
                    return (
                      <div key={field.id} className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-slate-800">
                          {field.label}
                        </span>
                        <label className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white inline-flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(val)}
                            onChange={(e) =>
                              setCustomValues((prev) => ({
                                ...prev,
                                [field.fieldKey]: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-teal-800"
                          />
                          <span>{val ? 'Sí' : 'No'}</span>
                        </label>
                      </div>
                    );
                  }
                  if (field.fieldType === 'select') {
                    return (
                      <SelectField
                        key={field.id}
                        label={field.label}
                        value={String(val ?? '')}
                        onChange={(e) =>
                          setCustomValues((prev) => ({
                            ...prev,
                            [field.fieldKey]: e.target.value,
                          }))
                        }
                        options={[
                          { value: '', label: 'Seleccionar...' },
                          ...(field.options || []).map((o) => ({
                            value: o,
                            label: o,
                          })),
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
                        setCustomValues((prev) => ({
                          ...prev,
                          [field.fieldKey]:
                            field.fieldType === 'number'
                              ? Number(e.target.value)
                              : e.target.value,
                        }))
                      }
                      required={field.required}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setManualModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSavingManual}
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              Guardar estudiante
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Importación por Excel o Foto con IA */}
      {importMode && (
        <StudentImportModal
          isOpen={Boolean(importMode)}
          onClose={() => setImportMode(null)}
          mode={importMode}
          teacherId={teacherId}
          academicYearId={course.academicYearId}
          gradeGroupId={course.gradeGroupId}
          courseDisplayName={course.displayName}
          onNotify={onNotify}
        />
      )}

      {/* Modal: Campos Personalizados */}
      <CustomFieldsModal
        isOpen={customFieldsModalOpen}
        onClose={() => setCustomFieldsModalOpen(false)}
        teacherId={teacherId}
        customFields={customFields}
        onNotify={onNotify}
      />

      {/* Modal: Ficha Individual del Estudiante con las 5 pestañas conectadas */}
      <StudentProfileModal
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        student={selectedStudent}
        group={group}
        customFields={customFields}
        attendanceRecords={attendanceRecords}
        categories={categories}
        activities={activities}
        gradeEntries={gradeEntries}
        periods={periods}
        courses={allCourses}
        observations={observations}
        eventCollections={eventCollections}
        eventPaymentItems={eventPaymentItems}
        teacherProfile={teacherProfile}
        teacherId={teacherId}
        onNotify={onNotify}
      />
    </div>
  );
};
