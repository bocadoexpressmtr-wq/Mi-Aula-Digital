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
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Sparkles,
  Smartphone,
  Table,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import {
  CourseAssignment,
  AcademicPeriod,
  Student,
  EvaluationCategory,
  EvaluationActivity,
  GradeEntry,
  TeacherProfile,
} from '../../types/schema';
import {
  getScaleThresholds,
  scoreToNationalScale,
  formatScaleLabel,
  calculateStudentPeriodGrade,
  calculateStudentAnnualGrade,
} from '../../utils/academicCalculations';
import {
  Button,
  InputField,
  SelectField,
  ModalDialog,
  ConfirmDeleteModal,
} from '../ui/DesignSystem';
import { ExportActionControl } from '../ui/ExportActionControl';
import { escapeHtml } from '../../utils/documentExporter';

interface CourseGradebookPanelProps {
  teacherId: string;
  course: CourseAssignment;
  periods: AcademicPeriod[];
  students: Student[];
  categories: EvaluationCategory[];
  activities: EvaluationActivity[];
  gradeEntries: GradeEntry[];
  teacherProfile: TeacherProfile | null;
  onOpenScaleSettings?: () => void;
  onSelectStudentForProfile?: (student: Student) => void;
  onNotify: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

const SUGGESTED_CATEGORY_NAMES = [
  'Talleres',
  'Quices',
  'Evaluaciones',
  'Tareas',
  'Exposiciones',
  'Participación',
  'Trabajo en clase',
  'Autoevaluación',
];

export const CourseGradebookPanel: React.FC<CourseGradebookPanelProps> = ({
  teacherId,
  course,
  periods,
  students,
  categories,
  activities,
  gradeEntries,
  teacherProfile,
  onOpenScaleSettings,
  onSelectStudentForProfile,
  onNotify,
}) => {
  const globalActivePeriod =
    periods.find((p) => p.isActive) || periods[0] || null;

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    globalActivePeriod?.id || ''
  );

  // Sincronizar automáticamente con el Periodo Actual cuando el docente entra o cambia el periodo global
  useEffect(() => {
    if (globalActivePeriod?.id) {
      setSelectedPeriodId(globalActivePeriod.id);
    }
  }, [globalActivePeriod?.id, course.id]);

  // Modo de captura en celular: 'por_actividad' o 'por_estudiante'
  const [mobileCaptureMode, setMobileCaptureMode] = useState<
    'por_actividad' | 'por_estudiante'
  >('por_actividad');
  const [selectedMobileActivityId, setSelectedMobileActivityId] =
    useState<string>('');
  const [selectedMobileStudentId, setSelectedMobileStudentId] =
    useState<string>('');

  // Estados para crear/editar Categoría
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<EvaluationCategory | null>(null);
  const [catName, setCatName] = useState('Talleres');
  const [catWeight, setCatWeight] = useState('35');
  const [catDescription, setCatDescription] = useState('');

  // Estados para crear/editar Actividad
  const [actModalOpen, setActModalOpen] = useState(false);
  const [editingAct, setEditingAct] = useState<EvaluationActivity | null>(null);
  const [actCategoryId, setActCategoryId] = useState('');
  const [actTitle, setActTitle] = useState('');
  const [actDueDate, setActDueDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [actWeightInCat, setActWeightInCat] = useState('100');
  const [actDescription, setActDescription] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<{
    collection: string;
    id: string;
    name: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Borradores locales de notas mientras el docente escribe en las celdas
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});

  const activePeriodId =
    selectedPeriodId ||
    globalActivePeriod?.id ||
    periods[0]?.id ||
    '';

  const selectedPeriodObj =
    periods.find((p) => p.id === activePeriodId) || globalActivePeriod || null;

  const isConsultingOtherPeriod = Boolean(
    globalActivePeriod &&
      activePeriodId &&
      activePeriodId !== globalActivePeriod.id
  );

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

  // Categorías, actividades y notas del curso y periodo seleccionado
  const periodCategories = categories.filter(
    (c) => c.courseId === course.id && c.periodId === activePeriodId
  );
  const periodActivities = activities.filter(
    (a) => a.courseId === course.id && a.periodId === activePeriodId
  );
  const periodEntries = gradeEntries.filter(
    (e) => e.courseId === course.id && e.periodId === activePeriodId
  );

  // Categorías, actividades y notas del Periodo Actual (para comparar cuando se consulta otro periodo)
  const currentActiveCategories = categories.filter(
    (c) =>
      c.courseId === course.id &&
      globalActivePeriod &&
      c.periodId === globalActivePeriod.id
  );
  const currentActiveActivities = activities.filter(
    (a) =>
      a.courseId === course.id &&
      globalActivePeriod &&
      a.periodId === globalActivePeriod.id
  );
  const currentActiveEntries = gradeEntries.filter(
    (e) =>
      e.courseId === course.id &&
      globalActivePeriod &&
      e.periodId === globalActivePeriod.id
  );

  // Validación del 100% de pesos de las categorías
  const totalCategoryWeight = periodCategories.reduce(
    (acc, c) => acc + (Number(c.weightPercentage) || 0),
    0
  );
  const isWeightValid = Math.abs(totalCategoryWeight - 100) < 0.01;

  const scaleThresholds = getScaleThresholds(teacherProfile);

