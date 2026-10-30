/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import {
  auth,
  db,
  testFirestoreConnection,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  ModuleKey,
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
  GuardianMessageTemplate,
} from './types/schema';
import { AuthScreen } from './components/auth/AuthScreen';
import { AppShell } from './components/layout/AppShell';
import { FoundationHome } from './components/dashboard/FoundationHome';
import { WorkspaceModule1 } from './components/module1/WorkspaceModule1';
import { InternalCourseTab } from './components/module1/CourseDetailView';
import { StudentProfileModal } from './components/module1/StudentProfileModal';
import { StandaloneCourseModuleView } from './components/module2/StandaloneCourseModuleView';
import { AnalyticsDashboard } from './components/module5/AnalyticsDashboard';
import { ReportsAndBulletinsModule } from './components/module6/ReportsAndBulletinsModule';
import { ExtrasModule } from './components/module7/ExtrasModule';
import { InstitutionSettingsModal } from './components/settings/InstitutionSettingsModal';
import { ToastContainer, ToastMessage } from './components/ui/DesignSystem';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(
    null
  );
  const [activeModule, setActiveModule] = useState<ModuleKey>('inicio');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [initialCourseTab, setInitialCourseTab] =
    useState<InternalCourseTab>('estudiantes');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [globalProfileStudent, setGlobalProfileStudent] =
    useState<Student | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Estados en tiempo real para los 7 Módulos
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [subjects, setSubjects] = useState<AreaSubject[]>([]);
  const [groups, setGroups] = useState<GradeGroup[]>([]);
  const [courses, setCourses] = useState<CourseAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [customFields, setCustomFields] = useState<StudentCustomField[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [categories, setCategories] = useState<EvaluationCategory[]>([]);
  const [activities, setActivities] = useState<EvaluationActivity[]>([]);
  const [gradeEntries, setGradeEntries] = useState<GradeEntry[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [eventCollections, setEventCollections] = useState<EventCollection[]>(
    []
  );
  const [eventPaymentItems, setEventPaymentItems] = useState<
    EventPaymentItem[]
  >([]);
  const [supportPlans, setSupportPlans] = useState<SupportPlan[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [guardianMessages, setGuardianMessages] = useState<
    GuardianMessageTemplate[]
  >([]);

  const addToast = (
    title: string,
    detail?: string,
    type: 'success' | 'error' | 'info' = 'success'
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, title, detail, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    testFirestoreConnection();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !currentUser) {
      setTeacherProfile(null);
      setYears([]);
      setPeriods([]);
      setSubjects([]);
      setGroups([]);
      setCourses([]);
      setStudents([]);
      setCustomFields([]);
      setAttendanceRecords([]);
      setCategories([]);
      setActivities([]);
      setGradeEntries([]);
      setObservations([]);
      setEventCollections([]);
      setEventPaymentItems([]);
      setSupportPlans([]);
      setCalendarEvents([]);
      setGuardianMessages([]);
      return;
    }

    const uid = currentUser.uid;
    const teacherPath = `teachers/${uid}`;
    const teacherRef = doc(db, 'teachers', uid);

    const unsubProfile = onSnapshot(
      teacherRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          setTeacherProfile({
            id: snapshot.id,
            ...(snapshot.data() as TeacherProfile),
          });
        } else {
          try {
            await setDoc(teacherRef, {
              teacherId: uid,
              fullName: (
                currentUser.displayName || 'Docente Titular'
              ).slice(0, 150),
              email: (
                currentUser.email || 'docente@colegio.edu.co'
              ).slice(0, 200),
              specialty: 'Educación General',
              institutionName: 'Institución Educativa Oficial',
              institutionCity: 'Colombia',
              gradingScaleMin: 1.0,
              gradingScaleMax: 5.0,
              passingScore: 3.0,
              basicMin: 3.0,
              highMin: 4.0,
              superiorMin: 4.6,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, teacherPath);
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, teacherPath)
    );

    const unsubYears = onSnapshot(
      query(collection(db, 'academic_years'), where('teacherId', '==', uid)),
      (snap) => {
        setYears(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<AcademicYear, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'academic_years')
    );

    const unsubPeriods = onSnapshot(
      query(collection(db, 'academic_periods'), where('teacherId', '==', uid)),
      (snap) => {
        setPeriods(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<AcademicPeriod, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'academic_periods')
    );

    const unsubSubjects = onSnapshot(
      query(collection(db, 'areas_subjects'), where('teacherId', '==', uid)),
      (snap) => {
        setSubjects(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<AreaSubject, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'areas_subjects')
    );

    const unsubGroups = onSnapshot(
      query(collection(db, 'grade_groups'), where('teacherId', '==', uid)),
      (snap) => {
        setGroups(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<GradeGroup, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'grade_groups')
    );

    const unsubCourses = onSnapshot(
      query(collection(db, 'courses'), where('teacherId', '==', uid)),
      (snap) => {
        setCourses(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<CourseAssignment, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'courses')
    );

    const unsubStudents = onSnapshot(
      query(collection(db, 'students'), where('teacherId', '==', uid)),
      (snap) => {
        setStudents(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<Student, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'students')
    );

    const unsubCustomFields = onSnapshot(
      query(
        collection(db, 'student_custom_fields'),
        where('teacherId', '==', uid)
      ),
      (snap) => {
        setCustomFields(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<StudentCustomField, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, 'student_custom_fields')
    );

    const unsubAttendance = onSnapshot(
      query(collection(db, 'attendance'), where('teacherId', '==', uid)),
      (snap) => {
        setAttendanceRecords(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<AttendanceRecord, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
    );

    const unsubCategories = onSnapshot(
      query(
        collection(db, 'evaluation_categories'),
        where('teacherId', '==', uid)
      ),
      (snap) => {
        setCategories(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<EvaluationCategory, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, 'evaluation_categories')
    );

    const unsubActivities = onSnapshot(
      query(
        collection(db, 'evaluation_activities'),
        where('teacherId', '==', uid)
      ),
      (snap) => {
        setActivities(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<EvaluationActivity, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, 'evaluation_activities')
    );

    const unsubGradeEntries = onSnapshot(
      query(collection(db, 'grade_entries'), where('teacherId', '==', uid)),
      (snap) => {
        setGradeEntries(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<GradeEntry, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'grade_entries')
    );

    const unsubObservations = onSnapshot(
      query(collection(db, 'observations'), where('teacherId', '==', uid)),
      (snap) => {
        setObservations(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<ObservationRecord, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'observations')
    );

    const unsubEventCollections = onSnapshot(
      query(collection(db, 'event_collections'), where('teacherId', '==', uid)),
      (snap) => {
        setEventCollections(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<EventCollection, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, 'event_collections')
    );

    const unsubEventPaymentItems = onSnapshot(
      query(
        collection(db, 'event_payment_items'),
        where('teacherId', '==', uid)
      ),
      (snap) => {
        setEventPaymentItems(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<EventPaymentItem, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, 'event_payment_items')
    );

    const unsubSupportPlans = onSnapshot(
      query(collection(db, 'support_plans'), where('teacherId', '==', uid)),
      (snap) => {
        setSupportPlans(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<SupportPlan, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'support_plans')
    );

    const unsubCalendarEvents = onSnapshot(
      query(collection(db, 'calendar_events'), where('teacherId', '==', uid)),
      (snap) => {
        setCalendarEvents(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<CalendarEvent, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'calendar_events')
    );

    const unsubGuardianMessages = onSnapshot(
      query(collection(db, 'guardian_messages'), where('teacherId', '==', uid)),
      (snap) => {
        setGuardianMessages(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<GuardianMessageTemplate, 'id'>),
            id: d.id,
          }))
        );
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, 'guardian_messages')
    );

    return () => {
      unsubProfile();
      unsubYears();
      unsubPeriods();
      unsubSubjects();
      unsubGroups();
      unsubCourses();
      unsubStudents();
      unsubCustomFields();
      unsubAttendance();
      unsubCategories();
      unsubActivities();
      unsubGradeEntries();
      unsubObservations();
      unsubEventCollections();
      unsubEventPaymentItems();
      unsubSupportPlans();
      unsubCalendarEvents();
      unsubGuardianMessages();
    };
  }, [authReady, currentUser]);

  const [routeResetKey, setRouteResetKey] = useState(0);

  const handleLogout = async () => {
    await signOut(auth);
    setActiveModule('inicio');
    setSelectedCourseId(null);
  };

  const handleSelectModule = (mod: ModuleKey) => {
    if (mod === 'inicio') {
      setRouteResetKey((prev) => prev + 1);
    }
    setActiveModule(mod);
    setSelectedCourseId(null);
    setInitialCourseTab('estudiantes');
  };

  const handleEnterCourseFromDashboard = (
    courseId: string,
    tab: InternalCourseTab = 'estudiantes'
  ) => {
    setSelectedCourseId(courseId);
    setInitialCourseTab(tab);
    setActiveModule('espacios');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 text-teal-800 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-800 font-display">
          Cargando Mi Aula Digital...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  const liveGlobalStudent = globalProfileStudent
    ? students.find((s) => s.id === globalProfileStudent.id) ||
      globalProfileStudent
    : null;
  const globalStudentGroup = liveGlobalStudent
    ? groups.find((g) => g.id === liveGlobalStudent.gradeGroupId) || null
    : null;

  return (
    <>
      <AppShell
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        teacherProfile={teacherProfile}
        students={students}
        groups={groups}
        onSelectGlobalStudent={(stu) => setGlobalProfileStudent(stu)}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogoutRequest={handleLogout}
      >
        {activeModule === 'espacios' ? (
          <WorkspaceModule1
            teacherId={currentUser.uid}
            years={years}
            periods={periods}
            subjects={subjects}
            groups={groups}
            courses={courses}
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
            selectedCourseId={selectedCourseId}
            initialCourseTab={initialCourseTab}
            onSelectCourse={(cid) => {
              setSelectedCourseId(cid);
              if (!cid) setInitialCourseTab('estudiantes');
            }}
            onOpenScaleSettings={() => setSettingsOpen(true)}
            onNotify={addToast}
          />
        ) : activeModule === 'asistencia' ||
          activeModule === 'calificaciones' ||
          activeModule === 'observador' ? (
          <StandaloneCourseModuleView
            mode={activeModule}
            teacherId={currentUser.uid}
            courses={courses}
            groups={groups}
            subjects={subjects}
            years={years}
            periods={periods}
            students={students}
            customFields={customFields}
            attendanceRecords={attendanceRecords}
            categories={categories}
            activities={activities}
            gradeEntries={gradeEntries}
            observations={observations}
            eventCollections={eventCollections}
            eventPaymentItems={eventPaymentItems}
            teacherProfile={teacherProfile}
            onGoToModule1={() => handleSelectModule('inicio')}
            onOpenScaleSettings={() => setSettingsOpen(true)}
            onNotify={addToast}
          />
        ) : activeModule === 'analisis' ? (
          <AnalyticsDashboard
            teacherId={currentUser.uid}
            teacherProfile={teacherProfile}
            years={years}
            periods={periods}
            subjects={subjects}
            groups={groups}
            courses={courses}
            students={students}
            customFields={customFields}
            attendanceRecords={attendanceRecords}
            categories={categories}
            activities={activities}
            gradeEntries={gradeEntries}
            observations={observations}
            eventCollections={eventCollections}
            eventPaymentItems={eventPaymentItems}
            onNotify={addToast}
          />
        ) : activeModule === 'reportes' ? (
          <ReportsAndBulletinsModule
            teacherId={currentUser.uid}
            teacherProfile={teacherProfile}
            years={years}
            periods={periods}
            subjects={subjects}
            groups={groups}
            courses={courses}
            students={students}
            attendanceRecords={attendanceRecords}
            categories={categories}
            activities={activities}
            gradeEntries={gradeEntries}
            observations={observations}
            eventCollections={eventCollections}
            eventPaymentItems={eventPaymentItems}
            onOpenSettings={() => setSettingsOpen(true)}
            onNotify={addToast}
          />
        ) : activeModule === 'extras' ? (
          <ExtrasModule
            teacherId={currentUser.uid}
            teacherProfile={teacherProfile}
            years={years}
            periods={periods}
            subjects={subjects}
            groups={groups}
            courses={courses}
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
            onNotify={addToast}
          />
        ) : (
          <FoundationHome
            key={routeResetKey}
            activeModule={activeModule}
            onSelectModule={handleSelectModule}
            teacherProfile={teacherProfile}
            teacherId={currentUser.uid}
            years={years}
            periods={periods}
            courses={courses}
            groups={groups}
            subjects={subjects}
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
            onEnterCourse={handleEnterCourseFromDashboard}
            onOpenSettings={() => setSettingsOpen(true)}
            onShowToast={(title, detail) => addToast(title, detail, 'info')}
          />
        )}
      </AppShell>

      <StudentProfileModal
        isOpen={Boolean(liveGlobalStudent)}
        onClose={() => setGlobalProfileStudent(null)}
        teacherId={currentUser.uid}
        student={liveGlobalStudent}
        group={globalStudentGroup}
        customFields={customFields}
        courses={courses.filter(
          (c) => c.gradeGroupId === liveGlobalStudent?.gradeGroupId
        )}
        periods={periods}
        attendanceRecords={attendanceRecords}
        categories={categories}
        activities={activities}
        gradeEntries={gradeEntries}
        observations={observations}
        eventCollections={eventCollections}
        eventPaymentItems={eventPaymentItems}
        teacherProfile={teacherProfile}
        onSaved={() => {
          addToast(
            'Ficha actualizada',
            'Los datos del estudiante se guardaron correctamente.'
          );
        }}
      />

      <InstitutionSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={teacherProfile}
        onSaved={(msg) => addToast('Cambios guardados', msg, 'success')}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
