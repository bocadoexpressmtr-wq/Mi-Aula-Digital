import React, { useState, useEffect } from 'react';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  CheckCircle2,
  Calendar,
  Clock,
  Users,
  Eye,
  BarChart3,
  History,
  Trash2,
  XCircle,
  Edit3,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import {
  CourseAssignment,
  AcademicPeriod,
  Student,
  AttendanceRecord,
} from '../../types/schema';
import { calculateStudentAttendanceSummary } from '../../utils/academicCalculations';
import {
  Button,
  ResponsiveDataView,
  ResponsiveColumn,
} from '../ui/DesignSystem';
import { ExportActionControl } from '../ui/ExportActionControl';
import { escapeHtml } from '../../utils/documentExporter';

interface CourseAttendancePanelProps {
  teacherId: string;
  course: CourseAssignment;
  periods: AcademicPeriod[];
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  onSelectStudentForProfile?: (student: Student) => void;
  onNotify: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

type AttendanceViewMode = 'diario' | 'resumen' | 'historial';

const STATUS_OPTIONS: {
  value: AttendanceRecord['status'];
  label: string;
  shortLabel: string;
  activeClass: string;
}[] = [
  {
    value: 'Presente',
    label: 'Presente',
    shortLabel: 'Presente',
    activeClass: 'bg-emerald-700 text-white border-emerald-800',
  },
  {
    value: 'Excusa',
    label: 'Ausente con excusa',
    shortLabel: 'Con excusa',
    activeClass: 'bg-teal-700 text-white border-teal-800',
  },
  {
    value: 'Ausente',
    label: 'Ausente sin excusa',
    shortLabel: 'Sin excusa',
    activeClass: 'bg-red-700 text-white border-red-800',
  },
  {
    value: 'Tardanza',
    label: 'Llegada tarde',
    shortLabel: 'Tarde',
    activeClass: 'bg-amber-600 text-white border-amber-700',
  },
];

export const CourseAttendancePanel: React.FC<CourseAttendancePanelProps> = ({
  teacherId,
  course,
  periods,
  students,
  attendanceRecords,
  onSelectStudentForProfile,
  onNotify,
}) => {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [viewMode, setViewMode] = useState<AttendanceViewMode>('diario');
  const globalActivePeriod =
    periods.find((p) => p.isActive) || periods[0] || null;

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    globalActivePeriod?.id || ''
  );
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('ALL');

  // Sincronizar automáticamente con el Periodo Actual cuando el docente entra o cambia el periodo global
  useEffect(() => {
    if (globalActivePeriod?.id) {
      setSelectedPeriodId(globalActivePeriod.id);
    }
  }, [globalActivePeriod?.id, course.id]);

  const activePeriodId =
    selectedPeriodId ||
    globalActivePeriod?.id ||
    periods[0]?.id ||
    'periodo_general';

  const selectedPeriodObj =
    periods.find((p) => p.id === activePeriodId) || globalActivePeriod || null;

  const isConsultingOtherPeriod = Boolean(
    globalActivePeriod &&
      activePeriodId &&
      activePeriodId !== globalActivePeriod.id
  );