  // Plantilla rápida de 3 categorías (Talleres 40%, Evaluaciones 40%, Participación/Ser 20%)
  const handleQuickCategoriesSetup = async () => {
    if (!activePeriodId) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const defaults = [
        { name: 'Talleres y Trabajo en Clase', weight: 40 },
        { name: 'Quices y Evaluaciones', weight: 40 },
        { name: 'Participación y Autoevaluación', weight: 20 },
      ];

      defaults.forEach((d, idx) => {
        const cid = `cat_${Date.now()}_${idx}_${Math.random()
          .toString(36)
          .slice(2, 5)}`;
        batch.set(doc(db, 'evaluation_categories', cid), {
          teacherId,
          academicYearId: course.academicYearId,
          periodId: activePeriodId,
          courseId: course.id,
          name: d.name,
          weightPercentage: d.weight,
          description: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Crear una primera actividad dentro de cada categoría
        const aid = `act_${Date.now()}_${idx}_${Math.random()
          .toString(36)
          .slice(2, 5)}`;
        batch.set(doc(db, 'evaluation_activities', aid), {
          teacherId,
          academicYearId: course.academicYearId,
          periodId: activePeriodId,
          courseId: course.id,
          categoryId: cid,
          title: `Actividad 1 · ${d.name.split(' ')[0]}`,
          description: '',
          dueDate: new Date().toISOString().slice(0, 10),
          weightInCategory: 100,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      onNotify(
        'Categorías y actividades listas',
        'Se crearon 3 categorías que suman 100% con su primera actividad.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'evaluation_categories');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !activePeriodId) return;

    const weight = Math.max(0, Math.min(100, parseFloat(catWeight) || 0));
    setIsSubmitting(true);
    try {
      if (editingCat) {
        await updateDoc(doc(db, 'evaluation_categories', editingCat.id), {
          name: catName.trim().slice(0, 120),
          weightPercentage: weight,
          description: catDescription.trim().slice(0, 300),
          updatedAt: serverTimestamp(),
        });
        onNotify('Categoría actualizada', `Se actualizó "${catName.trim()}" (${weight}%).`);
      } else {
        const cid = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'evaluation_categories', cid), {
          teacherId,
          academicYearId: course.academicYearId,
          periodId: activePeriodId,
          courseId: course.id,
          name: catName.trim().slice(0, 120),
          weightPercentage: weight,
          description: catDescription.trim().slice(0, 300),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onNotify('Categoría creada', `Se agregó "${catName.trim()}" (${weight}%).`);
      }
      setCatModalOpen(false);
      setEditingCat(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'evaluation_categories');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle.trim() || !actCategoryId || !activePeriodId) return;

    const valWeight = Math.max(
      1,
      Math.min(100, parseFloat(actWeightInCat) || 100)
    );
    setIsSubmitting(true);
    try {
      if (editingAct) {
        await updateDoc(doc(db, 'evaluation_activities', editingAct.id), {
          categoryId: actCategoryId,
          title: actTitle.trim().slice(0, 150),
          description: actDescription.trim().slice(0, 500),
          dueDate: actDueDate,
          weightInCategory: valWeight,
          updatedAt: serverTimestamp(),
        });
        onNotify('Actividad actualizada', `Se actualizó "${actTitle.trim()}".`);
      } else {
        const aid = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'evaluation_activities', aid), {
          teacherId,
          academicYearId: course.academicYearId,
          periodId: activePeriodId,
          courseId: course.id,
          categoryId: actCategoryId,
          title: actTitle.trim().slice(0, 150),
          description: actDescription.trim().slice(0, 500),
          dueDate: actDueDate,
          weightInCategory: valWeight,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onNotify('Actividad creada', `Se agregó "${actTitle.trim()}".`);
      }
      setActModalOpen(false);
      setEditingAct(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'evaluation_activities');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guardar o limpiar (dejar pendiente) una nota individual
  const handleCommitScore = async (
    student: Student,
    activity: EvaluationActivity,
    rawInput: string
  ) => {
    const trimmed = rawInput.trim().replace(',', '.');
    const existing = periodEntries.find(
      (e) => e.activityId === activity.id && e.studentId === student.id
    );

    // Si el docente borra la celda, la nota queda "Pendiente" (se elimina el documento sin dañar el cálculo)
    if (trimmed === '') {
      if (existing) {
        try {
          await deleteDoc(doc(db, 'grade_entries', existing.id));
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.DELETE,
            `grade_entries/${existing.id}`
          );
        }
      }
      return;
    }

    const parsed = parseFloat(trimmed);
    if (
      Number.isNaN(parsed) ||
      parsed < scaleThresholds.min ||
      parsed > scaleThresholds.max
    ) {
      onNotify(
        'Nota fuera de rango',
        `Ingresa un valor entre ${scaleThresholds.min.toFixed(
          1
        )} y ${scaleThresholds.max.toFixed(1)} (o déjalo vacío para Pendiente).`,
        'error'
      );
      return;
    }

    const roundedScore = Number(parsed.toFixed(2));
    const scaleLevel = scoreToNationalScale(roundedScore, teacherProfile);

    try {
      if (existing) {
        await updateDoc(doc(db, 'grade_entries', existing.id), {
          score: roundedScore,
          nationalScaleLevel: scaleLevel,
          updatedAt: serverTimestamp(),
        });
      } else {
        const deterministicId = `grd_${activity.id}_${student.id}`.replace(
          /[^a-zA-Z0-9_-]/g,
          '_'
        );
        await setDoc(doc(db, 'grade_entries', deterministicId), {
          teacherId,
          academicYearId: course.academicYearId,
          periodId: activePeriodId,
          courseId: course.id,
          categoryId: activity.categoryId,
          activityId: activity.id,
          studentId: student.id,
          score: roundedScore,
          nationalScaleLevel: scaleLevel,
          feedback: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'grade_entries');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, deleteTarget.collection, deleteTarget.id));
      onNotify('Eliminado', `Se eliminó "${deleteTarget.name}".`);
      setDeleteTarget(null);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `${deleteTarget.collection}/${deleteTarget.id}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeMobileActivity =
    periodActivities.find((a) => a.id === selectedMobileActivityId) ||
    periodActivities[0] ||
    null;

  const activeMobileStudent =
    courseStudents.find((s) => s.id === selectedMobileStudentId) ||
    courseStudents[0] ||
    null;

  const getScaleColorClass = (level: string | null) => {
    if (level === 'Superior') return 'text-emerald-800 font-bold';
    if (level === 'Alto') return 'text-teal-800 font-bold';
    if (level === 'Básico') return 'text-amber-700 font-semibold';
    if (level === 'Bajo') return 'text-red-700 font-bold';
    return 'text-slate-400';
  };

  return (
    <div className="space-y-4">
      {/* Aviso de seguridad cuando el docente consulta manualmente un periodo distinto al Periodo Actual */}
      {isConsultingOtherPeriod && globalActivePeriod && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Atención · Modo Consulta de Otro Periodo:</strong> Estás viendo las calificaciones de{' '}
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

      {/* =====================================================================
          1. BARRA SUPERIOR DE PERIODO, ESCALA SIEE Y CREACIÓN DE CATEGORÍAS/ACTIVIDADES
      ===================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
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
                      : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-teal-700'
                  }`}
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Peso: {p.weightPercentage}%)
                      {p.id === globalActivePeriod?.id ? ' · Actual' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="text-xs text-slate-600">
              <span>
                Escala:{' '}
                <strong className="font-mono">
                  {scaleThresholds.min.toFixed(1)} a{' '}
                  {scaleThresholds.max.toFixed(1)}
                </strong>
              </span>
              <span aria-hidden="true"> · </span>
              <span>
                Básico ≥{' '}
                <strong className="font-mono">
                  {scaleThresholds.basicMin.toFixed(1)}
                </strong>
              </span>
              <span aria-hidden="true"> · </span>
              <span>
                Alto ≥{' '}
                <strong className="font-mono">
                  {scaleThresholds.highMin.toFixed(1)}
                </strong>
              </span>
              <span aria-hidden="true"> · </span>
              <span>
                Superior ≥{' '}
                <strong className="font-mono">
                  {scaleThresholds.superiorMin.toFixed(1)}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenScaleSettings && (
              <Button
                type="button"
                variant="ghost"
                onClick={onOpenScaleSettings}
                leftIcon={<Sliders className="w-4 h-4 text-teal-800" />}
              >
                Rangos SIEE
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingCat(null);
                setCatName('Talleres');
                const remaining = Math.max(0, 100 - totalCategoryWeight);
                setCatWeight(String(remaining > 0 ? remaining : 25));
                setCatDescription('');
                setCatModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4 text-teal-800" />}
            >
              Nueva Categoría
            </Button>

            <Button
              type="button"
              variant="primary"
              disabled={periodCategories.length === 0}
              onClick={() => {
                setEditingAct(null);
                setActCategoryId(periodCategories[0]?.id || '');
                setActTitle('');
                setActWeightInCat('100');
                setActDescription('');
                setActModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Nueva Actividad
            </Button>

            <ExportActionControl
              label="Exportar o imprimir"
              documentTitle="Planilla Consolidada de Calificaciones SIEE"
              filenameBase={`Notas_SIEE_${course.name || 'Curso'}`}
              onNotify={onNotify}
              buildHtml={() => {
                const catHeaders = periodCategories
                  .map(
                    (c) =>
                      `<th class="text-right">${escapeHtml(c.name)} (${c.weightPercentage}%)</th>`
                  )
                  .join('');

                const rowsHtml = courseStudents
                  .map((stu, idx) => {
                    const gSummary = calculateStudentPeriodGrade(
                      stu.id,
                      course.id,
                      activePeriodId,
                      periodCategories,
                      periodActivities,
                      courseGradeEntries,
                      teacherProfile
                    );
                    const annualSummary = calculateStudentAnnualGrade(
                      stu.id,
                      course.id,
                      periods,
                      categories.filter((c) => c.courseId === course.id),
                      activities.filter((a) => a.courseId === course.id),
                      courseGradeEntries,
                      teacherProfile
                    );

                    const catCells = periodCategories
                      .map((cat) => {
                        const bd = gSummary.categoryBreakdowns.find(
                          (b) => b.category.id === cat.id
                        );
                        return `<td class="text-right font-mono">${
                          bd?.average !== null && bd?.average !== undefined
                            ? bd.average.toFixed(2)
                            : '—'
                        }</td>`;
                      })
                      .join('');

                    return `<tr>
                      <td class="text-center font-mono">${idx + 1}</td>
                      <td><strong>${escapeHtml(stu.lastName)} ${escapeHtml(stu.firstName)}</strong></td>
                      ${catCells}
                      <td class="text-right font-mono"><strong>${
                        gSummary.finalScore !== null
                          ? gSummary.finalScore.toFixed(2)
                          : '—'
                      }</strong></td>
                      <td class="text-center"><strong>${escapeHtml(
                        gSummary.scaleLevel || 'Sin nota'
                      )}</strong></td>
                      <td class="text-right font-mono">${
                        annualSummary.finalAnnualScore !== null
                          ? annualSummary.finalAnnualScore.toFixed(2)
                          : '—'
                      }</td>
                    </tr>`;
                  })
                  .join('');

                return buildFormalDocumentHtml({
                  institutionName:
                    teacherProfile?.institutionName ||
                    'Institución Educativa Oficial',
                  institutionNitDane: teacherProfile?.institutionNitDane,
                  institutionCity: teacherProfile?.institutionCity,
                  institutionLogoUrl: teacherProfile?.institutionLogoUrl,
                  teacherName: teacherProfile?.fullName,
                  title: 'PLANILLA CONSOLIDADA DE CALIFICACIONES (SIEE)',
                  subtitle: `${course.name || 'Curso'} · Periodo activo`,
                  metaItems: [
                    { label: 'Estudiantes', value: String(courseStudents.length) },
                    { label: 'Categorías', value: String(periodCategories.length) },
                    { label: 'Actividades', value: String(periodActivities.length) },
                    { label: 'Ponderación', value: `${totalCategoryWeight}%` },
                  ],
                  bodyHtml: `<table>
                    <thead>
                      <tr>
                        <th style="width:34px;">N°</th>
                        <th>Estudiante</th>
                        ${catHeaders}
                        <th class="text-right">Def. Periodo</th>
                        <th class="text-center">Desempeño SIEE</th>
                        <th class="text-right">Acum. Anual</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rowsHtml || '<tr><td colspan="6">Sin estudiantes activos.</td></tr>'}
                    </tbody>
                  </table>`,
                });
              }}
            />
          </div>
        </div>

        {/* Validador de suma 100% de las categorías */}
        {periodCategories.length > 0 && (
          <div
            className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              isWeightValid
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                : 'border-amber-300 bg-amber-50 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isWeightValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              )}
              <span>
                {isWeightValid ? (
                  <>
                    <strong>Ponderación válida:</strong> Los pesos de las{' '}
                    {periodCategories.length} categorías suman exactamente{' '}
                    <strong className="font-mono">100%</strong>.
                  </>
                ) : (
                  <>
                    <strong>Aviso de ponderación:</strong> Los pesos actuales de tus categorías suman{' '}
                    <strong className="font-mono">{totalCategoryWeight}%</strong>. Ajusta los porcentajes para que sumen <strong>100%</strong>.
                  </>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {periodCategories.map((c) => (
                <div
                  key={c.id}
                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800"
                >
                  <span className="font-semibold">{c.name}:</span>
                  <span className="font-mono font-bold text-teal-800">
                    {c.weightPercentage}%
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCat(c);
                      setCatName(c.name);
                      setCatWeight(String(c.weightPercentage));
                      setCatDescription(c.description || '');
                      setCatModalOpen(true);
                    }}
                    className="text-slate-400 hover:text-slate-800 ml-1 cursor-pointer"
                    title="Editar categoría"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({
                        collection: 'evaluation_categories',
                        id: c.id,
                        name: c.name,
                      })
                    }
                    className="text-slate-400 hover:text-red-700 cursor-pointer"
                    title="Eliminar categoría"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          2. ESTADO VACÍO SI AÚN NO HAY CATEGORÍAS CREADAS EN EL PERIODO
      ===================================================================== */}
      {periodCategories.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
          <h3 className="text-lg font-bold text-slate-900 font-display">
            Configura las categorías de calificación para este periodo
          </h3>
          <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
            Crea tus categorías libres (Talleres, Quices, Evaluaciones, Tareas, Exposiciones, Participación) con su peso porcentual o usa la distribución sugerida en un clic.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="primary"
              onClick={handleQuickCategoriesSetup}
              isLoading={isSubmitting}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              Crear Distribución Sugerida (40% · 40% · 20%)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingCat(null);
                setCatName('Talleres');
                setCatWeight('100');
                setCatModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Crear Categoría Personalizada
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* =================================================================
              VISTA EN CELULAR (< 768px): CAPTURA FÁCIL POR ACTIVIDAD O POR ESTUDIANTE
          ================================================================= */}
          <div className="md:hidden space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-teal-800" />
                  <span>Modo de captura en celular:</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMobileCaptureMode('por_actividad')}
                  className={`min-h-[42px] rounded-lg text-xs font-semibold cursor-pointer ${
                    mobileCaptureMode === 'por_actividad'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Por Actividad
                </button>
                <button
                  type="button"
                  onClick={() => setMobileCaptureMode('por_estudiante')}
                  className={`min-h-[42px] rounded-lg text-xs font-semibold cursor-pointer ${
                    mobileCaptureMode === 'por_estudiante'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Por Estudiante
                </button>
              </div>

              {mobileCaptureMode === 'por_actividad' ? (
                <SelectField
                  label="Selecciona la Actividad a calificar"
                  value={activeMobileActivity?.id || ''}
                  onChange={(e) => setSelectedMobileActivityId(e.target.value)}
                  options={periodActivities.map((a) => {
                    const c = periodCategories.find(
                      (cat) => cat.id === a.categoryId
                    );
                    return {
                      value: a.id,
                      label: `${a.title} (${c?.name || 'Categoría'})`,
                    };
                  })}
                />
              ) : (
                <SelectField
                  label="Selecciona el Estudiante"
                  value={activeMobileStudent?.id || ''}
                  onChange={(e) => setSelectedMobileStudentId(e.target.value)}
                  options={courseStudents.map((s) => ({
                    value: s.id,
                    label: `${s.lastName} ${s.firstName}`,
                  }))}
                />
              )}
            </div>

            {mobileCaptureMode === 'por_actividad' && activeMobileActivity ? (
              <div className="space-y-2.5">
                {courseStudents.map((stu, idx) => {
                  const draftKey = `${activeMobileActivity.id}_${stu.id}`;
                  const existing = periodEntries.find(
                    (e) =>
                      e.activityId === activeMobileActivity.id &&
                      e.studentId === stu.id
                  );
                  const val =
                    scoreDrafts[draftKey] !== undefined
                      ? scoreDrafts[draftKey]
                      : existing
                      ? String(existing.score)
                      : '';
                  const summary = calculateStudentPeriodGrade(
                    stu.id,
                    periodCategories,
                    periodActivities,
                    periodEntries,
                    teacherProfile
                  );

                  return (
                    <div
                      key={stu.id}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {idx + 1}. {stu.lastName} {stu.firstName}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Def. Periodo:{' '}
                          <strong className="font-mono text-slate-900">
                            {summary.finalPeriodScore !== null
                              ? summary.finalPeriodScore.toFixed(2)
                              : 'Pend.'}
                          </strong>{' '}
                          {summary.scaleLevel && (
                            <span
                              className={getScaleColorClass(summary.scaleLevel)}
                            >
                              · {formatScaleLabel(summary.scaleLevel, teacherProfile)}
                            </span>
                          )}
                        </p>
                      </div>

                      <input
                        type="text"
                        inputMode="decimal"
                        data-mobile-act-row={idx}
                        value={val}
                        placeholder="Pend."
                        onChange={(e) =>
                          setScoreDrafts((prev) => ({
                            ...prev,
                            [draftKey]: e.target.value.replace(',', '.'),
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown' || e.key === 'Enter') {
                            e.preventDefault();
                            const nextEl = document.querySelector<HTMLInputElement>(
                              `[data-mobile-act-row="${idx + 1}"]`
                            );
                            if (nextEl) {
                              nextEl.focus();
                              nextEl.select();
                            }
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            const prevEl = document.querySelector<HTMLInputElement>(
                              `[data-mobile-act-row="${idx - 1}"]`
                            );
                            if (prevEl) {
                              prevEl.focus();
                              prevEl.select();
                            }
                          }
                        }}
                        onBlur={(e) =>
                          handleCommitScore(
                            stu,
                            activeMobileActivity,
                            e.target.value.replace(',', '.')
                          )
                        }
                        className="w-24 min-h-[44px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-right font-mono text-base font-bold text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            ) : mobileCaptureMode === 'por_estudiante' && activeMobileStudent ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
                {(() => {
                  const summary = calculateStudentPeriodGrade(
                    activeMobileStudent.id,
                    periodCategories,
                    periodActivities,
                    periodEntries,
                    teacherProfile
                  );
                  const annual = calculateStudentAnnualGrade(
                    activeMobileStudent.id,
                    course.id,
                    periods,
                    categories,
                    activities,
                    gradeEntries,
                    teacherProfile
                  );
                  return (
                    <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900 font-display">
                          {activeMobileStudent.lastName}{' '}
                          {activeMobileStudent.firstName}
                        </p>
                        <p className="text-xs text-slate-500">
                          Definitiva Año:{' '}
                          <strong className="font-mono">
                            {annual.annualScore !== null
                              ? annual.annualScore.toFixed(2)
                              : '—'}
                          </strong>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold font-mono text-slate-900">
                          {summary.finalPeriodScore !== null
                            ? summary.finalPeriodScore.toFixed(2)
                            : 'Pendiente'}
                        </p>
                        {summary.scaleLevel && (
                          <p
                            className={`text-xs ${getScaleColorClass(
                              summary.scaleLevel
                            )}`}
                          >
                            {formatScaleLabel(
                              summary.scaleLevel,
                              teacherProfile
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {periodActivities.map((act, actIdx) => {
                  const cat = periodCategories.find(
                    (c) => c.id === act.categoryId
                  );
                  const draftKey = `${act.id}_${activeMobileStudent.id}`;
                  const existing = periodEntries.find(
                    (e) =>
                      e.activityId === act.id &&
                      e.studentId === activeMobileStudent.id
                  );
                  const val =
                    scoreDrafts[draftKey] !== undefined
                      ? scoreDrafts[draftKey]
                      : existing
                      ? String(existing.score)
                      : '';

                  return (
                    <div
                      key={act.id}
                      className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-teal-800">
                          {cat?.name} ({cat?.weightPercentage}%)
                        </p>
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {act.title}
                        </p>
                        {act.dueDate && (
                          <p className="text-[11px] font-mono text-slate-400">
                            Fecha: {act.dueDate}
                          </p>
                        )}
                      </div>

                      <input
                        type="text"
                        inputMode="decimal"
                        data-mobile-stu-row={actIdx}
                        value={val}
                        placeholder="Pend."
                        onChange={(e) =>
                          setScoreDrafts((prev) => ({
                            ...prev,
                            [draftKey]: e.target.value.replace(',', '.'),
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown' || e.key === 'Enter') {
                            e.preventDefault();
                            const nextEl = document.querySelector<HTMLInputElement>(
                              `[data-mobile-stu-row="${actIdx + 1}"]`
                            );
                            if (nextEl) {
                              nextEl.focus();
                              nextEl.select();
                            }
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            const prevEl = document.querySelector<HTMLInputElement>(
                              `[data-mobile-stu-row="${actIdx - 1}"]`
                            );
                            if (prevEl) {
                              prevEl.focus();
                              prevEl.select();
                            }
                          }
                        }}
                        onBlur={(e) =>
                          handleCommitScore(
                            activeMobileStudent,
                            act,
                            e.target.value.replace(',', '.')
                          )
                        }
                        className="w-24 min-h-[44px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-right font-mono text-base font-bold text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* =================================================================
              VISTA EN TABLET Y COMPUTADOR (>= 768px): HOJA DE CÁLCULO INTERACTIVA
          ================================================================= */}
          <div className="hidden md:block space-y-2">
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
              <span>
                Navegación rápida tipo Excel: usa las flechas del teclado <strong>↓</strong> y <strong>↑</strong> (o <strong>Enter</strong>) para bajar o subir de estudiante inmediatamente sin usar el mouse.
              </span>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                {/* Fila 1: Encabezados de Categorías con sus porcentajes */}
                <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700">
                  <th
                    rowSpan={2}
                    className="py-3 px-4 font-bold text-slate-900 border-r border-slate-200 min-w-[220px] sticky left-0 bg-slate-100 z-10"
                  >
                    <div className="flex items-center gap-2">
                      <Table className="w-4 h-4 text-teal-800" />
                      <span>Estudiante ({courseStudents.length})</span>
                    </div>
                  </th>
                  {periodCategories.map((cat) => {
                    const catActs = periodActivities.filter(
                      (a) => a.categoryId === cat.id
                    );
                    return (
                      <th
                        key={cat.id}
                        colSpan={Math.max(1, catActs.length)}
                        className="py-2.5 px-3 text-center border-r border-slate-200 bg-teal-50/50"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-bold text-slate-900">
                            {cat.name}
                          </span>
                          <span className="font-mono font-bold text-teal-800">
                            ({cat.weightPercentage}%)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAct(null);
                              setActCategoryId(cat.id);
                              setActTitle('');
                              setActWeightInCat('100');
                              setActModalOpen(true);
                            }}
                            className="ml-1 text-teal-800 hover:underline font-semibold cursor-pointer"
                            title="Agregar actividad a esta categoría"
                          >
                            + Act.
                          </button>
                        </div>
                      </th>
                    );
                  })}
                  <th
                    rowSpan={2}
                    className="py-3 px-3 text-right font-bold text-slate-900 border-r border-slate-200 bg-slate-100 whitespace-nowrap"
                  >
                    Def. {selectedPeriodObj?.name || 'Periodo'}
                  </th>
                  <th
                    rowSpan={2}
                    className="py-3 px-3 text-left font-bold text-slate-900 border-r border-slate-200 bg-slate-100 whitespace-nowrap"
                  >
                    Escala Nacional
                  </th>
                  {isConsultingOtherPeriod && globalActivePeriod && (
                    <th
                      rowSpan={2}
                      className="py-3 px-3 text-right font-bold text-amber-900 border-r border-slate-200 bg-amber-50/70 whitespace-nowrap"
                    >
                      Vs. {globalActivePeriod.name} (Actual)
                    </th>
                  )}
                  <th
                    rowSpan={2}
                    className="py-3 px-3 text-right font-bold text-teal-900 bg-teal-50/60 whitespace-nowrap"
                  >
                    Acum. Año
                  </th>
                </tr>

                {/* Fila 2: Encabezados de cada Actividad con su fecha y valor */}
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  {periodCategories.flatMap((cat) => {
                    const catActs = periodActivities.filter(
                      (a) => a.categoryId === cat.id
                    );
                    if (catActs.length === 0) {
                      return [
                        <th
                          key={`empty_${cat.id}`}
                          className="py-2 px-3 text-center text-slate-400 border-r border-slate-200"
                        >
                          Sin actividades
                        </th>,
                      ];
                    }
                    return catActs.map((act) => (
                      <th
                        key={act.id}
                        className="py-2 px-2.5 text-center border-r border-slate-200 min-w-[115px]"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1">
                            <span
                              className="font-semibold text-slate-800 truncate max-w-[95px]"
                              title={act.title}
                            >
                              {act.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAct(act);
                                setActCategoryId(act.categoryId);
                                setActTitle(act.title);
                                setActDueDate(act.dueDate || '');
                                setActWeightInCat(String(act.weightInCategory));
                                setActDescription(act.description || '');
                                setActModalOpen(true);
                              }}
                              className="text-slate-400 hover:text-slate-800 cursor-pointer"
                              title="Editar actividad"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  collection: 'evaluation_activities',
                                  id: act.id,
                                  name: act.title,
                                })
                              }
                              className="text-slate-400 hover:text-red-700 cursor-pointer"
                              title="Eliminar actividad"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {act.dueDate || 'Sin fecha'} · Val:{' '}
                            {act.weightInCategory}%
                          </span>
                        </div>
                      </th>
                    ));
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {(() => {
                  const orderedSheetActivities = periodCategories.flatMap((cat) =>
                    periodActivities.filter((a) => a.categoryId === cat.id)
                  );
                  return courseStudents.map((stu, idx) => {
                  const periodSummary = calculateStudentPeriodGrade(
                    stu.id,
                    periodCategories,
                    periodActivities,
                    periodEntries,
                    teacherProfile
                  );
                  const annualSummary = calculateStudentAnnualGrade(
                    stu.id,
                    course.id,
                    periods,
                    categories,
                    activities,
                    gradeEntries,
                    teacherProfile
                  );

                  return (
                    <tr
                      key={stu.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-4 border-r border-slate-200 sticky left-0 bg-white z-10">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onSelectStudentForProfile &&
                              onSelectStudentForProfile(stu)
                            }
                            className="font-semibold text-slate-900 hover:text-teal-800 text-left truncate cursor-pointer"
                          >
                            <span className="font-mono text-slate-400 mr-1.5">
                              {idx + 1}.
                            </span>
                            {stu.lastName} {stu.firstName}
                          </button>
                          {onSelectStudentForProfile && (
                            <button
                              type="button"
                              onClick={() => onSelectStudentForProfile(stu)}
                              className="text-slate-400 hover:text-teal-800 cursor-pointer shrink-0"
                              title="Abrir ficha individual"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {periodCategories.flatMap((cat) => {
                        const catActs = periodActivities.filter(
                          (a) => a.categoryId === cat.id
                        );
                        if (catActs.length === 0) {
                          return [
                            <td
                              key={`empty_cell_${cat.id}_${stu.id}`}
                              className="py-2 px-2 text-center text-slate-300 border-r border-slate-200"
                            >
                              —
                            </td>,
                          ];
                        }
                        return catActs.map((act) => {
                          const colIdx = orderedSheetActivities.findIndex(
                            (a) => a.id === act.id
                          );
                          const draftKey = `${act.id}_${stu.id}`;
                          const existing = periodEntries.find(
                            (e) =>
                              e.activityId === act.id && e.studentId === stu.id
                          );
                          const val =
                            scoreDrafts[draftKey] !== undefined
                              ? scoreDrafts[draftKey]
                              : existing
                              ? String(existing.score)
                              : '';

                          return (
                            <td
                              key={draftKey}
                              className="p-1.5 border-r border-slate-200 text-center"
                            >
                              <input
                                type="text"
                                inputMode="decimal"
                                data-grade-row={idx}
                                data-grade-col={colIdx}
                                value={val}
                                placeholder="Pend."
                                onChange={(e) =>
                                  setScoreDrafts((prev) => ({
                                    ...prev,
                                    [draftKey]: e.target.value.replace(',', '.'),
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                    e.preventDefault();
                                    const nextEl = document.querySelector<HTMLInputElement>(
                                      `[data-grade-row="${idx + 1}"][data-grade-col="${colIdx}"]`
                                    );
                                    if (nextEl) {
                                      nextEl.focus();
                                      nextEl.select();
                                    }
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const prevEl = document.querySelector<HTMLInputElement>(
                                      `[data-grade-row="${idx - 1}"][data-grade-col="${colIdx}"]`
                                    );
                                    if (prevEl) {
                                      prevEl.focus();
                                      prevEl.select();
                                    }
                                  } else if (
                                    e.key === 'ArrowRight' &&
                                    e.currentTarget.selectionStart === e.currentTarget.value.length
                                  ) {
                                    const rightEl = document.querySelector<HTMLInputElement>(
                                      `[data-grade-row="${idx}"][data-grade-col="${colIdx + 1}"]`
                                    );
                                    if (rightEl) {
                                      e.preventDefault();
                                      rightEl.focus();
                                      rightEl.select();
                                    }
                                  } else if (
                                    e.key === 'ArrowLeft' &&
                                    e.currentTarget.selectionStart === 0
                                  ) {
                                    const leftEl = document.querySelector<HTMLInputElement>(
                                      `[data-grade-row="${idx}"][data-grade-col="${colIdx - 1}"]`
                                    );
                                    if (leftEl) {
                                      e.preventDefault();
                                      leftEl.focus();
                                      leftEl.select();
                                    }
                                  }
                                }}
                                onBlur={(e) =>
                                  handleCommitScore(
                                    stu,
                                    act,
                                    e.target.value.replace(',', '.')
                                  )
                                }
                                className={`w-full min-h-[38px] rounded-lg border px-2 py-1 text-right font-mono tabular-nums text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-700/20 ${
                                  existing
                                    ? existing.score < scaleThresholds.basicMin
                                      ? 'border-red-200 bg-red-50/40 text-red-800'
                                      : 'border-slate-200 bg-white text-slate-900'
                                    : 'border-transparent bg-slate-50/70 text-slate-500 hover:border-slate-200'
                                }`}
                              />
                            </td>
                          );
                        });
                      })}

                      {/* Nota Definitiva del Periodo */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-sm border-r border-slate-200 bg-slate-50/50">
                        {periodSummary.finalPeriodScore !== null ? (
                          <span
                            className={
                              periodSummary.finalPeriodScore <
                              scaleThresholds.basicMin
                                ? 'text-red-700'
                                : 'text-slate-900'
                            }
                          >
                            {periodSummary.finalPeriodScore.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs font-normal text-slate-400">
                            Pendiente
                          </span>
                        )}
                      </td>

                      {/* Equivalencia en Escala Nacional */}
                      <td className="py-2.5 px-3 border-r border-slate-200 bg-slate-50/50 whitespace-nowrap">
                        {periodSummary.scaleLevel ? (
                          <span
                            className={getScaleColorClass(
                              periodSummary.scaleLevel
                            )}
                          >
                            {formatScaleLabel(
                              periodSummary.scaleLevel,
                              teacherProfile
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Comparativa con el Periodo Actual cuando se consulta otro periodo */}
                      {isConsultingOtherPeriod && globalActivePeriod && (
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums border-r border-slate-200 bg-amber-50/30 whitespace-nowrap">
                          {(() => {
                            const currActiveSum = calculateStudentPeriodGrade(
                              stu.id,
                              currentActiveCategories,
                              currentActiveActivities,
                              currentActiveEntries,
                              teacherProfile
                            );
                            if (
                              currActiveSum.finalPeriodScore === null &&
                              periodSummary.finalPeriodScore === null
                            ) {
                              return <span className="text-slate-400">Sin nota</span>;
                            }
                            const diff =
                              currActiveSum.finalPeriodScore !== null &&
                              periodSummary.finalPeriodScore !== null
                                ? Number(
                                    (
                                      currActiveSum.finalPeriodScore -
                                      periodSummary.finalPeriodScore
                                    ).toFixed(2)
                                  )
                                : null;
                            return (
                              <div>
                                <span className="font-bold text-slate-900">
                                  {currActiveSum.finalPeriodScore !== null
                                    ? currActiveSum.finalPeriodScore.toFixed(2)
                                    : 'Pend.'}
                                </span>
                                {diff !== null && (
                                  <span
                                    className={`block text-[10px] font-semibold ${
                                      diff > 0
                                        ? 'text-emerald-700'
                                        : diff < 0
                                        ? 'text-red-700'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} vs. este periodo
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      )}

                      {/* Nota Definitiva / Acumulada del Año */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold bg-teal-50/30 whitespace-nowrap">
                        {annualSummary.annualScore !== null ? (
                          <div>
                            <span
                              className={
                                annualSummary.annualScore <
                                scaleThresholds.basicMin
                                  ? 'text-red-700'
                                  : 'text-teal-900'
                              }
                            >
                              {annualSummary.annualScore.toFixed(2)}
                            </span>
                            {annualSummary.annualScaleLevel && (
                              <span className="block text-[10px] font-sans font-normal text-slate-500">
                                {annualSummary.annualScaleLevel}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                });
                })()}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {/* Modal: Crear / Editar Categoría */}
      <ModalDialog
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={
          editingCat
            ? 'Editar Categoría de Evaluación'
            : 'Nueva Categoría de Evaluación'
        }
        subtitle="Elige un nombre libre o sugerido y asígnale su peso porcentual en el periodo."
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-600">
              Sugerencias rápidas:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_CATEGORY_NAMES.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setCatName(sug)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-700 text-xs text-slate-700 cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <InputField
                label="Nombre de la Categoría *"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Ej. Talleres, Quices, Saber, Hacer..."
                required
              />
            </div>
            <InputField
              label="Porcentaje (%) *"
              type="number"
              step="0.1"
              value={catWeight}
              onChange={(e) => setCatWeight(e.target.value)}
              required
            />
          </div>

          <InputField
            label="Descripción o criterio pedagógico (Opcional)"
            value={catDescription}
            onChange={(e) => setCatDescription(e.target.value)}
            placeholder="Ej. Trabajo práctico en el aula y resolución de ejercicios"
          />

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCatModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Guardar Categoría
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Crear / Editar Actividad Evaluativa */}
      <ModalDialog
        isOpen={actModalOpen}
        onClose={() => setActModalOpen(false)}
        title={
          editingAct
            ? 'Editar Actividad de Calificación'
            : 'Nueva Actividad de Calificación'
        }
        subtitle="Define la actividad, su fecha y su peso o valor dentro de la categoría."
      >
        <form onSubmit={handleSaveActivity} className="space-y-4">
          <SelectField
            label="Categoría a la que pertenece *"
            value={actCategoryId}
            onChange={(e) => setActCategoryId(e.target.value)}
            options={periodCategories.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.weightPercentage}%)`,
            }))}
            required
          />

          <InputField
            label="Título de la Actividad *"
            value={actTitle}
            onChange={(e) => setActTitle(e.target.value)}
            placeholder="Ej. Taller 1: Fracciones, Quiz de Lectura, Exposición..."
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Fecha de la Actividad"
              type="date"
              value={actDueDate}
              onChange={(e) => setActDueDate(e.target.value)}
            />
            <InputField
              label="Peso / Valor en la Categoría (%)"
              type="number"
              value={actWeightInCat}
              onChange={(e) => setActWeightInCat(e.target.value)}
              helperText="Si todas valen igual, déjalo en 100."
              required
            />
          </div>

          <InputField
            label="Observación o competencia evaluada (Opcional)"
            value={actDescription}
            onChange={(e) => setActDescription(e.target.value)}
            placeholder="Ej. Resuelve problemas aplicando operaciones básicas"
          />

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Guardar Actividad
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Confirmación antes de borrar categoría o actividad */}
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
