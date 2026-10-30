import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  AlertTriangle,
  Award,
  TrendingDown,
  Users,
  CalendarCheck,
  Printer,
  Eye,
  Filter,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';
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
  NationalScaleLevel,
} from '../../types/schema';
import {
  calculateStudentAttendanceSummary,
  calculateStudentPeriodGrade,
  calculateStudentAnnualGrade,
} from '../../utils/academicCalculations';
import { getObservationCategory } from '../module4/CourseObserverPanel';
import { Button } from '../ui/DesignSystem';
import { ExportActionControl } from '../ui/ExportActionControl';
import { StudentProfileModal } from '../module1/StudentProfileModal';

interface AnalyticsDashboardProps {
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
  lockedGradeName?: string;
  lockedGroupId?: string;
  lockedCourseId?: string;
  onNotify: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

export interface StudentAnalyticsRow {
  student: Student;
  group?: GradeGroup;
  score: number | null;
  scaleLevel: NationalScaleLevel | null;
  attendancePercentage: number;
  totalSessions: number;
  unexcusedAbsences: number;
  totalAbsences: number;
  lateCount: number;
  coexistenceCount: number;
  improvementObsCount: number;
  hasDownwardTrend: boolean;
  previousPeriodScore: number | null;
  currentPeriodScore: number | null;
  atRiskOfFailing: boolean;
}

export interface SmartAlertItem {
  id: string;
  student: Student;
  groupName: string;
  alertType:
    | 'faltas'
    | 'tendencia_baja'
    | 'bajo_desempeno'
    | 'convivencia';
  title: string;
  detail: string;
  severity: 'high' | 'medium';
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
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
  lockedGradeName,
  lockedGroupId,
  lockedCourseId,
  onNotify,
}) => {
  const defaultYear = years.find((y) => y.isActive) || years[0] || null;
  const [selectedYearId, setSelectedYearId] = useState<string>(
    defaultYear?.id || ''
  );

  const activeYearId = selectedYearId || defaultYear?.id || '';

  const yearPeriods = useMemo(
    () =>
      periods
        .filter((p) => !activeYearId || p.academicYearId === activeYearId)
        .sort((a, b) => a.number - b.number),
    [periods, activeYearId]
  );

  const globalActivePeriod = useMemo(
    () => yearPeriods.find((p) => p.isActive) || yearPeriods[0] || null,
    [yearPeriods]
  );

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    globalActivePeriod?.id || 'ALL'
  );

  // Sincronizar automáticamente con el Periodo Actual al entrar o cambiar el periodo global
  useEffect(() => {
    if (globalActivePeriod?.id) {
      setSelectedPeriodId(globalActivePeriod.id);
    }
  }, [globalActivePeriod?.id, lockedCourseId, lockedGroupId, lockedGradeName]);

  const selectedPeriodObj =
    yearPeriods.find((p) => p.id === selectedPeriodId) || null;

  const isConsultingOtherPeriod = Boolean(
    globalActivePeriod && selectedPeriodId !== globalActivePeriod.id
  );

  const [selectedAreaId, setSelectedAreaId] = useState<string>('ALL');
  const [selectedGradeName, setSelectedGradeName] = useState<string>(
    lockedGradeName || 'ALL'
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    lockedGroupId || 'ALL'
  );

  const effectiveGradeName = lockedGradeName || selectedGradeName;
  const effectiveGroupId = lockedGroupId || selectedGroupId;

  const [selectedStudentForModal, setSelectedStudentForModal] =
    useState<Student | null>(null);

  const yearGroups = useMemo(
    () =>
      groups.filter((g) => !activeYearId || g.academicYearId === activeYearId),
    [groups, activeYearId]
  );

  const uniqueGrades = useMemo(
    () => Array.from(new Set(yearGroups.map((g) => g.gradeName))),
    [yearGroups]
  );

  // Cursos filtrados por Año, Área, Grado y Grupo
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (c.archived) return false;
      if (lockedCourseId) return c.id === lockedCourseId;
      if (activeYearId && c.academicYearId !== activeYearId) return false;
      if (selectedAreaId !== 'ALL' && c.areaSubjectId !== selectedAreaId)
        return false;
      const grp = groups.find((g) => g.id === c.gradeGroupId);
      if (
        effectiveGradeName !== 'ALL' &&
        grp?.gradeName !== effectiveGradeName
      )
        return false;
      if (effectiveGroupId !== 'ALL' && c.gradeGroupId !== effectiveGroupId)
        return false;
      return true;
    });
  }, [
    courses,
    lockedCourseId,
    activeYearId,
    selectedAreaId,
    effectiveGradeName,
    effectiveGroupId,
    groups,
  ]);

  const filteredGroupIds = useMemo(
    () => new Set(filteredCourses.map((c) => c.gradeGroupId)),
    [filteredCourses]
  );

  const filteredCourseIds = useMemo(
    () => new Set(filteredCourses.map((c) => c.id)),
    [filteredCourses]
  );

  // Estudiantes activos dentro de los grupos/cursos filtrados
  const activeStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (s.status !== 'Activo') return false;
        if (activeYearId && s.academicYearId !== activeYearId) return false;
        if (effectiveGroupId !== 'ALL' && s.gradeGroupId !== effectiveGroupId)
          return false;
        const grp = groups.find((g) => g.id === s.gradeGroupId);
        if (
          effectiveGradeName !== 'ALL' &&
          grp?.gradeName !== effectiveGradeName
        )
          return false;
        if (
          selectedAreaId !== 'ALL' &&
          filteredGroupIds.size > 0 &&
          !filteredGroupIds.has(s.gradeGroupId)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`,
          'es-CO'
        )
      );
  }, [
    students,
    activeYearId,
    effectiveGroupId,
    effectiveGradeName,
    selectedAreaId,
    filteredGroupIds,
    groups,
  ]);

  const passingThreshold =
    teacherProfile?.basicMin ?? teacherProfile?.passingScore ?? 3.0;
  const highMin = teacherProfile?.highMin ?? 4.0;
  const superiorMin = teacherProfile?.superiorMin ?? 4.6;

  // Analítica consolidada por estudiante
  const studentAnalytics: StudentAnalyticsRow[] = useMemo(() => {
    return activeStudents.map((stu) => {
      const grp = groups.find((g) => g.id === stu.gradeGroupId);
      const stuCourses = filteredCourses.filter(
        (c) => c.gradeGroupId === stu.gradeGroupId
      );

      // Cálculo de nota del estudiante en los cursos filtrados
      const courseScores: number[] = [];
      let prevPeriodAvg: number | null = null;
      let currPeriodAvg: number | null = null;

      stuCourses.forEach((crs) => {
        if (selectedPeriodId !== 'ALL') {
          const pCats = categories.filter(
            (c) => c.courseId === crs.id && c.periodId === selectedPeriodId
          );
          const pActs = activities.filter(
            (a) => a.courseId === crs.id && a.periodId === selectedPeriodId
          );
          const pEnts = gradeEntries.filter(
            (e) => e.courseId === crs.id && e.periodId === selectedPeriodId
          );
          const res = calculateStudentPeriodGrade(
            stu.id,
            pCats,
            pActs,
            pEnts,
            teacherProfile
          );
          if (res.finalPeriodScore !== null) {
            courseScores.push(res.finalPeriodScore);
          }
        } else {
          const annual = calculateStudentAnnualGrade(
            stu.id,
            crs.id,
            yearPeriods,
            categories,
            activities,
            gradeEntries,
            teacherProfile
          );
          if (annual.annualScore !== null) {
            courseScores.push(annual.annualScore);
          }
        }

        // Evaluar tendencia entre periodos consecutivos con nota
        const scoredPeriods: number[] = [];
        yearPeriods.forEach((per) => {
          const pCats = categories.filter(
            (c) => c.courseId === crs.id && c.periodId === per.id
          );
          const pActs = activities.filter(
            (a) => a.courseId === crs.id && a.periodId === per.id
          );
          const pEnts = gradeEntries.filter(
            (e) => e.courseId === crs.id && e.periodId === per.id
          );
          const pSum = calculateStudentPeriodGrade(
            stu.id,
            pCats,
            pActs,
            pEnts,
            teacherProfile
          );
          if (pSum.finalPeriodScore !== null) {
            scoredPeriods.push(pSum.finalPeriodScore);
          }
        });

        if (scoredPeriods.length >= 2) {
          prevPeriodAvg = scoredPeriods[scoredPeriods.length - 2];
          currPeriodAvg = scoredPeriods[scoredPeriods.length - 1];
        } else {
          // O tendencia a la baja en las últimas actividades calificadas del curso
          const stuCourseEntries = gradeEntries
            .filter((e) => e.courseId === crs.id && e.studentId === stu.id)
            .sort((a, b) => a.activityId.localeCompare(b.activityId));
          if (stuCourseEntries.length >= 2) {
            prevPeriodAvg =
              stuCourseEntries[stuCourseEntries.length - 2].score;
            currPeriodAvg =
              stuCourseEntries[stuCourseEntries.length - 1].score;
          }
        }
      });

      const finalScore =
        courseScores.length > 0
          ? Number(
              (
                courseScores.reduce((a, b) => a + b, 0) / courseScores.length
              ).toFixed(2)
            )
          : null;

      let scaleLevel: NationalScaleLevel | null = null;
      if (finalScore !== null) {
        if (finalScore >= superiorMin) scaleLevel = 'Superior';
        else if (finalScore >= highMin) scaleLevel = 'Alto';
        else if (finalScore >= passingThreshold) scaleLevel = 'Básico';
        else scaleLevel = 'Bajo';
      }

      // Asistencia filtrada del estudiante
      const stuAtt = attendanceRecords.filter((r) => {
        if (r.studentId !== stu.id) return false;
        if (selectedPeriodId !== 'ALL' && r.periodId !== selectedPeriodId)
          return false;
        if (filteredCourseIds.size > 0 && !filteredCourseIds.has(r.courseId))
          return false;
        return true;
      });
      const attSum = calculateStudentAttendanceSummary(stu.id, stuAtt);
      const totalAbsences =
        attSum.unexcusedAbsenceCount + attSum.excusedAbsenceCount;

      // Observaciones filtradas del estudiante
      const stuObs = observations.filter((o) => {
        if (o.studentId !== stu.id) return false;
        if (selectedPeriodId !== 'ALL' && o.periodId !== selectedPeriodId)
          return false;
        return true;
      });

      const coexistenceCount = stuObs.filter(
        (o) => getObservationCategory(o.type) === 'convivencia'
      ).length;
      const improvementObsCount = stuObs.filter(
        (o) => getObservationCategory(o.type) === 'mejora'
      ).length;

      const hasDownwardTrend =
        prevPeriodAvg !== null &&
        currPeriodAvg !== null &&
        currPeriodAvg < prevPeriodAvg - 0.3;

      const atRiskOfFailing =
        (finalScore !== null && finalScore < passingThreshold) ||
        (attSum.totalSessions > 0 && attSum.attendancePercentage < 80);

      return {
        student: stu,
        group: grp,
        score: finalScore,
        scaleLevel,
        attendancePercentage: attSum.attendancePercentage,
        totalSessions: attSum.totalSessions,
        unexcusedAbsences: attSum.unexcusedAbsenceCount,
        totalAbsences,
        lateCount: attSum.lateCount,
        coexistenceCount,
        improvementObsCount,
        hasDownwardTrend,
        previousPeriodScore: prevPeriodAvg,
        currentPeriodScore: currPeriodAvg,
        atRiskOfFailing,
      };
    });
  }, [
    activeStudents,
    groups,
    filteredCourses,
    selectedPeriodId,
    categories,
    activities,
    gradeEntries,
    teacherProfile,
    yearPeriods,
    superiorMin,
    highMin,
    passingThreshold,
    attendanceRecords,
    filteredCourseIds,
    observations,
  ]);

  // Promedio General del Curso / Filtro
  const scoredRows = studentAnalytics.filter((r) => r.score !== null);
  const courseAverage =
    scoredRows.length > 0
      ? Number(
          (
            scoredRows.reduce((acc, r) => acc + (r.score || 0), 0) /
            scoredRows.length
          ).toFixed(2)
        )
      : null;

  // Porcentaje de Asistencia e Inasistencia (0% si aún no se han tomado asistencias)
  const rowsWithAttendance = studentAnalytics.filter(
    (r) => r.totalSessions > 0
  );
  const overallAttendancePct =
    rowsWithAttendance.length > 0
      ? Math.round(
          rowsWithAttendance.reduce(
            (acc, r) => acc + r.attendancePercentage,
            0
          ) / rowsWithAttendance.length
        )
      : 0;
  const overallAbsencePct =
    rowsWithAttendance.length > 0
      ? Math.max(0, 100 - overallAttendancePct)
      : 0;

  // Distribución por Nivel de Desempeño SIEE
  const distribution = useMemo(() => {
    const counts: Record<NationalScaleLevel, number> = {
      Superior: 0,
      Alto: 0,
      Básico: 0,
      Bajo: 0,
    };
    scoredRows.forEach((r) => {
      if (r.scaleLevel) counts[r.scaleLevel] += 1;
    });
    return counts;
  }, [scoredRows]);

  // Ranking Mejores y Peores Estudiantes
  const bestStudents = useMemo(
    () =>
      [...scoredRows]
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 5),
    [scoredRows]
  );

  const lowestStudents = useMemo(
    () =>
      [...scoredRows]
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .slice(0, 5),
    [scoredRows]
  );

  const studentsAtRisk = useMemo(
    () => studentAnalytics.filter((r) => r.atRiskOfFailing),
    [studentAnalytics]
  );

  // Comparación entre Periodos
  const periodComparison = useMemo(() => {
    return yearPeriods.map((per) => {
      const scores: number[] = [];
      activeStudents.forEach((stu) => {
        const stuCrs = filteredCourses.filter(
          (c) => c.gradeGroupId === stu.gradeGroupId
        );
        stuCrs.forEach((crs) => {
          const pCats = categories.filter(
            (c) => c.courseId === crs.id && c.periodId === per.id
          );
          const pActs = activities.filter(
            (a) => a.courseId === crs.id && a.periodId === per.id
          );
          const pEnts = gradeEntries.filter(
            (e) => e.courseId === crs.id && e.periodId === per.id
          );
          const res = calculateStudentPeriodGrade(
            stu.id,
            pCats,
            pActs,
            pEnts,
            teacherProfile
          );
          if (res.finalPeriodScore !== null) scores.push(res.finalPeriodScore);
        });
      });

      const pAtt = attendanceRecords.filter(
        (r) =>
          r.periodId === per.id &&
          (filteredCourseIds.size === 0 || filteredCourseIds.has(r.courseId))
      );
      const presentOrExcused = pAtt.filter(
        (r) =>
          r.status === 'Presente' ||
          r.status === 'Excusa' ||
          r.status === 'Tardanza'
      ).length;
      const attPct =
        pAtt.length > 0
          ? Math.round((presentOrExcused / pAtt.length) * 100)
          : 0;

      return {
        period: per,
        averageScore:
          scores.length > 0
            ? Number(
                (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
              )
            : null,
        attendancePct: attPct,
      };
    });
  }, [
    yearPeriods,
    activeStudents,
    filteredCourses,
    categories,
    activities,
    gradeEntries,
    teacherProfile,
    attendanceRecords,
    filteredCourseIds,
  ]);

  // Comparación entre Grupos
  const groupComparison = useMemo(() => {
    return yearGroups.map((grp) => {
      const grpRows = studentAnalytics.filter(
        (r) => r.student.gradeGroupId === grp.id
      );
      const grpScored = grpRows.filter((r) => r.score !== null);
      const avg =
        grpScored.length > 0
          ? Number(
              (
                grpScored.reduce((acc, r) => acc + (r.score || 0), 0) /
                grpScored.length
              ).toFixed(2)
            )
          : null;
      const grpWithAtt = grpRows.filter((r) => r.totalSessions > 0);
      const attPct =
        grpWithAtt.length > 0
          ? Math.round(
              grpWithAtt.reduce((acc, r) => acc + r.attendancePercentage, 0) /
                grpWithAtt.length
            )
          : 0;
      const riskCount = grpRows.filter((r) => r.atRiskOfFailing).length;

      return {
        group: grp,
        studentCount: grpRows.length,
        averageScore: avg,
        attendancePct: attPct,
        riskCount,
      };
    });
  }, [yearGroups, studentAnalytics]);

  // Generación de Alertas Automáticas con enlace a la ficha del estudiante
  const smartAlerts: SmartAlertItem[] = useMemo(() => {
    const list: SmartAlertItem[] = [];
    studentAnalytics.forEach((row) => {
      const grpLabel = row.group
        ? `${row.group.gradeName} (${row.group.groupName})`
        : 'Grupo';

      if (
        row.totalSessions > 0 &&
        (row.totalAbsences >= 2 || row.attendancePercentage < 85)
      ) {
        list.push({
          id: `alt_att_${row.student.id}`,
          student: row.student,
          groupName: grpLabel,
          alertType: 'faltas',
          title: 'Muchas faltas de asistencia',
          detail: `${row.totalAbsences} inasistencias (${row.unexcusedAbsences} sin excusa) · Asistencia del ${row.attendancePercentage}%`,
          severity: row.attendancePercentage < 80 ? 'high' : 'medium',
        });
      }

      if (row.score !== null && row.score < passingThreshold) {
        list.push({
          id: `alt_low_${row.student.id}`,
          student: row.student,
          groupName: grpLabel,
          alertType: 'bajo_desempeno',
          title: 'Bajo desempeño · Riesgo de pérdida',
          detail: `Promedio actual en ${row.score.toFixed(2)} (Desempeño Bajo < ${passingThreshold.toFixed(1)})`,
          severity: 'high',
        });
      }

      if (row.hasDownwardTrend) {
        list.push({
          id: `alt_trend_${row.student.id}`,
          student: row.student,
          groupName: grpLabel,
          alertType: 'tendencia_baja',
          title: 'Tendencia académica a la baja',
          detail: `Bajó de ${row.previousPeriodScore?.toFixed(1)} a ${row.currentPeriodScore?.toFixed(1)} en los últimos cortes`,
          severity: 'medium',
        });
      }

      if (row.coexistenceCount >= 1 || row.improvementObsCount >= 2) {
        list.push({
          id: `alt_obs_${row.student.id}`,
          student: row.student,
          groupName: grpLabel,
          alertType: 'convivencia',
          title: 'Observaciones de convivencia / mejora',
          detail: `${row.coexistenceCount} de convivencia y ${row.improvementObsCount} de mejora registradas`,
          severity: row.coexistenceCount >= 2 ? 'high' : 'medium',
        });
      }
    });
    return list;
  }, [studentAnalytics, passingThreshold]);

  const buildSectionExportHtml = (sectionName: string): string => {
    const kpiHeader = `
      <div class="kpi-box">
        <strong>Sección:</strong> ${sectionName} · 
        <strong>Promedio General:</strong> ${courseAverage !== null ? courseAverage.toFixed(2) : 'Sin notas'} · 
        <strong>Asistencia:</strong> ${overallAttendancePct}% (${overallAbsencePct}% inasistencia) · 
        <strong>En riesgo:</strong> ${studentsAtRisk.length} de ${activeStudents.length} estudiantes
      </div>
    `;

    if (sectionName.includes('Distribución')) {
      return `${kpiHeader}
        <table class="data-table">
          <thead>
            <tr><th>Nivel de Desempeño SIEE</th><th>Cantidad de Estudiantes</th><th>Porcentaje</th></tr>
          </thead>
          <tbody>
            ${(['Superior', 'Alto', 'Básico', 'Bajo'] as NationalScaleLevel[])
              .map((lvl) => {
                const c = distribution[lvl];
                const p =
                  scoredRows.length > 0
                    ? Math.round((c / scoredRows.length) * 100)
                    : 0;
                return `<tr><td><strong>Desempeño ${lvl}</strong></td><td>${c}</td><td>${p}%</td></tr>`;
              })
              .join('')}
          </tbody>
        </table>`;
    }

    if (sectionName.includes('Alertas')) {
      const rows =
        smartAlerts.length === 0
          ? `<tr><td colspan="4">Sin alertas activas para los filtros seleccionados.</td></tr>`
          : smartAlerts
              .map(
                (a, i) =>
                  `<tr><td>${i + 1}</td><td><strong>${a.student.lastName} ${a.student.firstName}</strong> (${a.groupName})</td><td>${a.title}</td><td>${a.detail}</td></tr>`
              )
              .join('');
      return `${kpiHeader}
        <table class="data-table">
          <thead><tr><th>N°</th><th>Estudiante y Grupo</th><th>Tipo de Alerta</th><th>Detalle</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    if (sectionName.includes('Periodos')) {
      return `${kpiHeader}
        <table class="data-table">
          <thead><tr><th>Periodo Académico</th><th>Peso %</th><th>Promedio Académico</th><th>% Asistencia</th></tr></thead>
          <tbody>
            ${periodComparison
              .map(
                (p) =>
                  `<tr><td><strong>${p.period.name}</strong></td><td>${p.period.weightPercentage}%</td><td>${
                    p.averageScore !== null ? p.averageScore.toFixed(2) : '—'
                  }</td><td>${p.attendancePct}%</td></tr>`
              )
              .join('')}
          </tbody>
        </table>`;
    }

    if (sectionName.includes('Grupos')) {
      return `${kpiHeader}
        <table class="data-table">
          <thead><tr><th>Grado y Grupo</th><th>Estudiantes</th><th>Promedio</th><th>% Asistencia</th><th>En Riesgo</th></tr></thead>
          <tbody>
            ${groupComparison
              .map(
                (g) =>
                  `<tr><td><strong>${g.group.gradeName} (${g.group.groupName})</strong></td><td>${g.studentCount}</td><td>${
                    g.averageScore !== null ? g.averageScore.toFixed(2) : '—'
                  }</td><td>${g.attendancePct}%</td><td>${g.riskCount}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>`;
    }

    // Consolidado general, ranking o listado en riesgo
    const targetList = sectionName.includes('Honor')
      ? bestStudents
      : sectionName.includes('Riesgo')
      ? studentsAtRisk.length > 0
        ? studentsAtRisk
        : lowestStudents
      : studentAnalytics;

    const stuRows =
      targetList.length === 0
        ? `<tr><td colspan="6">No hay estudiantes para mostrar en este corte.</td></tr>`
        : targetList
            .map(
              (r, i) => `<tr>
                <td>${i + 1}</td>
                <td><strong>${r.student.lastName} ${r.student.firstName}</strong></td>
                <td>${r.group ? `${r.group.gradeName} (${r.group.groupName})` : '—'}</td>
                <td>${r.score !== null ? r.score.toFixed(2) : 'Pendiente'}</td>
                <td>${r.scaleLevel || '—'}</td>
                <td>${r.attendancePercentage}% (${r.totalAbsences} faltas)</td>
              </tr>`
            )
            .join('');

    return `${kpiHeader}
      <table class="data-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Estudiante</th>
            <th>Grupo</th>
            <th>Promedio</th>
            <th>Desempeño SIEE</th>
            <th>Asistencia y Faltas</th>
          </tr>
        </thead>
        <tbody>${stuRows}</tbody>
      </table>`;
  };

  const renderExportButton = (sectionName: string) => (
    <ExportActionControl
      compact
      label="Exportar o imprimir"
      title={`Análisis Académico · ${sectionName}`}
      filename={`analisis_${sectionName}`}
      profile={teacherProfile}
      getBodyHtml={() => buildSectionExportHtml(sectionName)}
      onNotify={onNotify}
    />
  );

  return (
    <div className="space-y-4">
      {/* Aviso cuando se consulta otro periodo o el acumulado anual */}
      {isConsultingOtherPeriod && globalActivePeriod && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Modo Consulta de Análisis:</strong> Estás analizando{' '}
              <strong>
                {selectedPeriodObj
                  ? selectedPeriodObj.name
                  : 'el Acumulado de Todos los Periodos'}
              </strong>
              . Tu periodo actual de trabajo es{' '}
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

      {/* =====================================================================
          1. ENCABEZADO Y BARRA DE FILTROS MULTIDIMENSIONAL
      ===================================================================== */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-teal-800 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" />
              <span>
                {lockedGroupId
                  ? 'Análisis Exclusivo del Grupo Actual'
                  : lockedGradeName
                  ? `Análisis y Comparativa de Grado ${lockedGradeName}`
                  : 'Panel de Análisis Global y Comparativo'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display mt-1">
              {lockedGroupId
                ? 'Rendimiento, Asistencia y Alertas del Grupo'
                : lockedGradeName
                ? `Consolidado y Comparación de Grupos · Grado ${lockedGradeName}`
                : 'Dashboard Global de Desempeño, Asistencia y Convivencia'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              {lockedGroupId
                ? 'Estadísticas calculadas automáticamente para los estudiantes de este grupo. Toca cualquier alumno para abrir su ficha.'
                : 'Filtra por periodo, área o grupo. Toca cualquier estudiante o alerta para abrir su ficha individual.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {lockedGroupId && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">
                  Periodo:
                </label>
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className={`min-h-[40px] rounded-xl border px-3 py-1.5 text-xs font-bold focus:outline-none ${
                    isConsultingOtherPeriod
                      ? 'border-amber-400 bg-amber-50 text-amber-950'
                      : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-teal-700'
                  }`}
                >
                  {yearPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.weightPercentage}%)
                      {p.id === globalActivePeriod?.id ? ' · Actual' : ''}
                    </option>
                  ))}
                  <option value="ALL">Acumulado Todos los Periodos</option>
                </select>
              </div>
            )}
            {renderExportButton('Consolidado General del Dashboard')}
          </div>
        </div>

        {/* Barra de Filtros (oculta cuando estamos dentro de un grupo específico) */}
        {!lockedGroupId && (
          <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Filter className="w-3 h-3 text-teal-800" />
                Año Lectivo
              </label>
              <select
                value={activeYearId}
                onChange={(e) => {
                  setSelectedYearId(e.target.value);
                  setSelectedGroupId('ALL');
                }}
                className="min-h-[42px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    Año {y.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">
                Periodo Académico
              </label>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-bold focus:outline-none ${
                  isConsultingOtherPeriod
                    ? 'border-amber-400 bg-amber-50 text-amber-950'
                    : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-teal-700'
                }`}
              >
                {yearPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.weightPercentage}%)
                    {p.id === globalActivePeriod?.id ? ' · Actual' : ''}
                  </option>
                ))}
                <option value="ALL">Acumulado Todos los Periodos</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">
                Área / Asignatura
              </label>
              <select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="min-h-[42px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                <option value="ALL">Todas las áreas ({subjects.length})</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {!lockedGradeName && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">
                  Grado Escolar
                </label>
                <select
                  value={effectiveGradeName}
                  onChange={(e) => {
                    setSelectedGradeName(e.target.value);
                    setSelectedGroupId('ALL');
                  }}
                  className="min-h-[42px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-700 focus:outline-none"
                >
                  <option value="ALL">Todos los grados</option>
                  {uniqueGrades.map((gName) => (
                    <option key={gName} value={gName}>
                      Grado {gName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">
                Grupo
              </label>
              <select
                value={effectiveGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="min-h-[42px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                <option value="ALL">Todos los grupos</option>
                {yearGroups
                  .filter(
                    (g) =>
                      effectiveGradeName === 'ALL' ||
                      g.gradeName === effectiveGradeName
                  )
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      Grupo {g.groupName} ({g.gradeName})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          2. INDICADORES CLAVE (PROMEDIO, ASISTENCIA/INASISTENCIA, RIESGO, ALERTAS)
      ===================================================================== */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Promedio del Curso / Filtro</p>
          <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-1">
            {courseAverage !== null ? courseAverage.toFixed(2) : '—'}
          </p>
          <p className="text-xs text-teal-800 mt-1">
            {scoredRows.length} de {activeStudents.length} estudiantes con nota
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Asistencia vs. Inasistencia</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-700">
              {overallAttendancePct}%
            </span>
            <span className="text-xs font-mono text-red-700 font-semibold">
              ({overallAbsencePct}% inasistencia)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-red-100 mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full"
              style={{ width: `${overallAttendancePct}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
          <p className="text-xs font-semibold text-red-900">
            En Riesgo de Perder Asignatura
          </p>
          <p className="text-2xl sm:text-3xl font-bold font-mono text-red-800 mt-1">
            {studentsAtRisk.length}
          </p>
          <p className="text-xs text-red-700 mt-1">
            Nota &lt; {passingThreshold.toFixed(1)} o asistencia &lt; 80%
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
          <p className="text-xs font-semibold text-amber-900">
            Alertas Automáticas Activas
          </p>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-amber-800 mt-1">
            {smartAlerts.length}
          </p>
          <p className="text-xs text-amber-800 mt-1">
            Faltas, tendencia baja, convivencia
          </p>
        </div>
      </section>

      {/* =====================================================================
          3. DISTRIBUCIÓN POR NIVEL DE DESEMPEÑO SIEE Y ALERTAS AUTOMÁTICAS
      ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gráfico de Distribución por Nivel de Desempeño */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                Distribución por Nivel de Desempeño SIEE
              </h2>
              <p className="text-xs text-slate-500">
                Cantidad y proporción de estudiantes en Superior, Alto, Básico y Bajo.
              </p>
            </div>
            {renderExportButton('Distribución por Nivel SIEE')}
          </div>

          <div className="space-y-4 pt-2">
            {(
              [
                {
                  level: 'Superior' as NationalScaleLevel,
                  range: `${superiorMin.toFixed(1)} – ${(teacherProfile?.gradingScaleMax ?? 5.0).toFixed(1)}`,
                  barClass: 'bg-emerald-600',
                  textClass: 'text-emerald-800',
                },
                {
                  level: 'Alto' as NationalScaleLevel,
                  range: `${highMin.toFixed(1)} – ${(superiorMin - 0.1).toFixed(1)}`,
                  barClass: 'bg-teal-700',
                  textClass: 'text-teal-800',
                },
                {
                  level: 'Básico' as NationalScaleLevel,
                  range: `${passingThreshold.toFixed(1)} – ${(highMin - 0.1).toFixed(1)}`,
                  barClass: 'bg-amber-500',
                  textClass: 'text-amber-800',
                },
                {
                  level: 'Bajo' as NationalScaleLevel,
                  range: `${(teacherProfile?.gradingScaleMin ?? 1.0).toFixed(1)} – ${(passingThreshold - 0.1).toFixed(1)}`,
                  barClass: 'bg-red-600',
                  textClass: 'text-red-700',
                },
              ]
            ).map((item) => {
              const count = distribution[item.level];
              const pct =
                scoredRows.length > 0
                  ? Math.round((count / scoredRows.length) * 100)
                  : 0;

              return (
                <div key={item.level} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className={`font-bold ${item.textClass}`}>
                        Desempeño {item.level}
                      </span>
                      <span className="text-slate-400 font-mono ml-2">
                        ({item.range})
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      {count} est. ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-3.5 rounded-xl bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full ${item.barClass} rounded-xl transition-all duration-300`}
                      style={{ width: `${Math.max(pct, count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel de Alertas Automáticas con Enlace Directo a la Ficha del Estudiante */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Alertas Automáticas Tempranas</span>
              </h2>
              <p className="text-xs text-slate-500">
                Muchas faltas, tendencia a la baja, bajo desempeño y convivencia.
              </p>
            </div>
            {renderExportButton('Reporte de Alertas Tempranas')}
          </div>

          {smartAlerts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-600">
              No se detectan alertas críticas con los filtros seleccionados.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[270px] overflow-y-auto pr-1">
              {smartAlerts.map((alt) => (
                <div
                  key={alt.id}
                  className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    alt.severity === 'high'
                      ? 'border-red-200 bg-red-50/40'
                      : 'border-amber-200 bg-amber-50/40'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 font-display truncate">
                        {alt.student.lastName} {alt.student.firstName}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        · {alt.groupName}
                      </span>
                    </div>
                    <p
                      className={`text-xs font-bold ${
                        alt.severity === 'high'
                          ? 'text-red-800'
                          : 'text-amber-900'
                      }`}
                    >
                      {alt.title}
                    </p>
                    <p className="text-[11px] text-slate-600">{alt.detail}</p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedStudentForModal(alt.student)}
                    leftIcon={<Eye className="w-3.5 h-3.5 text-teal-800" />}
                    className="text-xs px-3 shrink-0 bg-white"
                  >
                    Ver ficha
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          4. COMPARACIÓN ENTRE PERIODOS Y COMPARACIÓN ENTRE GRUPOS
      ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Comparación entre Periodos */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                Comparación entre Periodos Académicos
              </h2>
              <p className="text-xs text-slate-500">
                Evolución del promedio académico y porcentaje de asistencia por periodo.
              </p>
            </div>
            {renderExportButton('Comparación entre Periodos')}
          </div>

          <div className="space-y-3 pt-1">
            {periodComparison.map((item) => {
              const maxScale = teacherProfile?.gradingScaleMax ?? 5.0;
              const scorePct =
                item.averageScore !== null
                  ? Math.min(100, Math.round((item.averageScore / maxScale) * 100))
                  : 0;

              return (
                <div
                  key={item.period.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">
                      {item.period.name} ({item.period.weightPercentage}%)
                    </span>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="font-bold text-teal-900">
                        Prom:{' '}
                        {item.averageScore !== null
                          ? item.averageScore.toFixed(2)
                          : 'Sin notas'}
                      </span>
                      <span className="text-emerald-800 font-semibold">
                        Asist: {item.attendancePct}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-teal-700 rounded-full"
                      style={{ width: `${scorePct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparación entre Grupos */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                Comparación entre Grupos
              </h2>
              <p className="text-xs text-slate-500">
                Contrasta promedio, asistencia y estudiantes en riesgo por cada grupo.
              </p>
            </div>
            {renderExportButton('Comparación entre Grupos')}
          </div>

          {groupComparison.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              No hay grupos creados para este año lectivo.
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {groupComparison.map((gItem) => {
                const maxScale = teacherProfile?.gradingScaleMax ?? 5.0;
                const scorePct =
                  gItem.averageScore !== null
                    ? Math.min(
                        100,
                        Math.round((gItem.averageScore / maxScale) * 100)
                      )
                    : 0;

                return (
                  <div
                    key={gItem.group.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-900">
                        Grado {gItem.group.gradeName} · Grupo{' '}
                        {gItem.group.groupName} ({gItem.studentCount} est.)
                      </span>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="font-bold text-slate-900">
                          Prom:{' '}
                          {gItem.averageScore !== null
                            ? gItem.averageScore.toFixed(2)
                            : '—'}
                        </span>
                        <span className="text-emerald-800">
                          Asist: {gItem.attendancePct}%
                        </span>
                        <span className="text-red-700 font-semibold">
                          Riesgo: {gItem.riskCount}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-teal-800 rounded-full"
                        style={{ width: `${scorePct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          5. RANKING DE MEJORES ESTUDIANTES Y ESTUDIANTES EN RIESGO / BAJO DESEMPEÑO
      ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Mejores Estudiantes */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-700" />
                <span>Ranking · Mejores Estudiantes</span>
              </h2>
              <p className="text-xs text-slate-500">
                Cuadro de honor por desempeño académico y asistencia.
              </p>
            </div>
            {renderExportButton('Cuadro de Honor y Mejores Promedios')}
          </div>

          {bestStudents.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Registra calificaciones en el Módulo 3 para ver el ranking de mejores promedios.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
              {bestStudents.map((row, idx) => (
                <div
                  key={row.student.id}
                  className="p-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentForModal(row.student)}
                        className="font-bold text-slate-900 hover:text-teal-800 truncate block text-left cursor-pointer"
                      >
                        {row.student.lastName} {row.student.firstName}
                      </button>
                      <p className="text-slate-500">
                        {row.group
                          ? `${row.group.gradeName} (${row.group.groupName})`
                          : ''}{' '}
                        · Asistencia: {row.attendancePercentage}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right font-mono">
                      <p className="text-sm font-bold text-emerald-800">
                        {row.score?.toFixed(2)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {row.scaleLevel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentForModal(row.student)}
                      className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 text-teal-800 hover:bg-teal-50 font-semibold cursor-pointer"
                    >
                      Ficha
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Estudiantes con Desempeño más Bajo y En Riesgo de Perder */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-700" />
                <span>Estudiantes en Riesgo / Menor Promedio</span>
              </h2>
              <p className="text-xs text-slate-500">
                Prioridad para planes de apoyo, nivelación y citación a acudientes.
              </p>
            </div>
            {renderExportButton('Listado de Estudiantes en Riesgo')}
          </div>

          {lowestStudents.length === 0 && studentsAtRisk.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Aún no hay estudiantes con calificaciones registradas o en riesgo.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
              {(studentsAtRisk.length > 0 ? studentsAtRisk : lowestStudents)
                .slice(0, 6)
                .map((row, idx) => (
                  <div
                    key={row.student.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-7 w-7 rounded-lg bg-red-50 border border-red-200 text-red-800 font-mono font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStudentForModal(row.student)
                          }
                          className="font-bold text-slate-900 hover:text-teal-800 truncate block text-left cursor-pointer"
                        >
                          {row.student.lastName} {row.student.firstName}
                        </button>
                        <p className="text-slate-500">
                          {row.group
                            ? `${row.group.gradeName} (${row.group.groupName})`
                            : ''}{' '}
                          · Asistencia: {row.attendancePercentage}% (
                          {row.totalAbsences} faltas)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right font-mono">
                        <p
                          className={`text-sm font-bold ${
                            row.score !== null && row.score < passingThreshold
                              ? 'text-red-700'
                              : 'text-amber-800'
                          }`}
                        >
                          {row.score !== null ? row.score.toFixed(2) : 'S/N'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {row.scaleLevel || 'Riesgo'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedStudentForModal(row.student)}
                        className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 text-teal-800 hover:bg-teal-50 font-semibold cursor-pointer"
                      >
                        Ficha
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* Modal de Ficha Individual al hacer clic desde cualquier alerta o ranking */}
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
    </div>
  );
};