  // Filtrar estudiantes activos del grupo de este curso
  const courseStudents = students
    .filter(
      (s) => s.gradeGroupId === course.gradeGroupId && s.status === 'Activo'
    )
    .sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
        'es-CO'
      )
    );

  // Registros de este curso en la fecha seleccionada
  const dateRecords = attendanceRecords.filter(
    (r) => r.courseId === course.id && r.date === selectedDate
  );

  // Todas las fechas con registros en este curso y en el periodo seleccionado (ordenadas de más reciente a más antigua)
  const allRecordedDates: string[] = Array.from(
    new Set<string>(
      attendanceRecords
        .filter(
          (r) =>
            r.courseId === course.id &&
            (!selectedPeriodId || r.periodId === selectedPeriodId)
        )
        .map((r) => r.date)
    )
  ).sort((a, b) => b.localeCompare(a));

  const recordedDates = allRecordedDates.slice(0, 10);

  // Quitar / deseleccionar el registro de asistencia de un estudiante
  const handleClearStudentStatus = async (
    recordId: string,
    studentId?: string
  ) => {
    try {
      await deleteDoc(doc(db, 'attendance', recordId));
      if (studentId) {
        setNoteDrafts((prev) => {
          const copy = { ...prev };
          delete copy[studentId];
          return copy;
        });
      }
      onNotify(
        'Asistencia desmarcada',
        'Se eliminó el registro de asistencia de esa fecha.',
        'info'
      );
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `attendance/${recordId}`
      );
    }
  };

  // Borrar todos los registros de una fecha completa (por si se marcó un día equivocado)
  const handleClearEntireDate = async (targetDate: string) => {
    const recordsToDelete = attendanceRecords.filter(
      (r) => r.courseId === course.id && r.date === targetDate
    );
    if (recordsToDelete.length === 0) return;

    setIsSavingBatch(true);
    try {
      const batch = writeBatch(db);
      recordsToDelete.forEach((rec) => {
        batch.delete(doc(db, 'attendance', rec.id));
      });
      await batch.commit();
      setNoteDrafts({});
      onNotify(
        'Fecha limpiada',
        `Se borraron los ${recordsToDelete.length} registros de asistencia del día ${targetDate}.`,
        'info'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'attendance');
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Marcar, cambiar o deseleccionar (si toca el mismo estado activo) un estudiante en la fecha actual
  const handleSetStudentStatus = async (
    student: Student,
    status: AttendanceRecord['status'],
    customNote?: string
  ) => {
    const existing = dateRecords.find((r) => r.studentId === student.id);

    // Si el docente vuelve a tocar el botón que ya está activo (y no viene de editar la nota), se deselecciona
    if (existing && existing.status === status && customNote === undefined) {
      await handleClearStudentStatus(existing.id, student.id);
      return;
    }

    const noteValue = (
      customNote !== undefined
        ? customNote
        : noteDrafts[student.id] ?? existing?.note ?? ''
    )
      .trim()
      .slice(0, 400);

    try {
      if (existing) {
        await updateDoc(doc(db, 'attendance', existing.id), {
          status,
          note: noteValue,
          updatedAt: serverTimestamp(),
        });
      } else {
        const deterministicId = `att_${course.id}_${selectedDate}_${student.id}`.replace(
          /[^a-zA-Z0-9_-]/g,
          '_'
        );
        await setDoc(doc(db, 'attendance', deterministicId), {
          teacherId,
          academicYearId: course.academicYearId,
          periodId: activePeriodId,
          courseId: course.id,
          gradeGroupId: course.gradeGroupId,
          studentId: student.id,
          date: selectedDate,
          status,
          note: noteValue,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  // Botón táctil rápido: "Marcar todos presentes"
  const handleMarkAllPresent = async () => {
    if (courseStudents.length === 0) return;
    setIsSavingBatch(true);
    try {
      const batch = writeBatch(db);
      courseStudents.forEach((student) => {
        const existing = dateRecords.find((r) => r.studentId === student.id);
        if (existing) {
          batch.update(doc(db, 'attendance', existing.id), {
            status: 'Presente',
            updatedAt: serverTimestamp(),
          });
        } else {
          const deterministicId = `att_${course.id}_${selectedDate}_${student.id}`.replace(
            /[^a-zA-Z0-9_-]/g,
            '_'
          );
          batch.set(doc(db, 'attendance', deterministicId), {
            teacherId,
            academicYearId: course.academicYearId,
            periodId: activePeriodId,
            courseId: course.id,
            gradeGroupId: course.gradeGroupId,
            studentId: student.id,
            date: selectedDate,
            status: 'Presente',
            note: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });

      await batch.commit();
      onNotify(
        'Todos marcados como Presentes',
        `Ahora solo toca las excepciones (ausentes o llegadas tarde) del día ${selectedDate}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Estadísticas del día seleccionado
  const presentToday = dateRecords.filter((r) => r.status === 'Presente').length;
  const excusedToday = dateRecords.filter((r) => r.status === 'Excusa').length;
  const unexcusedToday = dateRecords.filter(
    (r) => r.status === 'Ausente' || r.status === 'Evasión'
  ).length;
  const lateToday = dateRecords.filter((r) => r.status === 'Tardanza').length;

  // Registros filtrados por el periodo seleccionado para la vista de Resumen
  const periodAttendanceRecords = attendanceRecords.filter(
    (r) =>
      r.courseId === course.id &&
      (!selectedPeriodId || r.periodId === selectedPeriodId)
  );

  // Registros del Periodo Actual de Trabajo (para comparar cuando se consulta otro periodo)
  const currentActivePeriodRecords = attendanceRecords.filter(
    (r) =>
      r.courseId === course.id &&
      (!globalActivePeriod || r.periodId === globalActivePeriod.id)
  );

  const summaryColumns: ResponsiveColumn<Student>[] = [
    {
      key: 'student',
      header: 'Estudiante',
      render: (stu) => (
        <button
          type="button"
          onClick={() =>
            onSelectStudentForProfile && onSelectStudentForProfile(stu)
          }
          className="text-left font-semibold text-slate-900 hover:text-teal-800 cursor-pointer"
        >
          {stu.lastName} {stu.firstName}
        </button>
      ),
    },
    {
      key: 'present',
      header: 'Presentes',
      align: 'right',
      isNumeric: true,
      render: (stu) => {
        const s = calculateStudentAttendanceSummary(
          stu.id,
          periodAttendanceRecords
        );
        return <span className="text-emerald-700 font-semibold">{s.presentCount}</span>;
      },
    },
    {
      key: 'excused',
      header: 'Con Excusa',
      align: 'right',
      isNumeric: true,
      render: (stu) => {
        const s = calculateStudentAttendanceSummary(
          stu.id,
          periodAttendanceRecords
        );
        return <span className="text-teal-800 font-semibold">{s.excusedAbsenceCount}</span>;
      },
    },
    {
      key: 'unexcused',
      header: 'Sin Excusa',
      align: 'right',
      isNumeric: true,
      render: (stu) => {
        const s = calculateStudentAttendanceSummary(
          stu.id,
          periodAttendanceRecords
        );
        return (
          <span
            className={
              s.unexcusedAbsenceCount > 0
                ? 'text-red-700 font-bold'
                : 'text-slate-600'
            }
          >
            {s.unexcusedAbsenceCount}
          </span>
        );
      },
    },
    {
      key: 'late',
      header: 'Llegadas Tarde',
      align: 'right',
      isNumeric: true,
      render: (stu) => {
        const s = calculateStudentAttendanceSummary(
          stu.id,
          periodAttendanceRecords
        );
        return <span className="text-amber-700 font-semibold">{s.lateCount}</span>;
      },
    },
    {
      key: 'percentage',
      header: `% (${selectedPeriodObj?.name || 'Periodo'})`,
      align: 'right',
      isNumeric: true,
      render: (stu) => {
        const s = calculateStudentAttendanceSummary(
          stu.id,
          periodAttendanceRecords
        );
        return (
          <span
            className={`font-bold ${
              s.totalSessions === 0
                ? 'text-slate-500'
                : s.attendancePercentage < 80
                ? 'text-red-700'
                : s.attendancePercentage < 90
                ? 'text-amber-700'
                : 'text-emerald-700'
            }`}
          >
            {s.attendancePercentage}%
          </span>
        );
      },
    },
    ...(isConsultingOtherPeriod && globalActivePeriod
      ? ([
          {
            key: 'compare_current',
            header: `Vs. ${globalActivePeriod.name} (Actual)`,
            align: 'right',
            isNumeric: true,
            render: (stu: Student) => {
              const sConsulted = calculateStudentAttendanceSummary(
                stu.id,
                periodAttendanceRecords
              );
              const sCurrent = calculateStudentAttendanceSummary(
                stu.id,
                currentActivePeriodRecords
              );
              if (sCurrent.totalSessions === 0 && sConsulted.totalSessions === 0) {
                return <span className="text-slate-400">Sin reg.</span>;
              }
              const diff =
                sCurrent.attendancePercentage - sConsulted.attendancePercentage;
              return (
                <span className="font-mono text-xs">
                  <strong className="text-slate-800">
                    {sCurrent.attendancePercentage}%
                  </strong>{' '}
                  <span
                    className={
                      diff > 0
                        ? 'text-emerald-700 font-semibold'
                        : diff < 0
                        ? 'text-red-700 font-semibold'
                        : 'text-slate-400'
                    }
                  >
                    ({diff > 0 ? `+${diff}%` : `${diff}%`})
                  </span>
                </span>
              );
            },
          },
        ] as ResponsiveColumn<Student>[])
      : []),
    {
      key: 'ficha',
      header: 'Ficha',
      align: 'right',
      render: (stu) =>
        onSelectStudentForProfile ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onSelectStudentForProfile(stu)}
            leftIcon={<Eye className="w-4 h-4 text-teal-800" />}
            className="text-xs px-2.5"
          >
            Ver Ficha
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Aviso de seguridad cuando el docente consulta manualmente un periodo distinto al Periodo Actual */}
      {isConsultingOtherPeriod && globalActivePeriod && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Modo Consulta de Otro Periodo:</strong> Estás viendo los registros de{' '}
              <strong>{selectedPeriodObj?.name}</strong>. Tu periodo actual de trabajo es{' '}
              <strong>{globalActivePeriod.name}</strong>.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => setSelectedPeriodId(globalActivePeriod.id)}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Volver al Periodo Actual ({globalActivePeriod.name})
          </Button>
        </div>
      )}

      {/* Barra de controles: Selector de Modo (Diario vs Resumen vs Historial), Fecha, Periodo y "Marcar todos presentes" */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Selector de pestaña Registro Diario / Resumen por Periodo / Historial */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
            <button
              type="button"
              onClick={() => setViewMode('diario')}
              className={`min-h-[42px] px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                viewMode === 'diario'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4 text-teal-800" />
              <span>Registro Diario</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('resumen')}
              className={`min-h-[42px] px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                viewMode === 'resumen'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-teal-800" />
              <span>Resumen por Periodo</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('historial')}
              className={`min-h-[42px] px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                viewMode === 'historial'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-4 h-4 text-teal-800" />
              <span>Historial de Fechas ({allRecordedDates.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de Periodo */}
            {periods.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">
                  Periodo:
                </label>
                <select
                  value={activePeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className={`min-h-[40px] rounded-xl border px-3 py-1.5 text-xs font-bold focus:outline-none ${
                    isConsultingOtherPeriod
                      ? 'border-amber-400 bg-amber-50 text-amber-950'
                      : 'border-slate-300 bg-white text-slate-900 focus:border-teal-700'
                  }`}
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.weightPercentage}%)
                      {p.id === globalActivePeriod?.id ? ' · Actual' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Selector de Fecha (permite elegir hoy o editar días anteriores) */}
            {viewMode === 'diario' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">
                  Fecha:
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>
            )}

            {viewMode === 'diario' && (
              <Button
                type="button"
                variant="primary"
                onClick={handleMarkAllPresent}
                isLoading={isSavingBatch}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Marcar todos presentes
              </Button>
            )}

            {viewMode === 'diario' && dateRecords.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClearEntireDate(selectedDate)}
                isLoading={isSavingBatch}
                leftIcon={<Trash2 className="w-4 h-4 text-red-700" />}
              >
                Limpiar día ({dateRecords.length})
              </Button>
            )}

            <ExportActionControl
              label="Exportar o imprimir"
              title="Planilla y Resumen de Asistencia"
              subtitle={`${course.name || 'Curso'} · Fecha de corte: ${selectedDate}`}
              filename={`Asistencia_${course.name || 'Curso'}_${selectedDate}`}
              onNotify={onNotify}
              getBodyHtml={() => {
                const rowsHtml = courseStudents
                  .map((stu, idx) => {
                    const s = calculateStudentAttendanceSummary(
                      stu.id,
                      periodAttendanceRecords
                    );
                    const recToday = dateRecords.find(
                      (r) => r.studentId === stu.id
                    );
                    return `<tr>
                      <td style="text-align:center;">${idx + 1}</td>
                      <td><strong>${escapeHtml(stu.lastName)} ${escapeHtml(stu.firstName)}</strong></td>
                      <td style="text-align:center;">${escapeHtml(recToday?.status || 'Sin marcar')}</td>
                      <td style="text-align:right;">${s.presentCount}</td>
                      <td style="text-align:right;">${s.excusedAbsenceCount}</td>
                      <td style="text-align:right;">${s.unexcusedAbsenceCount}</td>
                      <td style="text-align:right;">${s.lateCount}</td>
                      <td style="text-align:right;"><strong>${s.attendancePercentage}%</strong></td>
                    </tr>`;
                  })
                  .join('');

                return `<div class="kpi-box">
                  <strong>Estudiantes activos:</strong> ${courseStudents.length} &nbsp;|&nbsp;
                  <strong>Presentes hoy:</strong> ${presentToday} &nbsp;|&nbsp;
                  <strong>Ausentes sin excusa:</strong> ${unexcusedToday} &nbsp;|&nbsp;
                  <strong>Ausentes con excusa:</strong> ${excusedToday}
                </div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th style="width:36px;">N°</th>
                      <th>Estudiante</th>
                      <th style="text-align:center;">Estado (${escapeHtml(selectedDate)})</th>
                      <th style="text-align:right;">Presentes</th>
                      <th style="text-align:right;">Excusadas</th>
                      <th style="text-align:right;">Sin Excusa</th>
                      <th style="text-align:right;">Tardanzas</th>
                      <th style="text-align:right;">% Asist.</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml || '<tr><td colspan="8">Sin estudiantes activos.</td></tr>'}
                  </tbody>
                </table>`;
              }}
            />
          </div>
        </div>

        {/* Historial rápido de fechas ya registradas para editar días anteriores con 1 toque */}
        {viewMode === 'diario' && recordedDates.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-slate-500 whitespace-nowrap shrink-0">
              Días con asistencia (toca para abrir):
            </span>
            {recordedDates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDate(d)}
                className={`px-2.5 py-1 rounded-lg font-mono tabular-nums whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  d === selectedDate
                    ? 'bg-teal-800 text-white font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setViewMode('historial')}
              className="ml-auto text-teal-800 hover:underline font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ver todo el historial →
            </button>
          </div>
        )}

        {/* Contadores rápidos del día */}
        {viewMode === 'diario' && courseStudents.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                <span className="text-xs text-slate-600">Presentes</span>
                <span className="text-base font-bold font-mono tabular-nums text-emerald-700">
                  {presentToday}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                <span className="text-xs text-slate-600">Ausente con excusa</span>
                <span className="text-base font-bold font-mono tabular-nums text-teal-800">
                  {excusedToday}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                <span className="text-xs text-slate-600">Ausente sin excusa</span>
                <span className="text-base font-bold font-mono tabular-nums text-red-700">
                  {unexcusedToday}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                <span className="text-xs text-slate-600">Llegada tarde</span>
                <span className="text-base font-bold font-mono tabular-nums text-amber-700">
                  {lateToday}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Tip: Si marcaste un estado por error, vuelve a tocar el mismo botón activo o pulsa <strong>"Quitar"</strong> para dejar al estudiante sin registro en esta fecha.
            </p>
          </div>
        )}
      </div>

      {/* CONTENIDO PRINCIPAL SEGÚN MODO (DIARIO / RESUMEN / HISTORIAL) */}
      {courseStudents.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-base font-bold text-slate-900 font-display">
            No hay estudiantes activos en este curso
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Agrega estudiantes en la pestaña "Estudiantes" para tomar asistencia.
          </p>
        </div>
      ) : viewMode === 'diario' ? (
        <div className="space-y-3">
          {courseStudents.map((stu, idx) => {
            const record = dateRecords.find((r) => r.studentId === stu.id);
            const currentStatus = record?.status;
            const currentNote =
              noteDrafts[stu.id] !== undefined
                ? noteDrafts[stu.id]
                : record?.note || '';

            return (
              <div
                key={stu.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                {/* Nombre del estudiante */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-slate-400 tabular-nums w-6 shrink-0">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        onSelectStudentForProfile &&
                        onSelectStudentForProfile(stu)
                      }
                      className="text-sm sm:text-base font-bold text-slate-900 font-display hover:text-teal-800 text-left truncate block cursor-pointer"
                    >
                      {stu.lastName} {stu.firstName}
                    </button>
                    <p className="text-xs text-slate-500 font-mono">
                      {stu.documentType} {stu.documentNumber || '—'}
                    </p>
                  </div>
                </div>

                {/* 4 Botones Táctiles Grandes + Botón Quitar + Campo opcional de motivo */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {STATUS_OPTIONS.map((opt) => {
                      const isSelected = currentStatus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSetStudentStatus(stu, opt.value)}
                          title={
                            isSelected
                              ? 'Toca de nuevo para desmarcar este estado'
                              : `Marcar como ${opt.label}`
                          }
                          className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none whitespace-nowrap ${
                            isSelected
                              ? opt.activeClass
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {opt.shortLabel}
                        </button>
                      );
                    })}
                  </div>

                  {record && (
                    <button
                      type="button"
                      onClick={() => handleClearStudentStatus(record.id, stu.id)}
                      title="Quitar registro de asistencia de esta fecha"
                      className="min-h-[44px] px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-red-700 hover:border-red-200 hover:bg-red-50/50 text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  )}

                  {/* Campo opcional de motivo / observación de asistencia */}
                  <input
                    type="text"
                    value={currentNote}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({
                        ...prev,
                        [stu.id]: e.target.value,
                      }))
                    }
                    onBlur={() => {
                      if (
                        currentStatus &&
                        noteDrafts[stu.id] !== undefined &&
                        noteDrafts[stu.id] !== (record?.note || '')
                      ) {
                        handleSetStudentStatus(
                          stu,
                          currentStatus,
                          noteDrafts[stu.id]
                        );
                      }
                    }}
                    placeholder="Motivo u observación (opcional)..."
                    className="min-h-[44px] sm:w-52 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'resumen' ? (
        /* VISTA DE RESUMEN POR ESTUDIANTE Y PERIODO */
        <ResponsiveDataView
          data={courseStudents}
          columns={summaryColumns}
          keyExtractor={(stu) => stu.id}
          mobileCardRender={(stu) => {
            const s = calculateStudentAttendanceSummary(
              stu.id,
              periodAttendanceRecords
            );
            return (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectStudentForProfile &&
                      onSelectStudentForProfile(stu)
                    }
                    className="text-sm font-bold text-slate-900 font-display text-left cursor-pointer"
                  >
                    {stu.lastName} {stu.firstName}
                  </button>
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      s.totalSessions === 0
                        ? 'text-slate-500'
                        : s.attendancePercentage < 80
                        ? 'text-red-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {s.attendancePercentage}% Asistencia
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                  <div>
                    <p className="text-slate-500">Presente</p>
                    <p className="font-mono font-bold text-emerald-700">
                      {s.presentCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Con Excusa</p>
                    <p className="font-mono font-bold text-teal-800">
                      {s.excusedAbsenceCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Sin Excusa</p>
                    <p className="font-mono font-bold text-red-700">
                      {s.unexcusedAbsenceCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Tarde</p>
                    <p className="font-mono font-bold text-amber-700">
                      {s.lateCount}
                    </p>
                  </div>
                </div>
              </div>
            );
          }}
        />
      ) : (
        /* VISTA DE HISTORIAL DE FECHAS Y REGISTROS */
        <div className="space-y-6">
          {/* Guía rápida de cómo funciona el historial */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-900">
                ¿Cómo funciona el historial de asistencia?
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">
                Cada vez que marcas asistencia en una fecha, queda guardada aquí. Puedes <strong>abrir cualquier día anterior</strong> para corregirlo, <strong>eliminar una fecha completa</strong> si fue una prueba por error, o consultar el historial individual de un alumno tocando su nombre (pestaña <em>Asistencia</em> de su Ficha).
              </p>
            </div>
          </div>

          {/* 1. Tarjetas por cada fecha registrada */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-display">
                  Fechas con Asistencia Registrada ({allRecordedDates.length})
                </h4>
                <p className="text-xs text-slate-500">
                  Selecciona una fecha para editarla o elimínala si la registraste por equivocación.
                </p>
              </div>
            </div>

            {allRecordedDates.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Aún no hay fechas registradas en este curso.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {allRecordedDates.map((d) => {
                  const recsForDay = attendanceRecords.filter(
                    (r) => r.courseId === course.id && r.date === d
                  );
                  const pres = recsForDay.filter((r) => r.status === 'Presente').length;
                  const exc = recsForDay.filter((r) => r.status === 'Excusa').length;
                  const unexc = recsForDay.filter(
                    (r) => r.status === 'Ausente' || r.status === 'Evasión'
                  ).length;
                  const late = recsForDay.filter((r) => r.status === 'Tardanza').length;

                  return (
                    <div
                      key={d}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {d}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {recsForDay.length} de {courseStudents.length} marcados
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 text-center text-[11px] bg-white rounded-lg p-2 border border-slate-200/80">
                        <div>
                          <span className="block text-slate-400">Pres.</span>
                          <strong className="font-mono text-emerald-700">{pres}</strong>
                        </div>
                        <div>
                          <span className="block text-slate-400">Excusa</span>
                          <strong className="font-mono text-teal-800">{exc}</strong>
                        </div>
                        <div>
                          <span className="block text-slate-400">Falta</span>
                          <strong className="font-mono text-red-700">{unexc}</strong>
                        </div>
                        <div>
                          <span className="block text-slate-400">Tarde</span>
                          <strong className="font-mono text-amber-700">{late}</strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(d);
                            setViewMode('diario');
                          }}
                          className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-teal-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-teal-900 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Abrir y editar día</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearEntireDate(d)}
                          title="Borrar todos los registros de esta fecha"
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Borrar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Bitácora detallada registro por registro */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-display">
                  Bitácora Detallada de Registros del Periodo
                </h4>
                <p className="text-xs text-slate-500">
                  Filtra por novedades (ausencias o llegadas tarde) o quita un registro individual con un clic.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">
                  Filtrar estado:
                </label>
                <select
                  value={historyFilterStatus}
                  onChange={(e) => setHistoryFilterStatus(e.target.value)}
                  className="min-h-[38px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="NOVEDADES">Solo faltas y llegadas tarde</option>
                  <option value="Presente">Solo Presentes</option>
                  <option value="Excusa">Solo Con Excusa</option>
                  <option value="Ausente">Solo Sin Excusa</option>
                  <option value="Tardanza">Solo Llegadas Tarde</option>
                </select>
              </div>
            </div>

            {(() => {
              const filteredLogs = [...periodAttendanceRecords]
                .filter((r) => {
                  if (historyFilterStatus === 'ALL') return true;
                  if (historyFilterStatus === 'NOVEDADES') {
                    return r.status !== 'Presente';
                  }
                  return r.status === historyFilterStatus;
                })
                .sort((a, b) => b.date.localeCompare(a.date));

              if (filteredLogs.length === 0) {
                return (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    No hay registros para el filtro seleccionado.
                  </p>
                );
              }

              return (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-2.5 px-3 font-semibold">Fecha</th>
                        <th className="py-2.5 px-3 font-semibold">Estudiante</th>
                        <th className="py-2.5 px-3 font-semibold">Estado</th>
                        <th className="py-2.5 px-3 font-semibold">Motivo / Observación</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredLogs.slice(0, 100).map((rec) => {
                        const stu = students.find((s) => s.id === rec.studentId);
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                              {rec.date}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {stu ? `${stu.lastName} ${stu.firstName}` : 'Estudiante'}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                                  rec.status === 'Presente'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : rec.status === 'Excusa'
                                    ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                    : rec.status === 'Tardanza'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-red-50 text-red-800 border border-red-200'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {rec.note || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  handleClearStudentStatus(rec.id, rec.studentId)
                                }
                                className="text-red-700 hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Quitar</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
