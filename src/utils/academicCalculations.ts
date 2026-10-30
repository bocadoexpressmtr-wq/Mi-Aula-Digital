import {
  TeacherProfile,
  NationalScaleLevel,
  EvaluationCategory,
  EvaluationActivity,
  GradeEntry,
  AcademicPeriod,
  AttendanceRecord,
} from '../types/schema';

export interface ScaleThresholds {
  min: number;
  max: number;
  basicMin: number;
  highMin: number;
  superiorMin: number;
  customLabels?: {
    Bajo: string;
    Básico: string;
    Alto: string;
    Superior: string;
  };
}

export function getScaleThresholds(profile?: TeacherProfile | null): ScaleThresholds {
  const min = profile?.gradingScaleMin ?? 1.0;
  const max = profile?.gradingScaleMax ?? 5.0;
  const basicMin = profile?.basicMin ?? profile?.passingScore ?? 3.0;
  const rangeAboveBasic = Math.max(0.4, max - basicMin);

  // Por defecto para escala 1.0 a 5.0 con Básico en 3.0 -> Alto: 4.0, Superior: 4.6
  const defaultHigh = Number((basicMin + rangeAboveBasic * 0.5).toFixed(1));
  const defaultSuperior = Number((basicMin + rangeAboveBasic * 0.8).toFixed(1));

  const highMin = profile?.highMin ?? defaultHigh;
  const superiorMin = profile?.superiorMin ?? defaultSuperior;

  let customLabels = undefined;
  if (profile?.customScaleName && profile.customScaleName.includes('|')) {
    const parts = profile.customScaleName.split('|').map((s) => s.trim());
    if (parts.length === 4) {
      customLabels = {
        Bajo: parts[0] || 'Bajo',
        Básico: parts[1] || 'Básico',
        Alto: parts[2] || 'Alto',
        Superior: parts[3] || 'Superior',
      };
    }
  }

  return { min, max, basicMin, highMin, superiorMin, customLabels };
}

export function scoreToNationalScale(
  score: number,
  profile?: TeacherProfile | null
): NationalScaleLevel {
  const { basicMin, highMin, superiorMin } = getScaleThresholds(profile);
  if (score >= superiorMin) return 'Superior';
  if (score >= highMin) return 'Alto';
  if (score >= basicMin) return 'Básico';
  return 'Bajo';
}

export function formatScaleLabel(
  level: NationalScaleLevel,
  profile?: TeacherProfile | null
): string {
  const { customLabels } = getScaleThresholds(profile);
  if (!customLabels) return level;
  const custom = customLabels[level];
  return custom && custom !== level ? `${level} (${custom})` : level;
}

export interface StudentPeriodGradeSummary {
  categoryScores: Record<string, number | null>;
  finalPeriodScore: number | null;
  scaleLevel: NationalScaleLevel | null;
  gradedActivitiesCount: number;
  totalActivitiesCount: number;
}

/**
 * Calcula la nota de cada categoría y la definitiva del periodo de un estudiante.
 * Ignora las actividades "pendientes" (sin nota) para no dañar el promedio en curso.
 */
export function calculateStudentPeriodGrade(
  studentId: string,
  categories: EvaluationCategory[],
  activities: EvaluationActivity[],
  entries: GradeEntry[],
  profile?: TeacherProfile | null
): StudentPeriodGradeSummary {
  const categoryScores: Record<string, number | null> = {};
  let weightedSum = 0;
  let activeCategoryWeightSum = 0;
  let gradedActivitiesCount = 0;

  categories.forEach((cat) => {
    const catActivities = activities.filter((a) => a.categoryId === cat.id);
    let catWeightedSum = 0;
    let catActiveWeight = 0;

    catActivities.forEach((act) => {
      const entry = entries.find(
        (e) => e.activityId === act.id && e.studentId === studentId
      );
      if (entry && typeof entry.score === 'number' && !Number.isNaN(entry.score)) {
        const w = act.weightInCategory > 0 ? act.weightInCategory : 1;
        catWeightedSum += entry.score * w;
        catActiveWeight += w;
        gradedActivitiesCount += 1;
      }
    });

    if (catActiveWeight > 0) {
      const catAvg = Number((catWeightedSum / catActiveWeight).toFixed(2));
      categoryScores[cat.id] = catAvg;
      if (cat.weightPercentage > 0) {
        weightedSum += catAvg * cat.weightPercentage;
        activeCategoryWeightSum += cat.weightPercentage;
      }
    } else {
      categoryScores[cat.id] = null;
    }
  });

  if (activeCategoryWeightSum === 0) {
    return {
      categoryScores,
      finalPeriodScore: null,
      scaleLevel: null,
      gradedActivitiesCount: 0,
      totalActivitiesCount: activities.length,
    };
  }

  const finalPeriodScore = Number(
    (weightedSum / activeCategoryWeightSum).toFixed(2)
  );
  const scaleLevel = scoreToNationalScale(finalPeriodScore, profile);

  return {
    categoryScores,
    finalPeriodScore,
    scaleLevel,
    gradedActivitiesCount,
    totalActivitiesCount: activities.length,
  };
}

