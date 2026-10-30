import { Timestamp } from 'firebase/firestore';

export type ModuleKey =
  | 'inicio'
  | 'espacios'
  | 'asistencia'
  | 'calificaciones'
  | 'observador'
  | 'analisis'
  | 'reportes'
  | 'extras';

export type EducationLevel =
  | 'Preescolar'
  | 'Primaria'
  | 'Secundaria'
  | 'Media'
  | 'CLEI / Adultos'
  | 'Todos';

export type SchoolShift =
  | 'Mañana'
  | 'Tarde'
  | 'Única'
  | 'Nocturna'
  | 'Sabatina / Dominical';

export type NationalScaleLevel = 'Bajo' | 'Básico' | 'Alto' | 'Superior';

export interface TeacherProfile {
  id?: string;
  teacherId: string;
  fullName: string;
  email: string;
  documentId?: string;
  phone?: string;
  specialty?: string;
  institutionName: string;
  institutionsList?: string[];
  institutionDane?: string;
  institutionNit?: string;
  institutionCity?: string;
  institutionLogoUrl?: string;
  gradingScaleMin: number;
  gradingScaleMax: number;
  passingScore: number;
  basicMin?: number;
  highMin?: number;
  superiorMin?: number;
  customScaleName?: string;
  activeYearId?: string;
  activePeriodId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AcademicYear {
  id: string;
  teacherId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: 'active' | 'closed' | 'draft';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AcademicPeriod {
  id: string;
  teacherId: string;
  academicYearId: string;
  name: string;
  number: number;
  weightPercentage: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AreaSubject {
  id: string;
  teacherId: string;
  name: string;
  areaName: string;
  code?: string;
  weeklyHours: number;
  educationLevel: EducationLevel;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GradeGroup {
  id: string;
  teacherId: string;
  academicYearId: string;
  institutionName?: string;
  gradeName: string;
  groupName: string;
  educationLevel: Exclude<EducationLevel, 'Todos'>;
  shift: SchoolShift;
  isDirector: boolean;
  room?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CourseAssignment {
  id: string;
  teacherId: string;
  academicYearId: string;
  gradeGroupId: string;
  areaSubjectId: string;
  displayName: string;
  scheduleSummary?: string;
  archived?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Student {
  id: string;
  teacherId: string;
  academicYearId: string;
  gradeGroupId: string;
  firstName: string;
  lastName: string;
  documentType: 'RC' | 'TI' | 'CC' | 'CE' | 'PPT' | 'NES' | 'Otro';
  documentNumber?: string;
  code?: string;
  birthDate?: string;
  gender?: string;
  guardianName?: string;
  guardianRelationship?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  eps?: string;
  bloodType?: string;
  piarOrAlert?: string;
  status: 'Activo' | 'Retirado' | 'Trasladado' | 'Desertor';
  customValues?: Record<string, string | number | boolean>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StudentCustomField {
  id: string;
  teacherId: string;
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
  required: boolean;
  order?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AttendanceRecord {
  id: string;
  teacherId: string;
  academicYearId: string;
  periodId: string;
  courseId: string;
  gradeGroupId: string;
  studentId: string;
  date: string;
  status: 'Presente' | 'Ausente' | 'Tardanza' | 'Excusa' | 'Evasión';
  note?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface EvaluationCategory {
  id: string;
  teacherId: string;
  academicYearId: string;
  periodId: string;
  courseId: string;
  name: string;
  weightPercentage: number;
  description?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface EvaluationActivity {
  id: string;
  teacherId: string;
  academicYearId: string;
  periodId: string;
  courseId: string;
  categoryId: string;
  title: string;
  description?: string;
  dueDate?: string;
  weightInCategory: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GradeEntry {
  id: string;
  teacherId: string;
  academicYearId: string;
  periodId: string;
  courseId: string;
  categoryId: string;
  activityId: string;
  studentId: string;
  score: number;
  nationalScaleLevel: NationalScaleLevel;
  feedback?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ObservationRecord {
  id: string;
  teacherId: string;
  academicYearId: string;
  periodId: string;
  gradeGroupId: string;
  courseId?: string;
  studentId: string;
  date: string;
  type:
    | 'Reconocimiento Positivo'
    | 'Llamado de Atención'
    | 'Situación Tipo I'
    | 'Situación Tipo II'
    | 'Situación Tipo III'
    | 'Seguimiento Académico'
    | 'Citación a Acudiente';
  description: string;
  studentDischarge?: string;
  commitments?: string;
  guardianNotified: boolean;
  status: 'Abierto' | 'En seguimiento' | 'Cerrado';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface EventCollection {
  id: string;
  teacherId: string;
  academicYearId: string;
  gradeGroupId: string;
  courseId?: string;
  title: string;
  description?: string;
  eventType:
    | 'Recaudo de Dinero'
    | 'Permiso / Autorización'
    | 'Entrega de Materiales'
    | 'Evento / Salida'
    | 'Otro';
  targetAmountCOP: number;
  dueDate?: string;
  status: 'Activo' | 'Cerrado';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface EventPaymentItem {
  id: string;
  teacherId: string;
  eventCollectionId: string;
  gradeGroupId: string;
  courseId?: string;
  studentId: string;
  amountPaidCOP: number;
  paymentStatus: 'Pendiente' | 'Abono' | 'Pagado / Cumplido' | 'Exento';
  paymentDate?: string;
  note?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SupportPlan {
  id: string;
  teacherId: string;
  academicYearId: string;
  periodId: string;
  courseId: string;
  studentId: string;
  weaknesses: string;
  assignedActivities: string;
  dueDate?: string;
  recoveryScore?: number;
  status: 'Asignado' | 'En revisión' | 'Superado' | 'No superado';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CalendarEvent {
  id: string;
  teacherId: string;
  academicYearId: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  category:
    | 'Evaluación'
    | 'Reunión de Padres'
    | 'Consejo Académico'
    | 'Actividad Institucional'
    | 'Entrega de Planillas'
    | 'Otro';
  courseId?: string;
  completed: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GuardianMessage {
  id: string;
  teacherId: string;
  academicYearId: string;
  gradeGroupId: string;
  studentId?: string;
  subject: string;
  body: string;
  channel:
    | 'WhatsApp'
    | 'Correo Electrónico'
    | 'Nota Impresa'
    | 'Citación Presencial';
  sentDate?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ModuleBlueprintInfo {
  id: ModuleKey;
  number: number;
  title: string;
  shortTitle: string;
  subtitle: string;
  entities: string[];
  feedsInto: string[];
  description: string;
}
