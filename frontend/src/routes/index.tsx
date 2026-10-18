import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Bell, ChevronDown, ChevronsUpDown, CircleHelp, Command, FileCheck2, Globe2, LayoutDashboard, LogOut, Menu, Monitor, Package, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings2, Smartphone, Sparkles, Truck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Backoffice } from '@/components/backoffice';
import { Management } from '@/components/management';
import { Seller } from '@/components/seller';
import { FourSIcon, FourSLogo } from '@/components/logo';
import { createOrderApi, demoData, fetchWorkspaceData, financials, reserveOrder, type AppData, type Order } from '@/lib/business';
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

const modules = [
  { id: 'orders', label: 'Mesa de conferência', icon: FileCheck2 },
  { id: 'import', label: 'Importação', icon: Globe2 },
  { id: 'executive', label: 'Visão executiva', icon: LayoutDashboard },
];

function Index() {
  const [data, setData] = useState<AppData>(demoData);
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  const [module, setModule] = useState('orders');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [info, setInfo] = useState<'settings' | 'help' | 'notifications' | 'profile' | null>(null);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [query, setQuery] = useState('');
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

  const updateFontScale = (scale: FontScale) => {
    setFontScale(scale);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('totaltrigo_font_scale', scale);
      } catch {
        // Fallback silencioso caso localStorage esteja bloqueado
      }
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('font-scale-normal', 'font-scale-large', 'font-scale-xlarge');
      document.documentElement.classList.add(`font-scale-${fontScale}`);
    }
  }, [fontScale]);

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
          notify(e instanceof Error ? e.message : 'Salvo localmente (modo offline).');
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
          <div className="font-scale-control" role="group" aria-label="Tamanho da letra (Conforto visual)">
            <Button
              variant="ghost"
              size="sm"
              className={`font-scale-btn ${fontScale === 'normal' ? 'selected' : ''}`}
              onClick={() => updateFontScale('normal')}
              title="Tamanho da letra (Conforto visual)"
              aria-label="Tamanho da letra normal"
            >
              A
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`font-scale-btn ${fontScale === 'large' ? 'selected' : ''}`}
              onClick={() => updateFontScale('large')}
              title="Tamanho da letra (Conforto visual)"
              aria-label="Tamanho da letra grande"
            >
              A+
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`font-scale-btn ${fontScale === 'xlarge' ? 'selected' : ''}`}
              onClick={() => updateFontScale('xlarge')}
              title="Tamanho da letra (Conforto visual)"
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
                    <p>Workspace de Gabriel</p>
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
                <Settings2 />
                {!collapsed && 'Configurações'}
              </Button>
              <Button variant="ghost" className="sidebar-link" title="Central de ajuda" onClick={() => setInfo('help')}>
                <CircleHelp />
                {!collapsed && 'Central de ajuda'}
              </Button>
              <div className="sidebar-user">
                <Button variant="ghost" className="profile-button" onClick={() => setInfo('profile')}>
                  <span className="avatar">GF</span>
                  {!collapsed && (
                    <div>
                      <strong>Gabriel Furtado</strong>
                      <p>Administrador</p>
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
              <div className="flex items-center gap-3">
                <Button
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
                <span>{modules.find(m => m.id === module)?.label}</span>
              </div>
              <div className="header-center-title">
                <h2>{modules.find(m => m.id === module)?.label}</h2>
              </div>
              <div className="header-actions">
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
                      <Plus size={14} />
                      <span>+ Novo pedido</span>
                    </Button>
                    <div className="header-separator" />
                  </div>
                )}
                <Button variant="ghost" className="global-search" onClick={() => setGlobalSearch(true)}>
                  <Search size={15} />
                  <span>Buscar</span>
                  <kbd>⌘ K</kbd>
                </Button>
                <div className="header-separator" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="notification-button"
                  aria-label="Notificações"
                  title="Notificações"
                  onClick={() => setInfo('notifications')}
                >
                  <Bell />
                  <i />
                </Button>
                <Button
                  variant="ghost"
                  className="avatar-button"
                  aria-label="Perfil de Gabriel"
                  onClick={() => setInfo('profile')}
                >
                  <span className="avatar">GF</span>
                </Button>
              </div>
            </header>
            <main className="main-content">
              {module === 'orders' ? <Backoffice {...shared} newOrder={() => setMode('mobile')} /> : <Management {...shared} module={module} />}
            </main>
            <footer className="app-footer">
              <span><span className="online-dot" />Todos os sistemas operacionais</span>
              <span>4S ERP <span className="mx-2">·</span> Total Trigo Comércio de Alimentos Ltda.</span>
              <span>v.1.0</span>
            </footer>
          </div>
        </div>
      ) : (
        <Seller {...shared} />
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
        <DialogContent>
          <DialogTitle>
            {info === 'settings' ? 'Configurações do workspace' : info === 'help' ? 'Central de ajuda' : info === 'notifications' ? 'Notificações' : 'Gabriel Furtado'}
          </DialogTitle>
          <DialogDescription>
            {info === 'settings' ? '4S ERP · Total Trigo Comércio de Alimentos' : info === 'profile' ? 'Administrador · Workspace Total Trigo 4S' : info === 'help' ? 'Contato e informações do ambiente' : 'Atualizações da sua operação'}
          </DialogDescription>
          {info === 'settings' ? (
            <>
              <div className="settings-row">
                <div>
                  <span className="font-medium text-foreground">Conforto Visual</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Tamanho da fonte para Sr. Sérgio</p>
                </div>
                <div className="font-scale-control settings-scale" role="group" aria-label="Tamanho da fonte">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`font-scale-btn ${fontScale === 'normal' ? 'selected' : ''}`}
                    onClick={() => updateFontScale('normal')}
                  >
                    Normal
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`font-scale-btn ${fontScale === 'large' ? 'selected' : ''}`}
                    onClick={() => updateFontScale('large')}
                  >
                    Grande (A+)
                  </Button>
                  <Button
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
          ) : info === 'notifications' ? (
            <>
              <div className="attention-row">
                <FileCheck2 size={18} />
                <div>
                  <strong>{data.orders.filter(o => o.status === 'AGUARDANDO_REVISAO').length} pedidos aguardam conferência</strong>
                  <p>Confira os dados fiscais antes da emissão.</p>
                </div>
              </div>
              <div className="attention-row">
                <Package size={18} />
                <div>
                  <strong>Estoque e lotes de importação</strong>
                  <p>Custo Médio Ponderado ativo · Rastreabilidade SEFAZ.</p>
                </div>
              </div>
            </>
          ) : info === 'help' ? (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                4S ERP · Força de Vendas, Suprimentos, SEFAZ Pré-Nota e Separação da Total Trigo.
              </p>
              <p className="text-sm text-muted-foreground">
                Todas as reservas de estoque, revisões de pré-nota, buscas de CNPJ e lotes de importação são persistidos no banco de dados.
              </p>
            </>
          ) : (
            <>
              <div className="flex gap-3 items-center py-3">
                <span className="avatar">GF</span>
                <div>
                  <strong>Gabriel Furtado</strong>
                  <p className="text-sm text-muted-foreground">Gestão comercial e fiscal</p>
                </div>
              </div>
              <div className="settings-row">
                <span>Permissão</span>
                <strong>Administrador</strong>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
