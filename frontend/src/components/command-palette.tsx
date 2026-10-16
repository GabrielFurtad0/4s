import React, { useEffect } from 'react';
import {
  ArrowDownToLine,
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
  onSelectModule,
  onNewOrder,
  onExportCsv,
  onSync,
}: CommandPaletteProps) {
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
      <CommandInput placeholder="Digite um comando, cliente, pedido ou SKU..." />
      <CommandList className="max-h-[380px]">
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {/* Ações Rápidas */}
        <CommandGroup heading="Ações Rápidas">
          <CommandItem
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

        {/* Pedidos em Pré-Nota */}
        <CommandGroup heading={`Fila Pré-Nota (${pendingOrders.length} aguardando)`}>
          {pendingOrders.map(order => {
            const client = data.clients.find(c => c.id === order.clientId);
            const fin = financials(order.items);
            return (
              <CommandItem
                key={order.id}
                onSelect={() => {
                  onOpenChange(false);
                  onSelectOrder?.(order);
                }}
              >
                <Clock3 className="mr-2 h-4 w-4 text-amber-500" />
                <div className="flex flex-col flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs">
                      #{order.id} — {client?.name ?? 'Cliente'}
                    </span>
                    <span className="font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {money(fin.total)}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {client?.neighborhood} · {order.items.reduce((s, i) => s + i.quantity, 0)} sacos
                  </span>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* SKUs e Estoque Disponível */}
        <CommandGroup heading="Posição de Estoque (3 SKUs)">
          {data.products.map(prod => (
            <CommandItem
              key={prod.id}
              onSelect={() => {
                onOpenChange(false);
                onSelectModule?.('orders');
              }}
            >
              <Package className="mr-2 h-4 w-4 text-amber-600" />
              <div className="flex items-center justify-between flex-1">
                <span className="text-xs">{prod.name}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Disp:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {available(prod)} un.
                  </span>
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Clientes Cadastrados */}
        <CommandGroup heading="Clientes & Padarias">
          {data.clients.map(client => (
            <CommandItem
              key={client.id}
              onSelect={() => {
                onOpenChange(false);
                onSelectModule?.('orders');
              }}
            >
              <Users className="mr-2 h-4 w-4 text-primary" />
              <div className="flex flex-col flex-1">
                <span className="text-xs font-medium">{client.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {client.neighborhood}, SP · Comprador: {client.buyer}
                </span>
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