/**
 * Calcula la nota acumulada / definitiva del año lectivo a través de todos los periodos.
 * Ignora periodos donde el estudiante aún no tiene notas registradas.
 */
export function calculateStudentAnnualGrade(
  studentId: string,
  courseId: string,
  periods: AcademicPeriod[],
  allCategories: EvaluationCategory[],
  allActivities: EvaluationActivity[],
  allEntries: GradeEntry[],
  profile?: TeacherProfile | null
): {
  periodFinalScores: Record<string, number | null>;
  annualScore: number | null;
  annualScaleLevel: NationalScaleLevel | null;
} {
  const periodFinalScores: Record<string, number | null> = {};
  let weightedYearSum = 0;
  let activePeriodWeights = 0;

  periods.forEach((per) => {
    const pCats = allCategories.filter(
      (c) => c.courseId === courseId && c.periodId === per.id
    );
    const pActs = allActivities.filter(
      (a) => a.courseId === courseId && a.periodId === per.id
    );
    const pEntries = allEntries.filter(
      (e) => e.courseId === courseId && e.periodId === per.id
    );

    const summary = calculateStudentPeriodGrade(
      studentId,
      pCats,
      pActs,
      pEntries,
      profile
    );
    periodFinalScores[per.id] = summary.finalPeriodScore;

    if (summary.finalPeriodScore !== null) {
      const pw = per.weightPercentage > 0 ? per.weightPercentage : 25;
      weightedYearSum += summary.finalPeriodScore * pw;
      activePeriodWeights += pw;
    }
  });

  if (activePeriodWeights === 0) {
    return {
      periodFinalScores,
      annualScore: null,
      annualScaleLevel: null,
    };
  }

  const annualScore = Number(
    (weightedYearSum / activePeriodWeights).toFixed(2)
  );
  return {
    periodFinalScores,
    annualScore,
    annualScaleLevel: scoreToNationalScale(annualScore, profile),
  };
}

export interface StudentAttendanceSummary {
  presentCount: number;
  excusedAbsenceCount: number;
  unexcusedAbsenceCount: number;
  lateCount: number;
  totalSessions: number;
  attendancePercentage: number;
}

/**
 * Calcula el resumen de asistencia de un estudiante (Presente, Ausente con excusa,
 * Ausente sin excusa y Llegada tarde) y su porcentaje de asistencia.
 */
export function calculateStudentAttendanceSummary(
  studentId: string,
  records: AttendanceRecord[]
): StudentAttendanceSummary {
  const stuRecords = records.filter((r) => r.studentId === studentId);
  let presentCount = 0;
  let excusedAbsenceCount = 0;
  let unexcusedAbsenceCount = 0;
  let lateCount = 0;

  stuRecords.forEach((r) => {
    if (r.status === 'Presente') presentCount += 1;
    else if (r.status === 'Excusa') excusedAbsenceCount += 1;
    else if (r.status === 'Ausente' || r.status === 'Evasión')
      unexcusedAbsenceCount += 1;
    else if (r.status === 'Tardanza') lateCount += 1;
  });

  const totalSessions = stuRecords.length;
  // Asistencia efectiva: Presentes + Llegadas tarde + Excusas justificadas cuentan positivamente o
  // según estándar escolar colombiano las inasistencias reducen el % de asistencia presencial:
  const attendedSessions = presentCount + lateCount;
  const attendancePercentage =
    totalSessions > 0
      ? Math.round((attendedSessions / totalSessions) * 100)
      : 0;

  return {
    presentCount,
    excusedAbsenceCount,
    unexcusedAbsenceCount,
    lateCount,
    totalSessions,
    attendancePercentage,
  };
}

/**
 * Formatea valores monetarios en Pesos Colombianos (COP), ej. $ 15.000
 */
export function formatCOP(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(safe);
}

