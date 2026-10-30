import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Printer,
  FileDown,
  Building2,
  Users,
  User,
  CheckCircle2,
  Eye,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
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
  NationalScaleLevel,
} from '../../types/schema';
import {
  calculateStudentAttendanceSummary,
  calculateStudentPeriodGrade,
  formatScaleLabel,
  formatCOP,
} from '../../utils/academicCalculations';
import {
  exportToWordDoc,
  printOrSavePdf,
} from '../../utils/documentExporter';
import { getObservationCategoryLabel } from '../module4/CourseObserverPanel';
import { Button, InputField } from '../ui/DesignSystem';

interface ReportsAndBulletinsModuleProps {
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
  lockedCourseId?: string;
  onOpenSettings: () => void;
  onNotify: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

type Module6Section = 'boletin' | 'reportes';

type ReportKind =
  | 'listado_estudiantes'
  | 'planilla_asistencia'
  | 'consolidado_notas'
  | 'analisis_graficos'
  | 'reporte_comportamiento'
  | 'reporte_recaudos';

export const ReportsAndBulletinsModule: React.FC<
  ReportsAndBulletinsModuleProps
> = ({
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
  lockedCourseId,
  onOpenSettings,
  onNotify,
}) => {
  const [activeSection, setActiveSection] = useState<Module6Section>('boletin');

  const activeYear = years.find((y) => y.isActive) || years[0] || null;
  const [selectedYearId, setSelectedYearId] = useState<string>(
    activeYear?.id || ''
  );

  const yearPeriods = useMemo(
    () =>
      periods
        .filter((p) => !selectedYearId || p.academicYearId === selectedYearId)
        .sort((a, b) => a.number - b.number),
    [periods, selectedYearId]
  );

  const activeCourses = useMemo(
    () =>
      courses.filter(
        (c) =>
          !c.archived &&
          (!selectedYearId || c.academicYearId === selectedYearId)
      ),
    [courses, selectedYearId]
  );

  const globalActivePeriod = useMemo(
    () => yearPeriods.find((p) => p.isActive) || yearPeriods[0] || null,
    [yearPeriods]
  );

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    globalActivePeriod?.id || ''
  );

