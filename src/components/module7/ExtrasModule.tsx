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
  Calendar,
  LifeBuoy,
  MessageSquare,
  DatabaseBackup,
  Plus,
  Trash2,
  CheckCircle2,
  Copy,
  Printer,
  Download,
  Upload,
  Sparkles,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import {
  TeacherProfile,
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
  SupportPlan,
  CalendarEvent,
  GuardianMessage,
} from '../../types/schema';
import {
  calculateStudentAttendanceSummary,
  calculateStudentPeriodGrade,
  formatCOP,
} from '../../utils/academicCalculations';
import {
  Button,
  InputField,
  SelectField,
  TextareaField,
  ModalDialog,
  ConfirmDeleteModal,
} from '../ui/DesignSystem';
import { ExportActionControl } from '../ui/ExportActionControl';

interface ExtrasModuleProps {
  teacherId: string;
  teacherProfile: TeacherProfile | null;
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
  supportPlans: SupportPlan[];
  calendarEvents: CalendarEvent[];
  guardianMessages: GuardianMessage[];
  lockedCourseId?: string;
  onNotify: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

type ExtraTab = 'calendario' | 'planes_apoyo' | 'mensajes' | 'respaldo';

export const ExtrasModule: React.FC<ExtrasModuleProps> = ({
  teacherId,
  teacherProfile,
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
  supportPlans,
  calendarEvents,
  guardianMessages,
  lockedCourseId,
  onNotify,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [activeTab, setActiveTab] = useState<ExtraTab>('calendario');

  const activeYear = years.find((y) => y.isActive) || years[0] || null;
  const activeYearId = activeYear?.id || '';
  const activeCourses = courses.filter((c) => !c.archived);

  // ===========================================================================
  // 1. ESTADOS PARA CALENDARIO CONECTADO CON ACTIVIDADES DE CALIFICACIÓN
  // ===========================================================================
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evDate, setEvDate] = useState(todayStr);
  const [evTime, setEvTime] = useState('08:00');
  const [evCategory, setEvCategory] =
    useState<CalendarEvent['category']>('Evaluación');
  const [evCourseId, setEvCourseId] = useState<string>(lockedCourseId || '');
  const [evDesc, setEvDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    collection: string;
    id: string;
    name: string;
  } | null>(null);

  // ===========================================================================
  // 2. ESTADOS PARA PLANES DE APOYO Y RECUPERACIÓN (DESEMPEÑO BAJO)
  // ===========================================================================
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SupportPlan | null>(null);
  const [planCourseId, setPlanCourseId] = useState<string>(
    lockedCourseId || activeCourses[0]?.id || ''
  );
  const activePeriod = periods.find((p) => p.isActive) || periods[0] || null;
  const [planPeriodId, setPlanPeriodId] = useState<string>(
    activePeriod?.id || ''
  );
  const [planStudentId, setPlanStudentId] = useState<string>('');
  const [weaknesses, setWeaknesses] = useState('');
  const [assignedActivities, setAssignedActivities] = useState('');
  const [planDueDate, setPlanDueDate] = useState(todayStr);
  const [recoveryScore, setRecoveryScore] = useState('');
  const [planStatus, setPlanStatus] =
    useState<SupportPlan['status']>('Asignado');

  // ===========================================================================
  // 3. ESTADOS PARA PLANTILLAS DE MENSAJES A ACUDIENTES
  // ===========================================================================
  const [msgCourseId, setMsgCourseId] = useState<string>(
    lockedCourseId || activeCourses[0]?.id || ''
  );
  const [msgStudentId, setMsgStudentId] = useState<string>('');
  const [msgTemplateKey, setMsgTemplateKey] = useState<
    | 'citacion'
    | 'inasistencia'
    | 'bajo_desempeno'
    | 'felicitacion'
    | 'recaudo'
  >('citacion');
  const [msgChannel, setMsgChannel] =
    useState<GuardianMessage['channel']>('WhatsApp');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');

  // Unificar eventos propios del calendario + actividades de calificación de los cursos
  const unifiedCalendarItems = useMemo(() => {
    const activityItems = activities.map((act) => {
      const crs = courses.find((c) => c.id === act.courseId);
      const cat = categories.find((c) => c.id === act.categoryId);
      return {
        id: `act_${act.id}`,
        date: act.dueDate || todayStr,
        title: act.title,
        subtitle: `${crs?.displayName || 'Curso'} · Categoría: ${
          cat?.name || 'Evaluación'
        }`,
        badge: 'Actividad Calificable SIEE',
        isGradeActivity: true,
        completed: false,
        rawEvent: null as CalendarEvent | null,
      };
    });

    const manualItems = calendarEvents.map((ev) => {
      const crs = courses.find((c) => c.id === ev.courseId);
      return {
        id: ev.id,
        date: ev.date,
        title: ev.title,
        subtitle: `${ev.category}${
          crs ? ` · ${crs.displayName}` : ''
        }${ev.time ? ` · ${ev.time}` : ''}${
          ev.description ? ` — ${ev.description}` : ''
        }`,
        badge: ev.category,
        isGradeActivity: false,
        completed: ev.completed,
        rawEvent: ev,
      };
    });

    return [...activityItems, ...manualItems].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [activities, calendarEvents, courses, categories, todayStr]);

  // Detectar automáticamente estudiantes con Desempeño Bajo para Planes de Apoyo
  const passingThreshold =
    teacherProfile?.basicMin ?? teacherProfile?.passingScore ?? 3.0;

  const lowPerformingCandidates = useMemo(() => {
    const list: {
      student: Student;
      course: CourseAssignment;
      period: AcademicPeriod;
      score: number;
    }[] = [];

    activeCourses.forEach((crs) => {
      const crsPeriods = periods.filter(
        (p) => p.academicYearId === crs.academicYearId
      );
      const crsStudents = students.filter(
        (s) => s.gradeGroupId === crs.gradeGroupId && s.status === 'Activo'
      );

      crsPeriods.forEach((per) => {
        const pCats = categories.filter(
          (c) => c.courseId === crs.id && c.periodId === per.id
        );
        const pActs = activities.filter(
          (a) => a.courseId === crs.id && a.periodId === per.id
        );
        const pEnts = gradeEntries.filter(
          (e) => e.courseId === crs.id && e.periodId === per.id
        );

        crsStudents.forEach((stu) => {
          const sum = calculateStudentPeriodGrade(
            stu.id,
            pCats,
            pActs,
            pEnts,
            teacherProfile
          );
          if (
            sum.finalPeriodScore !== null &&
            sum.finalPeriodScore < passingThreshold
          ) {
            list.push({
              student: stu,
              course: crs,
              period: per,
              score: sum.finalPeriodScore,
            });
          }
        });
      });
    });

    return list;
  }, [
    activeCourses,
    periods,
    students,
    categories,
    activities,
    gradeEntries,
    teacherProfile,
    passingThreshold,
  ]);

  // Crear evento de calendario
  const handleCreateCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim()) return;
    const yId = activeYearId || years[0]?.id || '';
    if (!yId) {
      onNotify(
        'Año lectivo requerido',
        'Configura un año lectivo en el Módulo 1 primero.',
        'error'
      );
      return;
    }

    setIsSaving(true);
    const newId = `cal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'calendar_events', newId), {
        teacherId,
        academicYearId: yId,
        title: evTitle.trim().slice(0, 150),
        description: evDesc.trim().slice(0, 600),
        date: evDate,
        time: evTime.slice(0, 20),
        category: evCategory,
        courseId: evCourseId || '',
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setEvTitle('');
      setEvDesc('');
      setEventModalOpen(false);
      onNotify('Evento agendado', `Se agregó "${evTitle.trim()}" al calendario.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `calendar_events/${newId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEventCompleted = async (ev: CalendarEvent) => {
    try {
      await updateDoc(doc(db, 'calendar_events', ev.id), {
        title: ev.title,
        description: ev.description || '',
        date: ev.date,
        time: ev.time || '',
        category: ev.category,
        courseId: ev.courseId || '',
        completed: !ev.completed,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `calendar_events/${ev.id}`);
    }
  };

  // Guardar Plan de Apoyo y Recuperación
  const openSupportPlanModal = (prefill?: {
    studentId: string;
    courseId: string;
    periodId: string;
    score?: number;
  }) => {
    setEditingPlan(null);
    const cId = prefill?.courseId || activeCourses[0]?.id || '';
    const pId = prefill?.periodId || periods[0]?.id || '';
    setPlanCourseId(cId);
    setPlanPeriodId(pId);
    setPlanStudentId(prefill?.studentId || '');
    setWeaknesses(
      prefill?.score !== undefined
        ? `Obtuvo promedio de ${prefill.score.toFixed(
            2
          )} (Desempeño Bajo). Requiere reforzar competencias fundamentales del periodo.`
        : 'Dificultades en la comprensión y entrega de actividades evaluativas del periodo.'
    );
    setAssignedActivities(
      '1. Desarrollo y sustentación de taller de nivelación.\n2. Evaluación escrita de superación con acompañamiento de acudiente.'
    );
    setPlanDueDate(todayStr);
    setRecoveryScore('');
    setPlanStatus('Asignado');
    setPlanModalOpen(true);
  };

  const handleSaveSupportPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planCourseId || !planPeriodId || !planStudentId) {
      onNotify(
        'Faltan datos',
        'Selecciona curso, periodo y estudiante.',
        'error'
      );
      return;
    }

    const crs = courses.find((c) => c.id === planCourseId);
    const yId = crs?.academicYearId || activeYearId;
    const parsedScore =
      recoveryScore.trim() !== '' ? parseFloat(recoveryScore) : undefined;

    setIsSaving(true);
    try {
      if (editingPlan) {
        const payload: Record<string, unknown> = {
          weaknesses: weaknesses.trim().slice(0, 1000),
          assignedActivities: assignedActivities.trim().slice(0, 1000),
          dueDate: planDueDate,
          status: planStatus,
          updatedAt: serverTimestamp(),
        };
        if (parsedScore !== undefined && !Number.isNaN(parsedScore)) {
          payload.recoveryScore = parsedScore;
        }
        await updateDoc(doc(db, 'support_plans', editingPlan.id), payload);
        onNotify('Plan actualizado', 'Se guardaron los cambios del plan de apoyo.');
      } else {
        const newId = `sp_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        const payload: Record<string, unknown> = {
          teacherId,
          academicYearId: yId,
          periodId: planPeriodId,
          courseId: planCourseId,
          studentId: planStudentId,
          weaknesses: weaknesses.trim().slice(0, 1000),
          assignedActivities: assignedActivities.trim().slice(0, 1000),
          dueDate: planDueDate,
          status: planStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (parsedScore !== undefined && !Number.isNaN(parsedScore)) {
          payload.recoveryScore = parsedScore;
        }
        await setDoc(doc(db, 'support_plans', newId), payload);
        onNotify(
          'Plan de apoyo asignado',
          'Quedó registrado el plan de superación para el estudiante.'
        );
      }
      setPlanModalOpen(false);
      setEditingPlan(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'support_plans');
    } finally {
      setIsSaving(false);
    }
  };

  // Generador automático de mensaje a acudientes con datos reales del estudiante insertados
  const currentMsgCourse =
    activeCourses.find((c) => c.id === msgCourseId) || activeCourses[0] || null;
  const msgCourseStudents = students
    .filter(
      (s) =>
        currentMsgCourse &&
        s.gradeGroupId === currentMsgCourse.gradeGroupId &&
        s.status === 'Activo'
    )
    .sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
        'es-CO'
      )
    );
  const currentMsgStudent =
    msgCourseStudents.find((s) => s.id === msgStudentId) ||
    msgCourseStudents[0] ||
    null;

  const generateInterpolatedMessage = (
    template: typeof msgTemplateKey,
    stu: Student | null,
    crs: CourseAssignment | null
  ) => {
    if (!stu || !crs) return;
    const guardian = stu.guardianName || 'Padre de Familia y/o Acudiente';
    const stuFullName = `${stu.firstName} ${stu.lastName}`;
    const instName =
      teacherProfile?.institutionName || 'nuestra Institución Educativa';
    const teacherName = teacherProfile?.fullName || 'Docente Titular';

    const stuAtt = attendanceRecords.filter(
      (r) => r.studentId === stu.id && r.courseId === crs.id
    );
    const attSum = calculateStudentAttendanceSummary(stu.id, stuAtt);
    const totalAbsences =
      attSum.unexcusedAbsenceCount + attSum.excusedAbsenceCount;

    const pCats = categories.filter((c) => c.courseId === crs.id);
    const pActs = activities.filter((a) => a.courseId === crs.id);
    const pEnts = gradeEntries.filter((e) => e.courseId === crs.id);
    const grdSum = calculateStudentPeriodGrade(
      stu.id,
      pCats,
      pActs,
      pEnts,
      teacherProfile
    );
    const avgText =
      grdSum.finalPeriodScore !== null
        ? `${grdSum.finalPeriodScore.toFixed(2)} (Desempeño ${grdSum.scaleLevel})`
        : 'en proceso de calificación';

    if (template === 'citacion') {
      setMsgSubject(`Citación a Acudiente · ${stuFullName} (${crs.displayName})`);
      setMsgBody(
        `Estimado(a) ${guardian},\n\nReciba un cordial saludo de parte de ${instName}. Por medio del presente mensaje le solicito asistir a reunión de seguimiento del estudiante ${stuFullName} del curso ${crs.displayName}, con el fin de dialogar sobre su proceso académico (promedio actual: ${avgText}) y convivencial.\n\nAgradezco confirmar su asistencia.\n\nAtentamente,\n${teacherName}`
      );
    } else if (template === 'inasistencia') {
      setMsgSubject(`Reporte de Asistencia · ${stuFullName}`);
      setMsgBody(
        `Estimado(a) ${guardian},\n\nLe informamos desde ${instName} que el(la) estudiante ${stuFullName} (${crs.displayName}) registra a la fecha ${totalAbsences} inasistencias (${attSum.unexcusedAbsenceCount} sin excusa y ${attSum.lateCount} llegadas tarde), para un porcentaje de asistencia del ${attSum.attendancePercentage}%.\n\nLe solicitamos enviar el soporte correspondiente y garantizar su asistencia puntual.\n\nAtentamente,\n${teacherName}`
      );
    } else if (template === 'bajo_desempeno') {
      setMsgSubject(
        `Alerta Académica y Plan de Apoyo · ${stuFullName} (${crs.displayName})`
      );
      setMsgBody(
        `Estimado(a) ${guardian},\n\nMe permito informarle que ${stuFullName} presenta actualmente un promedio de ${avgText} en ${crs.displayName}. Se ha dispuesto un Plan de Apoyo y Nivelación para superar las dificultades del periodo. Es indispensable su acompañamiento en casa para la entrega puntual de las actividades.\n\nCordialmente,\n${teacherName}`
      );
    } else if (template === 'felicitacion') {
      setMsgSubject(`Felicitación por Desempeño y Actitud · ${stuFullName}`);
      setMsgBody(
        `Estimado(a) ${guardian},\n\nQuiero extenderle una especial felicitación por el excelente compromiso, respeto y rendimiento de ${stuFullName} en ${crs.displayName} (promedio actual: ${avgText} · Asistencia: ${attSum.attendancePercentage}%). ¡Gracias por el gran apoyo familiar en su formación!\n\nCon aprecio,\n${teacherName}`
      );
    } else {
      setMsgSubject(`Recordatorio de Control / Circular · ${stuFullName}`);
      setMsgBody(
        `Estimado(a) ${guardian},\n\nLe recordamos revisar con ${stuFullName} (${crs.displayName}) los compromisos pendientes de entrega de permisos firmados o recaudos de actividades del grupo.\n\nMuchas gracias por su colaboración,\n${teacherName}`
      );
    }
  };

  const handleSaveGuardianMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMsgCourse || !msgSubject.trim() || !msgBody.trim()) return;

    setIsSaving(true);
    const newId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'guardian_messages', newId), {
        teacherId,
        academicYearId: currentMsgCourse.academicYearId,
        gradeGroupId: currentMsgCourse.gradeGroupId,
        studentId: currentMsgStudent?.id || '',
        subject: msgSubject.trim().slice(0, 150),
        body: msgBody.trim().slice(0, 1500),
        channel: msgChannel,
        sentDate: todayStr,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onNotify(
        'Mensaje registrado en historial',
        `Se guardó el comunicado para el acudiente de ${currentMsgStudent?.firstName || 'el curso'}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `guardian_messages/${newId}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ===========================================================================
  // 4. COPIA DE SEGURIDAD COMPLETA (EXPORTACIÓN E IMPORTACIÓN JSON)
  // ===========================================================================
  const handleDownloadFullBackup = () => {
    const backupPayload = {
      appName: 'Mi Aula Digital',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      teacherId,
      collections: {
        academic_years: years,
        academic_periods: periods,
        areas_subjects: subjects,
        grade_groups: groups,
        courses,
        students,
        student_custom_fields: customFields,
        attendance: attendanceRecords,
        evaluation_categories: categories,
        evaluation_activities: activities,
        grade_entries: gradeEntries,
        observations,
        event_collections: eventCollections,
        event_payment_items: eventPaymentItems,
        support_plans: supportPlans,
        calendar_events: calendarEvents,
        guardian_messages: guardianMessages,
      },
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copia_seguridad_mi_aula_digital_${todayStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    onNotify(
      'Copia de seguridad descargada',
      'Se exportaron todos tus años, cursos, estudiantes, asistencias, notas, observador y recaudos.'
    );
  };

  const handleRestoreBackupFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.collections || typeof parsed.collections !== 'object') {
        onNotify(
          'Archivo inválido',
          'El archivo seleccionado no corresponde a una copia de seguridad de Mi Aula Digital.',
          'error'
        );
        return;
      }

      const allowedCollections = [
        'academic_years',
        'academic_periods',
        'areas_subjects',
        'grade_groups',
        'courses',
        'students',
        'student_custom_fields',
        'attendance',
        'evaluation_categories',
        'evaluation_activities',
        'grade_entries',
        'observations',
        'event_collections',
        'event_payment_items',
        'support_plans',
        'calendar_events',
        'guardian_messages',
      ];

      let restoredCount = 0;
      let batch = writeBatch(db);
      let opsInBatch = 0;

      for (const colName of allowedCollections) {
        const items = parsed.collections[colName];
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item && typeof item.id === 'string') {
              const { id, createdAt, updatedAt, ...rest } = item;
              batch.set(doc(db, colName, id), {
                ...rest,
                teacherId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              restoredCount += 1;
              opsInBatch += 1;

              if (opsInBatch >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                opsInBatch = 0;
              }
            }
          }
        }
      }

      if (opsInBatch > 0) {
        await batch.commit();
      }

      onNotify(
        'Copia de seguridad restaurada',
        `Se restauraron ${restoredCount} registros en tu cuenta docente.`
      );
    } catch {
      onNotify(
        'Error al restaurar',
        'Verifica que el archivo .json esté íntegro.',
        'error'
      );
    } finally {
      setIsSaving(false);
      e.target.value = '';
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, deleteTarget.collection, deleteTarget.id));
      onNotify('Registro eliminado', `Se eliminó "${deleteTarget.name}".`);
      setDeleteTarget(null);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `${deleteTarget.collection}/${deleteTarget.id}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Navegación de las 4 Herramientas Extra */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div>
          <div className="text-xs font-semibold text-teal-800">
            Módulo 7 de 7 · Herramientas Complementarias y Respaldo Docente
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display mt-1">
            Calendario, Planes de Apoyo, Mensajes a Acudientes y Copia de Seguridad
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Todo conectado automáticamente con tus actividades calificables, promedios bajos y datos de estudiantes.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-200 flex items-center gap-2 overflow-x-auto">
          {[
            {
              id: 'calendario' as ExtraTab,
              label: `1. Calendario y Entregas (${unifiedCalendarItems.length})`,
              icon: Calendar,
            },
            {
              id: 'planes_apoyo' as ExtraTab,
              label: `2. Planes de Apoyo y Nivelación (${supportPlans.length})`,
              icon: LifeBuoy,
            },
            {
              id: 'mensajes' as ExtraTab,
              label: `3. Mensajes a Acudientes (${guardianMessages.length})`,
              icon: MessageSquare,
            },
            {
              id: 'respaldo' as ExtraTab,
              label: '4. Copia de Seguridad y Exportación Total',
              icon: DatabaseBackup,
            },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          PESTAÑA 1: CALENDARIO CONECTADO CON ACTIVIDADES DE CALIFICACIÓN
      ===================================================================== */}
      {activeTab === 'calendario' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                Agenda Docente y Fechas de Entrega de Actividades
              </h2>
              <p className="text-xs text-slate-600">
                Sincroniza automáticamente las fechas de talleres, quices y evaluaciones creadas en el Módulo 3 junto con tus eventos institucionales.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={() => setEventModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Agendar Evento o Reunión
            </Button>
          </div>

          {unifiedCalendarItems.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-600">
              No hay actividades ni eventos programados todavía.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
              {unifiedCalendarItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-1.5 text-center shrink-0">
                      <p className="text-xs font-mono font-bold text-teal-900">
                        {item.date}
                      </p>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-bold font-display ${
                            item.completed
                              ? 'line-through text-slate-400'
                              : 'text-slate-900'
                          }`}
                        >
                          {item.title}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                            item.isGradeActivity
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  {item.rawEvent && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          item.rawEvent &&
                          handleToggleEventCompleted(item.rawEvent)
                        }
                        className="min-h-[36px] px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>
                          {item.completed ? 'Completado' : 'Marcar listo'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          item.rawEvent &&
                          setDeleteTarget({
                            collection: 'calendar_events',
                            id: item.rawEvent.id,
                            name: item.rawEvent.title,
                          })
                        }
                        className="min-h-[36px] min-w-[36px] rounded-lg border border-red-200 text-red-700 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 2: PLANES DE APOYO Y RECUPERACIÓN (DESEMPEÑO BAJO)
      ===================================================================== */}
      {activeTab === 'planes_apoyo' && (
        <div className="space-y-6">
          {/* Sugerencias automáticas de estudiantes en Desempeño Bajo */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-amber-950 font-display flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-700" />
                  <span>
                    Estudiantes detectados con Desempeño Bajo (&lt;{' '}
                    {passingThreshold.toFixed(1)}) ({lowPerformingCandidates.length})
                  </span>
                </h3>
                <p className="text-xs text-amber-900/80">
                  Toca cualquier estudiante para asignarle su Plan de Apoyo y Recuperación en 1 clic.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={() => openSupportPlanModal()}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Nuevo Plan de Apoyo Manual
              </Button>
            </div>

            {lowPerformingCandidates.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {lowPerformingCandidates.map((cand) => (
                  <div
                    key={`${cand.student.id}_${cand.course.id}_${cand.period.id}`}
                    className="rounded-xl border border-amber-200 bg-white p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {cand.student.lastName} {cand.student.firstName}
                      </p>
                      <p className="text-slate-600 truncate">
                        {cand.course.displayName} · {cand.period.name}
                      </p>
                      <p className="font-mono font-bold text-red-700">
                        Definitiva: {cand.score.toFixed(2)} (Bajo)
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        openSupportPlanModal({
                          studentId: cand.student.id,
                          courseId: cand.course.id,
                          periodId: cand.period.id,
                          score: cand.score,
                        })
                      }
                      className="text-xs px-2.5 shrink-0"
                    >
                      Asignar Plan
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Listado de Planes de Apoyo asignados */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Planes de Apoyo y Nivelaciones Registradas ({supportPlans.length})
              </h3>
              <ExportActionControl
                label="Exportar o imprimir Planes de Apoyo"
                title="Acta de Planes de Apoyo y Recuperación SIEE"
                filename="planes_apoyo_recuperacion"
                profile={teacherProfile}
                getBodyHtml={() => {
                  const rows =
                    supportPlans.length === 0
                      ? `<tr><td colspan="6">No hay planes de apoyo registrados.</td></tr>`
                      : supportPlans
                          .map((sp, i) => {
                            const stu = students.find(
                              (s) => s.id === sp.studentId
                            );
                            const crs = courses.find(
                              (c) => c.id === sp.courseId
                            );
                            return `<tr>
                              <td>${i + 1}</td>
                              <td><strong>${stu ? `${stu.lastName} ${stu.firstName}` : '—'}</strong></td>
                              <td>${crs?.displayName || '—'}</td>
                              <td>${sp.weaknesses}</td>
                              <td>${sp.assignedActivities}</td>
                              <td>${sp.status}${
                                sp.recoveryScore !== undefined
                                  ? ` (Nota: ${sp.recoveryScore.toFixed(1)})`
                                  : ''
                              }</td>
                            </tr>`;
                          })
                          .join('');
                  return `
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>N°</th>
                          <th>Estudiante</th>
                          <th>Curso</th>
                          <th>Dificultades</th>
                          <th>Actividades de Nivelación</th>
                          <th>Estado y Nota</th>
                        </tr>
                      </thead>
                      <tbody>${rows}</tbody>
                    </table>
                  `;
                }}
                onNotify={onNotify}
              />
            </div>

            {supportPlans.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                Aún no has asignado planes de apoyo o recuperación.
              </div>
            ) : (
              <div className="space-y-3">
                {supportPlans.map((sp) => {
                  const stu = students.find((s) => s.id === sp.studentId);
                  const crs = courses.find((c) => c.id === sp.courseId);
                  const per = periods.find((p) => p.id === sp.periodId);

                  return (
                    <div
                      key={sp.id}
                      className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div>
                          <span className="text-sm font-bold text-slate-900 font-display">
                            {stu
                              ? `${stu.lastName} ${stu.firstName}`
                              : 'Estudiante'}
                          </span>
                          <span className="text-slate-500 ml-2">
                            · {crs?.displayName || 'Curso'} ({per?.name || 'Periodo'})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold px-2.5 py-0.5 rounded bg-teal-50 text-teal-900 border border-teal-200">
                            {sp.status}
                            {sp.recoveryScore !== undefined
                              ? ` · Nota recuperación: ${sp.recoveryScore.toFixed(1)}`
                              : ''}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditingPlan(sp);
                              setPlanCourseId(sp.courseId);
                              setPlanPeriodId(sp.periodId);
                              setPlanStudentId(sp.studentId);
                              setWeaknesses(sp.weaknesses);
                              setAssignedActivities(sp.assignedActivities);
                              setPlanDueDate(sp.dueDate || todayStr);
                              setRecoveryScore(
                                sp.recoveryScore !== undefined
                                  ? String(sp.recoveryScore)
                                  : ''
                              );
                              setPlanStatus(sp.status);
                              setPlanModalOpen(true);
                            }}
                            className="text-xs px-2.5"
                          >
                            Calificar / Editar
                          </Button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                collection: 'support_plans',
                                id: sp.id,
                                name: `Plan de apoyo de ${stu?.firstName || 'estudiante'}`,
                              })
                            }
                            className="min-h-[34px] min-w-[34px] rounded-lg border border-red-200 text-red-700 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-700">
                        <strong>Dificultades:</strong> {sp.weaknesses}
                      </p>
                      <p className="text-slate-700">
                        <strong>Actividades asignadas:</strong>{' '}
                        {sp.assignedActivities}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 3: PLANTILLAS DE MENSAJES A ACUDIENTES CON DATOS INSERTADOS
      ===================================================================== */}
      {activeTab === 'mensajes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveGuardianMessage}
            className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
          >
            <h2 className="text-lg font-bold text-slate-900 font-display">
              Generador de Comunicados para Acudientes
            </h2>
            <p className="text-xs text-slate-600">
              Selecciona el estudiante y una plantilla para insertar automáticamente su nombre, acudiente, promedio, faltas y curso.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="1. Curso"
                value={currentMsgCourse?.id || ''}
                onChange={(e) => {
                  setMsgCourseId(e.target.value);
                  setMsgStudentId('');
                }}
                options={activeCourses.map((c) => ({
                  value: c.id,
                  label: c.displayName,
                }))}
              />

              <SelectField
                label="2. Estudiante"
                value={currentMsgStudent?.id || ''}
                onChange={(e) => {
                  const sId = e.target.value;
                  setMsgStudentId(sId);
                  const stuObj =
                    msgCourseStudents.find((s) => s.id === sId) || null;
                  generateInterpolatedMessage(
                    msgTemplateKey,
                    stuObj,
                    currentMsgCourse
                  );
                }}
                options={[
                  { value: '', label: 'Seleccionar estudiante...' },
                  ...msgCourseStudents.map((s) => ({
                    value: s.id,
                    label: `${s.lastName} ${s.firstName}`,
                  })),
                ]}
              />
            </div>

            {/* Botones de Plantillas con Autoinserción */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-700 block">
                3. Elige una plantilla (inserta los datos del estudiante en 1 clic):
              </span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'citacion', label: 'Citación a Acudiente' },
                    { id: 'inasistencia', label: 'Alerta de Inasistencia' },
                    { id: 'bajo_desempeno', label: 'Bajo Desempeño / Nivelación' },
                    { id: 'felicitacion', label: 'Felicitación Positiva' },
                    { id: 'recaudo', label: 'Recordatorio Permiso / Cuota' },
                  ] as const
                ).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setMsgTemplateKey(tpl.id);
                      generateInterpolatedMessage(
                        tpl.id,
                        currentMsgStudent,
                        currentMsgCourse
                      );
                    }}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                      msgTemplateKey === tpl.id
                        ? 'border-teal-800 bg-teal-800 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Canal de Envío"
                value={msgChannel}
                onChange={(e) =>
                  setMsgChannel(e.target.value as GuardianMessage['channel'])
                }
                options={[
                  { value: 'WhatsApp', label: 'WhatsApp del Acudiente' },
                  {
                    value: 'Correo Electrónico',
                    label: 'Correo Electrónico',
                  },
                  {
                    value: 'Nota Impresa',
                    label: 'Nota Impresa en el Cuaderno',
                  },
                  {
                    value: 'Citación Presencial',
                    label: 'Citación Presencial Firmada',
                  },
                ]}
              />

              <InputField
                label="Asunto del Comunicado *"
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
                required
              />
            </div>

            <TextareaField
              label="Texto del Mensaje (Editable) *"
              rows={6}
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              required
            />

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!msgBody.trim()) return;
                  navigator.clipboard?.writeText(msgBody);
                  onNotify(
                    'Mensaje copiado',
                    'Listo para pegar en WhatsApp o correo electrónico.'
                  );
                }}
                leftIcon={<Copy className="w-4 h-4 text-teal-800" />}
              >
                Copiar para WhatsApp / Correo
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSaving}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Guardar en Historial de Mensajes
              </Button>
            </div>
          </form>

          {/* Historial de Mensajes Enviados */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 font-display">
              Historial de Comunicados ({guardianMessages.length})
            </h3>
            {guardianMessages.length === 0 ? (
              <p className="text-xs text-slate-500">
                Aún no hay mensajes registrados en la bitácora.
              </p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {guardianMessages.map((gm) => (
                  <div
                    key={gm.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-teal-900">
                        {gm.channel} · {gm.sentDate || ''}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            collection: 'guardian_messages',
                            id: gm.id,
                            name: gm.subject,
                          })
                        }
                        className="text-red-700 hover:underline cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </div>
                    <p className="font-bold text-slate-900">{gm.subject}</p>
                    <p className="text-slate-700 whitespace-pre-line">
                      {gm.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 4: COPIA DE SEGURIDAD Y EXPORTACIÓN DE TODOS LOS DATOS
      ===================================================================== */}
      {activeTab === 'respaldo' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-display">
              Copia de Seguridad Completa y Respaldo de Datos
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Descarga una copia completa de toda tu información académica en tu computador o celular, o restáurala cuando lo necesites.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-slate-500">Cursos y Grupos</p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                {courses.length} cursos · {groups.length} grupos
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-slate-500">Estudiantes</p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                {students.length} fichas
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-slate-500">Asistencias y Notas</p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                {attendanceRecords.length + gradeEntries.length} registros
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-slate-500">Observador y Recaudos</p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                {observations.length + eventCollections.length} registros
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 font-display">
                1. Descargar Copia de Seguridad Total (.JSON)
              </h3>
              <p className="text-xs text-slate-600">
                Guarda en un solo archivo todos los datos de los 7 módulos para conservar tu respaldo local.
              </p>
              <Button
                type="button"
                variant="primary"
                onClick={handleDownloadFullBackup}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Descargar Copia de Seguridad Ahora
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 font-display">
                2. Restaurar desde Copia de Seguridad (.JSON)
              </h3>
              <p className="text-xs text-slate-600">
                Selecciona un archivo de respaldo descargado previamente de Mi Aula Digital para restaurar tus registros.
              </p>
              <label className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-800 inline-flex items-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4 text-teal-800" />
                <span>
                  {isSaving
                    ? 'Restaurando datos...'
                    : 'Seleccionar archivo .JSON para restaurar'}
                </span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleRestoreBackupFile}
                  disabled={isSaving}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agendar Evento en el Calendario */}
      <ModalDialog
        isOpen={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        title="Agendar Evento en el Calendario Docente"
      >
        <form onSubmit={handleCreateCalendarEvent} className="space-y-4">
          <InputField
            label="Título del Evento *"
            placeholder="Ej. Entrega de boletines Periodo 1 / Reunión de área"
            value={evTitle}
            onChange={(e) => setEvTitle(e.target.value)}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Fecha *"
              type="date"
              value={evDate}
              onChange={(e) => setEvDate(e.target.value)}
              required
            />
            <InputField
              label="Hora (Opcional)"
              type="time"
              value={evTime}
              onChange={(e) => setEvTime(e.target.value)}
            />
          </div>
          <SelectField
            label="Categoría"
            value={evCategory}
            onChange={(e) =>
              setEvCategory(e.target.value as CalendarEvent['category'])
            }
            options={[
              { value: 'Evaluación', label: 'Evaluación' },
              { value: 'Reunión de Padres', label: 'Reunión de Padres' },
              { value: 'Consejo Académico', label: 'Consejo Académico' },
              {
                value: 'Actividad Institucional',
                label: 'Actividad Institucional',
              },
              {
                value: 'Entrega de Planillas',
                label: 'Entrega de Planillas',
              },
              { value: 'Otro', label: 'Otro' },
            ]}
          />
          <SelectField
            label="Curso Asociado (Opcional)"
            value={evCourseId}
            onChange={(e) => setEvCourseId(e.target.value)}
            options={[
              { value: '', label: 'General institucional' },
              ...activeCourses.map((c) => ({
                value: c.id,
                label: c.displayName,
              })),
            ]}
          />
          <InputField
            label="Nota adicional"
            value={evDesc}
            onChange={(e) => setEvDesc(e.target.value)}
          />
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEventModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              Guardar Evento
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Crear / Editar Plan de Apoyo y Recuperación */}
      <ModalDialog
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title={
          editingPlan
            ? 'Editar / Calificar Plan de Apoyo'
            : 'Asignar Plan de Apoyo y Recuperación (Desempeño Bajo)'
        }
        maxWidth="xl"
      >
        <form onSubmit={handleSaveSupportPlan} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SelectField
              label="Curso *"
              value={planCourseId}
              onChange={(e) => setPlanCourseId(e.target.value)}
              options={activeCourses.map((c) => ({
                value: c.id,
                label: c.displayName,
              }))}
            />
            <SelectField
              label="Periodo *"
              value={planPeriodId}
              onChange={(e) => setPlanPeriodId(e.target.value)}
              options={periods.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
            />
            <SelectField
              label="Estudiante *"
              value={planStudentId}
              onChange={(e) => setPlanStudentId(e.target.value)}
              options={[
                { value: '', label: 'Seleccionar...' },
                ...students
                  .filter((s) => s.status === 'Activo')
                  .map((s) => ({
                    value: s.id,
                    label: `${s.lastName} ${s.firstName}`,
                  })),
              ]}
              required
            />
          </div>

          <TextareaField
            label="Debilidades o desempeños pendientes por alcanzar *"
            rows={2}
            value={weaknesses}
            onChange={(e) => setWeaknesses(e.target.value)}
            required
          />

          <TextareaField
            label="Actividades de nivelación y criterios de evaluación *"
            rows={3}
            value={assignedActivities}
            onChange={(e) => setAssignedActivities(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InputField
              label="Fecha límite de entrega"
              type="date"
              value={planDueDate}
              onChange={(e) => setPlanDueDate(e.target.value)}
            />
            <InputField
              label="Nota de Recuperación (Opcional)"
              type="number"
              step="0.1"
              placeholder="Ej. 3.5"
              value={recoveryScore}
              onChange={(e) => setRecoveryScore(e.target.value)}
            />
            <SelectField
              label="Estado del Plan"
              value={planStatus}
              onChange={(e) =>
                setPlanStatus(e.target.value as SupportPlan['status'])
              }
              options={[
                { value: 'Asignado', label: 'Asignado' },
                { value: 'En revisión', label: 'En revisión' },
                { value: 'Superado', label: 'Superado (Aprobó)' },
                { value: 'No superado', label: 'No superado' },
              ]}
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPlanModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              Guardar Plan de Apoyo
            </Button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title="Confirmar eliminación"
        itemName={deleteTarget?.name || ''}
        isLoading={isSaving}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
