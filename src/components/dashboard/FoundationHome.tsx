import React, { useState, useMemo } from 'react';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Plus,
  Users,
  BarChart3,
  GraduationCap,
  Layers,
  Calendar,
  BookOpen,
  Edit3,
  Trash2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import {
  ModuleKey,
  TeacherProfile,
  CourseAssignment,
  GradeGroup,
  AreaSubject,
  Student,
  StudentCustomField,
  AcademicYear,
  AcademicPeriod,
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
  EducationLevel,
  SchoolShift,
} from '../../types/schema';
import { formatCOP } from '../../utils/academicCalculations';
import {
  CourseDetailView,
  InternalCourseTab,
} from '../module1/CourseDetailView';
import { StudentProfileModal } from '../module1/StudentProfileModal';
import { AnalyticsDashboard } from '../module5/AnalyticsDashboard';
import {
  Button,
  InputField,
  SelectField,
  ModalDialog,
  ConfirmDeleteModal,
  formatShortTeacherName,
} from '../ui/DesignSystem';

interface FoundationHomeProps {
  activeModule: ModuleKey;
  onSelectModule: (mod: ModuleKey) => void;
  teacherProfile: TeacherProfile | null;
  teacherId: string;
  years: AcademicYear[];
  periods: AcademicPeriod[];
  courses: CourseAssignment[];
  groups: GradeGroup[];
  subjects: AreaSubject[];
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
  onEnterCourse: (courseId: string, initialTab?: InternalCourseTab) => void;
  onOpenSettings: () => void;
  onShowToast: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

// Orden pedagógico natural para ordenar los grados en Colombia
function getGradeSortOrder(gradeName: string): number {
  const clean = gradeName.toLowerCase().trim();
  if (clean.includes('prej') || clean.includes('párv')) return 1;
  if (clean.includes('jard')) return 2;
  if (clean.includes('trans') || clean === '0°' || clean === '0') return 3;
  const numMatch = clean.match(/\d+/);
  if (numMatch) {
    return 10 + parseInt(numMatch[0], 10);
  }
  if (clean.includes('clei')) return 100;
  return 50;
}

export const FoundationHome: React.FC<FoundationHomeProps> = ({
  teacherProfile,
  teacherId,
  years,
  periods,
  courses,
  groups,
  subjects,
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
  onOpenSettings,
  onShowToast,
}) => {
  // ===========================================================================
  // ESTADOS DE LA RUTA JERÁRQUICA: INSTITUCIÓN ▸ GRADO ▸ GRUPO ▸ MÓDULOS
  // ===========================================================================
  const [selectedInstitution, setSelectedInstitution] = useState<string>('ALL');
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedGradeName, setSelectedGradeName] = useState<string | null>(
    null
  );
  const [gradeTab, setGradeTab] = useState<'grupos' | 'analisis_grado'>(
    'grupos'
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [initialGroupTab, setInitialGroupTab] =
    useState<InternalCourseTab>('estudiantes');

  const [selectedStudentForModal, setSelectedStudentForModal] =
    useState<Student | null>(null);

  // Modal: Institución Educativa
  const [instModalOpen, setInstModalOpen] = useState(false);
  const [newInstitutionName, setNewInstitutionName] = useState('');
  const [isSavingInst, setIsSavingInst] = useState(false);

  // Modal en ruta: Año Lectivo y Periodos Académicos (sin salir de la ruta)
  const [yearPeriodsModalOpen, setYearPeriodsModalOpen] = useState(false);
  const [newYearName, setNewYearName] = useState('2026');
  const [newYearStart, setNewYearStart] = useState('2026-01-26');
  const [newYearEnd, setNewYearEnd] = useState('2026-11-30');
  const [showNewYearForm, setShowNewYearForm] = useState(false);

  const [editingPeriod, setEditingPeriod] = useState<AcademicPeriod | null>(
    null
  );
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [periodName, setPeriodName] = useState('Periodo 1');
  const [periodNumber, setPeriodNumber] = useState('1');
  const [periodWeight, setPeriodWeight] = useState('25');
  const [periodStart, setPeriodStart] = useState('2026-01-26');
  const [periodEnd, setPeriodEnd] = useState('2026-04-10');
  const [isSavingYearPeriod, setIsSavingYearPeriod] = useState(false);

  // Modal en ruta: Áreas y Asignaturas (sin salir de la ruta)
  const [subjectsModalOpen, setSubjectsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<AreaSubject | null>(
    null
  );
  const [subjectName, setSubjectName] = useState('');
  const [areaName, setAreaName] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('4');
  const [subjectLevel, setSubjectLevel] =
    useState<EducationLevel>('Secundaria');
  const [isSavingSubject, setIsSavingSubject] = useState(false);

  // Modal en ruta: Crear o Editar Grado + Grupo + Asignatura
  const [quickGroupModalOpen, setQuickGroupModalOpen] = useState(false);
  const [editingGroupObj, setEditingGroupObj] = useState<GradeGroup | null>(
    null
  );
  const [qInstitution, setQInstitution] = useState('');
  const [qGradeName, setQGradeName] = useState('7°');
  const [qGroupName, setQGroupName] = useState('7-1');
  const [qLevel, setQLevel] =
    useState<Exclude<EducationLevel, 'Todos'>>('Secundaria');
  const [qShift, setQShift] = useState<SchoolShift>('Mañana');
  const [qSubjectName, setQSubjectName] = useState('Tecnología e Informática');
  const [qAreaName, setQAreaName] = useState('Tecnología e Informática');
  const [isCreatingQuickGroup, setIsCreatingQuickGroup] = useState(false);

  // Confirmación antes de eliminar
  const [deleteTarget, setDeleteTarget] = useState<{
    collection: string;
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const primaryInstitution =
    teacherProfile?.institutionName?.trim() || 'Institución Educativa Oficial';

  const shortTeacherName = formatShortTeacherName(teacherProfile?.fullName);

  // Lista consolidada de instituciones donde trabaja el docente
  const institutions = useMemo(() => {
    const set = new Set<string>([primaryInstitution]);
    if (Array.isArray(teacherProfile?.institutionsList)) {
      teacherProfile.institutionsList.forEach((inst) => {
        if (inst && inst.trim()) set.add(inst.trim());
      });
    }
    groups.forEach((g) => {
      if (g.institutionName && g.institutionName.trim()) {
        set.add(g.institutionName.trim());
      }
    });
    return Array.from(set);
  }, [primaryInstitution, teacherProfile?.institutionsList, groups]);

  const activeYear =
    years.find((y) => y.id === selectedYearId) ||
    years.find((y) => y.isActive) ||
    years[0] ||
    null;

  const activeYearId = activeYear?.id || '';

  const yearPeriods = useMemo(
    () =>
      periods
        .filter((p) => !activeYearId || p.academicYearId === activeYearId)
        .sort((a, b) => a.number - b.number),
    [periods, activeYearId]
  );

  const currentActivePeriod = useMemo(
    () => yearPeriods.find((p) => p.isActive) || yearPeriods[0] || null,
    [yearPeriods]
  );

  // Cambiar el Periodo Actual de Trabajo para sincronizar todos los módulos automáticamente
  const handleSetActivePeriod = async (periodId: string) => {
    const target = yearPeriods.find((p) => p.id === periodId);
    if (!target) return;
    try {
      const batch = writeBatch(db);
      yearPeriods.forEach((p) => {
        batch.update(doc(db, 'academic_periods', p.id), {
          isActive: p.id === periodId,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      onShowToast(
        `Periodo Actual: ${target.name}`,
        'Todos los módulos (Asistencia, Notas, Observador y Boletines) se ubicaron en este periodo.',
        'success'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'academic_periods');
    }
  };

  const activeCourses = courses.filter((c) => !c.archived);

  // Filtrar grupos según institución y año activo
  const filteredGroupsByInst = useMemo(() => {
    return groups.filter((g) => {
      if (activeYearId && g.academicYearId !== activeYearId) return false;
      const gInst = g.institutionName?.trim() || primaryInstitution;
      if (selectedInstitution !== 'ALL' && gInst !== selectedInstitution) {
        return false;
      }
      return true;
    });
  }, [groups, activeYearId, selectedInstitution, primaryInstitution]);

  const filteredGroupIdsSet = useMemo(
    () => new Set(filteredGroupsByInst.map((g) => g.id)),
    [filteredGroupsByInst]
  );

  const activeStudents = useMemo(
    () =>
      students.filter(
        (s) => s.status === 'Activo' && filteredGroupIdsSet.has(s.gradeGroupId)
      ),
    [students, filteredGroupIdsSet]
  );

  // Agrupar por GRADO (Nivel 1 de navegación)
  const gradeCards = useMemo(() => {
    const map = new Map<
      string,
      {
        gradeName: string;
        educationLevel: string;
        groups: GradeGroup[];
        courses: CourseAssignment[];
        studentCount: number;
        institutions: Set<string>;
      }
    >();

    filteredGroupsByInst.forEach((grp) => {
      const key = grp.gradeName.trim();
      const existing = map.get(key) || {
        gradeName: key,
        educationLevel: grp.educationLevel,
        groups: [],
        courses: [],
        studentCount: 0,
        institutions: new Set<string>(),
      };

      existing.groups.push(grp);
      existing.institutions.add(
        grp.institutionName?.trim() || primaryInstitution
      );

      const grpCourses = activeCourses.filter((c) => c.gradeGroupId === grp.id);
      existing.courses.push(...grpCourses);

      const grpStuCount = students.filter(
        (s) => s.gradeGroupId === grp.id && s.status === 'Activo'
      ).length;
      existing.studentCount += grpStuCount;

      map.set(key, existing);
    });

    return Array.from(map.values()).sort(
      (a, b) =>
        getGradeSortOrder(a.gradeName) - getGradeSortOrder(b.gradeName) ||
        a.gradeName.localeCompare(b.gradeName, 'es-CO')
    );
  }, [filteredGroupsByInst, activeCourses, students, primaryInstitution]);

  // Cálculos de resumen del Periodo Actual (0% si aún no hay registros)
  const filteredAttendance = attendanceRecords.filter(
    (r) =>
      filteredGroupIdsSet.has(r.gradeGroupId) &&
      (!currentActivePeriod || r.periodId === currentActivePeriod.id)
  );
  const totalPresentOrExcused = filteredAttendance.filter(
    (r) =>
      r.status === 'Presente' ||
      r.status === 'Excusa' ||
      r.status === 'Tardanza'
  ).length;
  const globalAttendancePct =
    filteredAttendance.length > 0
      ? Math.round((totalPresentOrExcused / filteredAttendance.length) * 100)
      : 0;

  const totalCollectedCOP = eventPaymentItems
    .filter((item) => filteredGroupIdsSet.has(item.gradeGroupId))
    .reduce((acc, item) => acc + (item.amountPaidCOP || 0), 0);

  // Entrar a un grupo garantizando que tenga un curso activo vinculado
  const handleEnterGroup = async (
    group: GradeGroup,
    tab: InternalCourseTab = 'estudiantes',
    specificCourseId?: string
  ) => {
    const grpCourses = activeCourses.filter((c) => c.gradeGroupId === group.id);
    if (specificCourseId) {
      setInitialGroupTab(tab);
      setSelectedGradeName(group.gradeName);
      setSelectedCourseId(specificCourseId);
      return;
    }

    if (grpCourses.length > 0) {
      setInitialGroupTab(tab);
      setSelectedGradeName(group.gradeName);
      setSelectedCourseId(grpCourses[0].id);
      return;
    }

    try {
      let defaultSubject = subjects[0];
      if (!defaultSubject) {
        const subId = `subj_${Date.now()}`;
        defaultSubject = {
          id: subId,
          teacherId,
          name: 'Asignatura General',
          areaName: 'Área General',
          weeklyHours: 4,
          educationLevel: group.educationLevel,
        };
        await setDoc(doc(db, 'areas_subjects', subId), {
          teacherId,
          name: defaultSubject.name,
          areaName: defaultSubject.areaName,
          weeklyHours: 4,
          educationLevel: group.educationLevel,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const newCourseId = `crs_${Date.now()}`;
      await setDoc(doc(db, 'courses', newCourseId), {
        teacherId,
        academicYearId: group.academicYearId,
        gradeGroupId: group.id,
        areaSubjectId: defaultSubject.id,
        displayName: `${defaultSubject.name} · ${group.gradeName} (${group.groupName})`,
        scheduleSummary: `Jornada ${group.shift}`,
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setInitialGroupTab(tab);
      setSelectedGradeName(group.gradeName);
      setSelectedCourseId(newCourseId);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'courses');
    }
  };

  // Guardar nueva institución en el perfil del docente
  const handleAddInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newInstitutionName.trim().slice(0, 150);
    if (!clean) return;

    setIsSavingInst(true);
    try {
      const updatedList = Array.from(
        new Set([...institutions, clean])
      ).slice(0, 20);
      await updateDoc(doc(db, 'teachers', teacherId), {
        institutionsList: updatedList,
        updatedAt: serverTimestamp(),
      });
      setSelectedInstitution(clean);
      setSelectedGradeName(null);
      setSelectedCourseId(null);
      setNewInstitutionName('');
      setInstModalOpen(false);
      onShowToast('Institución agregada', `Se agregó "${clean}".`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `teachers/${teacherId}`);
    } finally {
      setIsSavingInst(false);
    }
  };

  // Crear Año Lectivo con sus 4 periodos desde el modal en ruta
  const handleCreateYearInPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearName.trim()) return;
    setIsSavingYearPeriod(true);

    const newYId = `yr_${Date.now()}`;
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'academic_years', newYId), {
        teacherId,
        name: newYearName.trim().slice(0, 100),
        startDate: newYearStart,
        endDate: newYearEnd,
        isActive: years.length === 0,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      [1, 2, 3, 4].forEach((num) => {
        const pid = `per_${Date.now()}_${num}`;
        batch.set(doc(db, 'academic_periods', pid), {
          teacherId,
          academicYearId: newYId,
          name: `Periodo ${num}`,
          number: num,
          weightPercentage: 25,
          startDate: `${newYearName.trim()}-0${num * 2}-01`,
          endDate: `${newYearName.trim()}-0${num * 2 + 1}-28`,
          isActive: num === 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      setSelectedYearId(newYId);
      setShowNewYearForm(false);
      onShowToast(
        'Año creado',
        `Año ${newYearName.trim()} configurado con 4 periodos.`,
        'success'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `academic_years/${newYId}`);
    } finally {
      setIsSavingYearPeriod(false);
    }
  };

  // Guardar Periodo Académico en el modal en ruta
  const handleSavePeriodInPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeYearId || !periodName.trim()) return;
    setIsSavingYearPeriod(true);

    const num = Math.max(1, Math.min(10, parseInt(periodNumber, 10) || 1));
    const weight = Math.max(0, Math.min(100, parseFloat(periodWeight) || 25));

    try {
      if (editingPeriod) {
        await updateDoc(doc(db, 'academic_periods', editingPeriod.id), {
          academicYearId: activeYearId,
          name: periodName.trim().slice(0, 100),
          number: num,
          weightPercentage: weight,
          startDate: periodStart,
          endDate: periodEnd,
          isActive: editingPeriod.isActive,
          updatedAt: serverTimestamp(),
        });
        onShowToast('Periodo actualizado', `${periodName} guardado.`);
      } else {
        const pid = `per_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'academic_periods', pid), {
          teacherId,
          academicYearId: activeYearId,
          name: periodName.trim().slice(0, 100),
          number: num,
          weightPercentage: weight,
          startDate: periodStart,
          endDate: periodEnd,
          isActive: yearPeriods.length === 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onShowToast('Periodo agregado', `Se agregó ${periodName} (${weight}%).`);
      }
      setEditingPeriod(null);
      setShowPeriodForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'academic_periods');
    } finally {
      setIsSavingYearPeriod(false);
    }
  };

  // Guardar Asignatura en el modal en ruta
  const handleSaveSubjectInPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;
    setIsSavingSubject(true);

    const hours = Math.max(0, Math.min(40, parseInt(weeklyHours, 10) || 4));
    const finalArea = (areaName.trim() || subjectName.trim()).slice(0, 150);

    try {
      if (editingSubject) {
        await updateDoc(doc(db, 'areas_subjects', editingSubject.id), {
          name: subjectName.trim().slice(0, 150),
          areaName: finalArea,
          weeklyHours: hours,
          educationLevel: subjectLevel,
          updatedAt: serverTimestamp(),
        });
        onShowToast('Asignatura actualizada', subjectName.trim());
      } else {
        const sid = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'areas_subjects', sid), {
          teacherId,
          name: subjectName.trim().slice(0, 150),
          areaName: finalArea,
          weeklyHours: hours,
          educationLevel: subjectLevel,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onShowToast('Asignatura creada', subjectName.trim());
      }
      setEditingSubject(null);
      setSubjectName('');
      setAreaName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'areas_subjects');
    } finally {
      setIsSavingSubject(false);
    }
  };

  // Crear o Editar Grado + Grupo + Asignatura desde la ruta
  const handleCreateQuickGradeAndGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qGradeName.trim() || !qGroupName.trim()) return;

    setIsCreatingQuickGroup(true);
    try {
      const instName = (
        qInstitution.trim() ||
        (selectedInstitution !== 'ALL'
          ? selectedInstitution
          : primaryInstitution)
      ).slice(0, 150);

      if (editingGroupObj) {
        await updateDoc(doc(db, 'grade_groups', editingGroupObj.id), {
          academicYearId: editingGroupObj.academicYearId,
          institutionName: instName,
          gradeName: qGradeName.trim().slice(0, 80),
          groupName: qGroupName.trim().slice(0, 80),
          educationLevel: qLevel,
          shift: qShift,
          isDirector: editingGroupObj.isDirector,
          room: editingGroupObj.room || '',
          updatedAt: serverTimestamp(),
        });
        setQuickGroupModalOpen(false);
        setEditingGroupObj(null);
        onShowToast(
          'Grupo actualizado',
          `Grupo ${qGroupName.trim()} (${qGradeName.trim()}) actualizado.`
        );
        return;
      }

      if (!qSubjectName.trim()) return;

      const batch = writeBatch(db);
      let yearId = activeYear?.id || '';

      if (!yearId) {
        yearId = `yr_${Date.now()}`;
        batch.set(doc(db, 'academic_years', yearId), {
          teacherId,
          name: String(new Date().getFullYear()),
          startDate: `${new Date().getFullYear()}-01-20`,
          endDate: `${new Date().getFullYear()}-11-30`,
          isActive: true,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        [1, 2, 3, 4].forEach((n) => {
          batch.set(doc(db, 'academic_periods', `per_${Date.now()}_${n}`), {
            teacherId,
            academicYearId: yearId,
            name: `Periodo ${n}`,
            number: n,
            weightPercentage: 25,
            startDate: `${new Date().getFullYear()}-0${n * 2}-01`,
            endDate: `${new Date().getFullYear()}-0${n * 2 + 1}-28`,
            isActive: n === 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      }

      let subjectObj = subjects.find(
        (s) => s.name.toLowerCase() === qSubjectName.trim().toLowerCase()
      );
      let subjectId = subjectObj?.id || '';
      if (!subjectId) {
        subjectId = `subj_${Date.now()}`;
        batch.set(doc(db, 'areas_subjects', subjectId), {
          teacherId,
          name: qSubjectName.trim().slice(0, 150),
          areaName: (qAreaName.trim() || qSubjectName.trim()).slice(0, 150),
          weeklyHours: 4,
          educationLevel: qLevel,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const groupId = `grp_${Date.now()}`;
      batch.set(doc(db, 'grade_groups', groupId), {
        teacherId,
        academicYearId: yearId,
        institutionName: instName,
        gradeName: qGradeName.trim().slice(0, 80),
        groupName: qGroupName.trim().slice(0, 80),
        educationLevel: qLevel,
        shift: qShift,
        isDirector: false,
        room: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const courseId = `crs_${Date.now()}`;
      const displayName = `${qSubjectName.trim()} · ${qGradeName.trim()} (${qGroupName.trim()})`.slice(
        0,
        200
      );
      batch.set(doc(db, 'courses', courseId), {
        teacherId,
        academicYearId: yearId,
        gradeGroupId: groupId,
        areaSubjectId: subjectId,
        displayName,
        scheduleSummary: `Jornada ${qShift}`,
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      setQuickGroupModalOpen(false);
      setSelectedGradeName(qGradeName.trim());
      onShowToast(
        'Grado y Grupo creados',
        `Grupo ${qGroupName.trim()} en Grado ${qGradeName.trim()} listo.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'grade_groups');
    } finally {
      setIsCreatingQuickGroup(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, deleteTarget.collection, deleteTarget.id));
      onShowToast('Registro eliminado', deleteTarget.name);
      setDeleteTarget(null);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `${deleteTarget.collection}/${deleteTarget.id}`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // ===========================================================================
  // NIVEL 3: SI HAY UN GRUPO / CURSO SELECCIONADO, MOSTRAR EL CENTRO DEL GRUPO
  // ===========================================================================
  const activeCourseObj = courses.find((c) => c.id === selectedCourseId);
  if (activeCourseObj) {
    const grp = groups.find((g) => g.id === activeCourseObj.gradeGroupId);
    const subj = subjects.find((s) => s.id === activeCourseObj.areaSubjectId);
    const yr = years.find((y) => y.id === activeCourseObj.academicYearId);

    return (
      <CourseDetailView
        key={activeCourseObj.id}
        course={activeCourseObj}
        group={grp}
        subject={subj}
        year={yr}
        years={years}
        periods={periods}
        subjects={subjects}
        groups={groups}
        allCourses={courses}
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
        teacherProfile={teacherProfile}
        teacherId={teacherId}
        initialTab={initialGroupTab}
        onSwitchCourse={(newCid) => setSelectedCourseId(newCid)}
        onNavigateToGrade={(gName) => {
          setSelectedCourseId(null);
          setSelectedGradeName(gName);
          setGradeTab('grupos');
        }}
        onOpenScaleSettings={onOpenSettings}
        onSetActivePeriod={handleSetActivePeriod}
        onBack={() => {
          setSelectedCourseId(null);
          setSelectedGradeName(null);
        }}
        onNotify={(title, detail, type) => onShowToast(title, detail, type)}
      />
    );
  }

  // ===========================================================================
  // NIVEL 2: VISTA DEL GRADO (EJ. GRADO 7°) — GRUPOS Y COMPARATIVA DEL GRADO
  // ===========================================================================
  if (selectedGradeName) {
    const groupsInGrade = filteredGroupsByInst
      .filter((g) => g.gradeName.trim() === selectedGradeName.trim())
      .sort((a, b) => a.groupName.localeCompare(b.groupName, 'es-CO'));

    const totalStudentsInGrade = students.filter(
      (s) =>
        s.status === 'Activo' &&
        groupsInGrade.some((g) => g.id === s.gradeGroupId)
    ).length;

    return (
      <div className="space-y-5">
        {/* Cabecera Compacta del Grado */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
          {/* Miga de pan */}
          <nav
            aria-label="Ruta del grado"
            className="flex flex-wrap items-center justify-between gap-2 text-xs pb-3 border-b border-slate-100"
          >
            <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
              <button
                type="button"
                onClick={() => setSelectedGradeName(null)}
                className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-teal-800 cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5 text-teal-800" />
                <span>
                  {selectedInstitution === 'ALL'
                    ? primaryInstitution
                    : selectedInstitution}
                </span>
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-teal-900">
                Grado {selectedGradeName}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {yearPeriods.length > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50/70 px-2.5 py-1">
                  <span className="text-[11px] font-semibold text-teal-900">
                    Periodo Actual:
                  </span>
                  <select
                    aria-label="Periodo Actual de Trabajo"
                    value={currentActivePeriod?.id || ''}
                    onChange={(e) => handleSetActivePeriod(e.target.value)}
                    className="bg-transparent text-xs font-bold text-teal-950 focus:outline-none cursor-pointer"
                  >
                    {yearPeriods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.weightPercentage}%)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedGradeName(null)}
                className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Todos los grados</span>
              </button>
            </div>
          </nav>

          {/* Título del Grado + Controles */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                Grado {selectedGradeName}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-mono tabular-nums font-semibold text-slate-700">
                  {groupsInGrade.length}
                </span>{' '}
                {groupsInGrade.length === 1 ? 'grupo' : 'grupos'} ·{' '}
                <span className="font-mono tabular-nums font-semibold text-slate-700">
                  {totalStudentsInGrade}
                </span>{' '}
                estudiantes activos
                {currentActivePeriod ? (
                  <>
                    {' · '}
                    <span className="font-semibold text-teal-800">
                      {currentActivePeriod.name} en curso
                    </span>
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Selector de vista dentro del Grado */}
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
                <button
                  type="button"
                  onClick={() => setGradeTab('grupos')}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    gradeTab === 'grupos'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-teal-800" />
                  <span>Grupos ({groupsInGrade.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGradeTab('analisis_grado')}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    gradeTab === 'analisis_grado'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-teal-800" />
                  <span>Análisis del Grado</span>
                </button>
              </div>

              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => {
                  setEditingGroupObj(null);
                  setQInstitution(
                    selectedInstitution === 'ALL'
                      ? primaryInstitution
                      : selectedInstitution
                  );
                  setQGradeName(selectedGradeName);
                  setQGroupName(
                    `${selectedGradeName.replace('°', '')}-${
                      groupsInGrade.length + 1
                    }`
                  );
                  setQuickGroupModalOpen(true);
                }}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                + Grupo en {selectedGradeName}
              </Button>
            </div>
          </div>
        </section>

        {gradeTab === 'analisis_grado' ? (
          <AnalyticsDashboard
            teacherId={teacherId}
            teacherProfile={teacherProfile}
            years={years}
            periods={periods}
            subjects={subjects}
            groups={groups}
            courses={courses}
            students={students}
            customFields={customFields}
            attendanceRecords={attendanceRecords}
            categories={categories}
            activities={activities}
            gradeEntries={gradeEntries}
            observations={observations}
            eventCollections={eventCollections}
            eventPaymentItems={eventPaymentItems}
            lockedGradeName={selectedGradeName}
            onNotify={(title, detail, type) => onShowToast(title, detail, type)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupsInGrade.map((grp) => {
              const grpCourses = activeCourses.filter(
                (c) => c.gradeGroupId === grp.id
              );
              const grpStudents = students.filter(
                (s) => s.gradeGroupId === grp.id && s.status === 'Activo'
              );
              const grpAtt = attendanceRecords.filter(
                (r) =>
                  r.gradeGroupId === grp.id &&
                  (!currentActivePeriod || r.periodId === currentActivePeriod.id)
              );
              const grpPres = grpAtt.filter(
                (r) =>
                  r.status === 'Presente' ||
                  r.status === 'Excusa' ||
                  r.status === 'Tardanza'
              ).length;
              const grpAttPct =
                grpAtt.length > 0
                  ? Math.round((grpPres / grpAtt.length) * 100)
                  : 0;

              return (
                <div
                  key={grp.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4 hover:border-teal-800 transition-colors"
                >
                  <div className="space-y-3">
                    {/* Metadatos limpios sin exceso de cajas */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Jornada {grp.shift} ·{' '}
                        <strong className="font-mono tabular-nums text-slate-800">
                          {grpStudents.length}
                        </strong>{' '}
                        est.
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGroupObj(grp);
                            setQInstitution(
                              grp.institutionName || primaryInstitution
                            );
                            setQGradeName(grp.gradeName);
                            setQGroupName(grp.groupName);
                            setQLevel(grp.educationLevel);
                            setQShift(grp.shift);
                            setQuickGroupModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                          title="Editar grupo"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              collection: 'grade_groups',
                              id: grp.id,
                              name: `Grupo ${grp.groupName}`,
                            })
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          title="Eliminar grupo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => handleEnterGroup(grp, 'estudiantes')}
                        className="text-left group cursor-pointer"
                      >
                        <h2 className="text-xl font-bold text-slate-900 font-display group-hover:text-teal-800 transition-colors">
                          Grupo {grp.groupName}
                        </h2>
                      </button>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Asistencia ({currentActivePeriod?.name || 'Periodo'}):{' '}
                        <strong className="font-mono tabular-nums text-emerald-700">
                          {grpAttPct}%
                        </strong>{' '}
                        ({grpAtt.length} reg.)
                      </p>
                    </div>

                    {/* Asignaturas dictadas en este grupo */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                      {grpCourses.length === 0 ? (
                        <span className="text-xs text-slate-400">
                          Sin asignatura (se vincula al abrir)
                        </span>
                      ) : (
                        grpCourses.map((crs) => {
                          const subj = subjects.find(
                            (s) => s.id === crs.areaSubjectId
                          );
                          return (
                            <button
                              key={crs.id}
                              type="button"
                              onClick={() =>
                                handleEnterGroup(grp, 'estudiantes', crs.id)
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 hover:bg-teal-50 hover:text-teal-900 text-xs font-medium transition-colors cursor-pointer"
                            >
                              {subj?.name || crs.displayName}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => handleEnterGroup(grp, 'estudiantes')}
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    className="w-full"
                  >
                    Abrir Grupo {grp.groupName}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // NIVEL 1 (PANTALLA PRINCIPAL): INSTITUCIÓN, AÑO/PERIODOS Y TARJETAS DE GRADOS
  // ===========================================================================
  return (
    <div className="space-y-6">
      {/* 1. CABECERA COMPACTA DE BIENVENIDA Y CONTEXTO EN LA MISMA RUTA */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              Hola, {shortTeacherName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Elige tu institución y periodo actual; al entrar a cualquier grado o grupo todo se sincronizará en ese periodo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => {
                setEditingGroupObj(null);
                setQInstitution(
                  selectedInstitution === 'ALL'
                    ? primaryInstitution
                    : selectedInstitution
                );
                setQuickGroupModalOpen(true);
              }}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              + Nuevo Grado / Grupo
            </Button>
          </div>
        </div>

        {/* Barra de Contexto Integrada en la Ruta: Institución + Periodo Actual + Año/Asignaturas */}
        <div className="pt-3.5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Selector de Institución Educativa */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 inline-flex items-center gap-1 mr-1">
              <Building2 className="w-3.5 h-3.5 text-teal-800" />
              <span>Colegio:</span>
            </span>

            {institutions.length > 1 && (
              <button
                type="button"
                onClick={() => setSelectedInstitution('ALL')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedInstitution === 'ALL'
                    ? 'bg-teal-800 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Todos ({institutions.length})
              </button>
            )}

            {institutions.map((inst) => {
              const isSelected =
                institutions.length === 1 || selectedInstitution === inst;
              return (
                <button
                  key={inst}
                  type="button"
                  onClick={() => setSelectedInstitution(inst)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-teal-800 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {inst}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setInstModalOpen(true)}
              className="min-h-[34px] px-2.5 py-1 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:border-teal-700 hover:text-teal-800 text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Otro colegio</span>
            </button>
          </div>

          {/* Controles integrados: Periodo Actual de Trabajo, Año Lectivo y Asignaturas */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Selector Maestro de Periodo Actual de Trabajo */}
            {yearPeriods.length > 0 && (
              <div className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-teal-700/30 bg-teal-50/80 px-2.5 py-1">
                <span className="h-2 w-2 rounded-full bg-teal-700 shrink-0" />
                <span className="text-xs font-semibold text-teal-900 whitespace-nowrap">
                  Periodo Actual:
                </span>
                <select
                  aria-label="Seleccionar Periodo Actual de Trabajo"
                  value={currentActivePeriod?.id || ''}
                  onChange={(e) => handleSetActivePeriod(e.target.value)}
                  className="bg-transparent text-xs font-bold text-teal-950 focus:outline-none cursor-pointer"
                >
                  {yearPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.weightPercentage}%)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {years.length > 0 && (
              <select
                aria-label="Seleccionar año lectivo"
                value={activeYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="min-h-[34px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 focus:border-teal-700 focus:outline-none"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    Año {y.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => {
                setShowNewYearForm(years.length === 0);
                setShowPeriodForm(false);
                setYearPeriodsModalOpen(true);
              }}
              className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-teal-800" />
              <span>
                Año y Periodos ({yearPeriods.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingSubject(null);
                setSubjectName('');
                setAreaName('');
                setSubjectsModalOpen(true);
              }}
              className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-800" />
              <span>Asignaturas ({subjects.length})</span>
            </button>
          </div>
        </div>

        {/* Franja Limpia de Resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <p className="text-xs text-slate-500">Grados y Grupos</p>
            <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {gradeCards.length} grados · {filteredGroupsByInst.length} grupos
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <p className="text-xs text-slate-500">Estudiantes Activos</p>
            <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {activeStudents.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <p className="text-xs text-slate-500">
              Asistencia ({currentActivePeriod?.name || 'Periodo Actual'})
            </p>
            <p className="text-lg font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
              {globalAttendancePct}%{' '}
              <span className="text-xs font-normal text-slate-500">
                ({filteredAttendance.length} reg.)
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <p className="text-xs text-slate-500">Total Recaudado</p>
            <p className="text-lg font-bold text-emerald-800 font-mono tabular-nums mt-0.5">
              {formatCOP(totalCollectedCOP)}
            </p>
          </div>
        </div>
      </section>

      {/* 2. TARJETAS DE GRADOS ESCOLARES */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-800" />
            <span>Grados Escolares</span>
          </h2>
        </div>

        {gradeCards.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
            <div className="h-11 w-11 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center mx-auto">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-display">
              Aún no hay grados creados
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Crea tu primer grado y grupo para subir tus listas de estudiantes, asistencia y notas.
            </p>
            <div className="pt-1 flex justify-center">
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => {
                  setEditingGroupObj(null);
                  setQInstitution(
                    selectedInstitution === 'ALL'
                      ? primaryInstitution
                      : selectedInstitution
                  );
                  setQuickGroupModalOpen(true);
                }}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                + Crear Grado y Grupo
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gradeCards.map((gCard) => {
              const sortedGroups = [...gCard.groups].sort((a, b) =>
                a.groupName.localeCompare(b.groupName, 'es-CO')
              );

              return (
                <div
                  key={gCard.gradeName}
                  className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4 hover:border-teal-800 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{gCard.educationLevel}</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-700">
                        {sortedGroups.length}{' '}
                        {sortedGroups.length === 1 ? 'grupo' : 'grupos'} ·{' '}
                        {gCard.studentCount} est.
                      </span>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGradeName(gCard.gradeName);
                          setGradeTab('grupos');
                        }}
                        className="text-left group cursor-pointer"
                      >
                        <h3 className="text-xl font-bold text-slate-900 font-display group-hover:text-teal-800 transition-colors">
                          Grado {gCard.gradeName}
                        </h3>
                      </button>
                      {institutions.length > 1 && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {Array.from(gCard.institutions).join(' · ')}
                        </p>
                      )}
                    </div>

                    {/* Acceso directo en 1 clic a cada grupo del grado */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                      {sortedGroups.map((grp) => {
                        const count = students.filter(
                          (s) =>
                            s.gradeGroupId === grp.id && s.status === 'Activo'
                        ).length;
                        return (
                          <button
                            key={grp.id}
                            type="button"
                            onClick={() => handleEnterGroup(grp, 'estudiantes')}
                            className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-800 hover:text-white hover:border-teal-800 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <span>Grupo {grp.groupName}</span>
                            <span className="text-[11px] font-mono tabular-nums opacity-75">
                              ({count})
                            </span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedGradeName(gCard.gradeName);
                        setGradeTab('grupos');
                      }}
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      className="flex-1"
                    >
                      Abrir Grado {gCard.gradeName}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedGradeName(gCard.gradeName);
                        setGradeTab('analisis_grado');
                      }}
                      leftIcon={<BarChart3 className="w-3.5 h-3.5 text-teal-800" />}
                    >
                      Análisis
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =====================================================================
          MODAL EN RUTA: AÑO LECTIVO Y PERIODOS ACADÉMICOS
      ===================================================================== */}
      <ModalDialog
        isOpen={yearPeriodsModalOpen}
        onClose={() => setYearPeriodsModalOpen(false)}
        title="Año Lectivo y Periodos Académicos"
        subtitle="Administra el año escolar y el porcentaje de cada periodo sin salir de tu ruta."
        maxWidth="xl"
      >
        <div className="space-y-5">
          {/* Selector de año lectivo + Botón Nuevo Año */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              {years.map((y) => (
                <button
                  key={y.id}
                  type="button"
                  onClick={() => setSelectedYearId(y.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    y.id === activeYearId
                      ? 'bg-teal-800 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Año {y.name}
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowNewYearForm(!showNewYearForm)}
              leftIcon={<Plus className="w-3.5 h-3.5 text-teal-800" />}
            >
              {showNewYearForm ? 'Cancelar nuevo año' : '+ Nuevo Año Lectivo'}
            </Button>
          </div>

          {showNewYearForm && (
            <form
              onSubmit={handleCreateYearInPlace}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
            >
              <p className="text-xs font-bold text-slate-800">
                Crear Nuevo Año Lectivo (incluye los 4 periodos al 25% por defecto)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InputField
                  label="Año *"
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                  required
                />
                <InputField
                  label="Inicio"
                  type="date"
                  value={newYearStart}
                  onChange={(e) => setNewYearStart(e.target.value)}
                  required
                />
                <InputField
                  label="Cierre"
                  type="date"
                  value={newYearEnd}
                  onChange={(e) => setNewYearEnd(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  isLoading={isSavingYearPeriod}
                >
                  Crear Año y 4 Periodos
                </Button>
              </div>
            </form>
          )}

          {/* Lista de periodos del año activo */}
          {activeYear && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800">
                  Periodos del Año {activeYear.name} ({yearPeriods.length})
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingPeriod(null);
                    const nextNum = yearPeriods.length + 1;
                    setPeriodName(`Periodo ${nextNum}`);
                    setPeriodNumber(String(nextNum));
                    setPeriodWeight('25');
                    setShowPeriodForm(true);
                  }}
                  leftIcon={<Plus className="w-3.5 h-3.5 text-teal-800" />}
                >
                  + Agregar Periodo
                </Button>
              </div>

              {showPeriodForm && (
                <form
                  onSubmit={handleSavePeriodInPlace}
                  className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <InputField
                      label="Nombre *"
                      value={periodName}
                      onChange={(e) => setPeriodName(e.target.value)}
                      required
                    />
                    <InputField
                      label="Número *"
                      type="number"
                      value={periodNumber}
                      onChange={(e) => setPeriodNumber(e.target.value)}
                      required
                    />
                    <InputField
                      label="Peso (%) *"
                      type="number"
                      value={periodWeight}
                      onChange={(e) => setPeriodWeight(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField
                      label="Fecha Inicio"
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      required
                    />
                    <InputField
                      label="Fecha Fin"
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowPeriodForm(false);
                        setEditingPeriod(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      variant="primary"
                      isLoading={isSavingYearPeriod}
                    >
                      Guardar Periodo
                    </Button>
                  </div>
                </form>
              )}

              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {yearPeriods.map((p) => {
                  const isCurrentActive = p.id === currentActivePeriod?.id;
                  return (
                    <div
                      key={p.id}
                      className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-slate-900">{p.name}</span>
                        <span className="font-mono tabular-nums text-teal-800 font-semibold">
                          · {p.weightPercentage}%
                        </span>
                        <span className="text-slate-500 font-mono">
                          ({p.startDate} a {p.endDate})
                        </span>
                        {isCurrentActive && (
                          <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-bold text-teal-900">
                            Periodo Actual
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!isCurrentActive && (
                          <button
                            type="button"
                            onClick={() => handleSetActivePeriod(p.id)}
                            className="px-2.5 py-1 rounded-lg border border-teal-200 bg-teal-50/70 hover:bg-teal-800 hover:text-white text-[11px] font-semibold text-teal-900 transition-colors cursor-pointer"
                          >
                            Marcar como Actual
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPeriod(p);
                            setPeriodName(p.name);
                            setPeriodNumber(String(p.number));
                            setPeriodWeight(String(p.weightPercentage));
                            setPeriodStart(p.startDate);
                            setPeriodEnd(p.endDate);
                            setShowPeriodForm(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                          title="Editar periodo"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              collection: 'academic_periods',
                              id: p.id,
                              name: p.name,
                            })
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          title="Eliminar periodo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ModalDialog>

      {/* =====================================================================
          MODAL EN RUTA: ÁREAS Y ASIGNATURAS
      ===================================================================== */}
      <ModalDialog
        isOpen={subjectsModalOpen}
        onClose={() => setSubjectsModalOpen(false)}
        title="Áreas y Asignaturas"
        subtitle="Crea o edita tus asignaturas sin salir de la pantalla principal."
        maxWidth="xl"
      >
        <div className="space-y-4">
          <form
            onSubmit={handleSaveSubjectInPlace}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
          >
            <p className="text-xs font-bold text-slate-800">
              {editingSubject ? 'Editar Asignatura' : 'Agregar Nueva Asignatura'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InputField
                label="Asignatura *"
                placeholder="Ej. Matemáticas"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                required
              />
              <InputField
                label="Área Fundamental"
                placeholder="Ej. Matemáticas"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
              />
              <InputField
                label="Horas / Semana"
                type="number"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              {editingSubject && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingSubject(null);
                    setSubjectName('');
                    setAreaName('');
                  }}
                >
                  Cancelar edición
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                variant="primary"
                isLoading={isSavingSubject}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                {editingSubject ? 'Actualizar Asignatura' : 'Guardar Asignatura'}
              </Button>
            </div>
          </form>

          {subjects.length > 0 && (
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white max-h-64 overflow-y-auto">
              {subjects.map((s) => (
                <div
                  key={s.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900">{s.name}</span>
                    <span className="text-slate-500 ml-2">
                      · Área: {s.areaName} ({s.weeklyHours}h/sem)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSubject(s);
                        setSubjectName(s.name);
                        setAreaName(s.areaName);
                        setWeeklyHours(String(s.weeklyHours));
                        setSubjectLevel(s.educationLevel);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          collection: 'areas_subjects',
                          id: s.id,
                          name: s.name,
                        })
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalDialog>

      {/* Modal: Agregar otra Institución Educativa */}
      <ModalDialog
        isOpen={instModalOpen}
        onClose={() => setInstModalOpen(false)}
        title="Agregar otra Institución Educativa"
        subtitle="Separa tus grados y grupos por colegio."
      >
        <form onSubmit={handleAddInstitution} className="space-y-4">
          <InputField
            label="Nombre del Colegio o Institución *"
            placeholder="Ej. I.E. Francisco José de Caldas"
            value={newInstitutionName}
            onChange={(e) => setNewInstitutionName(e.target.value)}
            required
          />
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setInstModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              isLoading={isSavingInst}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Guardar Colegio
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Creación o Edición Rápida de Grado + Grupo + Asignatura */}
      <ModalDialog
        isOpen={quickGroupModalOpen}
        onClose={() => {
          setQuickGroupModalOpen(false);
          setEditingGroupObj(null);
        }}
        title={
          editingGroupObj
            ? `Editar Grupo ${editingGroupObj.groupName}`
            : 'Nuevo Grado y Grupo'
        }
        subtitle="Configura el grado, el grupo y su asignatura en un solo paso."
      >
        <form onSubmit={handleCreateQuickGradeAndGroup} className="space-y-4">
          <InputField
            label="Institución Educativa *"
            placeholder="Nombre del colegio"
            value={qInstitution}
            onChange={(e) => setQInstitution(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Grado *"
              placeholder="Ej. 2°, 7°, 11°..."
              value={qGradeName}
              onChange={(e) => setQGradeName(e.target.value)}
              required
            />
            <InputField
              label="Grupo *"
              placeholder="Ej. 2-2, 7-1, 7-B..."
              value={qGroupName}
              onChange={(e) => setQGroupName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Nivel Educativo"
              value={qLevel}
              onChange={(e) =>
                setQLevel(e.target.value as Exclude<EducationLevel, 'Todos'>)
              }
              options={[
                { value: 'Preescolar', label: 'Preescolar' },
                { value: 'Primaria', label: 'Básica Primaria' },
                { value: 'Secundaria', label: 'Básica Secundaria' },
                { value: 'Media', label: 'Educación Media (10° - 11°)' },
                { value: 'CLEI / Adultos', label: 'CLEI / Adultos' },
              ]}
            />
            <SelectField
              label="Jornada"
              value={qShift}
              onChange={(e) => setQShift(e.target.value as SchoolShift)}
              options={[
                { value: 'Mañana', label: 'Mañana' },
                { value: 'Tarde', label: 'Tarde' },
                { value: 'Única', label: 'Jornada Única' },
                { value: 'Nocturna', label: 'Nocturna' },
                { value: 'Sabatina / Dominical', label: 'Sabatina / Dominical' },
              ]}
            />
          </div>

          {!editingGroupObj && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <InputField
                label="Asignatura inicial *"
                placeholder="Ej. Tecnología e Informática"
                value={qSubjectName}
                onChange={(e) => setQSubjectName(e.target.value)}
                required
              />
              <InputField
                label="Área (Opcional)"
                placeholder="Ej. Tecnología"
                value={qAreaName}
                onChange={(e) => setQAreaName(e.target.value)}
              />
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setQuickGroupModalOpen(false);
                setEditingGroupObj(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              isLoading={isCreatingQuickGroup}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              {editingGroupObj ? 'Guardar Cambios' : 'Crear y Abrir'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title="Confirmar eliminación"
        itemName={deleteTarget?.name || ''}
        isLoading={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      <StudentProfileModal
        isOpen={Boolean(selectedStudentForModal)}
        onClose={() => setSelectedStudentForModal(null)}
        student={selectedStudentForModal}
        group={groups.find(
          (g) => g.id === selectedStudentForModal?.gradeGroupId
        )}
        customFields={customFields}
        attendanceRecords={attendanceRecords}
        categories={categories}
        activities={activities}
        gradeEntries={gradeEntries}
        periods={periods}
        courses={courses}
        observations={observations}
        eventCollections={eventCollections}
        eventPaymentItems={eventPaymentItems}
        teacherProfile={teacherProfile}
        teacherId={teacherId}
        onNotify={(title, detail) => onShowToast(title, detail)}
      />
    </div>
  );
};
