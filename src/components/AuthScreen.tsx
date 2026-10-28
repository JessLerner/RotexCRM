import { FormEvent, useState } from 'react';
import { LockKeyhole, Mail } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function AuthScreen({ error }: { error?: string | null }) {
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
          <form className="space-y-4" onSubmit={signIn}>
            <label className="block text-sm font-medium">Correo
              <span className="relative mt-1 block"><Mail className="absolute left-3 top-3 text-slate-400" size={16} /><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3" autoComplete="email" /></span>
            </label>
            <label className="block text-sm font-medium">Contraseña
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" autoComplete="current-password" />
            </label>
            <button disabled={submitting} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">{submitting ? 'Ingresando…' : 'Iniciar sesión'}</button>
            {(message || error) && <p className="text-sm text-red-700">{message || error}</p>}
          </form>
        )}
      </section>
    </main>
  );
}
