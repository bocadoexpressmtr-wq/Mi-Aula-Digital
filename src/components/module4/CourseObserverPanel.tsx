import React, { useState, useEffect } from 'react';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ClipboardList,
  Plus,
  ThumbsUp,
  TrendingUp,
  ShieldAlert,
  Printer,
  Trash2,
  Edit3,
  UserCheck,
  Sparkles,
  Eye,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import {
  CourseAssignment,
  AcademicPeriod,
  Student,
  ObservationRecord,
  ObservationType,
} from '../../types/schema';
import {
  Button,
  InputField,
  SelectField,
  TextareaField,
  ModalDialog,
  ConfirmDeleteModal,
} from '../ui/DesignSystem';
import { ExportActionControl } from '../ui/ExportActionControl';

interface CourseObserverPanelProps {
  teacherId: string;
  course: CourseAssignment;
  periods: AcademicPeriod[];
  students: Student[];
  observations: ObservationRecord[];
  onSelectStudentForProfile: (student: Student) => void;
  onNotify: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

export type SimplifiedObservationCategory = 'positiva' | 'mejora' | 'convivencia';

export function getObservationCategory(
  type: ObservationType
): SimplifiedObservationCategory {
  if (type === 'Reconocimiento Positivo') return 'positiva';
  if (type === 'Seguimiento Académico' || type === 'Llamado de Atención') {
    return 'mejora';
  }
  return 'convivencia';
}

export function getObservationCategoryLabel(
  type: ObservationType
): {
  category: SimplifiedObservationCategory;
  shortLabel: string;
  detailLabel: string;
} {
  const cat = getObservationCategory(type);
  if (cat === 'positiva') {
    return {
      category: 'positiva',
      shortLabel: 'Positiva',
      detailLabel: 'Reconocimiento Positivo',
    };
  }
  if (cat === 'mejora') {
    return {
      category: 'mejora',
      shortLabel: 'De mejora',
      detailLabel: type,
    };
  }
  return {
    category: 'convivencia',
    shortLabel: 'Convivencia',
    detailLabel: type,
  };
}

const QUICK_PHRASES: Record<SimplifiedObservationCategory, string[]> = {
  positiva: [
    'Destaca por su participación activa, liderazgo positivo y colaboración en clase.',
    'Excelente responsabilidad y puntualidad en la entrega de talleres y actividades.',
    'Muestra gran empatía, respeto y apoyo constante hacia sus compañeros de grupo.',
  ],
  mejora: [
    'Requiere fortalecer hábitos de estudio en casa y entrega oportuna de compromisos.',
    'Se distrae con facilidad durante las explicaciones; se recomienda acompañamiento.',
    'Presenta rezago en las actividades recientes del área; se acuerda plan de refuerzo.',
  ],
  convivencia: [
    'Interrumpe reiteradamente el desarrollo de la clase y el trabajo de sus compañeros.',
    'Incumple acuerdos básicos del manual de convivencia dentro del aula.',
    'Situación de conflicto interpersonal atendida mediante diálogo formativo y mediación.',
  ],
};

export const CourseObserverPanel: React.FC<CourseObserverPanelProps> = ({
  teacherId,
  course,
  periods,
  students,
  observations,
  onSelectStudentForProfile,
  onNotify,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const activePeriod =
    periods.find((p) => p.isActive) || periods[0] || null;
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    activePeriod?.id || ''
  );

  // Sincronizar automáticamente con el Periodo Actual cuando el docente entra o cambia el periodo global
  useEffect(() => {
    if (activePeriod?.id) {
      setSelectedPeriodId(activePeriod.id);
    }
  }, [activePeriod?.id, course.id]);

  const selectedPeriodObj =
    periods.find((p) => p.id === selectedPeriodId) || null;

  const isConsultingOtherPeriod = Boolean(
    activePeriod && selectedPeriodId !== activePeriod.id
  );

  const [filterStudentId, setFilterStudentId] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<
    'ALL' | SimplifiedObservationCategory
  >('ALL');

  // Formulario rápido de creación / edición en pocos toques
  const [formOpen, setFormOpen] = useState(false);
  const [editingObs, setEditingObs] = useState<ObservationRecord | null>(null);
  const [studentId, setStudentId] = useState<string>('');
  const [date, setDate] = useState<string>(todayStr);
  const [selectedCat, setSelectedCat] =
    useState<SimplifiedObservationCategory>('positiva');
  const [specificType, setSpecificType] = useState<ObservationType>(
    'Reconocimiento Positivo'
  );
  const [description, setDescription] = useState<string>('');
  const [commitments, setCommitments] = useState<string>('');
  const [studentDischarge, setStudentDischarge] = useState<string>('');
  const [guardianNotified, setGuardianNotified] = useState<boolean>(false);
  const [obsStatus, setObsStatus] =
    useState<ObservationRecord['status']>('Abierto');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ObservationRecord | null>(
    null
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

  // Observaciones de este grupo/curso
  const groupObservations = observations
    .filter(
      (o) =>
        o.gradeGroupId === course.gradeGroupId &&
        (!o.courseId || o.courseId === course.id)
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredObservations = groupObservations.filter((obs) => {
    if (selectedPeriodId && obs.periodId !== selectedPeriodId) return false;
    if (filterStudentId !== 'ALL' && obs.studentId !== filterStudentId)
      return false;
    if (
      filterCategory !== 'ALL' &&
      getObservationCategory(obs.type) !== filterCategory
    )
      return false;
    return true;
  });

  const handleSelectCategoryButton = (cat: SimplifiedObservationCategory) => {
    setSelectedCat(cat);
    if (cat === 'positiva') {
      setSpecificType('Reconocimiento Positivo');
    } else if (cat === 'mejora') {
      setSpecificType('Seguimiento Académico');
    } else {
      setSpecificType('Situación Tipo I');
    }
  };

  const openQuickCreate = (preselectedStudentId?: string) => {
    setEditingObs(null);
    setStudentId(preselectedStudentId || courseStudents[0]?.id || '');
    setDate(todayStr);
    handleSelectCategoryButton('positiva');
    setDescription('');
    setCommitments('');
    setStudentDischarge('');
    setGuardianNotified(false);
    setObsStatus('Abierto');
    setFormOpen(true);
  };

  const openEditModal = (obs: ObservationRecord) => {
    setEditingObs(obs);
    setStudentId(obs.studentId);
    setDate(obs.date);
    setSelectedCat(getObservationCategory(obs.type));
    setSpecificType(obs.type);
    setDescription(obs.description);
    setCommitments(obs.commitments || '');
    setStudentDischarge(obs.studentDischarge || '');
    setGuardianNotified(obs.guardianNotified);
    setObsStatus(obs.status);
    setFormOpen(true);
  };

  const handleSaveObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPeriodId =
      selectedPeriodId || activePeriod?.id || periods[0]?.id || '';
    if (!targetPeriodId) {
      onNotify(
        'Periodo requerido',
        'Configura al menos un periodo académico en el Módulo 1.',
        'error'
      );
      return;
    }
    if (!studentId) {
      onNotify('Selecciona un estudiante', 'Elige el estudiante.', 'error');
      return;
    }
    if (!description.trim()) {
      onNotify(
        'Descripción obligatoria',
        'Escribe o selecciona el motivo de la observación.',
        'error'
      );
      return;
    }

    setIsSaving(true);
    try {
      if (editingObs) {
        await updateDoc(doc(db, 'observations', editingObs.id), {
          academicYearId: course.academicYearId,
          periodId: editingObs.periodId,
          gradeGroupId: course.gradeGroupId,
          courseId: course.id,
          studentId,
          date,
          type: specificType,
          description: description.trim().slice(0, 1500),
          studentDischarge: studentDischarge.trim().slice(0, 1000),
          commitments: commitments.trim().slice(0, 1000),
          guardianNotified,
          status: obsStatus,
          updatedAt: serverTimestamp(),
        });
        onNotify(
          'Observación actualizada',
          'Se guardaron los cambios y acuerdos en el observador.'
        );
      } else {
        const newId = `obs_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        await setDoc(doc(db, 'observations', newId), {
          teacherId,
          academicYearId: course.academicYearId,
          periodId: targetPeriodId,
          gradeGroupId: course.gradeGroupId,
          courseId: course.id,
          studentId,
          date,
          type: specificType,
          description: description.trim().slice(0, 1500),
          studentDischarge: studentDischarge.trim().slice(0, 1000),
          commitments: commitments.trim().slice(0, 1000),
          guardianNotified,
          status: obsStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const stu = courseStudents.find((s) => s.id === studentId);
        onNotify(
          'Observación registrada',
          `Se anexó al observador de ${stu ? `${stu.lastName} ${stu.firstName}` : 'el estudiante'}.`
        );
      }
      setFormOpen(false);
      setEditingObs(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'observations');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteObservation = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'observations', deleteTarget.id));
      onNotify(
        'Observación eliminada',
        'El registro fue retirado del observador.'
      );
      setDeleteTarget(null);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `observations/${deleteTarget.id}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const positiveCount = filteredObservations.filter(
    (o) => getObservationCategory(o.type) === 'positiva'
  ).length;
  const improvementCount = filteredObservations.filter(
    (o) => getObservationCategory(o.type) === 'mejora'
  ).length;
  const coexistenceCount = filteredObservations.filter(
    (o) => getObservationCategory(o.type) === 'convivencia'
  ).length;

  const buildObserverExportHtml = () => {
    const rowsHtml =
      filteredObservations.length === 0
        ? `<tr><td colspan="6" style="text-align:center;">Sin observaciones registradas para el filtro actual.</td></tr>`
        : filteredObservations
            .map((obs, idx) => {
              const stu = students.find((s) => s.id === obs.studentId);
              const info = getObservationCategoryLabel(obs.type);
              return `<tr>
                <td>${idx + 1}</td>
                <td>${obs.date}</td>
                <td><strong>${stu ? `${stu.lastName} ${stu.firstName}` : 'Estudiante'}</strong></td>
                <td>${info.shortLabel} (${info.detailLabel})</td>
                <td>${obs.description}</td>
                <td>${obs.commitments || '—'} (${obs.guardianNotified ? 'Acudiente informado' : 'Pendiente'})</td>
              </tr>`;
            })
            .join('');

    return `
      <div class="kpi-box">
        <strong>Curso:</strong> ${course.displayName} · 
        <strong>Total anotaciones:</strong> ${filteredObservations.length} 
        (Positivas: ${positiveCount} · De mejora: ${improvementCount} · Convivencia: ${coexistenceCount})
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Fecha</th>
            <th>Estudiante</th>
            <th>Tipo</th>
            <th>Descripción de la Observación</th>
            <th>Compromisos y Acuerdos</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  };

  return (
    <div className="space-y-4">
      {/* Aviso de seguridad cuando el docente consulta manualmente otro periodo o todos los periodos */}
      {isConsultingOtherPeriod && activePeriod && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Modo Consulta de Observador:</strong> Estás viendo{' '}
              <strong>
                {selectedPeriodObj
                  ? selectedPeriodObj.name
                  : 'Todos los periodos del año'}
              </strong>
              . Tu periodo actual de trabajo es{' '}
              <strong>{activePeriod.name}</strong>.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => setSelectedPeriodId(activePeriod.id)}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Volver al Periodo Actual ({activePeriod.name})
          </Button>
        </div>
      )}

      {/* Barra de controles y registro en pocos toques */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-teal-800" />
              <span>Observador de Actitud, Desempeño y Convivencia</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Registra en pocos toques observaciones positivas, de mejora o de convivencia con acuerdos de acudientes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <ExportActionControl
              label="Exportar o imprimir"
              title={`Reporte de Observador y Comportamiento · ${course.displayName}`}
              filename={`observador_${course.displayName}`}
              getBodyHtml={buildObserverExportHtml}
              onNotify={onNotify}
            />
            <Button
              type="button"
              variant="primary"
              onClick={() => openQuickCreate()}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Nueva Observación Rápida
            </Button>
          </div>
        </div>

        {/* Filtros y contadores */}
        <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
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
              <option value="">Todos los periodos</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === activePeriod?.id ? ' · Actual' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">
              Filtrar por Estudiante
            </label>
            <select
              value={filterStudentId}
              onChange={(e) => setFilterStudentId(e.target.value)}
              className="min-h-[42px] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-teal-700 focus:outline-none"
            >
              <option value="ALL">
                Todos los estudiantes ({courseStudents.length})
              </option>
              {courseStudents.map((stu) => (
                <option key={stu.id} value={stu.id}>
                  {stu.lastName} {stu.firstName}
                </option>
              ))}
            </select>
          </div>

          {/* Botones de filtro por tipo */}
          <button
            type="button"
            onClick={() =>
              setFilterCategory(
                filterCategory === 'positiva' ? 'ALL' : 'positiva'
              )
            }
            className={`min-h-[42px] rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer flex items-center justify-between ${
              filterCategory === 'positiva'
                ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="text-xs font-semibold inline-flex items-center gap-1.5">
              <ThumbsUp className="w-3.5 h-3.5 text-emerald-700" />
              Positivas
            </span>
            <span className="font-mono font-bold text-xs text-emerald-800">
              {positiveCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilterCategory(filterCategory === 'mejora' ? 'ALL' : 'mejora')
            }
            className={`min-h-[42px] rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer flex items-center justify-between ${
              filterCategory === 'mejora'
                ? 'border-amber-700 bg-amber-50 text-amber-950'
                : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="text-xs font-semibold inline-flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-700" />
              De mejora
            </span>
            <span className="font-mono font-bold text-xs text-amber-800">
              {improvementCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilterCategory(
                filterCategory === 'convivencia' ? 'ALL' : 'convivencia'
              )
            }
            className={`min-h-[42px] rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer flex items-center justify-between ${
              filterCategory === 'convivencia'
                ? 'border-red-700 bg-red-50 text-red-950'
                : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="text-xs font-semibold inline-flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-red-700" />
              Convivencia
            </span>
            <span className="font-mono font-bold text-xs text-red-800">
              {coexistenceCount}
            </span>
          </button>
        </div>

        {/* Barra rápida de estudiantes para anotar en 1 toque */}
        {courseStudents.length > 0 && (
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 mb-2">
              Registro rápido en 1 toque por estudiante:
            </p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {courseStudents.slice(0, 12).map((stu) => (
                <button
                  key={stu.id}
                  type="button"
                  onClick={() => openQuickCreate(stu.id)}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-teal-700 hover:bg-teal-50/40 text-xs font-medium text-slate-800 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  + {stu.lastName} {stu.firstName.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Listado de Observaciones */}
      {filteredObservations.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center mx-auto">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-900 font-display">
            Sin anotaciones en el observador para este filtro
          </h4>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Usa el botón "Nueva Observación Rápida" o toca el nombre de un estudiante arriba para registrar felicitaciones, llamados de mejora o situaciones de convivencia.
          </p>
          <div className="pt-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => openQuickCreate()}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Registrar primera observación
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredObservations.map((obs) => {
            const stu = students.find((s) => s.id === obs.studentId);
            const info = getObservationCategoryLabel(obs.type);
            const per = periods.find((p) => p.id === obs.periodId);

            return (
              <div
                key={obs.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => stu && onSelectStudentForProfile(stu)}
                      className="text-sm font-bold text-slate-900 hover:text-teal-800 font-display cursor-pointer"
                    >
                      {stu
                        ? `${stu.lastName} ${stu.firstName}`
                        : 'Estudiante'}
                    </button>
                    <span className="text-slate-300">·</span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                        info.category === 'positiva'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : info.category === 'mejora'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {info.shortLabel} ({info.detailLabel})
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      {obs.date}
                    </span>
                    {per && (
                      <span className="text-xs text-slate-500">
                        · {per.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {stu && (
                      <button
                        type="button"
                        onClick={() => onSelectStudentForProfile(stu)}
                        className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-teal-800 hover:bg-teal-50 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ficha</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(obs)}
                      className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(obs)}
                      className="min-h-[34px] min-w-[34px] rounded-lg border border-red-200 text-red-700 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                      title="Eliminar observación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-slate-800 leading-relaxed">
                  {obs.description}
                </p>

                {(obs.commitments ||
                  obs.studentDischarge ||
                  obs.guardianNotified) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {obs.commitments && (
                      <div className="rounded-xl bg-teal-50/60 border border-teal-200/80 p-3 text-xs">
                        <p className="font-bold text-teal-950">
                          Compromisos y Acuerdos con Acudiente / Estudiante:
                        </p>
                        <p className="text-slate-700 mt-1">{obs.commitments}</p>
                      </div>
                    )}
                    {obs.studentDischarge && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
                        <p className="font-bold text-slate-800">
                          Descargos o Versión del Estudiante:
                        </p>
                        <p className="text-slate-600 mt-1">
                          {obs.studentDischarge}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-teal-800" />
                    {obs.guardianNotified
                      ? 'Acudiente informado / enterado'
                      : 'Pendiente informar al acudiente'}
                  </span>
                  <span>
                    Estado del seguimiento: <strong>{obs.status}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Registro en Pocos Toques */}
      <ModalDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editingObs
            ? 'Editar Anotación del Observador'
            : 'Nueva Observación en Pocos Toques'
        }
        subtitle={`Curso: ${course.displayName}`}
        maxWidth="xl"
      >
        <form onSubmit={handleSaveObservation} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Estudiante *"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              options={[
                { value: '', label: 'Seleccionar estudiante...' },
                ...courseStudents.map((s) => ({
                  value: s.id,
                  label: `${s.lastName} ${s.firstName}`,
                })),
              ]}
              required
            />
            <InputField
              label="Fecha *"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Selección táctil de tipo en 1 toque */}
          <div className="space-y-2">
            <span className="text-sm font-semibold text-slate-800 block">
              Tipo de Observación (1 toque) *
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectCategoryButton('positiva')}
                className={`min-h-[48px] rounded-xl border p-2.5 text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  selectedCat === 'positiva'
                    ? 'border-emerald-700 bg-emerald-700 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span>Positiva</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCategoryButton('mejora')}
                className={`min-h-[48px] rounded-xl border p-2.5 text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  selectedCat === 'mejora'
                    ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>De mejora</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCategoryButton('convivencia')}
                className={`min-h-[48px] rounded-xl border p-2.5 text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  selectedCat === 'convivencia'
                    ? 'border-red-700 bg-red-700 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Convivencia</span>
              </button>
            </div>
          </div>

          {selectedCat !== 'positiva' && (
            <SelectField
              label="Clasificación detallada (Ley 1620 / Manual de Convivencia)"
              value={specificType}
              onChange={(e) =>
                setSpecificType(e.target.value as ObservationType)
              }
              options={
                selectedCat === 'mejora'
                  ? [
                      {
                        value: 'Seguimiento Académico',
                        label: 'Seguimiento Académico y Actitudinal',
                      },
                      {
                        value: 'Llamado de Atención',
                        label: 'Llamado de Atención Formativo',
                      },
                    ]
                  : [
                      {
                        value: 'Situación Tipo I',
                        label: 'Convivencia · Situación Tipo I (Conflicto manejable)',
                      },
                      {
                        value: 'Situación Tipo II',
                        label: 'Convivencia · Situación Tipo II (Agresión / Reiterada)',
                      },
                      {
                        value: 'Situación Tipo III',
                        label: 'Convivencia · Situación Tipo III (Gravedad mayor)',
                      },
                      {
                        value: 'Citación a Acudiente',
                        label: 'Convivencia · Citación Formal a Acudiente',
                      },
                    ]
              }
            />
          )}

          {/* Frases rápidas para ahorrar digitación en celular */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-teal-800" />
              Frases rápidas sugeridas (toca una para usarla):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PHRASES[selectedCat].map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() =>
                    setDescription((prev) =>
                      prev ? `${prev} ${phrase}` : phrase
                    )
                  }
                  className="text-left text-[11px] bg-slate-100 hover:bg-teal-50 hover:text-teal-900 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  + {phrase}
                </button>
              ))}
            </div>
          </div>

          <TextareaField
            label="Descripción de la Observación *"
            rows={3}
            placeholder="Describe la situación observada, actitud o reconocimiento..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />

          <TextareaField
            label="Compromisos y Acuerdos (Con el estudiante y/o acudiente)"
            rows={2}
            placeholder="Ej. El acudiente revisará diariamente la agenda; el estudiante entregará el taller el viernes."
            value={commitments}
            onChange={(e) => setCommitments(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <SelectField
              label="Estado del Compromiso"
              value={obsStatus}
              onChange={(e) =>
                setObsStatus(e.target.value as ObservationRecord['status'])
              }
              options={[
                { value: 'Abierto', label: 'Abierto' },
                {
                  value: 'En seguimiento',
                  label: 'En seguimiento con Acudiente',
                },
                { value: 'Cerrado', label: 'Cumplido / Cerrado' },
              ]}
            />

            <label className="min-h-[44px] mt-4 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 inline-flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={guardianNotified}
                onChange={(e) => setGuardianNotified(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-800"
              />
              <span>Acudiente notificado o presente en el acuerdo</span>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {editingObs ? 'Guardar Cambios' : 'Guardar en el Observador'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title="Eliminar observación del estudiante"
        itemName={deleteTarget?.description.slice(0, 60) || 'Observación'}
        isLoading={isSaving}
        onConfirm={handleDeleteObservation}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
