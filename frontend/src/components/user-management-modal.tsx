import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Monitor,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  Truck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  deleteUserApi,
  fetchUsersApi,
  PROFILES_LIST,
  saveUserApi,
  type AllowedMode,
  type AuthUser,
  type UserRoleProfile,
} from '@/lib/business';

type UserManagementModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: AuthUser | null;
  onUserUpdated?: (user: AuthUser) => void;
  notify?: (msg: string) => void;
};

const ALLOWED_MODES_INFO: {
  id: AllowedMode;
  label: string;
  desc: string;
  icon: typeof Monitor;
}[] = [
  {
    id: 'ALL',
    label: 'Acesso Completo (Desktop + Mobile)',
    desc: 'Permite alternar entre Backoffice completo e App de Rua.',
    icon: ShieldCheck,
  },
  {
    id: 'MOBILE_ONLY',
    label: 'Somente Mobile (Celular · Rua)',
    desc: 'Trava a sessão na interface Mobile do vendedor (ideal para o celular do Sr. Sérgio).',
    icon: Smartphone,
  },
  {
    id: 'DESKTOP_ONLY',
    label: 'Somente Desktop (Backoffice / Galpão)',
    desc: 'Acesso focado na estação de trabalho ou conferência de galpão.',
    icon: Monitor,
  },
];

