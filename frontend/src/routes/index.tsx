import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Barcode, Bell, Check, CheckCircle2, ChevronDown, ChevronsUpDown, CircleHelp, Command, CreditCard, FileCheck2, FileText, Globe2, LayoutDashboard, LogOut, Menu, Monitor, Package, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, ShieldCheck, Smartphone, Sparkles, Truck, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Backoffice } from '@/components/backoffice';
import { Management } from '@/components/management';
import { Seller } from '@/components/seller';
import { OrderSlipSection } from '@/components/order-slip-section';
import { FourSIcon, FourSLogo } from '@/components/logo';
import {
  createOrderApi,
  demoData,
  fetchWorkspaceData,
  financials,
  getActiveProfile,
  PROFILES_LIST,
  reserveOrder,
  saveOrderToOfflineQueue,
  setActiveProfile,
  type AppData,
  type Order,
  type UserRoleProfile,
} from '@/lib/business';
import { CommandPalette } from '@/components/command-palette';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: '4S ERP — Total Trigo' },
    { name: 'description', content: '4S: Força de Vendas, Suprimentos, SEFAZ Pré-Nota e Separação. Sistema Total Trigo.' },
    { property: 'og:title', content: '4S ERP — Total Trigo' },
    { property: 'og:description', content: 'Da venda em campo à conferência fiscal e ao galpão. Total Trigo 4S.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Index,
});

type FontScale = 'normal' | 'large' | 'xlarge';

const PROFILES_CONFIG = [
  {
    id: 'Gabriel Furtado · Backoffice & Fiscal' as UserRoleProfile,
    shortName: 'Gabriel Furtado',
    fullName: 'Gabriel Furtado · Backoffice & Fiscal',
    name: 'Gabriel Furtado · Backoffice & Fiscal',
    initials: 'GF',
    icon: ShieldCheck,
    badge: 'Gestão & SEFAZ',
    colorClasses: {
      avatar: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
      badge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
    },
    description: 'Conferência de pré-notas (DQ/BQ), emissão de NF-e, baixa de boletos, cadastros e importação.',
  },
  {
    id: 'Sérgio Soares · Sócio & Rua' as UserRoleProfile,
    shortName: 'Sérgio Soares',
    fullName: 'Sérgio Soares · Sócio & Rua',
    name: 'Sérgio Soares · Sócio & Rua',
    initials: 'SS',
    icon: Smartphone,
    badge: 'Vendas & Diretoria',
    colorClasses: {
      avatar: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      badge: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    },
    description: 'App mobile de rua (estoque físico disponível) e acesso ao Backoffice pelo notebook em casa.',
  },
  {
    id: 'Expedição · Romaneio Cego' as UserRoleProfile,
    shortName: 'Expedição Galpão',
    fullName: 'Expedição · Romaneio Cego',
    name: 'Expedição · Romaneio Cego',
    initials: 'EX',
    icon: Truck,
    badge: 'Galpão & Entrega',
    colorClasses: {
      avatar: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    },
    description: 'Visualização exclusiva de volumes físicos (DQ) e impressão de Romaneio Cego. Custos e margens ocultos.',
  },
] as const;

function getProfileShortName(prof: string) {
  if (prof.includes('Sérgio')) return 'Sérgio · Sócio & Rua';
  if (prof.includes('Expedição')) return 'Expedição · Galpão';
  return 'Gabriel · Backoffice';
}

function getProfileInitials(prof: string) {
  if (prof.includes('Sérgio')) return 'SS';
  if (prof.includes('Expedição')) return 'EX';
  return 'GF';
}

function applyFontScaleToDom(scale: FontScale) {
  if (typeof document !== 'undefined') {
    const classes = ['font-scale-normal', 'font-scale-large', 'font-scale-xlarge'];
    document.documentElement.classList.remove(...classes);
    document.documentElement.classList.add(`font-scale-${scale}`);
    if (document.body) {
      document.body.classList.remove(...classes);
      document.body.classList.add(`font-scale-${scale}`);
    }
  }
}

