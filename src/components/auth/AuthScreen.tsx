import React, { useState } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  BookOpen,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  GraduationCap,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../../firebase';
import { Button, InputField } from '../ui/DesignSystem';

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ensureTeacherProfile = async (
    uid: string,
    userEmail: string,
    defaultName: string,
    defaultInstitution: string,
    defaultSpecialty: string
  ) => {
    const teacherPath = `teachers/${uid}`;
    const teacherRef = doc(db, 'teachers', uid);

    try {
      const snap = await getDoc(teacherRef);
      if (!snap.exists()) {
        await setDoc(teacherRef, {
          teacherId: uid,
          fullName: (defaultName || 'Docente Titular').slice(0, 150),
          email: (userEmail || 'docente@institucion.edu.co').slice(0, 200),
          specialty: (defaultSpecialty || 'Educación General').slice(0, 150),
          institutionName: (
            defaultInstitution || 'Institución Educativa Oficial'
          ).slice(0, 200),
          institutionCity: 'Colombia',
          gradingScaleMin: 1.0,
          gradingScaleMax: 5.0,
          passingScore: 3.0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, teacherPath);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      await ensureTeacherProfile(
        user.uid,
        user.email || 'docente@colombia.edu.co',
        user.displayName || fullName || 'Docente Titular',
        institutionName || 'Institución Educativa',
        specialty || 'Todas las áreas'
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('popup-closed-by-user')) {
        setErrorMsg(
          'Cerraste la ventana de acceso antes de completar el inicio de sesión.'
        );
      } else {
        setErrorMsg(
          'No se pudo completar el inicio de sesión con Google. Intenta de nuevo.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor ingresa tu correo institucional o personal y tu contraseña.');
      return;
    }

    if (mode === 'register' && !fullName.trim()) {
      setErrorMsg('Por favor escribe tu nombre completo para personalizar tus planillas.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        if (fullName.trim()) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
        }
        await ensureTeacherProfile(
          cred.user.uid,
          cred.user.email || email.trim(),
          fullName.trim(),
          institutionName.trim() || 'Institución Educativa',
          specialty.trim() || 'Docente de Aula'
        );
      } else {
        const cred = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        await ensureTeacherProfile(
          cred.user.uid,
          cred.user.email || email.trim(),
          cred.user.displayName || 'Docente Titular',
          'Institución Educativa',
          'Docente de Aula'
        );
      }
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code === 'auth/operation-not-allowed') {
        setErrorMsg(
          'El acceso con correo y contraseña aún no está habilitado en la consola de Firebase. Por favor utiliza el botón "Continuar con cuenta de Google" para ingresar o crear tu cuenta de inmediato.'
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password'
      ) {
        setErrorMsg('Correo o contraseña incorrectos. Verifica tus datos o ingresa con Google.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg('Este correo ya está registrado. Cambia a la pestaña "Iniciar Sesión".');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setErrorMsg(
          'Ocurrió un inconveniente al autenticar. Te recomendamos usar el botón "Continuar con cuenta de Google".'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Barra Superior Sobria */}
      <header className="w-full border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 shrink-0">
          <div className="h-10 w-10 rounded-xl bg-teal-800 text-white flex items-center justify-center font-display font-bold text-lg">
            MA
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap">
            Mi Aula Digital
          </span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-xs text-slate-600">
          <span>Preescolar</span>
          <span aria-hidden="true">·</span>
          <span>Básica Primaria</span>
          <span aria-hidden="true">·</span>
          <span>Básica Secundaria</span>
          <span aria-hidden="true">·</span>
          <span>Educación Media</span>
          <span aria-hidden="true">·</span>
          <span>CLEI / Adultos</span>
        </div>
        <div className="shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Crear cuenta docente' : 'Ya tengo cuenta'}
          </Button>
        </div>
      </header>

      {/* Cuerpo Principal en 2 Columnas Balanceadas */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 md:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Columna Izquierda: Propuesta de Valor para el Docente Colombiano */}
        <div className="lg:col-span-7 space-y-6">
          <div className="text-xs font-semibold text-teal-800 tracking-wide">
            Plataforma Pedagógica Integral · Colombia (Decreto 1290 y Ley 1620)
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 font-display leading-tight text-balance">
            Reemplaza los cuadernos y planillas sueltas por tu espacio docente en la nube.
          </h1>

          <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
            Diseñada específicamente para el trabajo diario en el salón de clases desde tu
            celular, tablet o computador. Registra asistencia, calificaciones por desempeño
            nacional, observador convivencial, recaudos y boletines en un solo lugar.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display">
                  Todos los niveles y áreas
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Adaptable a Preescolar, Primaria, Secundaria, Media y Educación para Adultos (CLEI).
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display">
                  Diseño táctil para el aula
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Botones grandes y tablas que se transforman en tarjetas cómodas en tu celular.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display">
                  7 Módulos Conectados
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Grupos, asistencia, notas SIEE, observador, recaudos, estadísticas y boletines PDF/Word.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display">
                  Privacidad por Docente
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Aislamiento estricto en la base de datos: cada docente solo ve y administra su propia información.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Tarjeta de Inicio de Sesión y Registro */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            {/* Selector de pestaña Iniciar Sesión / Registro */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className={`min-h-[42px] text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                }}
                className={`min-h-[42px] text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Registro Docente
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 font-display">
                {mode === 'login'
                  ? 'Bienvenido a tu Aula Digital'
                  : 'Crea tu cuenta de Docente'}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                {mode === 'login'
                  ? 'Ingresa para acceder a tus grupos, planillas y observador.'
                  : 'Configura tu perfil inicial. Podrás personalizar tu institución en cualquier momento.'}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-3 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Acceso rápido y recomendado con Google */}
            <div className="space-y-4">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleGoogleAuth}
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {mode === 'login'
                  ? 'Continuar con cuenta de Google'
                  : 'Registrarse rápido con Google'}
              </Button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="shrink-0 mx-3 text-xs text-slate-400">
                  o con correo electrónico
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                {mode === 'register' && (
                  <>
                    <InputField
                      label="Nombre completo del docente"
                      placeholder="Ej. Prof. Carlos Andrés Ramírez"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <InputField
                        label="Institución Educativa"
                        placeholder="Ej. I.E. Simón Bolívar"
                        value={institutionName}
                        onChange={(e) => setInstitutionName(e.target.value)}
                      />
                      <InputField
                        label="Área o Especialidad"
                        placeholder="Ej. Matemáticas / Primaria"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <InputField
                  label="Correo electrónico"
                  type="email"
                  placeholder="docente@colegio.edu.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <InputField
                  label="Contraseña"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <Button
                  type="submit"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  isLoading={isLoading}
                >
                  {mode === 'login'
                    ? 'Ingresar con correo'
                    : 'Completar registro con correo'}
                </Button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
              <span>
                Tus datos están protegidos y sincronizados automáticamente en tiempo real.
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Pie de página sobrio */}
      <footer className="w-full border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-500">
        Mi Aula Digital · Sistema de Gestión Académica para Docentes de Colombia · Fase 1 (Cimientos y Arquitectura)
      </footer>
    </div>
  );
};
