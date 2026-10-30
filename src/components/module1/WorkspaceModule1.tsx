import React, { useState } from 'react';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Calendar,
  BookOpen,
  Users,
  FolderKanban,
  Plus,
  CheckCircle2,
  Trash2,
  Edit3,
  Copy,
  Archive,
  ArchiveRestore,
  SlidersHorizontal,
  ArrowRight,
  Sparkles,
  Search,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import {
  AcademicYear,
  AcademicPeriod,
  AreaSubject,
  GradeGroup,
  CourseAssignment,
  Student,
  StudentCustomField,
  AttendanceRecord,
  EvaluationCategory,
  EvaluationActivity,
  GradeEntry,
  ObservationRecord,
  EventCollection,
  EventPaymentItem,
  TeacherProfile,
  EducationLevel,
  SchoolShift,
  SupportPlan,
  CalendarEvent,
  GuardianMessageTemplate,
} from '../../types/schema';
import {
  Button,
  InputField,
  SelectField,
  ModalDialog,
  ConfirmDeleteModal,
} from '../ui/DesignSystem';
import { CourseDetailView, InternalCourseTab } from './CourseDetailView';
import { CustomFieldsModal } from './CustomFieldsModal';
import { StudentProfileModal } from './StudentProfileModal';

interface WorkspaceModule1Props {
  teacherId: string;
  years: AcademicYear[];
  periods: AcademicPeriod[];
  subjects: AreaSubject[];
  groups: GradeGroup[];
  courses: CourseAssignment[];
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
  guardianMessages?: GuardianMessageTemplate[];
  teacherProfile: TeacherProfile | null;
  selectedCourseId: string | null;
  initialCourseTab?: InternalCourseTab;
  onSelectCourse: (courseId: string | null) => void;
  onOpenScaleSettings?: () => void;
  onNotify: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

type GuidedStep = 1 | 2 | 3 | 4;

export const WorkspaceModule1: React.FC<WorkspaceModule1Props> = ({
  teacherId,
  years,
  periods,
  subjects,
  groups,
  courses,
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
  selectedCourseId,
  initialCourseTab = 'estudiantes',
  onSelectCourse,
  onOpenScaleSettings,
  onNotify,
}) => {
  const [activeStep, setActiveStep] = useState<GuidedStep>(1);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [showArchivedCourses, setShowArchivedCourses] = useState(false);
  const [globalStudentQuery, setGlobalStudentQuery] = useState('');
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [selectedStudentForModal, setSelectedStudentForModal] =
    useState<Student | null>(null);

  // Determinar el año activo o el primero disponible
  const currentYear =
    years.find((y) => y.id === selectedYearId) ||
    years.find((y) => y.isActive) ||
    years[0] ||
    null;

  const activeYearId = currentYear?.id || '';

  // ---------------------------------------------------------------------------
  // ESTADOS PARA PASO 1: AÑOS LECTIVOS Y PERIODOS
  // ---------------------------------------------------------------------------
  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [yearName, setYearName] = useState('2026');
  const [yearStart, setYearStart] = useState('2026-01-26');
  const [yearEnd, setYearEnd] = useState('2026-11-30');
  const [createDefaultPeriods, setCreateDefaultPeriods] = useState(true);

  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<AcademicPeriod | null>(null);
  const [periodName, setPeriodName] = useState('Periodo 1');
  const [periodNumber, setPeriodNumber] = useState('1');
  const [periodWeight, setPeriodWeight] = useState('25');
  const [periodStart, setPeriodStart] = useState('2026-01-26');
  const [periodEnd, setPeriodEnd] = useState('2026-04-10');

  // ---------------------------------------------------------------------------
  // ESTADOS PARA PASO 2: ÁREAS Y ASIGNATURAS
  // ---------------------------------------------------------------------------
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<AreaSubject | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [areaName, setAreaName] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('4');
  const [subjectLevel, setSubjectLevel] = useState<EducationLevel>('Secundaria');

  // ---------------------------------------------------------------------------
  // ESTADOS PARA PASO 3: GRADOS Y GRUPOS
  // ---------------------------------------------------------------------------
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GradeGroup | null>(null);
  const [gradeName, setGradeName] = useState('7°');
  const [groupName, setGroupName] = useState('7-B');
  const [groupLevel, setGroupLevel] =
    useState<Exclude<EducationLevel, 'Todos'>>('Secundaria');
  const [groupShift, setGroupShift] = useState<SchoolShift>('Mañana');
  const [groupRoom, setGroupRoom] = useState('');
  const [isGroupDirector, setIsGroupDirector] = useState(false);

  // ---------------------------------------------------------------------------
  // ESTADOS PARA PASO 4: CURSOS (CREAR, EDITAR, DUPLICAR A OTRO AÑO, ARCHIVAR)
  // ---------------------------------------------------------------------------
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseAssignment | null>(
    null
  );
  const [courseSubjectId, setCourseSubjectId] = useState('');
  const [courseGroupId, setCourseGroupId] = useState('');
  const [courseSchedule, setCourseSchedule] = useState('');

  const [duplicateModalCourse, setDuplicateModalCourse] =
    useState<CourseAssignment | null>(null);
  const [targetDuplicateYearId, setTargetDuplicateYearId] = useState('');
  const [copyStudentsOnDuplicate, setCopyStudentsOnDuplicate] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<{
    collection: string;
    id: string;
    name: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Si hay un curso seleccionado, abrimos su vista detallada con sus estudiantes y pestañas internas
  const selectedCourseObj = courses.find((c) => c.id === selectedCourseId);
  if (selectedCourseObj) {
    const grp = groups.find((g) => g.id === selectedCourseObj.gradeGroupId);
    const subj = subjects.find((s) => s.id === selectedCourseObj.areaSubjectId);
    const yr = years.find((y) => y.id === selectedCourseObj.academicYearId);

    return (
      <CourseDetailView
        course={selectedCourseObj}
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
        initialTab={initialCourseTab}
        onSwitchCourse={(cid) => onSelectCourse(cid)}
        onOpenScaleSettings={onOpenScaleSettings}
        onBack={() => onSelectCourse(null)}
        onNotify={onNotify}
      />
    );
  }

  // Filtrar periodos, grupos y cursos del año lectivo seleccionado
  const yearPeriods = periods
    .filter((p) => p.academicYearId === activeYearId)
    .sort((a, b) => a.number - b.number);

  const yearGroups = groups.filter((g) => g.academicYearId === activeYearId);

  const yearCourses = courses.filter(
    (c) =>
      c.academicYearId === activeYearId &&
      (showArchivedCourses ? Boolean(c.archived) : !c.archived)
  );

  // ===========================================================================
  // ACCIONES DE CREACIÓN Y EDICIÓN
  // ===========================================================================
  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearName.trim()) return;
    setIsSubmitting(true);

    const newYearId = `yr_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    try {
      const batch = writeBatch(db);
      const yearRef = doc(db, 'academic_years', newYearId);

      batch.set(yearRef, {
        teacherId,
        name: yearName.trim().slice(0, 100),
        startDate: yearStart,
        endDate: yearEnd,
        isActive: years.length === 0,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (createDefaultPeriods) {
        const defaultPeriods = [
          { num: 1, name: 'Periodo 1', weight: 25, start: `${yearName}-01-26`, end: `${yearName}-04-10` },
          { num: 2, name: 'Periodo 2', weight: 25, start: `${yearName}-04-13`, end: `${yearName}-06-19` },
          { num: 3, name: 'Periodo 3', weight: 25, start: `${yearName}-07-06`, end: `${yearName}-09-11` },
          { num: 4, name: 'Periodo 4', weight: 25, start: `${yearName}-09-14`, end: `${yearName}-11-27` },
        ];
        defaultPeriods.forEach((dp) => {
          const pid = `per_${Date.now()}_${dp.num}_${Math.random()
            .toString(36)
            .slice(2, 5)}`;
          batch.set(doc(db, 'academic_periods', pid), {
            teacherId,
            academicYearId: newYearId,
            name: dp.name,
            number: dp.num,
            weightPercentage: dp.weight,
            startDate: dp.start,
            endDate: dp.end,
            isActive: dp.num === 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      }

      await batch.commit();
      setSelectedYearId(newYearId);
      setYearModalOpen(false);
      onNotify(
        'Año lectivo creado',
        createDefaultPeriods
          ? `Se creó el año ${yearName} junto con sus 4 periodos académicos (25% c/u).`
          : `Se creó el año lectivo ${yearName}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `academic_years/${newYearId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeYearId || !periodName.trim()) return;
    setIsSubmitting(true);

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
        onNotify('Periodo actualizado', `Se guardaron los cambios en ${periodName}.`);
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
        onNotify('Periodo agregado', `Se creó ${periodName} (${weight}%).`);
      }
      setPeriodModalOpen(false);
      setEditingPeriod(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'academic_periods');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;
    setIsSubmitting(true);

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
        onNotify('Asignatura actualizada', `Se actualizó ${subjectName.trim()}.`);
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
        onNotify('Asignatura creada', `Se agregó ${subjectName.trim()}.`);
      }
      setSubjectModalOpen(false);
      setEditingSubject(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'areas_subjects');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeYearId || !gradeName.trim() || !groupName.trim()) return;
    setIsSubmitting(true);

    try {
      if (editingGroup) {
        await updateDoc(doc(db, 'grade_groups', editingGroup.id), {
          academicYearId: activeYearId,
          gradeName: gradeName.trim().slice(0, 80),
          groupName: groupName.trim().slice(0, 80),
          educationLevel: groupLevel,
          shift: groupShift,
          isDirector: isGroupDirector,
          room: groupRoom.trim().slice(0, 80),
          updatedAt: serverTimestamp(),
        });
        onNotify('Grupo actualizado', `Se actualizó el grupo ${groupName.trim()}.`);
      } else {
        const gid = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'grade_groups', gid), {
          teacherId,
          academicYearId: activeYearId,
          gradeName: gradeName.trim().slice(0, 80),
          groupName: groupName.trim().slice(0, 80),
          educationLevel: groupLevel,
          shift: groupShift,
          isDirector: isGroupDirector,
          room: groupRoom.trim().slice(0, 80),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onNotify(
          'Grado y grupo creado',
          `Se creó ${gradeName.trim()} · Grupo ${groupName.trim()}.`
        );
      }
      setGroupModalOpen(false);
      setEditingGroup(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'grade_groups');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeYearId || !courseSubjectId || !courseGroupId) {
      onNotify(
        'Faltan datos',
        'Selecciona una asignatura y un grupo para conformar el curso.',
        'error'
      );
      return;
    }

    const subj = subjects.find((s) => s.id === courseSubjectId);
    const grp = groups.find((g) => g.id === courseGroupId);
    const displayName = `${subj?.name || 'Asignatura'} · ${
      grp?.gradeName || ''
    } (${grp?.groupName || ''})`.slice(0, 200);

    setIsSubmitting(true);
    try {
      if (editingCourse) {
        await updateDoc(doc(db, 'courses', editingCourse.id), {
          academicYearId: activeYearId,
          gradeGroupId: courseGroupId,
          areaSubjectId: courseSubjectId,
          displayName,
          scheduleSummary: courseSchedule.trim().slice(0, 200),
          archived: Boolean(editingCourse.archived),
          updatedAt: serverTimestamp(),
        });
        onNotify('Curso actualizado', `Se actualizó "${displayName}".`);
      } else {
        const cid = `crs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'courses', cid), {
          teacherId,
          academicYearId: activeYearId,
          gradeGroupId: courseGroupId,
          areaSubjectId: courseSubjectId,
          displayName,
          scheduleSummary: courseSchedule.trim().slice(0, 200),
          archived: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onNotify('Curso creado', `Ahora puedes entrar con un clic a "${displayName}".`);
      }
      setCourseModalOpen(false);
      setEditingCourse(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'courses');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Archivar o Restaurar un Curso
  const handleToggleArchiveCourse = async (course: CourseAssignment) => {
    const nextArchived = !course.archived;
    try {
      await updateDoc(doc(db, 'courses', course.id), {
        academicYearId: course.academicYearId,
        gradeGroupId: course.gradeGroupId,
        areaSubjectId: course.areaSubjectId,
        displayName: course.displayName,
        scheduleSummary: course.scheduleSummary || '',
        archived: nextArchived,
        updatedAt: serverTimestamp(),
      });
      onNotify(
        nextArchived ? 'Curso archivado' : 'Curso restaurado',
        nextArchived
          ? `"${course.displayName}" se movió a cursos archivados.`
          : `"${course.displayName}" volvió a tus cursos activos.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${course.id}`);
    }
  };

