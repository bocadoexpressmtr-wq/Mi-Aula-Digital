import React, { useState, useMemo } from 'react';
import {
  Layers,
  BarChart3,
  FileSpreadsheet,
  Wrench,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  Search,
  UserCheck,
} from 'lucide-react';
import {
  ModuleKey,
  TeacherProfile,
  Student,
  GradeGroup,
} from '../../types/schema';
import {
  Button,
  ModalDialog,
  formatShortTeacherName,
} from '../ui/DesignSystem';

interface AppShellProps {
  activeModule: ModuleKey;
  onSelectModule: (mod: ModuleKey) => void;
  teacherProfile: TeacherProfile | null;
  students?: Student[];
  groups?: GradeGroup[];
  onSelectGlobalStudent?: (student: Student) => void;
  onOpenSettings: () => void;
  onLogoutRequest: () => void;
  children: React.ReactNode;
}

interface NavItemConfig {
  id: ModuleKey;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'inicio',
    label: 'Mis Espacios (Grados y Grupos)',
    shortLabel: 'Espacios',
    icon: Layers,
  },
  {
    id: 'analisis',
    label: 'Análisis Global',
    shortLabel: 'Análisis',
    icon: BarChart3,
  },
  {
    id: 'reportes',
    label: 'Boletines y Reportes',
    shortLabel: 'Boletines',
    icon: FileSpreadsheet,
  },
  {
    id: 'extras',
    label: 'Calendario y Respaldo',
    shortLabel: 'Respaldo',
    icon: Wrench,
  },
];

