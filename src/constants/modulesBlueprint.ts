import { ModuleBlueprintInfo } from '../types/schema';

export const MODULES_BLUEPRINT: ModuleBlueprintInfo[] = [
  {
    id: 'espacios',
    number: 1,
    title: 'Módulo 1 · Espacios de Trabajo y Estudiantes',
    shortTitle: 'Espacios y Estudiantes',
    subtitle: 'Año lectivo, periodos, áreas, grados, grupos y fichas estudiantiles con IA / Excel',
    entities: [
      'teachers',
      'academic_years',
      'academic_periods',
      'areas_subjects',
      'grade_groups',
      'courses',
      'students',
      'student_custom_fields',
    ],
    feedsInto: [
      'Asistencia Diaria (Módulo 2)',
      'Libro de Calificaciones (Módulo 3)',
      'Observador y Recaudos (Módulo 4)',
      'Panel de Análisis (Módulo 5)',
      'Boletines y Reportes (Módulo 6)',
      'Planes de Apoyo y Mensajes (Módulo 7)',
    ],
    description:
      'Es la columna vertebral del sistema. Define la institución, el año escolar activo, los periodos con sus pesos porcentuales, los grados/grupos (Preescolar a Media y CLEI/Adultos), las áreas/asignaturas y el directorio de estudiantes con campos personalizados.',
  },
  {
    id: 'asistencia',
    number: 2,
    title: 'Módulo 2 · Asistencia Diaria',
    shortTitle: 'Asistencia',
    subtitle: 'Llamado a lista táctil por curso y fecha: Presente, Ausente, Tardanza, Excusa y Evasión',
    entities: ['attendance'],
    feedsInto: [
      'Panel de Análisis: alertas por inasistencia reiterada (Módulo 5)',
      'Reportes y Boletín: consolidado de fallas por periodo (Módulo 6)',
      'Mensajes a Acudientes: notificación inmediata (Módulo 7)',
    ],
    description:
      'Conecta cada curso y estudiante del Módulo 1 con el registro diario de asistencia en el salón desde el celular o tablet en un solo toque.',
  },
  {
    id: 'calificaciones',
    number: 3,
    title: 'Módulo 3 · Libro de Calificaciones SIEE',
    shortTitle: 'Calificaciones',
    subtitle: 'Categorías (Saber, Hacer, Ser), actividades con pesos y Escala Nacional (Bajo, Básico, Alto, Superior)',
    entities: [
      'evaluation_categories',
      'evaluation_activities',
      'grade_entries',
    ],
    feedsInto: [
      'Panel de Análisis: promedios y mortalidad académica (Módulo 5)',
      'Boletín Formal: notas definitivas y desempeño SIEE (Módulo 6)',
      'Planes de Apoyo: detección automática de desempeño Bajo (Módulo 7)',
    ],
    description:
      'Calcula automáticamente las notas definitivas por categoría y periodo respetando los porcentajes configurados por el docente y su equivalencia en la escala nacional colombiana (Decreto 1290).',
  },
  {
    id: 'observador',
    number: 4,
    title: 'Módulo 4 · Observador y Eventualidades (Recaudos)',
    shortTitle: 'Observador y Recaudos',
    subtitle: 'Seguimiento convivencial (Ley 1620), actitud, descargos, permisos y control de recaudos en pesos (COP)',
    entities: [
      'observations',
      'event_collections',
      'event_payment_items',
    ],
    feedsInto: [
      'Panel de Análisis: indicadores de convivencia y estado de cartera/recaudos (Módulo 5)',
      'Reportes Imprimibles: ficha del observador y paz y salvo de pagos (Módulo 6)',
      'Mensajes a Acudientes: citaciones y comprobantes (Módulo 7)',
    ],
    description:
      'Reemplaza el cuaderno de observador y las listas sueltas de cobros (salidas pedagógicas, fotocopias, eventos), llevando el estado individual por estudiante (Pendiente, Abono, Pagado).',
  },
  {
    id: 'analisis',
    number: 5,
    title: 'Módulo 5 · Panel de Análisis (Dashboard)',
    shortTitle: 'Análisis',
    subtitle: 'Indicadores en tiempo real, filtros por periodo/grupo/área y alertas tempranas',
    entities: [
      'Lectura transversal de students, attendance, grade_entries, observations y event_payment_items',
    ],
    feedsInto: [
      'Toma de decisiones en Consejo Académico y Comisiones de Evaluación (Módulo 6)',
    ],
    description:
      'Cruza toda la base de datos para mostrar distribución por desempeño (Bajo, Básico, Alto, Superior), estudiantes en riesgo por inasistencia o pérdida académica y balance de recaudos.',
  },
  {
    id: 'reportes',
    number: 6,
    title: 'Módulo 6 · Reportes PDF/Word y Boletín Formal',
    shortTitle: 'Reportes y Boletín',
    subtitle: 'Planillas imprimibles, actas de seguimiento y boletín informativo para padres con escudo institucional',
    entities: [
      'Consolida teachers (logo/datos), students, grade_entries, attendance y observations',
    ],
    feedsInto: [
      'Entrega oficial a coordinación y padres de familia en reuniones de periodo',
    ],
    description:
      'Genera documentos formales listos para imprimir o exportar en PDF y Word utilizando el membrete institucional configurado por el docente.',
  },
  {
    id: 'extras',
    number: 7,
    title: 'Módulo 7 · Funciones Extra y Herramientas Docentes',
    shortTitle: 'Herramientas Extra',
    subtitle: 'Calendario escolar, planes de apoyo/nivelación, mensajes a acudientes, copia de seguridad y búsqueda global',
    entities: [
      'support_plans',
      'calendar_events',
      'guardian_messages',
    ],
    feedsInto: [
      'Cierre de ciclo pedagógico, recuperación de notas y respaldo integral del docente',
    ],
    description:
      'Integra la agenda docente, el seguimiento de nivelaciones para estudiantes con desempeño Bajo, el historial de comunicados a padres y la exportación/copia de seguridad completa.',
  },
];
