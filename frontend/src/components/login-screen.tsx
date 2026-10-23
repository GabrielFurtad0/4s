import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Monitor,
  ShieldCheck,
  Smartphone,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FourSIcon } from '@/components/logo';
import {
  getLocalUsersDb,
  loginWithGoogleApi,
  loginWithPasswordApi,
  type AuthUser,
} from '@/lib/business';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
          }) => void;
          prompt: () => void;
          renderButton?: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function GoogleLogoSvg({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
      />
    </svg>
  );
}

type LoginScreenProps = {
  onSuccess: (user: AuthUser) => void;
};

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal de Login com Conta Google (Gmail / Google Workspace)
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const googleClientId =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID
      ? String(import.meta.env.VITE_GOOGLE_CLIENT_ID).trim()
      : '';

  useEffect(() => {
    if (!googleClientId || typeof window === 'undefined') return;

    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async response => {
            if (!response.credential) return;
            setLoading(true);
            setError('');
            try {
              const user = await loginWithGoogleApi(
                { credential: response.credential },
                remember
              );
              onSuccess(user);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : 'Falha ao autenticar com Conta Google.'
              );
            } finally {
              setLoading(false);
            }
          },
        });
      }
    };

    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
    }
  }, [googleClientId, onSuccess, remember]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await loginWithPasswordApi(email, password, remember);
      onSuccess(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível autenticar. Verifique seu e-mail e senha.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleButtonClick = () => {
    setError('');
    setGoogleError('');
    if (googleClientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
    setGoogleEmail(email.includes('@') ? email : '');
    setGoogleDialogOpen(true);
  };

  const handleGoogleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = googleEmail.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      setGoogleError('Informe um endereço de e-mail Google / Gmail válido.');
      return;
    }
    setGoogleLoading(true);
    setGoogleError('');
    try {
      const user = await loginWithGoogleApi({ email: targetEmail }, remember);
      setGoogleDialogOpen(false);
      onSuccess(user);
    } catch (err) {
      setGoogleError(
        err instanceof Error
          ? err.message
          : 'Conta Google não autorizada no Backoffice.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const fillQuickCredentials = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    setError('');
  };

  const registeredUsers = getLocalUsersDb().filter(u => u.active);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden px-4 py-8">
      {/* Background sutil corporativo */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 15%, rgba(99, 102, 241, 0.28), transparent 45%), radial-gradient(circle at 80% 85%, rgba(16, 185, 129, 0.18), transparent 45%)',
        }}
      />

      {/* Topo institucional */}
      <div className="relative z-10 max-w-5xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FourSIcon size={28} />
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-white">4S ERP</span>
            <span className="h-3.5 w-px bg-slate-700" />
            <span className="text-xs font-medium text-slate-400">
              Total Trigo Comércio de Alimentos
            </span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-full">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Ambiente Corporativo Seguro · SEFAZ & Força de Vendas</span>
        </div>
      </div>

      {/* Card Central de Autenticação */}
      <div className="relative z-10 w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center justify-center p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-1">
              <FourSIcon size={32} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Acesso ao 4S ERP
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Entre com suas credenciais ou utilize sua Conta Google autorizada.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed"
            >
              <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Formulário E-mail + Senha */}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-slate-300"
              >
                E-mail Corporativo ou Gmail
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nome@totaltrigo.com.br ou seu@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Senha de Acesso
                </label>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Lock size={11} /> Criptografia ponta a ponta
                </span>
              </div>
              <div className="relative">
                <KeyRound
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500/40 size-4 accent-indigo-500"
                />
                <span>Manter conectado por 30 dias</span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no 4S ERP</span>
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>

          {/* Divisor */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-400 whitespace-nowrap">
              ou acesse com sua conta corporativa
            </span>
            <div className="border-t border-slate-800 w-full" />
          </div>

          {/* Botão Google SSO */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleButtonClick}
            disabled={loading}
            className="w-full h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border-slate-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer transition-all shadow-xs"
          >
            <GoogleLogoSvg className="w-4 h-4 shrink-0" />
            <span>Continuar com Conta Google (Gmail)</span>
          </Button>

          {/* Seção Acesso Rápido (Ambiente de Homologação) */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-400">
                Acesso Rápido (Ambiente de Homologação)
              </span>
              <span className="text-[10px] text-slate-500">1 clique para preencher</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  fillQuickCredentials('gabriel@totaltrigo.com.br', 'totaltrigo2026')
                }
                className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-slate-950/80 hover:bg-indigo-500/15 border border-slate-800 hover:border-indigo-500/40 text-left transition-all cursor-pointer group"
              >
                <Monitor
                  size={15}
                  className="text-indigo-400 group-hover:scale-105 transition-transform"
                />
                <span className="text-[11px] font-semibold text-slate-200 text-center leading-tight">
                  Gabriel · Backoffice
                </span>
                <span className="text-[9px] text-slate-400">Acesso Total</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  fillQuickCredentials('sergio@totaltrigo.com.br', 'sergio2026')
                }
                className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-slate-950/80 hover:bg-amber-500/15 border border-slate-800 hover:border-amber-500/40 text-left transition-all cursor-pointer group"
              >
                <Smartphone
                  size={15}
                  className="text-amber-400 group-hover:scale-105 transition-transform"
                />
                <span className="text-[11px] font-semibold text-slate-200 text-center leading-tight">
                  Sr. Sérgio · Mobile
                </span>
                <span className="text-[9px] text-slate-400">Celular / Rua</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  fillQuickCredentials('expedicao@totaltrigo.com.br', 'galpao2026')
                }
                className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-slate-950/80 hover:bg-emerald-500/15 border border-slate-800 hover:border-emerald-500/40 text-left transition-all cursor-pointer group"
              >
                <Truck
                  size={15}
                  className="text-emerald-400 group-hover:scale-105 transition-transform"
                />
                <span className="text-[11px] font-semibold text-slate-200 text-center leading-tight">
                  Expedição · Galpão
                </span>
                <span className="text-[9px] text-slate-400">Romaneio Cego</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div className="relative z-10 max-w-5xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <span>4S ERP · Total Trigo Comércio de Alimentos Ltda.</span>
        <span>Controle de Acesso por Perfil e Dispositivo (Desktop / Mobile)</span>
      </div>

      {/* Modal de Autenticação Google SSO */}
      <Dialog open={googleDialogOpen} onOpenChange={setGoogleDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 text-slate-100 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white text-slate-900 shrink-0 shadow-xs">
              <GoogleLogoSvg className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Autenticação Google SSO
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Informe ou selecione sua conta Google previamente autorizada no Backoffice.
              </DialogDescription>
            </div>
          </div>

          {googleError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{googleError}</span>
            </div>
          )}

          <form onSubmit={handleGoogleModalSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="google-sso-email"
                className="block text-xs font-semibold text-slate-300"
              >
                Endereço Gmail ou Google Workspace
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  id="google-sso-email"
                  type="email"
                  required
                  placeholder="seu.email@gmail.com"
                  value={googleEmail}
                  onChange={e => setGoogleEmail(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            </div>

            {registeredUsers.length > 0 && (
              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-slate-400">
                  Contas autorizadas no Backoffice (clique para selecionar):
                </span>
                <div className="grid gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {registeredUsers.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setGoogleEmail(u.email);
                        setGoogleError('');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all cursor-pointer ${
                        googleEmail.toLowerCase() === u.email.toLowerCase()
                          ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span className="font-medium truncate">{u.email}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 ml-2 shrink-0">
                        {u.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-slate-200 block mb-0.5">
                Política de Segurança Total Trigo:
              </strong>
              Apenas endereços de e-mail previamente cadastrados e ativos no módulo{' '}
              <span className="text-slate-300 font-medium">
                Usuários & Acessos (Backoffice)
              </span>{' '}
              podem iniciar sessão via Google SSO.
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setGoogleDialogOpen(false)}
                className="text-xs text-slate-300 hover:text-white hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={googleLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 rounded-xl flex items-center gap-2 cursor-pointer"
              >
                {googleLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Validando...</span>
                  </>
                ) : (
                  <>
                    <GoogleLogoSvg className="w-3.5 h-3.5" />
                    <span>Autenticar com Google</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