export const AppShell: React.FC<AppShellProps> = ({
  activeModule,
  onSelectModule,
  teacherProfile,
  students = [],
  groups = [],
  onSelectGlobalStudent,
  onOpenSettings,
  onLogoutRequest,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');

  const currentNav =
    NAV_ITEMS.find((item) => item.id === activeModule) || NAV_ITEMS[0];

  const shortTeacherName = formatShortTeacherName(teacherProfile?.fullName);

  const handleNavClick = (mod: ModuleKey) => {
    onSelectModule(mod);
    setMobileMenuOpen(false);
  };

  const filteredStudents = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) {
      return students.slice(0, 20);
    }
    return students
      .filter((s) => {
        const full = `${s.lastName} ${s.firstName} ${s.documentNumber || ''} ${
          s.guardianName || ''
        }`.toLowerCase();
        return full.includes(q);
      })
      .slice(0, 30);
  }, [students, globalQuery]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* ===================================================================
          MENÚ LATERAL FIJO EN COMPUTADOR (lg:flex, 264px ancho)
      =================================================================== */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white z-30">
        {/* Marca e Institución */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          {teacherProfile?.institutionLogoUrl ? (
            <img
              src={teacherProfile.institutionLogoUrl}
              alt="Escudo Institucional"
              referrerPolicy="no-referrer"
              className="h-10 w-10 rounded-xl object-contain border border-slate-200 bg-slate-50 p-1 shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-teal-800 text-white flex items-center justify-center font-display font-bold text-base shrink-0">
              MA
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 font-display truncate">
              Mi Aula Digital
            </p>
            <p className="text-xs text-slate-500 truncate">
              {teacherProfile?.institutionName || 'Institución Educativa'}
            </p>
          </div>
        </div>

        {/* Navegación Principal Limpia */}
        <nav
          className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
          aria-label="Menú principal"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full min-h-[42px] px-3 py-2 rounded-xl flex items-center gap-3 text-xs sm:text-sm font-medium transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-teal-800 text-white font-semibold shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Pie del Menú Lateral: Perfil del Docente y Ajustes Institucionales */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/60 space-y-2.5">
          <div className="px-1">
            <p className="text-xs font-bold text-slate-900 truncate">
              {shortTeacherName}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              Escala{' '}
              <span className="font-mono tabular-nums">
                {(teacherProfile?.gradingScaleMin ?? 1.0).toFixed(1)}–
                {(teacherProfile?.gradingScaleMax ?? 5.0).toFixed(1)}
              </span>{' '}
              · Aprueba{' '}
              <span className="font-mono tabular-nums">
                {(teacherProfile?.passingScore ?? 3.0).toFixed(1)}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenSettings}
              leftIcon={<Settings className="w-3.5 h-3.5" />}
              className="w-full"
            >
              Colegio
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onLogoutRequest}
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
              className="w-full text-slate-600 hover:text-red-700"
            >
              Salir
            </Button>
          </div>
        </div>
      </aside>

      {/* ===================================================================
          CONTENEDOR PRINCIPAL (Con margen izquierdo en computador lg:pl-64)
      =================================================================== */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0 pb-20 lg:pb-0">
        {/* Top Bar Contract: 3 zonas limpias separadas por gap-8 */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zona 1: Título de vista actual / Botón menú en móvil */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
              aria-label="Abrir menú"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-sm sm:text-base font-bold text-slate-900 font-display truncate">
              {currentNav.label}
            </span>
          </div>

          {/* Zona 2: Contexto Institucional en 1 línea limpia */}
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap shrink-0">
            <span>{teacherProfile?.institutionName || 'Institución Educativa'}</span>
            <span aria-hidden="true">·</span>
            <span>
              Escala SIEE{' '}
              <strong className="font-mono tabular-nums text-slate-800">
                {(teacherProfile?.gradingScaleMin ?? 1.0).toFixed(1)}–
                {(teacherProfile?.gradingScaleMax ?? 5.0).toFixed(1)}
              </strong>
            </span>
          </div>

          {/* Zona 3: Buscador Global de Estudiantes + Ajustes del Colegio */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setGlobalQuery('');
                setSearchModalOpen(true);
              }}
              leftIcon={<Search className="w-3.5 h-3.5 text-teal-800" />}
            >
              <span className="hidden sm:inline">Buscar estudiante</span>
              <span className="sm:hidden">Buscar</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenSettings}
              leftIcon={<Building2 className="w-3.5 h-3.5 text-teal-800" />}
            >
              <span className="hidden sm:inline">Ajustes SIEE</span>
              <span className="sm:hidden">SIEE</span>
            </Button>
          </div>
        </header>

        {/* Área de Contenido Adaptable */}
        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          {children}
        </main>
      </div>

      {/* ===================================================================
          MENÚ INFERIOR TÁCTIL EN CELULAR Y TABLET VERTICAL (< 1024px)
      =================================================================== */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-2 py-1 grid grid-cols-4 gap-1 shadow-lg"
        aria-label="Navegación rápida inferior"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`min-h-[46px] flex flex-col items-center justify-center rounded-xl px-1 py-1 transition-colors cursor-pointer ${
                isActive
                  ? 'text-teal-800 font-semibold bg-teal-50/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[11px] leading-tight mt-0.5 truncate max-w-full">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ===================================================================
          MODAL DE BÚSQUEDA GLOBAL DE ESTUDIANTES
      =================================================================== */}
      <ModalDialog
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        title="Buscar Estudiante"
        subtitle="Busca por nombre, apellido, documento o acudiente para abrir su ficha."
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Escribe nombre, apellido, documento o acudiente..."
              className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>

          {students.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-600">
              Aún no hay estudiantes registrados en ningún grupo.
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-600">
              Sin coincidencias para "{globalQuery}".
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
              {filteredStudents.map((stu) => {
                const group = groups.find((g) => g.id === stu.gradeGroupId);
                return (
                  <button
                    key={stu.id}
                    type="button"
                    onClick={() => {
                      setSearchModalOpen(false);
                      if (onSelectGlobalStudent) {
                        onSelectGlobalStudent(stu);
                      }
                    }}
                    className="w-full px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-teal-50/60 transition-colors text-left cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {stu.lastName} {stu.firstName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {group
                          ? `Grado ${group.gradeName} · Grupo ${group.groupName}`
                          : 'Grupo asignado'}{' '}
                        · {stu.documentType || 'TI'}{' '}
                        {stu.documentNumber || 'Sin doc.'}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 shrink-0">
                      <UserCheck className="w-3.5 h-3.5" />
                      Ficha
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ModalDialog>

      {/* ===================================================================
          MENÚ DESPLEGABLE (DRAWER) PARA CELULAR Y TABLET
      =================================================================== */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-full max-w-xs bg-white h-full flex flex-col justify-between z-10 shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-teal-800 text-white flex items-center justify-center font-display font-bold text-sm shrink-0">
                  MA
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 font-display truncate">
                    Mi Aula Digital
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {teacherProfile?.institutionName || 'Institución Educativa'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer text-left ${
                      isActive
                        ? 'bg-teal-800 text-white font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2.5">
              <div className="text-xs text-slate-600 px-1">
                Docente:{' '}
                <strong className="text-slate-900">{shortTeacherName}</strong>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenSettings();
                  }}
                  leftIcon={<Settings className="w-3.5 h-3.5" />}
                >
                  Colegio
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogoutRequest();
                  }}
                  leftIcon={<LogOut className="w-3.5 h-3.5" />}
                  className="text-red-700 hover:bg-red-50"
                >
                  Salir
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
