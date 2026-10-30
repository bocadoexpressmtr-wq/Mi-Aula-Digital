import React, { useState } from 'react';
import {
  CalendarCheck,
  BookOpenCheck,
  ClipboardList,
  Wallet,
  Users,
  ArrowRight,
} from 'lucide-react';
import {
  CourseAssignment,
  GradeGroup,
  AreaSubject,
  AcademicYear,
  AcademicPeriod,
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
} from '../../types/schema';
import { Button } from '../ui/DesignSystem';
import { CourseAttendancePanel } from './CourseAttendancePanel';
import { CourseGradebookPanel } from '../module3/CourseGradebookPanel';
import { CourseObserverPanel } from '../module4/CourseObserverPanel';
import { CourseEventsPanel } from '../module4/CourseEventsPanel';
import { StudentProfileModal } from '../module1/StudentProfileModal';

interface StandaloneCourseModuleViewProps {
  mode: 'asistencia' | 'calificaciones' | 'observador';
  teacherId: string;
  courses: CourseAssignment[];
  groups: GradeGroup[];
  subjects: AreaSubject[];
  years: AcademicYear[];
  periods: AcademicPeriod[];
  students: Student[];
  customFields: StudentCustomField[];
  attendanceRecords: AttendanceRecord[];
  categories: EvaluationCategory[];
  activities: EvaluationActivity[];
  gradeEntries: GradeEntry[];
  observations: ObservationRecord[];
  eventCollections: EventCollection[];
  eventPaymentItems: EventPaymentItem[];
  teacherProfile: TeacherProfile | null;
  onGoToModule1: () => void;
  onOpenScaleSettings: () => void;
  onNotify: (
    title: string,
    detail?: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

export const StandaloneCourseModuleView: React.FC<
  StandaloneCourseModuleViewProps
> = ({
  mode,
  teacherId,
  courses,
  groups,
  periods,
  students,
  customFields,
  attendanceRecords,
  categories,
  activities,
  gradeEntries,
  observations,
  eventCollections,
  eventPaymentItems,
  teacherProfile,
  onGoToModule1,
  onOpenScaleSettings,
  onNotify,
}) => {
  const activeCourses = courses.filter((c) => !c.archived);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    activeCourses[0]?.id || ''
  );
  const [module4SubTab, setModule4SubTab] = useState<'observador' | 'registros'>(
    'observador'
  );
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const currentCourse =
    activeCourses.find((c) => c.id === selectedCourseId) ||
    activeCourses[0] ||
    null;

  if (!currentCourse) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center mx-auto">
          <Users className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 font-display">
          Primero crea un curso en el Módulo 1
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Para gestionar{' '}
          {mode === 'asistencia'
            ? 'la asistencia diaria'
            : mode === 'calificaciones'
            ? 'las calificaciones'
            : 'el observador y los recaudos'}
          , configura primero tu curso y estudiantes en el Módulo 1.
        </p>
        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={onGoToModule1}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Ir a Módulo 1 (Espacios y Cursos)
          </Button>
        </div>
      </div>
    );
  }

  const coursePeriods = periods
    .filter((p) => p.academicYearId === currentCourse.academicYearId)
    .sort((a, b) => a.number - b.number);

  const currentGroup = groups.find((g) => g.id === currentCourse.gradeGroupId);

  return (
    <div className="space-y-6">
      {/* Selector superior de Curso */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-teal-800 flex items-center gap-1.5">
              {mode === 'asistencia' && (
                <>
                  <CalendarCheck className="w-4 h-4" />
                  <span>
                    Módulo 2 de 7 · Registro y Resumen de Asistencia Diaria
                  </span>
                </>
              )}
              {mode === 'calificaciones' && (
                <>
                  <BookOpenCheck className="w-4 h-4" />
                  <span>
                    Módulo 3 de 7 · Libro de Calificaciones y Escala Nacional SIEE
                  </span>
                </>
              )}
              {mode === 'observador' && (
                <>
                  <ClipboardList className="w-4 h-4" />
                  <span>
                    Módulo 4 de 7 · Observador del Estudiante, Recaudos y Eventualidades
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 font-display mt-1">
              {currentCourse.displayName}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <label
              htmlFor="standalone-course-select"
              className="text-xs font-semibold text-slate-600 whitespace-nowrap"
            >
              Cambiar Curso:
            </label>
            <select
              id="standalone-course-select"
              value={currentCourse.id}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-bold text-slate-900 focus:border-teal-700 focus:outline-none"
            >
              {activeCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mode === 'observador' && (
          <div className="pt-4 border-t border-slate-200 flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setModule4SubTab('observador')}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors ${
                module4SubTab === 'observador'
                  ? 'bg-teal-800 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Observador (Actitud y Convivencia)</span>
            </button>

            <button
              type="button"
              onClick={() => setModule4SubTab('registros')}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors ${
                module4SubTab === 'registros'
                  ? 'bg-teal-800 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Registros, Recaudos y Entregas</span>
            </button>
          </div>
        )}
      </div>

      {mode === 'asistencia' && (
        <CourseAttendancePanel
          teacherId={teacherId}
          course={currentCourse}
          periods={coursePeriods}
          students={students}
          attendanceRecords={attendanceRecords}
          onSelectStudentForProfile={(stu) => setSelectedStudent(stu)}
          onNotify={onNotify}
        />
      )}

      {mode === 'calificaciones' && (
        <CourseGradebookPanel
          teacherId={teacherId}
          course={currentCourse}
          periods={coursePeriods}
          students={students}
          categories={categories}
          activities={activities}
          gradeEntries={gradeEntries}
          teacherProfile={teacherProfile}
          onOpenScaleSettings={onOpenScaleSettings}
          onSelectStudentForProfile={(stu) => setSelectedStudent(stu)}
          onNotify={onNotify}
        />
      )}

      {mode === 'observador' && module4SubTab === 'observador' && (
        <CourseObserverPanel
          teacherId={teacherId}
          course={currentCourse}
          periods={coursePeriods}
          students={students}
          observations={observations}
          onSelectStudentForProfile={(stu) => setSelectedStudent(stu)}
          onNotify={onNotify}
        />
      )}

      {mode === 'observador' && module4SubTab === 'registros' && (
        <CourseEventsPanel
          teacherId={teacherId}
          course={currentCourse}
          students={students}
          eventCollections={eventCollections}
          eventPaymentItems={eventPaymentItems}
          onSelectStudentForProfile={(stu) => setSelectedStudent(stu)}
          onNotify={onNotify}
        />
      )}

      <StudentProfileModal
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        student={selectedStudent}
        group={currentGroup}
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
