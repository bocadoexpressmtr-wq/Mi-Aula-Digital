import React, { useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Loader2,
  Trash2,
} from 'lucide-react';

// Formatea el nombre del docente mostrando 1 solo nombre y 1 solo apellido
export function formatShortTeacherName(fullName?: string | null): string {
  if (!fullName || !fullName.trim()) return 'Docente';
  const rawWords = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (rawWords.length <= 2) {
    return rawWords.join(' ');
  }

  // Agrupar conectores de apellidos compuestos (de, del, la, las, los, san, santa)
  const connectors = new Set(['de', 'del', 'la', 'las', 'los', 'san', 'santa']);
  const tokens: string[] = [];
  for (let i = 0; i < rawWords.length; i++) {
    const w = rawWords[i];
    if (connectors.has(w.toLowerCase()) && i + 1 < rawWords.length) {
      tokens.push(`${w} ${rawWords[i + 1]}`);
      i++;
    } else {
      tokens.push(w);
    }
  }

  if (tokens.length <= 2) {
    return tokens.join(' ');
  }

  // Si tiene 4 o más bloques (Nombre1 Nombre2 Apellido1 Apellido2) -> Nombre1 + Apellido1
  if (tokens.length >= 4) {
    return `${tokens[0]} ${tokens[2]}`;
  }

  // Si tiene 3 bloques, verificamos si el segundo bloque es un segundo nombre común
  const commonSecondNames = new Set([
    'fernando',
    'carlos',
    'andres',
    'andrés',
    'david',
    'jose',
    'josé',
    'miguel',
    'angel',
    'ángel',
    'camila',
    'sofia',
    'sofía',
    'alejandra',
    'alejandro',
    'patricia',
    'elena',
    'maria',
    'maría',
    'paola',
    'andrea',
    'felipe',
    'javier',
    'daniel',
    'eduardo',
    'alberto',
    'antonio',
    'enrique',
    'manuel',
    'luisa',
    'fernanda',
    'valentina',
    'carolina',
    'natalia',
    'sebastian',
    'sebastián',
    'santiago',
    'camilo',
    'esteban',
    'mauricio',
    'hernan',
    'hernán',
    'dario',
    'darío',
    'alfonso',
    'arturo',
  ]);

  if (commonSecondNames.has(tokens[1].toLowerCase())) {
    return `${tokens[0]} ${tokens[2]}`;
  }

  return `${tokens[0]} ${tokens[1]}`;
}

// ============================================================================
// 1. BOTÓN TÁCTIL PROPORCIONADO Y LIMPIO
// ============================================================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer select-none active:scale-[0.99]';

  const sizeClasses = {
    sm: 'min-h-[36px] px-3 py-1.5 text-xs',
    md: 'min-h-[40px] px-3.5 py-2 text-xs sm:text-sm',
    lg: 'min-h-[46px] px-5 py-2.5 text-sm',
  };

  const variantClasses = {
    primary:
      'bg-teal-800 text-white hover:bg-teal-900 shadow-2xs border border-teal-900/10',
    secondary:
      'bg-slate-900 text-white hover:bg-slate-800 shadow-2xs',
    outline:
      'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    danger:
      'bg-red-700 text-white hover:bg-red-800 shadow-2xs',
    ghost:
      'bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};

// ============================================================================
// 2. CAMPO DE ENTRADA ACCESIBLE Y CLARO
// ============================================================================
interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  helperText,
  error,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label
        htmlFor={inputId}
        className="text-sm font-semibold text-slate-800"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={`min-h-[44px] w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 ${
          error ? 'border-red-600' : 'border-slate-300'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
};

// ============================================================================
// 3. SELECTOR DESPLEGABLE TÁCTIL
// ============================================================================
interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  helperText?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  options,
  helperText,
  id,
  className = '',
  ...props
}) => {
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label
        htmlFor={selectId}
        className="text-sm font-semibold text-slate-800"
      >
        {label}
      </label>
      <select
        id={selectId}
        className={`min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
};

// ============================================================================
// 3B. CAMPO DE TEXTO MULTILÍNEA (TEXTAREA)
// ============================================================================
interface TextareaFieldProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  helperText?: string;
  error?: string;
}

export const TextareaField: React.FC<TextareaFieldProps> = ({
  label,
  helperText,
  error,
  id,
  className = '',
  rows = 3,
  ...props
}) => {
  const textareaId =
    id || `textarea-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label
        htmlFor={textareaId}
        className="text-sm font-semibold text-slate-800"
      >
        {label}
      </label>
      <textarea
        id={textareaId}
        rows={rows}
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 ${
          error ? 'border-red-600' : 'border-slate-300'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
};

// ============================================================================
// 4. MODAL DE CONFIRMACIÓN ANTES DE BORRAR (Regla de diseño obligatoria)
// ============================================================================
interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  itemName: string;
  description?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  itemName,
  description = 'Esta acción eliminará el registro de forma permanente y no se puede deshacer.',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="confirm-delete-title"
              className="text-lg font-bold text-slate-900 font-display"
            >
              {title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              ¿Estás seguro de que deseas eliminar{' '}
              <span className="font-semibold text-slate-900">"{itemName}"</span>?
            </p>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar y conservar
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            isLoading={isLoading}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Sí, eliminar registro
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. MODAL GENÉRICO REUTILIZABLE PARA TODOS LOS MÓDULOS
// ============================================================================
interface ModalDialogProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl';
}

export const ModalDialog: React.FC<ModalDialogProps> = ({
  isOpen,
  title,
  subtitle,
  description,
  onClose,
  children,
  maxWidth = 'lg',
}) => {
  const effectiveSubtitle = subtitle || description;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthMap = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${widthMap[maxWidth]} rounded-2xl bg-white border border-slate-200 shadow-xl my-8 overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50/60">
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-display">
              {title}
            </h3>
            {effectiveSubtitle && (
              <p className="text-xs text-slate-600 mt-0.5">{effectiveSubtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. TABLA ADAPTABLE (En celular se convierte en tarjetas; en computador es tabla amplia)
// ============================================================================
export interface ResponsiveColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  isNumeric?: boolean;
  render: (item: T) => React.ReactNode;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  keyExtractor: (item: T) => string;
  mobileCardRender: (item: T) => React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

export function ResponsiveDataView<T>({
  data,
  columns,
  keyExtractor,
  mobileCardRender,
  emptyTitle = 'No hay registros disponibles',
  emptyDescription = 'Aún no se han agregado datos en esta sección.',
  emptyAction,
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-base font-semibold text-slate-900 font-display">
          {emptyTitle}
        </p>
        <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
          {emptyDescription}
        </p>
        {emptyAction && <div className="mt-5 flex justify-center">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Vista Móvil (< 768px): Tarjetas táctiles amplias */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            {mobileCardRender(item)}
          </div>
        ))}
      </div>

      {/* Vista Tablet y Computador (>= 768px): Tabla amplia con desplazamiento cómodo */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-3.5 px-4 whitespace-nowrap ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className="hover:bg-slate-50/90 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-3 px-4 align-middle ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.isNumeric ? 'tabular-nums font-mono' : ''}`}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 7. NOTIFICACIÓN EMERGENTE (Toast feedback para acciones del docente)
// ============================================================================
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  detail?: string;
}

export const ToastContainer: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
        >
          {t.type === 'success' && (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          )}
          {t.type === 'error' && (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          {t.type === 'info' && (
            <Info className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{t.title}</p>
            {t.detail && (
              <p className="text-xs text-slate-600 mt-0.5">{t.detail}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            aria-label="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
