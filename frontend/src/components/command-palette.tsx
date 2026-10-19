import React, { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  Barcode,
  CheckCheck,
  Clock3,
  FileCheck2,
  FileSpreadsheet,
  Globe2,
  LayoutDashboard,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Truck,
  Users,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { available, financials, money, productLabel, type AppData, type Order } from '@/lib/business';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AppData;
  onSelectOrder?: (order: Order) => void;
  onSelectClient?: (clientName: string) => void;
  onSelectModule?: (moduleId: string) => void;
  onNewOrder?: () => void;
  onExportCsv?: () => void;
  onSync?: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  data,
  onSelectOrder,
  onSelectClient,
  onSelectModule,
  onNewOrder,
  onExportCsv,
  onSync,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const pendingOrders = data.orders.filter(o => o.status === 'AGUARDANDO_REVISAO');

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Digite um comando, cliente, pedido ou SKU..."
      />
      <CommandList className="max-h-[380px]">
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {/* Busca Dinâmica de Clientes por Texto */}
        {query.trim().length > 0 && (
          <>
            <CommandGroup heading="Ação de Busca Rápida">
              <CommandItem
                value={`pesquisar buscar cliente ${query.trim()}`}
                onSelect={() => {
                  onOpenChange(false);
                  onSelectClient?.(query.trim());
                }}
              >
                <Search className="mr-2 h-4 w-4 text-primary" />
                <div className="flex items-center justify-between flex-1">
                  <span className="text-xs">
                    Pesquisar <strong>"{query.trim()}"</strong> em Cadastros & Estoque
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">Ir para Cadastros ↵</span>
                </div>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navegação Rápida entre Módulos */}
        <CommandGroup heading="Módulos & Seções">
          <CommandItem
            value="mesa de conferência pedidos conferencia orders"
            onSelect={() => {
              onOpenChange(false);
              onSelectModule?.('orders');
            }}
          >
            <FileCheck2 className="mr-2 h-4 w-4 text-blue-500" />
            <span>Mesa de Conferência (Pré-Nota & Faturamento)</span>
          </CommandItem>
          <CommandItem
            value="boletos contas a receber financeiro bancos cobrança receivables"
            onSelect={() => {
              onOpenChange(false);
              onSelectModule?.('receivables');
            }}
          >
            <Barcode className="mr-2 h-4 w-4 text-purple-500" />
            <span>Boletos & Contas a Receber</span>
          </CommandItem>
          <CommandItem
            value="cadastros estoque clientes produtos precos registrations"
            onSelect={() => {
              onOpenChange(false);
              onSelectModule?.('registrations');
            }}
          >
            <Users className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Cadastros & Estoque</span>
          </CommandItem>
          <CommandItem
            value="trilha de auditoria logs seguranca conformidade fiscal audit"
            onSelect={() => {
              onOpenChange(false);
              onSelectModule?.('audit');
            }}
          >
            <ShieldCheck className="mr-2 h-4 w-4 text-amber-500" />
            <span>Trilha de Auditoria</span>
          </CommandItem>
          <CommandItem
            value="simulador de importacao landed cost trigo di frete import"
            onSelect={() => {
              onOpenChange(false);
              onSelectModule?.('import');
            }}
          >
            <Globe2 className="mr-2 h-4 w-4 text-indigo-500" />
            <span>Simulador de Importação (Landed Cost)</span>
          </CommandItem>
          <CommandItem
            value="visao executiva relatorios kpi faturamento margem executive"
            onSelect={() => {
              onOpenChange(false);
              onSelectModule?.('executive');
            }}
          >
            <LayoutDashboard className="mr-2 h-4 w-4 text-cyan-500" />
            <span>Visão Executiva (KPIs & DRE)</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Ações Rápidas */}
        <CommandGroup heading="Ações Rápidas">
          <CommandItem
            value="novo pedido field sales lancar venda mobile"
            onSelect={() => {
              onOpenChange(false);
              onNewOrder?.();
            }}
          >
            <Plus className="mr-2 h-4 w-4 text-primary" />
            <span>Novo Pedido (Field Sales)</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="exportar pedidos em csv relatorio planilha"
            onSelect={() => {
              onOpenChange(false);
              onExportCsv?.();
            }}
          >
            <ArrowDownToLine className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Exportar Pedidos em CSV</span>
            <CommandShortcut>⇧E</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="simulador de importacao landed cost"
            onSelect={() => {
              onOpenChange(false);
              onSelectModule?.('import');
            }}
          >
            <Globe2 className="mr-2 h-4 w-4 text-indigo-500" />
            <span>Simulador de Importação (Landed Cost)</span>
            <CommandShortcut>⌘I</CommandShortcut>
          </CommandItem>
          {onSync && (
            <CommandItem
              value="sincronizar com servidor backend api atualizar"
              onSelect={() => {
                onOpenChange(false);
                onSync();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4 text-amber-500" />
              <span>Sincronizar com Servidor Backend</span>
              <CommandShortcut>⌘R</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* Clientes Cadastrados (Direciona para Cadastros & Estoque com o cliente preenchido) */}
        <CommandGroup heading={`Clientes & Padarias (${data.clients.length})`}>
          {data.clients.map(client => (
            <CommandItem
              key={client.id}
              value={`${client.name} ${client.neighborhood} ${client.buyer} ${client.cnpj}`}
              onSelect={() => {
                onOpenChange(false);
                onSelectClient?.(client.name);
              }}
            >
              <Users className="mr-2 h-4 w-4 text-primary" />
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground truncate">{client.name}</span>
                  <span className="text-[10px] text-primary font-mono ml-2 shrink-0">Abrir em Cadastros ↗</span>
                </div>
                <span className="text-[10px] text-muted-foreground truncate">
                  {client.neighborhood}, SP · Comprador: {client.buyer} · CNPJ: {client.cnpj}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Pedidos em Pré-Nota */}
        {pendingOrders.length > 0 && (
          <>
            <CommandGroup heading={`Fila Pré-Nota (${pendingOrders.length} aguardando)`}>
              {pendingOrders.map(order => {
                const client = data.clients.find(c => c.id === order.clientId);
                const fin = financials(order.items);
                return (
                  <CommandItem
                    key={order.id}
                    value={`pedido #${order.id} ${order.id} ${client?.name ?? 'Cliente'} ${client?.neighborhood ?? ''}`}
                    onSelect={() => {
                      onOpenChange(false);
                      onSelectOrder?.(order);
                    }}
                  >
                    <Clock3 className="mr-2 h-4 w-4 text-amber-500" />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs truncate">
                          #{order.id} — {client?.name ?? 'Cliente'}
                        </span>
                        <span className="font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                          {money(fin.total)}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {client?.neighborhood} · {order.items.reduce((s, i) => s + i.quantity, 0)} sacos
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* SKUs e Estoque Disponível */}
        <CommandGroup heading="Posição de Estoque (3 SKUs)">
          {data.products.map(prod => (
            <CommandItem
              key={prod.id}
              value={`produto sku ${prod.name} ${prod.skuCode ?? ''} estoque`}
              onSelect={() => {
                onOpenChange(false);
                onSelectModule?.('orders');
              }}
            >
              <Package className="mr-2 h-4 w-4 text-amber-600" />
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="text-xs truncate">{prod.name}</span>
                <div className="flex items-center gap-2 text-xs shrink-0 ml-2">
                  <span className="text-muted-foreground">Disp:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {available(prod)} un.
                  </span>
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-muted-foreground bg-muted/30">
        <div className="flex items-center gap-3">
          <span><kbd className="px-1 py-0.5 rounded bg-card border text-[9px]">↑↓</kbd> Navegar</span>
          <span><kbd className="px-1 py-0.5 rounded bg-card border text-[9px]">↵</kbd> Selecionar</span>
          <span><kbd className="px-1 py-0.5 rounded bg-card border text-[9px]">ESC</kbd> Fechar</span>
        </div>
        <span className="font-medium text-primary">4S ERP Quick Access</span>
      </div>
    </CommandDialog>
  );
}