export function UserManagementModal({
  open,
  onOpenChange,
  currentUser,
  onUserUpdated,
  notify,
}: UserManagementModalProps) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Estado do formulário de criação / edição
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleProfile, setRoleProfile] = useState<UserRoleProfile>(
    'Gabriel Furtado · Backoffice & Fiscal'
  );
  const [allowedMode, setAllowedMode] = useState<AllowedMode>('ALL');
  const [active, setActive] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchUsersApi();
      setUsers(list);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao carregar usuários.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadUsers();
      setFormOpen(false);
      setEditingId(null);
      setError('');
    }
  }, [open]);

  const openNewUserForm = () => {
    setEditingId(null);
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setRoleProfile('Sérgio Soares · Sócio & Rua');
    setAllowedMode('MOBILE_ONLY');
    setActive(true);
    setError('');
    setFormOpen(true);
  };

  const openEditUserForm = (u: AuthUser) => {
    setEditingId(u.id);
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setShowPassword(false);
    setRoleProfile(u.roleProfile);
    setAllowedMode(u.allowedMode);
    setActive(u.active);
    setError('');
    setFormOpen(true);
  };

  const handleRoleChange = (nextRole: UserRoleProfile) => {
    setRoleProfile(nextRole);
    if (!editingId) {
      if (nextRole === 'Sérgio Soares · Sócio & Rua') {
        setAllowedMode('MOBILE_ONLY');
      } else if (nextRole === 'Expedição · Romaneio Cego') {
        setAllowedMode('DESKTOP_ONLY');
      } else {
        setAllowedMode('ALL');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim()) {
      setError('Informe o nome completo e o e-mail de login.');
      return;
    }
    if (!editingId && !password.trim()) {
      setError('Defina uma senha inicial para o novo usuário.');
      return;
    }

    setSaving(true);
    try {
      const saved = await saveUserApi({
        id: editingId ?? undefined,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim() || undefined,
        roleProfile,
        allowedMode,
        active,
      });

      const refreshed = await fetchUsersApi();
      setUsers(refreshed);
      setFormOpen(false);
      setEditingId(null);

      if (currentUser && saved.id === currentUser.id && onUserUpdated) {
        onUserUpdated(saved);
      }

      notify?.(
        editingId
          ? `Acesso de ${saved.name} (${saved.email}) atualizado com sucesso.`
          : `Novo usuário ${saved.name} (${saved.email}) autorizado para login e Google SSO.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao salvar usuário.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: AuthUser) => {
    if (currentUser && u.id === currentUser.id) {
      setError('Você não pode excluir o seu próprio usuário conectado no momento.');
      return;
    }
    try {
      await deleteUserApi(u.id);
      const refreshed = await fetchUsersApi();
      setUsers(refreshed);
      notify?.(`Usuário ${u.name} (${u.email}) removido do sistema.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao remover usuário.'
      );
    }
  };

  const formatModeBadge = (m: AllowedMode) => {
    if (m === 'MOBILE_ONLY') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          <Smartphone size={11} /> Somente Mobile (Celular)
        </span>
      );
    }
    if (m === 'DESKTOP_ONLY') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          <Monitor size={11} /> Somente Desktop
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
        <ShieldCheck size={11} /> Acesso Completo
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5">
              <Users size={20} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Usuários, Senhas & Contas Google (SSO)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Cadastre os e-mails autorizados (inclusive Gmail para login Google 1-clique), redefina senhas e configure a trava Mobile para o celular do Sr. Sérgio.
              </DialogDescription>
            </div>
          </div>
          {!formOpen && (
            <Button
              type="button"
              size="sm"
              onClick={openNewUserForm}
              className="h-9 text-xs font-semibold gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus size={15} />
              <span>Autorizar Novo E-mail / Usuário</span>
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {formOpen ? (
          <form
            onSubmit={handleSave}
            className="bg-muted/30 border border-border/80 rounded-xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {editingId
                    ? 'Editar Usuário e Credenciais'
                    : 'Novo Usuário / Autorização Google SSO'}
                </h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setFormOpen(false)}
              >
                <X size={15} />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sérgio Soares"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="form-input w-full h-10 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  E-mail de Login ou Conta Gmail (Google SSO)
                </label>
                <div className="relative">
                  <Mail
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Ex: sergio@gmail.com ou nome@totaltrigo.com.br"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="form-input w-full h-10 pl-9 text-xs"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Se for um endereço Gmail/Google, o usuário poderá entrar com 1 clique via botão Google SSO na tela de login.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  {editingId
                    ? 'Nova Senha (deixe em branco para manter a atual)'
                    : 'Senha de Acesso'}
                </label>
                <div className="relative">
                  <KeyRound
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingId}
                    placeholder={
                      editingId ? 'Manter senha atual' : 'Digite a senha de acesso'
                    }
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="form-input w-full h-10 pl-9 pr-9 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  Perfil Operacional e Permissões
                </label>
                <select
                  value={roleProfile}
                  onChange={e => handleRoleChange(e.target.value as UserRoleProfile)}
                  className="form-input w-full h-10 text-xs"
                >
                  {PROFILES_LIST.map(prof => (
                    <option key={prof} value={prof}>
                      {prof}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground block">
                Restrição de Dispositivo / Ambiente Permitido
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {ALLOWED_MODES_INFO.map(item => {
                  const Icon = item.icon;
                  const selected = allowedMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAllowedMode(item.id)}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        selected
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border/70 bg-background hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon
                          size={15}
                          className={selected ? 'text-primary' : 'text-muted-foreground'}
                        />
                        {selected && (
                          <CheckCircle2 size={14} className="text-primary" />
                        )}
                      </div>
                      <strong className="text-xs font-semibold text-foreground mt-0.5">
                        {item.label}
                      </strong>
                      <span className="text-[11px] text-muted-foreground leading-snug">
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  className="size-4 accent-primary rounded"
                />
                <span>Usuário Ativo (autorizado a fazer login no sistema)</span>
              </label>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  className="gap-1.5 font-semibold cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Salvar Credenciais</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {loading ? (
              <div className="py-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span>Carregando contas de acesso...</span>
              </div>
            ) : (
              <div className="border border-border/80 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border/70 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <th className="py-2.5 px-3.5">Usuário / E-mail (SSO)</th>
                        <th className="py-2.5 px-3">Perfil Operacional</th>
                        <th className="py-2.5 px-3">Ambiente Permitido</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {users.map(u => (
                        <tr
                          key={u.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-3 px-3.5">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {currentUser?.id === u.id && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/15 text-primary font-bold">
                                  Você
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                              <Mail size={11} />
                              <span>{u.email}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-medium text-foreground inline-flex items-center gap-1.5">
                              {u.roleProfile.includes('Sérgio') ? (
                                <Smartphone size={13} className="text-amber-500" />
                              ) : u.roleProfile.includes('Expedição') ? (
                                <Truck size={13} className="text-emerald-500" />
                              ) : (
                                <ShieldCheck size={13} className="text-indigo-500" />
                              )}
                              {u.roleProfile}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {formatModeBadge(u.allowedMode)}
                          </td>
                          <td className="py-3 px-3">
                            {u.active ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={13} /> Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                <Lock size={13} /> Bloqueado
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => openEditUserForm(u)}
                              >
                                <Edit size={13} />
                                <span>Editar</span>
                              </Button>
                              {currentUser?.id !== u.id && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                  title="Remover usuário"
                                  onClick={() => handleDelete(u)}
                                >
                                  <Trash2 size={13} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-start sm:items-center gap-2">
                <ShieldCheck size={16} className="text-primary shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  <strong className="text-foreground">Dica para o celular do Sr. Sérgio:</strong>{' '}
                  Cadastre o endereço <code className="font-mono text-foreground">@gmail.com</code> dele com o ambiente{' '}
                  <strong className="text-foreground">Somente Mobile (Celular)</strong> para que ele entre direto na rota de vendas.
                </span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