const modules = [
  { id: 'orders', label: 'Mesa de conferência', icon: FileCheck2 },
  { id: 'order-slip', label: 'Talão de Pedido', icon: FileText },
  { id: 'receivables', label: 'Boletos', icon: Barcode },
  { id: 'registrations', label: 'Cadastros & Estoque', icon: Users },
  { id: 'audit', label: 'Trilha de auditoria', icon: ShieldCheck },
  { id: 'import', label: 'Importação', icon: Globe2 },
  { id: 'executive', label: 'Visão executiva', icon: LayoutDashboard },
];

function Index() {
  const [data, setData] = useState<AppData>(demoData);
  const [activeProfile, setActiveProfileState] = useState<UserRoleProfile>(getActiveProfile);
  const [mode, setMode] = useState<'desktop' | 'mobile'>(() => {
    const prof = getActiveProfile();
    return prof.includes('Sérgio') ? 'mobile' : 'desktop';
  });
  const [module, setModule] = useState('orders');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [info, setInfo] = useState<'settings' | 'help' | 'profile' | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('totaltrigo_font_scale');
      if (saved === 'large' || saved === 'xlarge' || saved === 'normal') {
        return saved;
      }
    }
    return 'normal';
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (message: string) => { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4500); };

  const handleProfileChange = (newProfile: UserRoleProfile) => {
    setActiveProfileState(newProfile);
    setActiveProfile(newProfile);
    if (newProfile === 'Expedição · Romaneio Cego') {
      setMode('desktop');
      setModule('orders');
      notify('Perfil: Expedição (Romaneio Cego · Custos e margens ocultos)');
    } else if (newProfile === 'Sérgio Soares · Sócio & Rua') {
      notify('Perfil: Sr. Sérgio (Acesso ao App de Rua e Backoffice no notebook)');
    } else {
      notify('Perfil: Gabriel Furtado (Backoffice, Fiscal & Cadastros)');
    }
  };

  const updateFontScale = (scale: FontScale) => {
    setFontScale(scale);
    applyFontScaleToDom(scale);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('totaltrigo_font_scale', scale);
      } catch {
        // Fallback silencioso caso localStorage esteja bloqueado
      }
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('totaltrigo_font_scale');
      if (saved === 'large' || saved === 'xlarge' || saved === 'normal') {
        setFontScale(saved);
        applyFontScaleToDom(saved);
      } else {
        localStorage.setItem('totaltrigo_font_scale', 'normal');
        applyFontScaleToDom('normal');
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    applyFontScaleToDom(fontScale);
  }, [fontScale]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    fetchWorkspaceData(data.reconciled)
      .then(remote => setData(remote))
      .catch(() => {
        // Fallback silencioso para demoData caso backend esteja offline
      });
  }, []);

  const submit = (o: Order) => {
    try {
      const optimistic = reserveOrder(data, o);
      setData(optimistic);
      notify(`Pedido #${o.id} enviado para revisão. Estoque reservado.`);
      createOrderApi(data, o)
        .then(remote => {
          setData(remote);
        })
        .catch(e => {
          saveOrderToOfflineQueue(o);
          notify('Gravado na fila offline do dispositivo. Sincronizará assim que houver conexão.');
        });
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Confira o pedido.');
      return false;
    }
  };

  const exportOrdersCsv = () => {
    const csv =
      'Pedido;Cliente;Status;Total\n' +
      data.orders
        .map(
          o =>
            `${o.id};${data.clients.find(c => c.id === o.clientId)?.name};${o.status};${financials(o.items).total.toFixed(2)}`,
        )
        .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pedidos-4s.csv';
    a.click();
    URL.revokeObjectURL(url);
    notify('Relatório CSV de pedidos exportado.');
  };

  const shared = { data, update: setData, notify, submit };
  const pendingOrders = data.orders.filter(o => o.status === 'AGUARDANDO_REVISAO');
  const overdueClients = data.clients.filter(c => c.overdue);
  const lowStockProducts = data.products.filter(p => (p.physical - p.reserved) < 100);
  const restockClients = data.clients.filter(c => c.days > c.cycle && !c.overdue);
  const totalNotifications =
    (pendingOrders.length > 0 ? 1 : 0) +
    (overdueClients.length > 0 ? 1 : 0) +
    (lowStockProducts.length > 0 ? 1 : 0) +
    (restockClients.length > 0 ? 1 : 0);

  useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setGlobalSearch(v => !v); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);

  return (
    <div className={`app-shell font-scale-${fontScale}`}>
      <div className="environment-bar">
        <div className="environment-brand">
          <FourSIcon size={24} />
          <span className="font-bold text-sm tracking-tight text-foreground ml-1">4S<span className="environment-divider" />ERP</span>
        </div>
        <div className="environment-switch">
          <Button variant="ghost" className={mode === 'desktop' ? 'selected' : ''} onClick={() => setMode('desktop')}>
            <Monitor />Backoffice<span className="mode-person">Gabriel</span>
          </Button>
          <Button variant="ghost" className={mode === 'mobile' ? 'selected' : ''} onClick={() => setMode('mobile')}>
            <Smartphone />Em campo<span className="mode-person">Sérgio</span>
          </Button>
        </div>
        <div className="environment-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/90 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors shadow-2xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-300 select-none"
                aria-label="Perfil operacional ativo"
                title="Clique para alternar o perfil operacional"
              >
                <span className="flex items-center justify-center size-4.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold shrink-0">
                  {getProfileInitials(activeProfile)}
                </span>
                <span className="font-semibold text-xs text-slate-900 tracking-tight max-w-[130px] sm:max-w-none truncate">
                  {getProfileShortName(activeProfile)}
                </span>
                <ChevronsUpDown size={13} className="text-slate-500 hover:text-slate-800 ml-0.5 shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="w-80 p-1.5 bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-xl z-50 text-foreground"
            >
              <div className="px-2.5 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                    Perfil Operacional Ativo
                  </span>
                  <span className="text-[10px] text-primary font-medium">Troca rápida</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Alterna permissões, visibilidade de custos e assinatura de auditoria.
                </p>
              </div>

              <DropdownMenuSeparator className="my-1 bg-border/70" />

              <div className="space-y-1">
                {PROFILES_CONFIG.map(p => {
                  const isSelected = activeProfile === p.id;
                  const Icon = p.icon;
                  return (
                    <DropdownMenuItem
                      key={p.id}
                      onSelect={() => handleProfileChange(p.id)}
                      className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary/10 border border-primary/30 text-foreground'
                          : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-transparent'
                      }`}
                    >
                      <div className={`flex items-center justify-center size-8 rounded-lg shrink-0 mt-0.5 ${p.colorClasses.avatar}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {p.name}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${p.colorClasses.badge}`}>
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                          {p.description}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground shrink-0 mt-1">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="font-scale-control" role="group" aria-label="Tamanho da letra (Conforto visual)">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`font-scale-btn ${fontScale === 'normal' ? 'selected' : ''}`}
              onClick={() => updateFontScale('normal')}
              title="Tamanho da letra normal (Padrão)"
              aria-label="Tamanho da letra normal"
            >
              A
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`font-scale-btn ${fontScale === 'large' ? 'selected' : ''}`}
              onClick={() => updateFontScale('large')}
              title="Tamanho da letra grande (Conforto visual)"
              aria-label="Tamanho da letra grande"
            >
              A+
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`font-scale-btn ${fontScale === 'xlarge' ? 'selected' : ''}`}
              onClick={() => updateFontScale('xlarge')}
              title="Tamanho da letra extra grande (Máxima legibilidade)"
              aria-label="Tamanho da letra extra grande"
            >
              A++
            </Button>
          </div>
          <div className="environment-live">
            <span className="online-dot" />{data.backendConnected ? 'API conectada · Tempo real' : 'Demonstração interativa'}
          </div>
        </div>
      </div>

      {mode === 'desktop' ? (
        <div className="desktop-shell">
          <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${mobileMenu ? 'mobile-open' : ''}`}>
            <div className="workspace-picker">
              <FourSIcon size={28} />
              {!collapsed && (
                <>
                  <div>
                    <strong>Total Trigo 4S</strong>
                    <p>{activeProfile.split(' · ')[0]}</p>
                  </div>
                  <ChevronsUpDown size={14} />
                </>
              )}
            </div>
            <div className="sidebar-section-label">WORKSPACE</div>
            <nav className="sidebar-nav">
              {modules.map(item => (
                <Button
                  key={item.id}
                  variant="ghost"
                  title={item.label}
                  className={`sidebar-link ${module === item.id ? 'active' : ''}`}
                  onClick={() => {
                    setModule(item.id);
                    setMobileMenu(false);
                  }}
                >
                  <item.icon size={17} />
                  {!collapsed && (
                    <>
                      <span>{item.label}</span>
                      {item.id === 'orders' && <b>{data.orders.filter(o => o.status === 'AGUARDANDO_REVISAO').length}</b>}
                    </>
                  )}
                </Button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              {!collapsed && (
                <div className="field-promo">
                  <span className="field-promo-icon">
                    <Smartphone size={20} />
                  </span>
                  <h3>Sua operação, em campo.</h3>
                  <p>Vendas e backoffice.<br />Sempre conectados.</p>
                  <Button variant="ghost" onClick={() => setMode('mobile')}>
                    Abrir app do vendedor<ChevronDown className="-rotate-90" size={14} />
                  </Button>
                </div>
              )}
              <Button variant="ghost" className="sidebar-link" title="Configurações" onClick={() => setInfo('settings')}>
                <Settings />
                {!collapsed && 'Configurações'}
              </Button>
              <Button variant="ghost" className="sidebar-link" title="Central de ajuda" onClick={() => setInfo('help')}>
                <CircleHelp />
                {!collapsed && 'Central de ajuda'}
              </Button>
              <div className="sidebar-user">
                <Button variant="ghost" className="profile-button" onClick={() => setInfo('profile')}>
                  <span className="avatar">
                    {getProfileInitials(activeProfile)}
                  </span>
                  {!collapsed && (
                    <div>
                      <strong>{activeProfile.split(' · ')[0]}</strong>
                      <p>{activeProfile.split(' · ')[1] || 'Operador'}</p>
                    </div>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="collapse-button"
                  title={collapsed ? 'Expandir menu' : 'Recolher menu'}
                  aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                  onClick={() => {
                    setCollapsed(v => !v);
                    setMobileMenu(false);
                  }}
                >
                  {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                </Button>
              </div>
            </div>
          </aside>
          {mobileMenu && <div className="sidebar-scrim" onClick={() => setMobileMenu(false)} />}

          <div className="main-shell">
            <header className="main-header">
              <div className="header-left flex items-center gap-2 sm:gap-3 min-w-0 justify-self-start">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mobile-menu-toggle"
                  aria-label="Abrir menu"
                  onClick={() => setMobileMenu(v => !v)}
                >
                  <Menu />
                </Button>
                <span className="breadcrumb-workspace">Workspace</span>
                <span className="breadcrumb-slash">/</span>
                {(() => {
                  const currentMod = modules.find(m => m.id === module) ?? modules[0];
                  const ModIcon = currentMod?.icon ?? FileCheck2;
                  const modLabel = currentMod?.label ?? 'Mesa de conferência';
                  return (
                    <div className="inline-flex items-center gap-1.5 text-foreground font-semibold text-sm tracking-tight select-none truncate">
                      <ModIcon size={15} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{modLabel}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Centro da Navbar: Rigorosamente no centro geométrico */}
              <div className="header-center hidden md:flex items-center justify-center justify-self-center w-full max-w-sm lg:max-w-md">
                <Button
                  type="button"
                  variant="outline"
                  className="global-search header-center-search h-8 px-3.5 w-full justify-between bg-muted/40 hover:bg-muted/80 border-border/70 text-xs text-muted-foreground hover:text-foreground shadow-2xs transition-colors rounded-lg"
                  onClick={() => setGlobalSearch(true)}
                  aria-label="Buscar pedidos, clientes ou atalhos"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Search size={14} className="text-muted-foreground shrink-0" />
                    <span className="truncate">Buscar pedidos, clientes ou atalhos...</span>
                  </div>
                  <kbd className="ml-2 font-mono text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-muted-foreground shrink-0">⌘ K</kbd>
                </Button>
              </div>

              <div className="header-actions justify-self-end shrink-0">
                {module === 'orders' && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportOrdersCsv}>
                      <ArrowDownToLine size={13} />
                      <span>Exportar</span>
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs hover:opacity-95"
                      onClick={() => setMode('mobile')}
                    >
                      <Plus className="size-4 stroke-[2.75]" />
                      <span>Novo pedido</span>
                    </Button>
                    <div className="header-separator" />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-muted-foreground"
                  aria-label="Buscar"
                  title="Buscar"
                  onClick={() => setGlobalSearch(true)}
                >
                  <Search size={15} />
                </Button>
                <div className="header-separator md:hidden" />
                <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="notification-button flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors relative cursor-pointer focus:outline-none"
                      aria-label={`Notificações (${totalNotifications})`}
                      title="Notificações operacionais"
                    >
                      <Bell size={16} />
                      {totalNotifications > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    side="bottom"
                    sideOffset={8}
                    className="w-80 sm:w-96 p-0 shadow-2xl rounded-xl border border-border/80 bg-card text-card-foreground overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
                  >
                    {/* Cabeçalho do Card Retangular */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/70 bg-muted/40">
                      <div className="flex items-center gap-2">
                        <Bell size={15} className="text-primary" />
                        <span className="font-semibold text-xs text-foreground">Notificações</span>
                        {totalNotifications > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            {totalNotifications} pendência{totalNotifications > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">4S ERP</span>
                    </div>

                    {/* Lista Retangular de Notificações */}
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-border/50 text-xs">
                      {pendingOrders.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNotificationsOpen(false);
                            setModule('orders');
                            setMode('desktop');
                          }}
                          className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-3 cursor-pointer group"
                        >
                          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                            <FileCheck2 size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <strong className="text-xs font-semibold text-foreground">
                                {pendingOrders.length} pedido{pendingOrders.length > 1 ? 's' : ''} em Pré-Nota
                              </strong>
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold shrink-0">Revisar</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                              Aguardando conferência física (DQ) e fiscal (BQ) antes de emitir NF-e.
                            </p>
                          </div>
                        </button>
                      )}

                      {overdueClients.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNotificationsOpen(false);
                            setModule('receivables');
                            setMode('desktop');
                          }}
                          className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-3 cursor-pointer group"
                        >
                          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 group-hover:scale-105 transition-transform">
                            <CreditCard size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <strong className="text-xs font-semibold text-foreground">
                                {overdueClients.length} cliente{overdueClients.length > 1 ? 's' : ''} com boleto vencido
                              </strong>
                              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold shrink-0">Cobrança</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                              {overdueClients.slice(0, 2).map(c => c.name).join(', ')}{overdueClients.length > 2 ? ' e outros' : ''} possuem parcelas em atraso.
                            </p>
                          </div>
                        </button>
                      )}

                      {lowStockProducts.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNotificationsOpen(false);
                            setModule('registrations');
                            setMode('desktop');
                          }}
                          className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-3 cursor-pointer group"
                        >
                          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                            <Package size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <strong className="text-xs font-semibold text-foreground">
                                Saldo de estoque em atenção
                              </strong>
                              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold shrink-0">Estoque</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                              {lowStockProducts.map(p => p.name.replace('Farinha de Trigo ', '')).join(', ')} com menos de 100 sacas disponíveis.
                            </p>
                          </div>
                        </button>
                      )}

                      {restockClients.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNotificationsOpen(false);
                            setModule('registrations');
                            setMode('desktop');
                          }}
                          className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-3 cursor-pointer group"
                        >
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                            <Users size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <strong className="text-xs font-semibold text-foreground">
                                {restockClients.length} cliente{restockClients.length > 1 ? 's' : ''} no ciclo de recompra
                              </strong>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0">Vendas</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                              Momento de contato: {restockClients.slice(0, 2).map(c => c.name).join(', ')}.
                            </p>
                          </div>
                        </button>
                      )}

                      {totalNotifications === 0 && (
                        <div className="p-6 text-center text-muted-foreground">
                          <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
                          <p className="font-semibold text-xs text-foreground">Tudo em ordem!</p>
                          <p className="text-[11px] mt-0.5">Nenhuma pendência operacional requer sua atenção no momento.</p>
                        </div>
                      )}
                    </div>

                    {/* Rodapé do Dropdown */}
                    <div className="px-3.5 py-2.5 border-t border-border/70 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        {data.backendConnected ? 'Backend Conectado (:8085)' : 'Sessão Local'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationsOpen(false);
                          setGlobalSearch(true);
                        }}
                        className="text-primary hover:underline font-medium cursor-pointer"
                      >
                        Busca Rápida (Ctrl+K)
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  className="avatar-button"
                  aria-label="Perfil de usuário"
                  onClick={() => setInfo('profile')}
                >
                  <span className="avatar">
                    {getProfileInitials(activeProfile)}
                  </span>
                </Button>
              </div>
            </header>
            <main className={`main-content ${module === 'order-slip' ? 'overflow-y-auto' : ''}`}>
              {module === 'order-slip' ? (
                <OrderSlipSection
                  data={data}
                  userProfile={activeProfile}
                  initialOrderId={targetOrderId ?? undefined}
                />
              ) : ['orders', 'receivables', 'registrations', 'audit'].includes(module) ? (
                <Backoffice
                  {...shared}
                  activeModule={module}
                  userProfile={activeProfile}
                  newOrder={() => setMode('mobile')}
                  initialClientSearch={clientSearchQuery}
                  targetOrderId={targetOrderId}
                  onClearTargetOrderId={() => setTargetOrderId(null)}
                />
              ) : (
                <Management {...shared} module={module} userProfile={activeProfile} />
              )}
            </main>
            <footer className="app-footer">
              <span><span className="online-dot" />Todos os sistemas operacionais</span>
              <span>4S ERP <span className="mx-2">·</span> Total Trigo Comércio de Alimentos Ltda.</span>
              <span>v.1.0</span>
            </footer>
          </div>
        </div>
      ) : (
        <Seller {...shared} userProfile={activeProfile} />
      )}

      {toast && (
        <div className="toast-message" role="status">
          <span className="online-dot" />
          {toast}
          <Button variant="ghost" size="icon" aria-label="Fechar aviso" onClick={() => setToast('')}>
            <X size={14} />
          </Button>
        </div>
      )}

      <CommandPalette
        open={globalSearch}
        onOpenChange={setGlobalSearch}
        data={data}
        onSelectModule={(mod) => {
          setModule(mod);
          setMode('desktop');
        }}
        onSelectClient={(clientName) => {
          setClientSearchQuery(clientName);
          setModule('registrations');
          setMode('desktop');
          notify(`Filtrando cliente "${clientName}" em Cadastros & Estoque.`);
        }}
        onSelectOrder={(order) => {
          setModule('orders');
          setMode('desktop');
          setTargetOrderId(order.id);
          notify(`Abrindo conferência do Pedido #${order.id}.`);
        }}
        onNewOrder={() => {
          setMode('mobile');
          notify('Abrindo lançador de pedidos.');
        }}
        onExportCsv={() => {
          const csv = 'Pedido;Cliente;Status;Total\n' + data.orders.map(o => `${o.id};${data.clients.find(c => c.id === o.clientId)?.name};${o.status}`).join('\n');
          const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
          const a = document.createElement('a'); a.href = url; a.download = 'pedidos-4s.csv'; a.click(); URL.revokeObjectURL(url);
          notify('Relatório CSV exportado.');
        }}
        onSync={async () => {
          try {
            const fresh = await fetchWorkspaceData([]);
            setData(fresh);
            notify('Workspace sincronizado com o servidor.');
          } catch {
            notify('Erro ao sincronizar com o servidor.');
          }
        }}
      />

      <Dialog open={Boolean(info)} onOpenChange={o => { if (!o) setInfo(null); }}>
        <DialogContent className={info === 'profile' ? 'sm:max-w-xl' : ''}>
          <DialogTitle>
            {info === 'settings'
              ? 'Configurações do workspace'
              : info === 'help'
              ? 'Central de ajuda'
              : 'Perfil Operacional Ativo'}
          </DialogTitle>
          <DialogDescription>
            {info === 'settings'
              ? '4S ERP · Total Trigo Comércio de Alimentos'
              : info === 'profile'
              ? 'O perfil selecionado adapta as visões, permissões e assina todas as movimentações na Trilha de Auditoria.'
              : 'Contato e informações do ambiente'}
          </DialogDescription>
          {info === 'profile' ? (
            <div className="space-y-3 pt-2">
              <div className="grid gap-2.5">
                {PROFILES_CONFIG.map(p => {
                  const isActive = activeProfile === p.id;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        handleProfileChange(p.id);
                        setInfo(null);
                      }}
                      className={`w-full text-left p-3.5 rounded-lg border transition-all cursor-pointer flex items-start gap-3.5 ${
                        isActive
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs'
                          : 'border-border/70 hover:border-border hover:bg-muted/40'
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {p.name}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground border border-border/50">
                              {p.badge}
                            </span>
                          </div>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 shrink-0">
                              <Check size={12} className="stroke-[3]" />
                              Ativo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {p.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Operador conectado: <strong className="text-foreground">{activeProfile.split(' · ')[0]}</strong></span>
                <span className="font-mono text-[11px]">Sessão 4S Segura</span>
              </div>
            </div>
          ) : info === 'settings' ? (
            <>
              <div className="settings-row">
                <div>
                  <span className="font-medium text-foreground">Conforto Visual</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Tamanho da fonte para Sr. Sérgio</p>
                </div>
                <div className="font-scale-control settings-scale" role="group" aria-label="Tamanho da fonte">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`font-scale-btn ${fontScale === 'normal' ? 'selected' : ''}`}
                    onClick={() => updateFontScale('normal')}
                  >
                    Normal (A)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`font-scale-btn ${fontScale === 'large' ? 'selected' : ''}`}
                    onClick={() => updateFontScale('large')}
                  >
                    Grande (A+)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`font-scale-btn ${fontScale === 'xlarge' ? 'selected' : ''}`}
                    onClick={() => updateFontScale('xlarge')}
                  >
                    Extra Grande (A++)
                  </Button>
                </div>
              </div>
              <div className="settings-row">
                <span>Moeda</span>
                <strong>Real brasileiro · BRL</strong>
              </div>
              <div className="settings-row">
                <span>Localização</span>
                <strong>São Paulo · Brasil</strong>
              </div>
              <div className="settings-row">
                <span>Backend API</span>
                <strong>{data.backendConnected ? 'Conectado (Spring Boot :8085)' : 'Sessão local'}</strong>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const fresh = await fetchWorkspaceData([]);
                    setData(fresh);
                    setInfo(null);
                    notify('Dados recarregados do servidor.');
                  } catch {
                    setData(demoData());
                    setInfo(null);
                    notify('Demonstração reiniciada.');
                  }
                }}
              >
                Sincronizar com o servidor
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                4S ERP · Força de Vendas, Suprimentos, SEFAZ Pré-Nota e Separação da Total Trigo.
              </p>
              <p className="text-sm text-muted-foreground">
                Todas as reservas de estoque, revisões de pré-nota, buscas de CNPJ e lotes de importação são persistidos no banco de dados.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