  // Duplicar un curso de un año lectivo al siguiente
  const handleDuplicateCourseToYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicateModalCourse || !targetDuplicateYearId) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const sourceGroup = groups.find(
        (g) => g.id === duplicateModalCourse.gradeGroupId
      );

      // Verificar si ya existe un grupo equivalente en el año destino; si no, crearlo
      let targetGroupId = duplicateModalCourse.gradeGroupId;
      if (sourceGroup) {
        const existingTargetGroup = groups.find(
          (g) =>
            g.academicYearId === targetDuplicateYearId &&
            g.groupName === sourceGroup.groupName &&
            g.gradeName === sourceGroup.gradeName
        );

        if (existingTargetGroup) {
          targetGroupId = existingTargetGroup.id;
        } else {
          targetGroupId = `grp_${Date.now()}_dup_${Math.random()
            .toString(36)
            .slice(2, 6)}`;
          batch.set(doc(db, 'grade_groups', targetGroupId), {
            teacherId,
            academicYearId: targetDuplicateYearId,
            gradeName: sourceGroup.gradeName,
            groupName: sourceGroup.groupName,
            educationLevel: sourceGroup.educationLevel,
            shift: sourceGroup.shift,
            isDirector: sourceGroup.isDirector,
            room: sourceGroup.room || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      const newCourseId = `crs_${Date.now()}_dup_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      batch.set(doc(db, 'courses', newCourseId), {
        teacherId,
        academicYearId: targetDuplicateYearId,
        gradeGroupId: targetGroupId,
        areaSubjectId: duplicateModalCourse.areaSubjectId,
        displayName: duplicateModalCourse.displayName,
        scheduleSummary: duplicateModalCourse.scheduleSummary || '',
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Si el docente eligió copiar también el listado de estudiantes al nuevo año/grupo
      if (copyStudentsOnDuplicate) {
        const sourceStudents = students.filter(
          (s) => s.gradeGroupId === duplicateModalCourse.gradeGroupId
        );
        sourceStudents.forEach((stu, idx) => {
          const newStuId = `stu_${Date.now()}_${idx}_${Math.random()
            .toString(36)
            .slice(2, 5)}`;
          batch.set(doc(db, 'students', newStuId), {
            teacherId,
            academicYearId: targetDuplicateYearId,
            gradeGroupId: targetGroupId,
            firstName: stu.firstName,
            lastName: stu.lastName,
            documentType: stu.documentType,
            documentNumber: stu.documentNumber || '',
            guardianName: stu.guardianName || '',
            guardianPhone: stu.guardianPhone || '',
            guardianEmail: stu.guardianEmail || '',
            status: 'Activo',
            customValues: stu.customValues || {},
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      }

      await batch.commit();
      const targetYearObj = years.find((y) => y.id === targetDuplicateYearId);
      setSelectedYearId(targetDuplicateYearId);
      setDuplicateModalCourse(null);
      onNotify(
        'Curso duplicado exitosamente',
        `Se copió "${duplicateModalCourse.displayName}" al año lectivo ${
          targetYearObj?.name || ''
        }.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'courses');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Plantilla rápida guiada en 1 clic si el docente aún no tiene nada configurado
  const handleQuickGuidedSetup = async () => {
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const yId = `yr_${Date.now()}`;
      batch.set(doc(db, 'academic_years', yId), {
        teacherId,
        name: '2026',
        startDate: '2026-01-26',
        endDate: '2026-11-30',
        isActive: true,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      [1, 2, 3, 4].forEach((n) => {
        batch.set(doc(db, 'academic_periods', `per_${Date.now()}_${n}`), {
          teacherId,
          academicYearId: yId,
          name: `Periodo ${n}`,
          number: n,
          weightPercentage: 25,
          startDate: `2026-0${n * 2}-01`,
          endDate: `2026-0${n * 2 + 1}-30`,
          isActive: n === 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      const subId = `sub_${Date.now()}`;
      batch.set(doc(db, 'areas_subjects', subId), {
        teacherId,
        name: 'Matemáticas',
        areaName: 'Matemáticas',
        weeklyHours: 5,
        educationLevel: 'Secundaria',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const grpId = `grp_${Date.now()}`;
      batch.set(doc(db, 'grade_groups', grpId), {
        teacherId,
        academicYearId: yId,
        gradeName: '7°',
        groupName: '7-B',
        educationLevel: 'Secundaria',
        shift: 'Mañana',
        isDirector: true,
        room: 'Aula 204',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const crsId = `crs_${Date.now()}`;
      batch.set(doc(db, 'courses', crsId), {
        teacherId,
        academicYearId: yId,
        gradeGroupId: grpId,
        areaSubjectId: subId,
        displayName: 'Matemáticas · 7° (7-B)',
        scheduleSummary: 'Lunes, Miércoles y Viernes · 7:00 a.m.',
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      setSelectedYearId(yId);
      setActiveStep(4);
      onNotify(
        'Espacio base creado',
        'Se configuró el Año 2026 (4 periodos), Matemáticas, Grado 7° (7-B) y el curso Matemáticas · 7° (7-B).'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'academic_years');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    const path = `${deleteTarget.collection}/${deleteTarget.id}`;
    try {
      await deleteDoc(doc(db, deleteTarget.collection, deleteTarget.id));
      onNotify('Registro eliminado', `Se eliminó "${deleteTarget.name}".`);
      setDeleteTarget(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resultados de búsqueda rápida global de estudiantes en el módulo 1
  const matchingGlobalStudents = globalStudentQuery.trim()
    ? students.filter((s) => {
        const q = globalStudentQuery.toLowerCase();
        return (
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          (s.documentNumber || '').toLowerCase().includes(q) ||
          (s.guardianName || '').toLowerCase().includes(q)
        );
      })
    : [];

  return (
    <div className="space-y-8">
      {/* =====================================================================
          ENCABEZADO DEL MÓDULO 1 + SELECTOR DE AÑO LECTIVO + BÚSQUEDA RÁPIDA
      ===================================================================== */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-teal-800">
              Fase 1 de 7 · Configuración Guiada de Espacios y Estudiantes
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display mt-1">
              Espacios de Trabajo, Cursos y Estudiantes
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Sigue los 4 pasos guiados para estructurar tu año escolar y entra con un clic a cualquiera de tus cursos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {years.length > 0 ? (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="active-year-select"
                  className="text-xs font-semibold text-slate-600 whitespace-nowrap"
                >
                  Año Lectivo:
                </label>
                <select
                  id="active-year-select"
                  value={activeYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-bold text-slate-900 focus:border-teal-700 focus:outline-none"
                >
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      Año {y.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={handleQuickGuidedSetup}
                isLoading={isSubmitting}
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                Crear Ejemplo Guiado (Año 2026 + Matemáticas 7-B)
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setCustomFieldsOpen(true)}
              leftIcon={<SlidersHorizontal className="w-4 h-4 text-teal-800" />}
            >
              Campos de Estudiante ({customFields.length})
            </Button>
          </div>
        </div>

        {/* Barra de Búsqueda Rápida de Estudiantes en todos los grupos */}
        <div className="mt-5 pt-5 border-t border-slate-200">
          <div className="relative max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={globalStudentQuery}
              onChange={(e) => setGlobalStudentQuery(e.target.value)}
              placeholder="Búsqueda rápida de estudiante en todos tus grupos (nombre, documento o acudiente)..."
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50/70 pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-700 focus:outline-none"
            />
          </div>

          {globalStudentQuery.trim() && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600">
                Resultados encontrados ({matchingGlobalStudents.length}):
              </p>
              {matchingGlobalStudents.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Ningún estudiante coincide con "{globalStudentQuery}".
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {matchingGlobalStudents.slice(0, 9).map((stu) => {
                    const grp = groups.find((g) => g.id === stu.gradeGroupId);
                    return (
                      <button
                        key={stu.id}
                        type="button"
                        onClick={() => setSelectedStudentForModal(stu)}
                        className="rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-teal-700 transition-colors cursor-pointer flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {stu.lastName} {stu.firstName}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {grp ? `${grp.gradeName} (${grp.groupName})` : 'Grupo'} ·{' '}
                            {stu.documentType} {stu.documentNumber || '—'}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-teal-800 shrink-0">
                          Ficha →
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          FLUJO GUIADO DE 4 PASOS (STEPPER INTERACTIVO)
      ===================================================================== */}
      <section className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              step: 1 as GuidedStep,
              title: 'Paso 1 · Año y Periodos',
              count: `${years.length} años · ${yearPeriods.length} periodos`,
              done: years.length > 0 && yearPeriods.length > 0,
              icon: Calendar,
            },
            {
              step: 2 as GuidedStep,
              title: 'Paso 2 · Áreas y Asignaturas',
              count: `${subjects.length} registradas`,
              done: subjects.length > 0,
              icon: BookOpen,
            },
            {
              step: 3 as GuidedStep,
              title: 'Paso 3 · Grados y Grupos',
              count: `${yearGroups.length} grupos en el año`,
              done: yearGroups.length > 0,
              icon: Users,
            },
            {
              step: 4 as GuidedStep,
              title: 'Paso 4 · Cursos y Estudiantes',
              count: `${yearCourses.length} cursos · ${students.length} estudiantes`,
              done: yearCourses.length > 0,
              icon: FolderKanban,
            },
          ].map((item) => {
            const Icon = item.icon;
            const isCurrent = activeStep === item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setActiveStep(item.step)}
                className={`rounded-2xl border p-4 text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isCurrent
                    ? 'border-teal-800 bg-teal-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon
                    className={`w-5 h-5 ${
                      isCurrent ? 'text-teal-200' : 'text-teal-800'
                    }`}
                  />
                  {item.done && (
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        isCurrent ? 'text-emerald-300' : 'text-emerald-600'
                      }`}
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold font-display">{item.title}</p>
                  <p
                    className={`text-xs mt-0.5 font-mono tabular-nums ${
                      isCurrent ? 'text-teal-100' : 'text-slate-500'
                    }`}
                  >
                    {item.count}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ===================================================================
            CONTENIDO DEL PASO 1: AÑO LECTIVO Y PERIODOS ACADÉMICOS
        =================================================================== */}
        {activeStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Años Lectivos */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 font-display">
                    Años Lectivos
                  </h2>
                  <p className="text-xs text-slate-500">
                    Crea el año escolar actual o el siguiente para duplicar cursos.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setYearModalOpen(true)}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Nuevo Año
                </Button>
              </div>

              {years.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center space-y-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Aún no has creado un año lectivo
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setYearModalOpen(true)}
                  >
                    Crear Año Lectivo 2026
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {years.map((y) => {
                    const isSelected = y.id === activeYearId;
                    return (
                      <div
                        key={y.id}
                        className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-teal-800 bg-teal-50/40'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedYearId(y.id)}
                          className="text-left flex-1 cursor-pointer"
                        >
                          <p className="text-base font-bold text-slate-900 font-display">
                            Año Lectivo {y.name}
                          </p>
                          <p className="text-xs font-mono text-slate-500 mt-0.5">
                            {y.startDate} a {y.endDate}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              collection: 'academic_years',
                              id: y.id,
                              name: `Año Lectivo ${y.name}`,
                            })
                          }
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          title="Eliminar año lectivo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Periodos Académicos del Año Seleccionado */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 font-display">
                    Periodos Académicos {currentYear ? `(${currentYear.name})` : ''}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Define las fechas de corte y el peso porcentual de cada periodo.
                  </p>
                </div>
                {currentYear && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingPeriod(null);
                      const nextNum = yearPeriods.length + 1;
                      setPeriodName(`Periodo ${nextNum}`);
                      setPeriodNumber(String(nextNum));
                      setPeriodWeight('25');
                      setPeriodModalOpen(true);
                    }}
                    leftIcon={<Plus className="w-4 h-4 text-teal-800" />}
                  >
                    Agregar Periodo
                  </Button>
                )}
              </div>

              {yearPeriods.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-600">
                  Selecciona o crea un año lectivo para configurar sus periodos académicos.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {yearPeriods.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 font-display">
                            {p.name}
                          </span>
                          <span className="text-xs font-mono tabular-nums text-teal-800 font-semibold">
                            · Peso: {p.weightPercentage}%
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">
                          Desde {p.startDate} hasta {p.endDate}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPeriod(p);
                            setPeriodName(p.name);
                            setPeriodNumber(String(p.number));
                            setPeriodWeight(String(p.weightPercentage));
                            setPeriodStart(p.startDate);
                            setPeriodEnd(p.endDate);
                            setPeriodModalOpen(true);
                          }}
                          className="min-h-[38px] px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
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
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setActiveStep(2)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Continuar al Paso 2: Áreas y Asignaturas
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            CONTENIDO DEL PASO 2: ÁREAS Y ASIGNATURAS
        =================================================================== */}
        {activeStep === 2 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-display">
                  Áreas y Asignaturas que orientas
                </h2>
                <p className="text-xs text-slate-600">
                  Registra tus materias (ej. Matemáticas, Lengua Castellana, Ciencias Naturales, Inglés, Dimensiones de Preescolar).
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setEditingSubject(null);
                  setSubjectName('');
                  setAreaName('');
                  setWeeklyHours('4');
                  setSubjectModalOpen(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Nueva Asignatura
              </Button>
            </div>

            {subjects.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-800">
                  Aún no has registrado asignaturas
                </p>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setSubjectModalOpen(true)}
                >
                  Agregar primera asignatura
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs text-teal-800 font-semibold">
                        Área: {sub.areaName}
                      </p>
                      <h3 className="text-base font-bold text-slate-900 font-display mt-0.5">
                        {sub.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Nivel: {sub.educationLevel} ·{' '}
                        <span className="font-mono tabular-nums">
                          {sub.weeklyHours} h/semana
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubject(sub);
                          setSubjectName(sub.name);
                          setAreaName(sub.areaName);
                          setWeeklyHours(String(sub.weeklyHours));
                          setSubjectLevel(sub.educationLevel);
                          setSubjectModalOpen(true);
                        }}
                        className="min-h-[38px] px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            collection: 'areas_subjects',
                            id: sub.id,
                            name: sub.name,
                          })
                        }
                        className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="primary"
                onClick={() => setActiveStep(3)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continuar al Paso 3: Grados y Grupos
              </Button>
            </div>
          </div>
        )}

        {/* ===================================================================
            CONTENIDO DEL PASO 3: GRADOS Y GRUPOS
        =================================================================== */}
        {activeStep === 3 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-display">
                  Grados y Grupos ({currentYear?.name || 'Año actual'})
                </h2>
                <p className="text-xs text-slate-600">
                  Ejemplo: Grado 7° · Grupo 7-B, Transición 01, 11° A o CLEI IV.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setEditingGroup(null);
                  setGradeName('7°');
                  setGroupName('7-B');
                  setGroupRoom('');
                  setGroupModalOpen(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Nuevo Grado / Grupo
              </Button>
            </div>

            {yearGroups.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-800">
                  Aún no hay grupos creados en este año lectivo
                </p>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setGroupModalOpen(true)}
                >
                  Crear primer grupo (Ej. 7° · 7-B)
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {yearGroups.map((grp) => {
                  const countStu = students.filter(
                    (s) => s.gradeGroupId === grp.id
                  ).length;
                  return (
                    <div
                      key={grp.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{grp.educationLevel}</span>
                          <span>Jornada {grp.shift}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 font-display mt-1">
                          Grado {grp.gradeName} · Grupo {grp.groupName}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1">
                          <strong className="font-mono tabular-nums">
                            {countStu}
                          </strong>{' '}
                          estudiantes ·{' '}
                          {grp.isDirector
                            ? 'Director de grupo'
                            : 'Docente de área'}
                          {grp.room ? ` · ${grp.room}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGroup(grp);
                            setGradeName(grp.gradeName);
                            setGroupName(grp.groupName);
                            setGroupLevel(grp.educationLevel);
                            setGroupShift(grp.shift);
                            setGroupRoom(grp.room || '');
                            setIsGroupDirector(grp.isDirector);
                            setGroupModalOpen(true);
                          }}
                          className="min-h-[38px] px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              collection: 'grade_groups',
                              id: grp.id,
                              name: `${grp.gradeName} (${grp.groupName})`,
                            })
                          }
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="primary"
                onClick={() => setActiveStep(4)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continuar al Paso 4: Mis Cursos y Estudiantes
              </Button>
            </div>
          </div>
        )}

        {/* ===================================================================
            CONTENIDO DEL PASO 4: MIS CURSOS (Combinación Área + Grado + Grupo)
        =================================================================== */}
        {activeStep === 4 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 font-display">
                  Mis Cursos ({currentYear ? `Año ${currentYear.name}` : ''})
                </h2>
                <p className="text-xs text-slate-600">
                  Haz clic en cualquier curso para entrar a su lista de estudiantes, cargar por Excel o Foto con IA.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowArchivedCourses((prev) => !prev)}
                  className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors ${
                    showArchivedCourses
                      ? 'border-amber-600 bg-amber-50 text-amber-900'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Archive className="w-4 h-4" />
                  <span>
                    {showArchivedCourses
                      ? 'Viendo Cursos Archivados'
                      : 'Ver Archivados'}
                  </span>
                </button>

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setEditingCourse(null);
                    setCourseSubjectId(subjects[0]?.id || '');
                    setCourseGroupId(yearGroups[0]?.id || '');
                    setCourseSchedule('');
                    setCourseModalOpen(true);
                  }}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Crear Nuevo Curso
                </Button>
              </div>
            </div>

            {yearCourses.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
                <p className="text-base font-bold text-slate-900 font-display">
                  {showArchivedCourses
                    ? 'No tienes cursos archivados en este año lectivo'
                    : 'Aún no tienes cursos activos en este año lectivo'}
                </p>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  Un curso une una Asignatura (ej. Matemáticas) con un Grado y Grupo (ej. 7° · 7-B). Puedes crearlo paso a paso o usar el botón de configuración rápida.
                </p>
                {!showArchivedCourses && (
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => {
                        if (subjects.length === 0 || yearGroups.length === 0) {
                          handleQuickGuidedSetup();
                        } else {
                          setEditingCourse(null);
                          setCourseSubjectId(subjects[0]?.id || '');
                          setCourseGroupId(yearGroups[0]?.id || '');
                          setCourseModalOpen(true);
                        }
                      }}
                      leftIcon={<Plus className="w-4 h-4" />}
                    >
                      {subjects.length === 0 || yearGroups.length === 0
                        ? 'Generar Curso de Ejemplo (Matemáticas · 7-B)'
                        : 'Crear Curso Ahora'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {yearCourses.map((crs) => {
                  const grp = groups.find((g) => g.id === crs.gradeGroupId);
                  const subj = subjects.find((s) => s.id === crs.areaSubjectId);
                  const stuCount = students.filter(
                    (s) => s.gradeGroupId === crs.gradeGroupId
                  ).length;

                  return (
                    <div
                      key={crs.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4 hover:border-teal-700/60 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            {subj?.areaName || 'Área'} ·{' '}
                            {grp?.educationLevel || 'Nivel'}
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-teal-800">
                            {stuCount} estudiantes
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectCourse(crs.id)}
                          className="text-left group cursor-pointer block w-full"
                        >
                          <h3 className="text-lg font-bold text-slate-900 font-display group-hover:text-teal-800 transition-colors">
                            {crs.displayName}
                          </h3>
                        </button>

                        <p className="text-xs text-slate-600">
                          Grado {grp?.gradeName || '—'} · Grupo{' '}
                          {grp?.groupName || '—'} · Jornada {grp?.shift || '—'}
                          {crs.scheduleSummary
                            ? ` · ${crs.scheduleSummary}`
                            : ''}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCourse(crs);
                              setCourseSubjectId(crs.areaSubjectId);
                              setCourseGroupId(crs.gradeGroupId);
                              setCourseSchedule(crs.scheduleSummary || '');
                              setCourseModalOpen(true);
                            }}
                            className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1 cursor-pointer"
                            title="Editar curso"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDuplicateModalCourse(crs);
                              const otherYear =
                                years.find(
                                  (y) => y.id !== crs.academicYearId
                                ) || years[0];
                              setTargetDuplicateYearId(otherYear?.id || '');
                            }}
                            className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1 cursor-pointer"
                            title="Duplicar curso a otro año lectivo"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Duplicar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleArchiveCourse(crs)}
                            className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1 cursor-pointer"
                            title={
                              crs.archived ? 'Restaurar curso' : 'Archivar curso'
                            }
                          >
                            {crs.archived ? (
                              <>
                                <ArchiveRestore className="w-3.5 h-3.5 text-teal-800" />
                                <span>Restaurar</span>
                              </>
                            ) : (
                              <>
                                <Archive className="w-3.5 h-3.5" />
                                <span>Archivar</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                collection: 'courses',
                                id: crs.id,
                                name: crs.displayName,
                              })
                            }
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                            title="Eliminar curso"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => onSelectCourse(crs.id)}
                          rightIcon={<ArrowRight className="w-4 h-4" />}
                        >
                          Entrar al Curso
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* =====================================================================
          MODALES DE CREACIÓN Y EDICIÓN DE LOS 4 PASOS
      ===================================================================== */}

      {/* Modal: Crear Año Lectivo */}
      <ModalDialog
        isOpen={yearModalOpen}
        onClose={() => setYearModalOpen(false)}
        title="Crear Nuevo Año Lectivo"
        subtitle="Configura el año escolar (por ejemplo 2026 o 2027)."
      >
        <form onSubmit={handleCreateYear} className="space-y-4">
          <InputField
            label="Nombre del Año Lectivo"
            placeholder="Ej. 2026"
            value={yearName}
            onChange={(e) => setYearName(e.target.value)}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Fecha de Inicio"
              type="date"
              value={yearStart}
              onChange={(e) => setYearStart(e.target.value)}
              required
            />
            <InputField
              label="Fecha de Cierre"
              type="date"
              value={yearEnd}
              onChange={(e) => setYearEnd(e.target.value)}
              required
            />
          </div>

          <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={createDefaultPeriods}
              onChange={(e) => setCreateDefaultPeriods(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-800"
            />
            <span>
              Crear automáticamente los 4 periodos académicos con peso del 25% cada uno
            </span>
          </label>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setYearModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Guardar Año Lectivo
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Crear / Editar Periodo Académico */}
      <ModalDialog
        isOpen={periodModalOpen}
        onClose={() => setPeriodModalOpen(false)}
        title={
          editingPeriod ? 'Editar Periodo Académico' : 'Nuevo Periodo Académico'
        }
        subtitle="Define las fechas de inicio y fin y su porcentaje en la nota final del año."
      >
        <form onSubmit={handleSavePeriod} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField
              label="Nombre del Periodo"
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
              placeholder="Ej. Periodo 1"
              required
            />
            <InputField
              label="Número (1 a 6)"
              type="number"
              value={periodNumber}
              onChange={(e) => setPeriodNumber(e.target.value)}
              required
            />
            <InputField
              label="Peso Porcentual (%)"
              type="number"
              step="0.1"
              value={periodWeight}
              onChange={(e) => setPeriodWeight(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Fecha Inicial"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
            />
            <InputField
              label="Fecha Final"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPeriodModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Guardar Periodo
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Crear / Editar Área o Asignatura */}
      <ModalDialog
        isOpen={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        title={
          editingSubject ? 'Editar Asignatura' : 'Nueva Área o Asignatura'
        }
        subtitle="Sirve para cualquier nivel educativo colombiano."
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <InputField
            label="Nombre de la Asignatura *"
            placeholder="Ej. Matemáticas, Biología, Lengua Castellana..."
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required
          />
          <InputField
            label="Área Fundamental (MEN)"
            placeholder="Ej. Matemáticas, Ciencias Naturales, Humanidades..."
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
            helperText="Si la dejas vacía, usará el mismo nombre de la asignatura."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Nivel Educativo"
              value={subjectLevel}
              onChange={(e) =>
                setSubjectLevel(e.target.value as EducationLevel)
              }
              options={[
                { value: 'Preescolar', label: 'Preescolar' },
                { value: 'Primaria', label: 'Básica Primaria' },
                { value: 'Secundaria', label: 'Básica Secundaria' },
                { value: 'Media', label: 'Educación Media (10° y 11°)' },
                { value: 'CLEI / Adultos', label: 'Educación para Adultos (CLEI)' },
                { value: 'Todos', label: 'Todos los niveles' },
              ]}
            />
            <InputField
              label="Intensidad Horaria Semanal"
              type="number"
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
              required
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubjectModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Guardar Asignatura
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Crear / Editar Grado y Grupo */}
      <ModalDialog
        isOpen={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        title={editingGroup ? 'Editar Grado y Grupo' : 'Nuevo Grado y Grupo'}
        subtitle="Por ejemplo: Grado 7° y Grupo 7-B."
      >
        <form onSubmit={handleSaveGroup} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Grado *"
              placeholder="Ej. 7°, Transición, 5°, 11°, CLEI IV"
              value={gradeName}
              onChange={(e) => setGradeName(e.target.value)}
              required
            />
            <InputField
              label="Nombre o Código del Grupo *"
              placeholder="Ej. 7-B, 702, 5-A, Transición 01"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
            <SelectField
              label="Nivel Educativo"
              value={groupLevel}
              onChange={(e) =>
                setGroupLevel(
                  e.target.value as Exclude<EducationLevel, 'Todos'>
                )
              }
              options={[
                { value: 'Preescolar', label: 'Preescolar' },
                { value: 'Primaria', label: 'Básica Primaria' },
                { value: 'Secundaria', label: 'Básica Secundaria' },
                { value: 'Media', label: 'Educación Media' },
                { value: 'CLEI / Adultos', label: 'CLEI / Adultos' },
              ]}
            />
            <SelectField
              label="Jornada Escolar"
              value={groupShift}
              onChange={(e) => setGroupShift(e.target.value as SchoolShift)}
              options={[
                { value: 'Mañana', label: 'Mañana' },
                { value: 'Tarde', label: 'Tarde' },
                { value: 'Única', label: 'Jornada Única' },
                { value: 'Nocturna', label: 'Nocturna' },
                { value: 'Sabatina / Dominical', label: 'Sabatina / Dominical' },
              ]}
            />
          </div>

          <InputField
            label="Salón o Aula (Opcional)"
            placeholder="Ej. Salón 204, Bloque B"
            value={groupRoom}
            onChange={(e) => setGroupRoom(e.target.value)}
          />

          <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isGroupDirector}
              onChange={(e) => setIsGroupDirector(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-800"
            />
            <span>Soy director de grupo de este curso</span>
          </label>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setGroupModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Guardar Grupo
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Crear / Editar Curso (Unión de Asignatura + Grado/Grupo) */}
      <ModalDialog
        isOpen={courseModalOpen}
        onClose={() => setCourseModalOpen(false)}
        title={editingCourse ? 'Editar Curso' : 'Crear Nuevo Curso'}
        subtitle="Une una asignatura con un grado y grupo para crear el curso."
      >
        <form onSubmit={handleSaveCourse} className="space-y-4">
          <SelectField
            label="1. Selecciona el Área / Asignatura *"
            value={courseSubjectId}
            onChange={(e) => setCourseSubjectId(e.target.value)}
            options={[
              { value: '', label: 'Seleccionar asignatura...' },
              ...subjects.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.areaName})`,
              })),
            ]}
            required
          />

          <SelectField
            label="2. Selecciona el Grado y Grupo *"
            value={courseGroupId}
            onChange={(e) => setCourseGroupId(e.target.value)}
            options={[
              { value: '', label: 'Seleccionar grupo...' },
              ...yearGroups.map((g) => ({
                value: g.id,
                label: `Grado ${g.gradeName} · Grupo ${g.groupName} (${g.shift})`,
              })),
            ]}
            required
          />

          <InputField
            label="Resumen de Horario (Opcional)"
            placeholder="Ej. Lunes 1ª hora, Miércoles 3ª hora"
            value={courseSchedule}
            onChange={(e) => setCourseSchedule(e.target.value)}
          />

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCourseModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingCourse ? 'Guardar Cambios' : 'Crear Curso'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Duplicar Curso a Otro Año Lectivo */}
      <ModalDialog
        isOpen={Boolean(duplicateModalCourse)}
        onClose={() => setDuplicateModalCourse(null)}
        title="Duplicar Curso a otro Año Lectivo"
        subtitle={`Curso origen: ${duplicateModalCourse?.displayName || ''}`}
      >
        <form onSubmit={handleDuplicateCourseToYear} className="space-y-4">
          <SelectField
            label="Selecciona el Año Lectivo Destino"
            value={targetDuplicateYearId}
            onChange={(e) => setTargetDuplicateYearId(e.target.value)}
            options={years.map((y) => ({
              value: y.id,
              label: `Año Lectivo ${y.name}`,
            }))}
            helperText="Si aún no has creado el año siguiente (ej. 2027), créalo primero en el Paso 1."
          />

          <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={copyStudentsOnDuplicate}
              onChange={(e) => setCopyStudentsOnDuplicate(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-800"
            />
            <span>
              Copiar también la lista de estudiantes actual al nuevo curso
            </span>
          </label>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDuplicateModalCourse(null)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              leftIcon={<Copy className="w-4 h-4" />}
            >
              Duplicar Curso
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Campos Personalizados */}
      <CustomFieldsModal
        isOpen={customFieldsOpen}
        onClose={() => setCustomFieldsOpen(false)}
        teacherId={teacherId}
        customFields={customFields}
        onNotify={onNotify}
      />

      {/* Modal: Ficha Individual desde el buscador global */}
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
        onNotify={onNotify}
      />

      {/* Modal: Confirmación antes de borrar */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title="Confirmar eliminación"
        itemName={deleteTarget?.name || ''}
        isLoading={isSubmitting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
