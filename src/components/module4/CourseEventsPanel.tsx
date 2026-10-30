import React, { useState } from 'react';
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Wallet,
  FileCheck2,
  Plus,
  Printer,
  Trash2,
  CheckCircle2,
  Clock,
  Coins,
  Eye,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import {
  CourseAssignment,
  Student,
  EventCollection,
  EventPaymentItem,
} from '../../types/schema';
import { formatCOP } from '../../utils/academicCalculations';
import {
  Button,
  InputField,
  SelectField,
  ModalDialog,
  ConfirmDeleteModal,
} from '../ui/DesignSystem';
import { ExportActionControl } from '../ui/ExportActionControl';

interface CourseEventsPanelProps {
  teacherId: string;
  course: CourseAssignment;
  students: Student[];
  eventCollections: EventCollection[];
  eventPaymentItems: EventPaymentItem[];
  onSelectStudentForProfile: (student: Student) => void;
  onNotify: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

export const CourseEventsPanel: React.FC<CourseEventsPanelProps> = ({
  teacherId,
  course,
  students,
  eventCollections,
  eventPaymentItems,
  onSelectStudentForProfile,
  onNotify,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const groupCollections = eventCollections
    .filter(
      (ec) =>
        ec.gradeGroupId === course.gradeGroupId &&
        (!ec.courseId || ec.courseId === course.id)
    )
    .sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));

  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    groupCollections[0]?.id || ''
  );

  // Modal de creación de nuevo control o plantilla rápida
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] =
    useState<EventCollection['eventType']>('Recaudo de Dinero');
  const [targetAmountCOP, setTargetAmountCOP] = useState('15000');
  const [dueDate, setDueDate] = useState(todayStr);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Modal para registrar un Abono parcial con fecha e historial
  const [abonoModalStudent, setAbonoModalStudent] = useState<Student | null>(
    null
  );
  const [abonoNewAmount, setAbonoNewAmount] = useState('5000');
  const [abonoDate, setAbonoDate] = useState(todayStr);
  const [abonoNote, setAbonoNote] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<EventCollection | null>(
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

  const currentCollection =
    groupCollections.find((c) => c.id === selectedCollectionId) ||
    groupCollections[0] ||
    null;

  const isMoneyCollection =
    currentCollection?.eventType === 'Recaudo de Dinero' &&
    (currentCollection?.targetAmountCOP || 0) > 0;

  const openTemplateModal = (
    template: 'dinero' | 'documentos' | 'personalizado'
  ) => {
    if (template === 'dinero') {
      setEventType('Recaudo de Dinero');
      setTitle('Cuota Copias y Material de Trabajo');
      setTargetAmountCOP('10000');
      setDescription('Recolección por estudiante con control de abonos.');
    } else if (template === 'documentos') {
      setEventType('Permiso / Autorización');
      setTitle('Entrega de Circular / Permiso Firmado por Acudiente');
      setTargetAmountCOP('0');
      setDescription('Control de quién entregó y quién falta por entregar.');
    } else {
      setEventType('Otro');
      setTitle('');
      setTargetAmountCOP('0');
      setDescription('');
    }
    setDueDate(todayStr);
    setCreateModalOpen(true);
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const amount =
      eventType === 'Recaudo de Dinero'
        ? Math.max(0, parseInt(targetAmountCOP, 10) || 0)
        : 0;

    setIsSaving(true);
    const newId = `evc_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'event_collections', newId), {
        teacherId,
        academicYearId: course.academicYearId,
        gradeGroupId: course.gradeGroupId,
        courseId: course.id,
        title: title.trim().slice(0, 150),
        description: description.trim().slice(0, 500),
        eventType,
        targetAmountCOP: amount,
        dueDate,
        status: 'Activo',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelectedCollectionId(newId);
      setCreateModalOpen(false);
      onNotify(
        'Control creado',
        `Se activó "${title.trim()}" para los estudiantes del curso.`
      );
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.CREATE,
        `event_collections/${newId}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetStudentStatus = async (
    student: Student,
    status: EventPaymentItem['paymentStatus'],
    customAmount?: number,
    customDate?: string,
    appendedHistoryNote?: string
  ) => {
    if (!currentCollection) return;

    const itemId = `epi_${currentCollection.id}_${student.id}`;
    const existing = eventPaymentItems.find((i) => i.id === itemId);

    const targetCOP = currentCollection.targetAmountCOP || 0;
    let finalAmount = 0;
    if (status === 'Pagado / Cumplido') {
      finalAmount = targetCOP;
    } else if (status === 'Abono') {
      finalAmount =
        customAmount !== undefined
          ? customAmount
          : existing?.amountPaidCOP || 0;
    } else {
      finalAmount = 0;
    }

    const finalDate = customDate || todayStr;
    const finalNote =
      appendedHistoryNote !== undefined
        ? appendedHistoryNote
        : existing?.note || '';

    try {
      await setDoc(doc(db, 'event_payment_items', itemId), {
        teacherId,
        eventCollectionId: currentCollection.id,
        gradeGroupId: course.gradeGroupId,
        courseId: course.id,
        studentId: student.id,
        amountPaidCOP: finalAmount,
        paymentStatus: status,
        paymentDate: finalDate,
        note: finalNote.slice(0, 300),
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `event_payment_items/${itemId}`
      );
    }
  };

  const handleSaveAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abonoModalStudent || !currentCollection) return;

    const addValue = Math.max(0, parseInt(abonoNewAmount, 10) || 0);
    if (addValue <= 0) return;

    const itemId = `epi_${currentCollection.id}_${abonoModalStudent.id}`;
    const existing = eventPaymentItems.find((i) => i.id === itemId);
    const previousPaid = existing?.amountPaidCOP || 0;
    const newTotalPaid = previousPaid + addValue;
    const targetCOP = currentCollection.targetAmountCOP || 0;

    const nextStatus: EventPaymentItem['paymentStatus'] =
      targetCOP > 0 && newTotalPaid >= targetCOP
        ? 'Pagado / Cumplido'
        : 'Abono';

    const historyEntry = `[${abonoDate}: +${formatCOP(addValue)}${
      abonoNote.trim() ? ` - ${abonoNote.trim()}` : ''
    }]`;
    const combinedHistory = existing?.note
      ? `${existing.note} · ${historyEntry}`
      : historyEntry;

    setIsSaving(true);
    await handleSetStudentStatus(
      abonoModalStudent,
      nextStatus,
      newTotalPaid,
      abonoDate,
      combinedHistory
    );
    setIsSaving(false);
    setAbonoModalStudent(null);
    setAbonoNote('');
    onNotify(
      'Abono registrado',
      `Se sumó ${formatCOP(addValue)} a ${abonoModalStudent.lastName} ${abonoModalStudent.firstName}.`
    );
  };

  const handleDeleteCollection = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'event_collections', deleteTarget.id));
      onNotify(
        'Control eliminado',
        `Se eliminó "${deleteTarget.title}".`
      );
      setDeleteTarget(null);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `event_collections/${deleteTarget.id}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Cálculos de resumen del control seleccionado
  const currentItems = currentCollection
    ? eventPaymentItems.filter(
        (i) => i.eventCollectionId === currentCollection.id
      )
    : [];

  const totalExpectedCOP =
    currentCollection && isMoneyCollection
      ? courseStudents.length * (currentCollection.targetAmountCOP || 0)
      : 0;

  const totalCollectedCOP = currentItems.reduce(
    (acc, item) => acc + (item.amountPaidCOP || 0),
    0
  );

  const pendingToCollectCOP = Math.max(0, totalExpectedCOP - totalCollectedCOP);

  const completedStudentsCount = courseStudents.filter((stu) => {
    const it = currentItems.find((i) => i.studentId === stu.id);
    return it?.paymentStatus === 'Pagado / Cumplido';
  }).length;

  const abonoStudentsCount = courseStudents.filter((stu) => {
    const it = currentItems.find((i) => i.studentId === stu.id);
    return it?.paymentStatus === 'Abono';
  }).length;

  const pendingStudentsCount =
    courseStudents.length - completedStudentsCount - abonoStudentsCount;

  const buildCollectionExportHtml = () => {
    if (!currentCollection) {
      return '<p>No hay controles creados en este curso todavía.</p>';
    }
    const rows = courseStudents
      .map((stu, idx) => {
        const it = currentItems.find((i) => i.studentId === stu.id);
        const status = it?.paymentStatus || 'Pendiente';
        const paid = it?.amountPaidCOP || 0;
        const pending = Math.max(
          0,
          (currentCollection.targetAmountCOP || 0) - paid
        );
        return `<tr>
          <td>${idx + 1}</td>
          <td><strong>${stu.lastName} ${stu.firstName}</strong></td>
          <td>${
            isMoneyCollection
              ? status
              : status === 'Pagado / Cumplido'
              ? 'Entregó'
              : 'No entregó'
          }</td>
          ${
            isMoneyCollection
              ? `<td>${formatCOP(paid)}</td><td>${formatCOP(pending)}</td>`
              : ''
          }
          <td>${it?.paymentDate || '—'}</td>
          <td>${it?.note || '—'}</td>
        </tr>`;
      })
      .join('');

    return `
      <div class="kpi-box">
        <strong>Control:</strong> ${currentCollection.title} (${currentCollection.eventType}) · 
        <strong>Curso:</strong> ${course.displayName}
        ${
          isMoneyCollection
            ? `<br/><strong>Cuota por estudiante:</strong> ${formatCOP(
                currentCollection.targetAmountCOP
              )} · <strong>Total Recaudado:</strong> ${formatCOP(
                totalCollectedCOP
              )} · <strong>Pendiente por cobrar:</strong> ${formatCOP(
                pendingToCollectCOP
              )}`
            : `<br/><strong>Cumplieron / Entregaron:</strong> ${completedStudentsCount} de ${courseStudents.length} estudiantes`
        }
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Estudiante</th>
            <th>Estado</th>
            ${isMoneyCollection ? '<th>Pagado</th><th>Saldo</th>' : ''}
            <th>Fecha</th>
            <th>Historial / Observación</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Plantillas Rápidas en 1 Clic */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
              <Wallet className="w-5 h-5 text-teal-800" />
              <span>Registros, Recaudos de Dinero y Control de Entregas</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Usa una plantilla rápida para llevar el control de cuotas/abonos o de entrega de circulares, permisos y documentos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ExportActionControl
              label="Exportar o imprimir"
              title={`Planilla de Control · ${currentCollection?.title || course.displayName}`}
              filename={`recaudos_${course.displayName}`}
              getBodyHtml={buildCollectionExportHtml}
              onNotify={onNotify}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => openTemplateModal('dinero')}
              leftIcon={<Coins className="w-4 h-4 text-teal-800" />}
            >
              + Plantilla Recolección de Dinero
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => openTemplateModal('documentos')}
              leftIcon={<FileCheck2 className="w-4 h-4 text-teal-800" />}
            >
              + Plantilla Permisos / Documentos
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => openTemplateModal('personalizado')}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Control Personalizado
            </Button>
          </div>
        </div>

        {/* Selector de Controles del Curso */}
        {groupCollections.length > 0 && (
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                Control activo:
              </label>
              <select
                value={currentCollection?.id || ''}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                className="min-h-[42px] w-full max-w-md rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-bold text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                {groupCollections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.eventType}
                    {c.targetAmountCOP > 0
                      ? ` · ${formatCOP(c.targetAmountCOP)}`
                      : ''}
                    )
                  </option>
                ))}
              </select>
            </div>

            {currentCollection && (
              <button
                type="button"
                onClick={() => setDeleteTarget(currentCollection)}
                className="min-h-[38px] px-3 rounded-xl border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar este control</span>
              </button>
            )}
          </div>
        )}
      </div>

      {!currentCollection ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center mx-auto">
            <Wallet className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-900 font-display">
            Aún no hay controles ni recaudos en este curso
          </h4>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Elige una de las dos plantillas rápidas para empezar a marcar pagos, abonos o entregas de documentos por estudiante.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 pt-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => openTemplateModal('dinero')}
              leftIcon={<Coins className="w-4 h-4" />}
            >
              Crear Recolección de Dinero
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => openTemplateModal('documentos')}
              leftIcon={<FileCheck2 className="w-4 h-4 text-teal-800" />}
            >
              Crear Control de Documentos / Permisos
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Resumen Financiero o de Entregas */}
          {isMoneyCollection ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Valor por Estudiante</p>
                <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                  {formatCOP(currentCollection.targetAmountCOP)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Meta curso: {formatCOP(totalExpectedCOP)}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="text-xs font-semibold text-emerald-900">
                  Total Recaudado
                </p>
                <p className="text-xl font-bold font-mono text-emerald-800 mt-1">
                  {formatCOP(totalCollectedCOP)}
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  {completedStudentsCount} al día · {abonoStudentsCount} con abono
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                <p className="text-xs font-semibold text-amber-900">
                  Pendiente por Cobrar
                </p>
                <p className="text-xl font-bold font-mono text-amber-800 mt-1">
                  {formatCOP(pendingToCollectCOP)}
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  {pendingStudentsCount} sin pagar aún
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Avance del Recaudo</p>
                <p className="text-xl font-bold font-mono text-teal-800 mt-1">
                  {totalExpectedCOP > 0
                    ? Math.round((totalCollectedCOP / totalExpectedCOP) * 100)
                    : 0}
                  %
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Fecha límite: {currentCollection.dueDate || 'Abierta'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-900">
                    Entregó / Cumplió
                  </p>
                  <p className="text-2xl font-bold font-mono text-emerald-800 mt-0.5">
                    {completedStudentsCount}
                  </p>
                </div>
                <CheckCircle2 className="w-7 h-7 text-emerald-700" />
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-red-900">
                    No ha entregado / Pendiente
                  </p>
                  <p className="text-2xl font-bold font-mono text-red-800 mt-0.5">
                    {courseStudents.length - completedStudentsCount}
                  </p>
                </div>
                <Clock className="w-7 h-7 text-red-700" />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Porcentaje de Entrega</p>
                <p className="text-2xl font-bold font-mono text-teal-800 mt-0.5">
                  {courseStudents.length > 0
                    ? Math.round(
                        (completedStudentsCount / courseStudents.length) * 100
                      )
                    : 0}
                  %
                </p>
              </div>
            </div>
          )}

          {/* Lista táctil de estudiantes para marcar Pagado, Abono o Entregó */}
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-200">
            {courseStudents.map((stu, idx) => {
              const item = currentItems.find((i) => i.studentId === stu.id);
              const status = item?.paymentStatus || 'Pendiente';
              const paidCOP = item?.amountPaidCOP || 0;
              const remainingCOP = Math.max(
                0,
                (currentCollection.targetAmountCOP || 0) - paidCOP
              );

              return (
                <div
                  key={stu.id}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400 w-5">
                        {idx + 1}.
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectStudentForProfile(stu)}
                        className="text-sm font-bold text-slate-900 hover:text-teal-800 font-display text-left truncate cursor-pointer"
                      >
                        {stu.lastName} {stu.firstName}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectStudentForProfile(stu)}
                        className="text-[11px] text-teal-800 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Ficha</span>
                      </button>
                    </div>

                    {isMoneyCollection ? (
                      <div className="pl-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="font-mono font-semibold text-emerald-800">
                          Pagado: {formatCOP(paidCOP)}
                        </span>
                        {remainingCOP > 0 && (
                          <span className="font-mono text-amber-800">
                            Saldo pendiente: {formatCOP(remainingCOP)}
                          </span>
                        )}
                        {item?.paymentDate && (
                          <span className="text-slate-500">
                            Último mov: {item.paymentDate}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="pl-7 text-xs text-slate-500">
                        {status === 'Pagado / Cumplido'
                          ? `Entregó el ${item?.paymentDate || todayStr}`
                          : 'Pendiente por entregar'}
                      </div>
                    )}

                    {item?.note && (
                      <p className="pl-7 text-[11px] font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 mt-1">
                        Historial: {item.note}
                      </p>
                    )}
                  </div>

                  {/* Botones de 1 toque según tipo de control */}
                  {isMoneyCollection ? (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleSetStudentStatus(
                            stu,
                            'Pagado / Cumplido',
                            currentCollection.targetAmountCOP,
                            todayStr,
                            `[${todayStr}: Pago total ${formatCOP(
                              currentCollection.targetAmountCOP
                            )}]`
                          )
                        }
                        className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          status === 'Pagado / Cumplido'
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-700'
                        }`}
                      >
                        Pagado Total
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAbonoModalStudent(stu);
                          setAbonoNewAmount(
                            String(Math.max(1000, Math.round(remainingCOP / 2)))
                          );
                          setAbonoDate(todayStr);
                          setAbonoNote('');
                        }}
                        className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          status === 'Abono'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-amber-600'
                        }`}
                      >
                        + Abono
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleSetStudentStatus(
                            stu,
                            'Pendiente',
                            0,
                            '',
                            ''
                          )
                        }
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          status === 'Pendiente'
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Pendiente
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleSetStudentStatus(
                            stu,
                            'Pagado / Cumplido',
                            0,
                            todayStr
                          )
                        }
                        className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          status === 'Pagado / Cumplido'
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-700'
                        }`}
                      >
                        Entregó
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSetStudentStatus(stu, 'Pendiente', 0, '')
                        }
                        className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          status === 'Pendiente'
                            ? 'bg-red-700 text-white border-red-700'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-red-700'
                        }`}
                      >
                        No entregó
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal: Crear Nuevo Control / Recaudo */}
      <ModalDialog
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Crear Control o Recolección del Curso"
        subtitle={`Curso: ${course.displayName}`}
      >
        <form onSubmit={handleCreateCollection} className="space-y-4">
          <SelectField
            label="Tipo de Control *"
            value={eventType}
            onChange={(e) =>
              setEventType(e.target.value as EventCollection['eventType'])
            }
            options={[
              {
                value: 'Recaudo de Dinero',
                label: 'Recolección de Dinero (Pagos, abonos y total recaudado)',
              },
              {
                value: 'Permiso / Autorización',
                label: 'Control de Entrega de Documentos, Permisos o Circulares',
              },
              {
                value: 'Entrega de Materiales',
                label: 'Control de Entrega de Materiales o Kit Escolar',
              },
              {
                value: 'Evento / Salida',
                label: 'Salida Pedagógica / Evento Especial',
              },
              { value: 'Otro', label: 'Otro Control Personalizado' },
            ]}
          />

          <InputField
            label="Nombre del Control o Recaudo *"
            placeholder="Ej. Cuota salidas pedagógicas / Circular reunión de padres"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {eventType === 'Recaudo de Dinero' && (
            <InputField
              label="Valor por Estudiante en Pesos (COP) *"
              type="number"
              min="0"
              step="500"
              value={targetAmountCOP}
              onChange={(e) => setTargetAmountCOP(e.target.value)}
              helperText="Permite registrar pagos completos o abonos parciales con fecha."
              required
            />
          )}

          <InputField
            label="Fecha Límite o Fecha del Evento"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <InputField
            label="Descripción o Nota (Opcional)"
            placeholder="Detalle adicional para recordar en la planilla"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              Crear Control
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Registrar Abono con Fecha e Historial */}
      <ModalDialog
        isOpen={Boolean(abonoModalStudent)}
        onClose={() => setAbonoModalStudent(null)}
        title={`Registrar Abono · ${abonoModalStudent?.lastName || ''} ${
          abonoModalStudent?.firstName || ''
        }`}
        subtitle={currentCollection?.title || ''}
      >
        <form onSubmit={handleSaveAbono} className="space-y-4">
          <InputField
            label="Valor del Abono que entrega hoy (COP) *"
            type="number"
            min="100"
            step="100"
            value={abonoNewAmount}
            onChange={(e) => setAbonoNewAmount(e.target.value)}
            required
          />
          <InputField
            label="Fecha del Abono *"
            type="date"
            value={abonoDate}
            onChange={(e) => setAbonoDate(e.target.value)}
            required
          />
          <InputField
            label="Nota u observación del abono (Opcional)"
            placeholder="Ej. Entregó en efectivo la mamá"
            value={abonoNote}
            onChange={(e) => setAbonoNote(e.target.value)}
          />

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAbonoModalStudent(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              Guardar Abono
            </Button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title="Eliminar control del curso"
        itemName={deleteTarget?.title || ''}
        isLoading={isSaving}
        onConfirm={handleDeleteCollection}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