  // Sincronizar automáticamente con el Periodo Actual al entrar o cambiar el periodo global
  useEffect(() => {
    if (globalActivePeriod?.id) {
      setSelectedPeriodId(globalActivePeriod.id);
    }
  }, [globalActivePeriod?.id, lockedCourseId]);

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    lockedCourseId || activeCourses[0]?.id || ''
  );

  // Configuración del Boletín Formal para Padres
  const [generationMode, setGenerationMode] = useState<'individual' | 'masivo'>(
    'individual'
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [generalRecommendation, setGeneralRecommendation] = useState<string>(
    'Se recomienda mantener hábitos diarios de lectura y repaso en casa, y asistir puntualmente a las clases y citaciones de seguimiento académico.'
  );

  // Configuración del Centro de Reportes (6 tipos)
  const [reportKind, setReportKind] = useState<ReportKind>(
    'listado_estudiantes'
  );

  const currentYear =
    years.find((y) => y.id === selectedYearId) || activeYear || null;
  const currentPeriod =
    yearPeriods.find((p) => p.id === selectedPeriodId) ||
    globalActivePeriod ||
    yearPeriods[0] ||
    null;

  const isConsultingOtherPeriod = Boolean(
    globalActivePeriod &&
      currentPeriod &&
      currentPeriod.id !== globalActivePeriod.id
  );
  const currentCourse =
    (lockedCourseId
      ? activeCourses.find((c) => c.id === lockedCourseId)
      : null) ||
    activeCourses.find((c) => c.id === selectedCourseId) ||
    activeCourses[0] ||
    null;
  const currentGroup = groups.find(
    (g) => g.id === currentCourse?.gradeGroupId
  );

  const courseStudents = useMemo(() => {
    if (!currentCourse) return [];
    return students
      .filter(
        (s) =>
          s.gradeGroupId === currentCourse.gradeGroupId &&
          s.status === 'Activo'
      )
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`,
          'es-CO'
        )
      );
  }, [students, currentCourse]);

  const effectiveStudent =
    courseStudents.find((s) => s.id === selectedStudentId) ||
    courseStudents[0] ||
    null;

  // Cursos asociados al mismo grupo para incluir todas las áreas en el Boletín Formal
  const groupCourses = useMemo(() => {
    if (!currentCourse) return [];
    return activeCourses.filter(
      (c) => c.gradeGroupId === currentCourse.gradeGroupId
    );
  }, [activeCourses, currentCourse]);

  /**
   * Construye el HTML de un Boletín Formal individual listo para imprimir / exportar
   */
  const buildSingleStudentBulletinHtml = (
    stu: Student,
    includePageBreakAfter: boolean
  ): string => {
    const pId = currentPeriod?.id || '';
    const stuAtt = attendanceRecords.filter(
      (r) =>
        r.studentId === stu.id &&
        (!pId || r.periodId === pId) &&
        groupCourses.some((gc) => gc.id === r.courseId)
    );
    const attSummary = calculateStudentAttendanceSummary(stu.id, stuAtt);

    // Detalle por cada área/curso del grupo
    const subjectsHtml = groupCourses
      .map((crs) => {
        const subj = subjects.find((s) => s.id === crs.areaSubjectId);
        const cCats = categories.filter(
          (c) => c.courseId === crs.id && (!pId || c.periodId === pId)
        );
        const cActs = activities.filter(
          (a) => a.courseId === crs.id && (!pId || a.periodId === pId)
        );
        const cEnts = gradeEntries.filter(
          (e) => e.courseId === crs.id && (!pId || e.periodId === pId)
        );

        const gradeSum = calculateStudentPeriodGrade(
          stu.id,
          cCats,
          cActs,
          cEnts,
          teacherProfile
        );

        const activitiesRows =
          cActs.length === 0
            ? `<tr><td colspan="4" style="color:#64748b;">Sin actividades registradas en este periodo.</td></tr>`
            : cActs
                .map((act) => {
                  const cat = cCats.find((c) => c.id === act.categoryId);
                  const entry = cEnts.find(
                    (e) => e.activityId === act.id && e.studentId === stu.id
                  );
                  return `<tr>
                    <td>${cat ? `${cat.name} (${cat.weightPercentage}%)` : 'General'}</td>
                    <td><strong>${act.title}</strong></td>
                    <td>${act.dueDate || '—'}</td>
                    <td style="text-align:right;font-weight:bold;">${
                      entry
                        ? `${entry.score.toFixed(1)} (${entry.nationalScaleLevel})`
                        : 'Pendiente'
                    }</td>
                  </tr>`;
                })
                .join('');

        return `
          <div style="margin-bottom:14px;border:1px solid #cbd5e1;border-radius:6px;padding:10px;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
              <tr>
                <td style="border:none;padding:0;">
                  <strong style="font-size:11pt;color:#0f172a;">
                    Área / Asignatura: ${subj?.name || crs.displayName}
                  </strong>
                  <span style="font-size:9pt;color:#475569;margin-left:8px;">
                    (I.H.S: ${subj?.weeklyHours || 4} horas/semana)
                  </span>
                </td>
                <td style="border:none;padding:0;text-align:right;">
                  <span style="font-size:10.5pt;font-weight:bold;color:#115e59;">
                    Definitiva Periodo: ${
                      gradeSum.finalPeriodScore !== null
                        ? gradeSum.finalPeriodScore.toFixed(2)
                        : 'Pendiente'
                    }
                    ${
                      gradeSum.scaleLevel
                        ? ` · Desempeño ${formatScaleLabel(
                            gradeSum.scaleLevel,
                            teacherProfile
                          )}`
                        : ''
                    }
                  </span>
                </td>
              </tr>
            </table>
            <table class="data-table" style="margin-top:4px;margin-bottom:2px;">
              <thead>
                <tr>
                  <th style="width:26%;">Categoría y Peso</th>
                  <th style="width:38%;">Taller, Quiz, Evaluación o Actividad</th>
                  <th style="width:16%;">Fecha</th>
                  <th style="width:20%;text-align:right;">Valor / Nota</th>
                </tr>
              </thead>
              <tbody>${activitiesRows}</tbody>
            </table>
          </div>
        `;
      })
      .join('');

    // Observaciones del estudiante en el periodo
    const stuObs = observations.filter(
      (o) => o.studentId === stu.id && (!pId || o.periodId === pId)
    );
    const obsHtml =
      stuObs.length === 0
        ? `<p style="font-size:9.5pt;color:#475569;margin:4px 0;">El estudiante mantuvo un comportamiento adecuado durante el periodo sin llamados de atención críticos.</p>`
        : `<ul style="margin:4px 0 8px 18px;padding:0;font-size:9.5pt;">
            ${stuObs
              .map((o) => {
                const info = getObservationCategoryLabel(o.type);
                return `<li style="margin-bottom:4px;">
                  <strong>[${o.date} · ${info.shortLabel}]:</strong> ${o.description}
                  ${
                    o.commitments
                      ? ` <em>(Compromiso: ${o.commitments})</em>`
                      : ''
                  }
                </li>`;
              })
              .join('')}
          </ul>`;

    return `
      <div class="${includePageBreakAfter ? 'page-break' : ''}">
        <div class="kpi-box">
          <table style="width:100%;border-collapse:collapse;font-size:9.5pt;">
            <tr>
              <td style="border:none;padding:2px 4px;width:55%;">
                <strong>Estudiante:</strong> ${stu.lastName} ${stu.firstName}<br/>
                <strong>Documento:</strong> ${stu.documentType} ${stu.documentNumber || 'Sin registrar'}<br/>
                <strong>Acudiente:</strong> ${stu.guardianName || 'Sin registrar'} ${
                  stu.guardianPhone ? `· Tel: ${stu.guardianPhone}` : ''
                }
              </td>
              <td style="border:none;padding:2px 4px;width:45%;">
                <strong>Año Lectivo:</strong> ${currentYear?.name || '2026'} · <strong>Periodo:</strong> ${
                  currentPeriod?.name || 'Periodo 1'
                }<br/>
                <strong>Grado y Grupo:</strong> ${
                  currentGroup
                    ? `Grado ${currentGroup.gradeName} · Grupo ${currentGroup.groupName} (${currentGroup.shift})`
                    : currentCourse?.displayName || ''
                }<br/>
                <strong>Escala Nacional SIEE:</strong> ${(
                  teacherProfile?.gradingScaleMin ?? 1.0
                ).toFixed(1)} a ${(
                  teacherProfile?.gradingScaleMax ?? 5.0
                ).toFixed(1)} (Aprueba en ${(
                  teacherProfile?.basicMin ??
                  teacherProfile?.passingScore ??
                  3.0
                ).toFixed(1)})
              </td>
            </tr>
          </table>
        </div>

        <div class="section-heading">1. Resumen de Asistencia del Periodo</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Clases Presentes</th>
              <th>Faltas Justificadas (Con Excusa)</th>
              <th>Faltas Injustificadas (Sin Excusa)</th>
              <th>Llegadas Tarde</th>
              <th>Porcentaje de Asistencia</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${attSummary.presentCount}</td>
              <td>${attSummary.excusedAbsenceCount}</td>
              <td>${attSummary.unexcusedAbsenceCount}</td>
              <td>${attSummary.lateCount}</td>
              <td><strong>${attSummary.attendancePercentage}%</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="section-heading">2. Detalle de Calificaciones por Actividades y Nota Definitiva SIEE</div>
        ${subjectsHtml}

        <div class="section-heading">3. Observaciones de Actitud, Comportamiento y Recomendaciones</div>
        <div class="kpi-box">
          ${obsHtml}
          ${
            generalRecommendation.trim()
              ? `<p style="font-size:9.5pt;margin:6px 0 0 0;"><strong>Recomendación del Docente:</strong> ${generalRecommendation.trim()}</p>`
              : ''
          }
        </div>

        <table class="signature-table">
          <tr>
            <td>
              <div class="sig-line">${teacherProfile?.fullName || 'Firma del Docente Titular'}</div>
              <div>Docente / Director de Grupo ${
                teacherProfile?.documentId
                  ? `· ${teacherProfile.documentId}`
                  : ''
              }</div>
            </td>
            <td>
              <div class="sig-line">${stu.guardianName || 'Firma del Padre de Familia o Acudiente'}</div>
              <div>Padre de Familia o Acudiente</div>
            </td>
          </tr>
        </table>
      </div>
    `;
  };

  const buildFullBulletinHtml = (): string => {
    if (!currentCourse || courseStudents.length === 0) {
      return '<p>No hay estudiantes activos en el curso seleccionado para generar el boletín.</p>';
    }

    if (generationMode === 'individual') {
      if (!effectiveStudent) return '<p>Selecciona un estudiante.</p>';
      return buildSingleStudentBulletinHtml(effectiveStudent, false);
    }

    return courseStudents
      .map((stu, idx) =>
        buildSingleStudentBulletinHtml(stu, idx < courseStudents.length - 1)
      )
      .join('<hr style="margin:28px 0;border:none;border-top:2px dashed #cbd5e1;" />');
  };

  /**
   * Construye el HTML de cualquiera de los 6 Reportes del Centro de Reportes
   */
  const buildSelectedReportHtml = (): string => {
    if (!currentCourse) {
      return '<p>Selecciona o crea primero un curso en el Módulo 1.</p>';
    }
    const pId = currentPeriod?.id || '';

    // 1. LISTADO DE ESTUDIANTES
    if (reportKind === 'listado_estudiantes') {
      const customCols = customFields.slice(0, 2);
      const rows = courseStudents
        .map(
          (s, i) => `<tr>
            <td>${i + 1}</td>
            <td><strong>${s.lastName} ${s.firstName}</strong></td>
            <td>${s.documentType} ${s.documentNumber || '—'}</td>
            <td>${s.guardianName || '—'}</td>
            <td>${s.guardianPhone || '—'}</td>
            ${customCols
              .map(
                (cf) =>
                  `<td>${
                    s.customValues?.[cf.fieldKey] !== undefined
                      ? String(s.customValues?.[cf.fieldKey])
                      : '—'
                  }</td>`
              )
              .join('')}
          </tr>`
        )
        .join('');
      return `
        <div class="kpi-box">
          <strong>Curso:</strong> ${currentCourse.displayName} · 
          <strong>Total Estudiantes Activos:</strong> ${courseStudents.length}
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Apellidos y Nombres</th>
              <th>Documento</th>
              <th>Acudiente</th>
              <th>Teléfono</th>
              ${customCols.map((cf) => `<th>${cf.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    // 2. PLANILLA DE ASISTENCIA
    if (reportKind === 'planilla_asistencia') {
      const rows = courseStudents
        .map((s, i) => {
          const recs = attendanceRecords.filter(
            (r) =>
              r.courseId === currentCourse.id &&
              r.studentId === s.id &&
              (!pId || r.periodId === pId)
          );
          const sum = calculateStudentAttendanceSummary(s.id, recs);
          return `<tr>
            <td>${i + 1}</td>
            <td><strong>${s.lastName} ${s.firstName}</strong></td>
            <td>${sum.presentCount}</td>
            <td>${sum.excusedAbsenceCount}</td>
            <td>${sum.unexcusedAbsenceCount}</td>
            <td>${sum.lateCount}</td>
            <td><strong>${sum.attendancePercentage}%</strong></td>
          </tr>`;
        })
        .join('');
      return `
        <div class="kpi-box">
          <strong>Curso:</strong> ${currentCourse.displayName} · 
          <strong>Periodo:</strong> ${currentPeriod?.name || 'Todos'}
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Estudiante</th>
              <th>Presentes</th>
              <th>Ausente con Excusa</th>
              <th>Ausente sin Excusa</th>
              <th>Llegadas Tarde</th>
              <th>% Asistencia</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    // 3. CONSOLIDADO DE NOTAS SIEE
    if (reportKind === 'consolidado_notas') {
      const cCats = categories.filter(
        (c) => c.courseId === currentCourse.id && (!pId || c.periodId === pId)
      );
      const cActs = activities.filter(
        (a) => a.courseId === currentCourse.id && (!pId || a.periodId === pId)
      );
      const cEnts = gradeEntries.filter(
        (e) => e.courseId === currentCourse.id && (!pId || e.periodId === pId)
      );

      const rows = courseStudents
        .map((s, i) => {
          const sum = calculateStudentPeriodGrade(
            s.id,
            cCats,
            cActs,
            cEnts,
            teacherProfile
          );
          return `<tr>
            <td>${i + 1}</td>
            <td><strong>${s.lastName} ${s.firstName}</strong></td>
            ${cCats
              .map((cat) => {
                const val = sum.categoryScores[cat.id];
                return `<td>${val !== null && val !== undefined ? val.toFixed(1) : '—'}</td>`;
              })
              .join('')}
            <td><strong>${
              sum.finalPeriodScore !== null
                ? sum.finalPeriodScore.toFixed(2)
                : 'Pendiente'
            }</strong></td>
            <td>${
              sum.scaleLevel
                ? formatScaleLabel(sum.scaleLevel, teacherProfile)
                : '—'
            }</td>
          </tr>`;
        })
        .join('');

      return `
        <div class="kpi-box">
          <strong>Curso:</strong> ${currentCourse.displayName} · 
          <strong>Periodo:</strong> ${currentPeriod?.name || 'Activo'} · 
          <strong>Categorías evaluadas:</strong> ${cCats.length} (${cActs.length} actividades)
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Estudiante</th>
              ${cCats
                .map((cat) => `<th>${cat.name} (${cat.weightPercentage}%)</th>`)
                .join('')}
              <th>Definitiva Periodo</th>
              <th>Escala Nacional SIEE</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    // 4. ANÁLISIS CON GRÁFICOS Y DISTRIBUCIÓN SIEE
    if (reportKind === 'analisis_graficos') {
      const cCats = categories.filter(
        (c) => c.courseId === currentCourse.id && (!pId || c.periodId === pId)
      );
      const cActs = activities.filter(
        (a) => a.courseId === currentCourse.id && (!pId || a.periodId === pId)
      );
      const cEnts = gradeEntries.filter(
        (e) => e.courseId === currentCourse.id && (!pId || e.periodId === pId)
      );

      const dist: Record<NationalScaleLevel, number> = {
        Superior: 0,
        Alto: 0,
        Básico: 0,
        Bajo: 0,
      };
      let scoreSum = 0;
      let scoredCount = 0;

      courseStudents.forEach((s) => {
        const res = calculateStudentPeriodGrade(
          s.id,
          cCats,
          cActs,
          cEnts,
          teacherProfile
        );
        if (res.finalPeriodScore !== null && res.scaleLevel) {
          dist[res.scaleLevel] += 1;
          scoreSum += res.finalPeriodScore;
          scoredCount += 1;
        }
      });

      const avg =
        scoredCount > 0 ? (scoreSum / scoredCount).toFixed(2) : 'Sin notas';

      const barsHtml = (
        ['Superior', 'Alto', 'Básico', 'Bajo'] as NationalScaleLevel[]
      )
        .map((lvl) => {
          const count = dist[lvl];
          const pct =
            scoredCount > 0 ? Math.round((count / scoredCount) * 100) : 0;
          return `<tr>
            <td><strong>Desempeño ${lvl}</strong></td>
            <td>${count} estudiantes</td>
            <td>${pct}%</td>
            <td style="width:45%;">
              <div style="background:#e2e8f0;height:14px;border-radius:4px;overflow:hidden;">
                <div style="background:#115e59;height:14px;width:${Math.max(
                  pct,
                  4
                )}%;"></div>
              </div>
            </td>
          </tr>`;
        })
        .join('');

      return `
        <div class="kpi-box">
          <strong>Curso:</strong> ${currentCourse.displayName} · 
          <strong>Periodo:</strong> ${currentPeriod?.name || 'Activo'} · 
          <strong>Promedio del Curso:</strong> ${avg} · 
          <strong>Estudiantes Evaluados:</strong> ${scoredCount} de ${courseStudents.length}
        </div>
        <div class="section-heading">Distribución Gráfica por Nivel de Desempeño SIEE</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Nivel SIEE</th>
              <th>Estudiantes</th>
              <th>Porcentaje</th>
              <th>Gráfico Proporcional</th>
            </tr>
          </thead>
          <tbody>${barsHtml}</tbody>
        </table>
      `;
    }

    // 5. REPORTE DE COMPORTAMIENTO Y OBSERVADOR
    if (reportKind === 'reporte_comportamiento') {
      const crsObs = observations.filter(
        (o) =>
          o.gradeGroupId === currentCourse.gradeGroupId &&
          (!pId || o.periodId === pId)
      );
      const rows =
        crsObs.length === 0
          ? `<tr><td colspan="5">Sin observaciones registradas en este periodo.</td></tr>`
          : crsObs
              .map((o, i) => {
                const stu = students.find((s) => s.id === o.studentId);
                const info = getObservationCategoryLabel(o.type);
                return `<tr>
                  <td>${i + 1}</td>
                  <td>${o.date}</td>
                  <td><strong>${stu ? `${stu.lastName} ${stu.firstName}` : '—'}</strong></td>
                  <td>${info.shortLabel} (${info.detailLabel})</td>
                  <td>${o.description} ${
                    o.commitments ? `<br/><em>Compromiso: ${o.commitments}</em>` : ''
                  }</td>
                </tr>`;
              })
              .join('');
      return `
        <div class="kpi-box">
          <strong>Curso:</strong> ${currentCourse.displayName} · 
          <strong>Total Observaciones:</strong> ${crsObs.length}
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Fecha</th>
              <th>Estudiante</th>
              <th>Categoría</th>
              <th>Descripción y Acuerdos con Acudiente</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    // 6. REPORTE DE RECAUDOS Y ENTREGAS
    const crsCols = eventCollections.filter(
      (ec) => ec.gradeGroupId === currentCourse.gradeGroupId
    );
    if (crsCols.length === 0) {
      return '<p>No hay controles de recaudo o entrega de documentos en este grupo.</p>';
    }

    return crsCols
      .map((col) => {
        const items = eventPaymentItems.filter(
          (i) => i.eventCollectionId === col.id
        );
        const totalPaid = items.reduce(
          (acc, i) => acc + (i.amountPaidCOP || 0),
          0
        );
        const rows = courseStudents
          .map((s, idx) => {
            const it = items.find((i) => i.studentId === s.id);
            return `<tr>
              <td>${idx + 1}</td>
              <td><strong>${s.lastName} ${s.firstName}</strong></td>
              <td>${it?.paymentStatus || 'Pendiente'}</td>
              <td>${
                col.targetAmountCOP > 0
                  ? formatCOP(it?.amountPaidCOP || 0)
                  : it?.paymentStatus === 'Pagado / Cumplido'
                  ? 'Entregó'
                  : 'No entregó'
              }</td>
              <td>${it?.paymentDate || '—'}</td>
              <td>${it?.note || '—'}</td>
            </tr>`;
          })
          .join('');

        return `
          <div class="section-heading">${col.title} (${col.eventType})</div>
          <div class="kpi-box">
            ${
              col.targetAmountCOP > 0
                ? `<strong>Valor por estudiante:</strong> ${formatCOP(
                    col.targetAmountCOP
                  )} · <strong>Total Recaudado:</strong> ${formatCOP(totalPaid)}`
                : `<strong>Tipo:</strong> Control de entrega`
            }
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Estudiante</th>
                <th>Estado</th>
                <th>Valor / Cumplimiento</th>
                <th>Fecha</th>
                <th>Historial / Nota</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `;
      })
      .join('');
  };

  return (
    <div className="space-y-4">
      {/* Aviso cuando se consulta o genera boletín de otro periodo distinto al Periodo Actual */}
      {isConsultingOtherPeriod && globalActivePeriod && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Modo Consulta de Boletines y Reportes:</strong> Estás generando documentos de{' '}
              <strong>{currentPeriod?.name}</strong>. Tu periodo actual de trabajo es{' '}
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

      {/* Encabezado y Selector de Modo: Boletín Formal vs Centro de Reportes */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-teal-800 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                Reportes Exportables (PDF / Word) y Boletín Formal para Padres
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display mt-1">
              Boletines Oficiales y Centro de Impresión
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Genera boletines individuales o masivos con membrete institucional, o exporta cualquier planilla en PDF y Word.
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenSettings}
            leftIcon={<Building2 className="w-4 h-4 text-teal-800" />}
          >
            {teacherProfile?.institutionLogoUrl
              ? 'Editar Institución y Escudo'
              : 'Subir Escudo / Logo del Colegio'}
          </Button>
        </div>

        {/* Pestañas principales del Módulo 6 */}
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('boletin')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors ${
              activeSection === 'boletin'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>1. Boletín Formal para Padres de Familia (Individual o Masivo)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('reportes')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors ${
              activeSection === 'reportes'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>2. Centro de Reportes (Listados, Asistencia, Notas, Análisis, Convivencia, Recaudos)</span>
          </button>
        </div>

        {/* Selectores de Año, Periodo y Curso */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">
              Año Lectivo
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="min-h-[42px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
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
              value={currentPeriod?.id || ''}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-bold ${
                isConsultingOtherPeriod
                  ? 'border-amber-400 bg-amber-50 text-amber-950'
                  : 'border-slate-300 bg-slate-50 text-slate-900'
              }`}
            >
              {yearPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.weightPercentage}%)
                  {p.id === globalActivePeriod?.id ? ' · Actual' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">
              Curso / Grupo
            </label>
            <select
              value={currentCourse?.id || ''}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="min-h-[42px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
            >
              {activeCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECCIÓN 1: BOLETÍN FORMAL PARA PADRES DE FAMILIA CON VISTA PREVIA
      ===================================================================== */}
      {activeSection === 'boletin' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-4 space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 block">
                  Modo de Generación del Boletín
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGenerationMode('individual')}
                    className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      generationMode === 'individual'
                        ? 'border-teal-800 bg-teal-800 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>Individual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenerationMode('masivo')}
                    className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      generationMode === 'masivo'
                        ? 'border-teal-800 bg-teal-800 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Masivo ({courseStudents.length})</span>
                  </button>
                </div>
              </div>

              {generationMode === 'individual' && (
                <div className="lg:col-span-4 flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Seleccionar Estudiante del Curso
                  </label>
                  <select
                    value={effectiveStudent?.id || ''}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="min-h-[42px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    {courseStudents.map((stu) => (
                      <option key={stu.id} value={stu.id}>
                        {stu.lastName} {stu.firstName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div
                className={`${
                  generationMode === 'individual'
                    ? 'lg:col-span-4'
                    : 'lg:col-span-8'
                } flex flex-wrap items-center justify-end gap-2.5`}
              >
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    printOrSavePdf({
                      title: 'INFORME PERIÓDICO DE EVALUACIÓN Y DESEMPEÑO (BOLETÍN)',
                      subtitle: `${
                        generationMode === 'masivo'
                          ? `Lote Completo del Curso (${courseStudents.length} estudiantes)`
                          : `${effectiveStudent?.lastName || ''} ${
                              effectiveStudent?.firstName || ''
                            }`
                      }`,
                      filename: `boletin_${
                        generationMode === 'masivo'
                          ? currentCourse?.displayName || 'curso'
                          : `${effectiveStudent?.lastName || 'estudiante'}`
                      }`,
                      profile: teacherProfile,
                      bodyHtml: buildFullBulletinHtml(),
                    });
                    onNotify(
                      'Boletín listo para imprimir / PDF',
                      'Se abrió la vista oficial de impresión con formato de página carta.'
                    );
                  }}
                  leftIcon={<Printer className="w-4 h-4" />}
                >
                  {generationMode === 'masivo'
                    ? `Imprimir / PDF Todo el Curso (${courseStudents.length})`
                    : 'Imprimir / Guardar PDF'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    exportToWordDoc({
                      title: 'INFORME PERIÓDICO DE EVALUACIÓN Y DESEMPEÑO (BOLETÍN)',
                      subtitle: `${currentCourse?.displayName || ''} · ${
                        currentPeriod?.name || ''
                      }`,
                      filename: `boletin_${
                        generationMode === 'masivo'
                          ? currentCourse?.displayName || 'curso'
                          : `${effectiveStudent?.lastName || 'estudiante'}`
                      }`,
                      profile: teacherProfile,
                      bodyHtml: buildFullBulletinHtml(),
                    });
                    onNotify(
                      'Boletín descargado en Word',
                      'Se descargó el archivo .doc editable con tablas y firmas.'
                    );
                  }}
                  leftIcon={<FileDown className="w-4 h-4 text-teal-800" />}
                >
                  Descargar en Word (.doc)
                </Button>
              </div>
            </div>

            <InputField
              label="Observación / Recomendación general del docente al pie del boletín"
              value={generalRecommendation}
              onChange={(e) => setGeneralRecommendation(e.target.value)}
              placeholder="Escribe una recomendación general para los padres de familia..."
            />
          </div>

          {/* Vista Previa Real en Pantalla del Boletín Formal */}
          <div className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between text-xs">
              <span className="font-semibold inline-flex items-center gap-2">
                <Eye className="w-4 h-4 text-teal-300" />
                Vista Previa Oficial del Boletín para Padres de Familia (
                {generationMode === 'masivo'
                  ? `Mostrando ${courseStudents.length} boletines del curso`
                  : effectiveStudent
                  ? `${effectiveStudent.lastName} ${effectiveStudent.firstName}`
                  : 'Sin estudiantes'}
                )
              </span>
              <span className="font-mono text-slate-300">
                Formato Hoja Carta · Decreto 1290 SIEE
              </span>
            </div>

            <div className="p-6 sm:p-8 bg-slate-100/70">
              <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
                {/* Encabezado Institucional en Vista Previa */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-teal-800 pb-4">
                  <div className="flex items-center gap-4">
                    {teacherProfile?.institutionLogoUrl ? (
                      <img
                        src={teacherProfile.institutionLogoUrl}
                        alt="Escudo"
                        referrerPolicy="no-referrer"
                        className="h-16 w-16 rounded-xl object-contain border border-slate-200 p-1"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="h-16 w-16 rounded-xl border-2 border-dashed border-teal-700 bg-teal-50/50 text-teal-900 text-[10px] font-bold flex flex-col items-center justify-center p-1 text-center cursor-pointer hover:bg-teal-100"
                      >
                        <Building2 className="w-5 h-5 mb-0.5" />
                        <span>Subir Logo</span>
                      </button>
                    )}
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 font-display uppercase">
                        {teacherProfile?.institutionName ||
                          'Institución Educativa Oficial'}
                      </h2>
                      <p className="text-xs text-slate-600">
                        {teacherProfile?.institutionCity || 'Colombia'}
                        {teacherProfile?.institutionDane
                          ? ` · DANE: ${teacherProfile.institutionDane}`
                          : ''}
                        {teacherProfile?.institutionNit
                          ? ` · NIT: ${teacherProfile.institutionNit}`
                          : ''}
                      </p>
                      <p className="text-xs font-bold text-teal-800 mt-0.5">
                        INFORME PERIÓDICO DE EVALUACIÓN Y DESEMPEÑO ·{' '}
                        {currentPeriod?.name.toUpperCase() || 'PERIODO'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cuerpo renderizado del Boletín */}
                <div
                  className="text-xs text-slate-800 overflow-x-auto"
                  dangerouslySetInnerHTML={{
                    __html: buildFullBulletinHtml(),
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECCIÓN 2: CENTRO DE REPORTES EXPORTABLES (6 TIPOS EN PDF Y WORD)
      ===================================================================== */}
      {activeSection === 'reportes' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(
                [
                  {
                    id: 'listado_estudiantes' as ReportKind,
                    title: '1. Listado Oficial de Estudiantes',
                    desc: 'Nombres, documento, acudiente, teléfono y campos personalizados.',
                  },
                  {
                    id: 'planilla_asistencia' as ReportKind,
                    title: '2. Planilla y Resumen de Asistencia',
                    desc: 'Presentes, ausencias con/sin excusa, llegadas tarde y % de asistencia.',
                  },
                  {
                    id: 'consolidado_notas' as ReportKind,
                    title: '3. Consolidado de Notas SIEE',
                    desc: 'Notas por categoría, promedio definitivo y escala nacional.',
                  },
                  {
                    id: 'analisis_graficos' as ReportKind,
                    title: '4. Análisis con Gráficos SIEE',
                    desc: 'Distribución gráfica de desempeño Superior, Alto, Básico y Bajo.',
                  },
                  {
                    id: 'reporte_comportamiento' as ReportKind,
                    title: '5. Reporte de Comportamiento',
                    desc: 'Anotaciones positivas, de mejora, convivencia y compromisos.',
                  },
                  {
                    id: 'reporte_recaudos' as ReportKind,
                    title: '6. Reporte de Recaudos y Entregas',
                    desc: 'Pagos, abonos con fecha, saldo pendiente, total recaudado y permisos.',
                  },
                ]
              ).map((item) => {
                const isSelected = reportKind === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setReportKind(item.id)}
                    className={`rounded-xl border p-4 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-800 bg-teal-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900 font-display">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">{item.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                Curso seleccionado:{' '}
                <strong className="text-slate-900">
                  {currentCourse?.displayName || 'Ninguno'}
                </strong>{' '}
                · Periodo:{' '}
                <strong className="text-slate-900">
                  {currentPeriod?.name || 'Todos'}
                </strong>
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    printOrSavePdf({
                      title: `Reporte Oficial · ${reportKind.replace(/_/g, ' ').toUpperCase()}`,
                      subtitle: `${currentCourse?.displayName || ''} · ${
                        currentPeriod?.name || ''
                      }`,
                      filename: `${reportKind}_${
                        currentCourse?.displayName || 'curso'
                      }`,
                      profile: teacherProfile,
                      bodyHtml: buildSelectedReportHtml(),
                    });
                  }}
                  leftIcon={<Printer className="w-4 h-4" />}
                >
                  Imprimir / Guardar PDF
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    exportToWordDoc({
                      title: `Reporte Oficial · ${reportKind.replace(/_/g, ' ').toUpperCase()}`,
                      subtitle: `${currentCourse?.displayName || ''} · ${
                        currentPeriod?.name || ''
                      }`,
                      filename: `${reportKind}_${
                        currentCourse?.displayName || 'curso'
                      }`,
                      profile: teacherProfile,
                      bodyHtml: buildSelectedReportHtml(),
                    });
                    onNotify(
                      'Reporte descargado en Word',
                      'Archivo .doc descargado exitosamente.'
                    );
                  }}
                  leftIcon={<FileDown className="w-4 h-4 text-teal-800" />}
                >
                  Descargar en Word (.doc)
                </Button>
              </div>
            </div>

            {/* Vista Previa del Reporte Seleccionado */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <p className="text-xs font-bold text-slate-700">
                Vista previa del reporte seleccionado:
              </p>
              <div
                className="rounded-lg border border-slate-200 bg-white p-5 overflow-x-auto text-xs text-slate-800"
                dangerouslySetInnerHTML={{
                  __html: buildSelectedReportHtml(),
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
