import React, { useEffect, useState } from 'react';
import {
  Columns2,
  Monitor,
  Palette,
  Smartphone,
  Wheat
} from 'lucide-react';
import { api } from './api';
import { BackofficeDesktop } from './components/BackofficeDesktop';
import { MobileFieldApp } from './components/MobileFieldApp';
import { DESIGN_THEMES, ThemeKey } from './themes';
import { TopbarSummary } from './types';

type ViewMode = 'mobile' | 'backoffice' | 'split';

export const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const p = window.location.pathname;
    if (p.startsWith('/backoffice')) return 'backoffice';
    if (p.startsWith('/app')) return 'mobile';
    return 'split';
  });

  const [themeKey, setThemeKey] = useState<ThemeKey>('trigo-gold');
  const [topbarData, setTopbarData] = useState<TopbarSummary | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const currentTheme = DESIGN_THEMES[themeKey];

  const loadTopbarAndSync = async () => {
    try {
      const summary = await api.getTopbar();
      setTopbarData(summary);
      setRefreshTrigger((prev) => prev + 1);
    } catch {
      // ignore initial error if backend still booting
    }
  };

  useEffect(() => {
    loadTopbarAndSync();
  }, []);

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    const nextUrl = mode === 'mobile' ? '/app' : mode === 'backoffice' ? '/backoffice' : '/';
    window.history.pushState({}, '', nextUrl);
  };

  return (
    <div
      className={`min-h-screen flex flex-col ${currentTheme.appOuterBg} transition-colors duration-300`}
    >
      {/* BARRA SUPERIOR DE CONTROLE: SELETOR DE MÓDULO + ESTÚDIO DE 4 VERSÕES DE DESIGN/CORES */}
      <div className="bg-stone-950 text-white border-b border-stone-800 px-4 py-2.5 sticky top-0 z-40 shadow-md">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Marca Total Trigo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-extrabold shadow-xs">
              <Wheat className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight">TOTAL TRIGO ERP</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold">
                  3 SKUs • Reserva Tripla • NF-e 4.00
                </span>
              </div>
              <p className="text-[10px] text-stone-400 hidden sm:block">
                Tema Ativo: <strong className="text-stone-200">{currentTheme.name}</strong> —{' '}
                {currentTheme.subtitle}
              </p>
            </div>
          </div>

          {/* Seletor das 4 Versões de Design & Cores */}
          <div className="flex items-center gap-1.5 bg-stone-900 p-1 rounded-xl border border-stone-800 overflow-x-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2 flex items-center gap-1 shrink-0">
              <Palette className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              Versões de Design:
            </span>
            {(Object.keys(DESIGN_THEMES) as ThemeKey[]).map((k) => {
              const t = DESIGN_THEMES[k];
              const isSelected = themeKey === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setThemeKey(k)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-stone-950 shadow-xs'
                      : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-white/40 shrink-0"
                    style={{ backgroundColor: t.accentHex }}
                  />
                  {t.name}
                </button>
              );
            })}
          </div>

          {/* Alternador de Visão: Mobile (/app) vs Backoffice (/backoffice) vs Lado a Lado */}
          <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => switchView('mobile')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'mobile'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
              App Rua (Pai)
            </button>
            <button
              type="button"
              onClick={() => switchView('backoffice')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'backoffice'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" aria-hidden="true" />
              Backoffice (Gabriel)
            </button>
            <button
              type="button"
              onClick={() => switchView('split')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
              Lado a Lado (Teste E2E)
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE EXIBIÇÃO PRINCIPAL */}
      <div className="flex-1 p-3 sm:p-6 max-w-[1600px] w-full mx-auto">
        {viewMode === 'mobile' && (
          <div className="flex justify-center">
            <MobileFieldApp
              theme={currentTheme}
              topbarData={topbarData}
              onDataMutated={loadTopbarAndSync}
            />
          </div>
        )}

        {viewMode === 'backoffice' && (
          <BackofficeDesktop
            theme={currentTheme}
            topbarData={topbarData}
            refreshTrigger={refreshTrigger}
            onDataMutated={loadTopbarAndSync}
          />
        )}

        {viewMode === 'split' && (
          <div className="flex flex-col xl:flex-row items-start justify-center gap-6">
            <div className="w-full xl:w-auto flex flex-col items-center shrink-0">
              <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-amber-600" aria-hidden="true" />
                Visão Mobile na Rua (Sr. Sérgio) — Rota `/app`
              </div>
              <MobileFieldApp
                theme={currentTheme}
                topbarData={topbarData}
                onDataMutated={loadTopbarAndSync}
              />
            </div>

            <div className="flex-1 w-full">
              <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-amber-600" aria-hidden="true" />
                Visão Desktop no Escritório (Gabriel) — Rota `/backoffice`
              </div>
              <BackofficeDesktop
                theme={currentTheme}
                topbarData={topbarData}
                refreshTrigger={refreshTrigger}
                onDataMutated={loadTopbarAndSync}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
