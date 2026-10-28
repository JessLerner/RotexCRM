import { FormEvent, useState } from 'react';
import { LockKeyhole, Mail } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function AuthScreen({ error, passwordSetup = false, onPasswordUpdated }: { error?: string | null; passwordSetup?: boolean; onPasswordUpdated?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured) return;
    setSubmitting(true);
    setMessage(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(signInError ? signInError.message : 'Sesión iniciada.');
    setSubmitting(false);
  };
  const sendRecovery = async () => {
    if (!email.trim()) { setMessage('Ingresá tu correo para enviarte el enlace de recuperación.'); return; }
    setSubmitting(true);
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/activate` });
    setMessage(recoveryError ? recoveryError.message : 'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.');
    setSubmitting(false);
  };
  const updatePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) { setMessage('La contraseña debe tener al menos 8 caracteres.'); return; }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) { setMessage(updateError.message); return; }
    window.history.replaceState({}, document.title, '/');
    onPasswordUpdated?.();
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-5 text-slate-900">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-3 text-white"><LockKeyhole size={24} /></div>
          <div><h1 className="text-xl font-bold">Rotex</h1><p className="text-sm text-slate-500">Rotación continua inteligente</p></div>
        </div>
        {!isSupabaseConfigured ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Falta configurar Supabase. Agregá `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` al entorno de despliegue.
          </p>
        ) : (
          {passwordSetup ? <form className="space-y-4" onSubmit={updatePassword}>
            <div><h2 className="text-lg font-bold">Creá tu contraseña</h2><p className="mt-1 text-sm text-slate-500">Elegí una contraseña segura para activar o recuperar tu acceso a Rotex.</p></div>
            <label className="block text-sm font-medium">Nueva contraseña
              <input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" autoComplete="new-password" />
            </label>
            <button disabled={submitting} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">{submitting ? 'Guardando…' : 'Guardar contraseña y continuar'}</button>
            {message && <p className="text-sm text-red-700">{message}</p>}
          </form> : <form className="space-y-4" onSubmit={signIn}>
            <label className="block text-sm font-medium">Correo
              <span className="relative mt-1 block"><Mail className="absolute left-3 top-3 text-slate-400" size={16} /><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3" autoComplete="email" /></span>
            </label>
            <label className="block text-sm font-medium">Contraseña
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" autoComplete="current-password" />
            </label>
            <button disabled={submitting} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">{submitting ? 'Ingresando…' : 'Iniciar sesión'}</button>
            <button type="button" onClick={sendRecovery} className="w-full text-sm font-medium text-blue-700 hover:text-blue-900">Olvidé mi contraseña</button>
            {(message || error) && <p className="text-sm text-red-700">{message || error}</p>}
          </form>}
        )}
      </section>
    </main>
  );
}
