export type ThemeKey = 'trigo-gold' | 'fintech-navy' | 'agro-emerald' | 'classic-mono';

export interface DesignTheme {
  key: ThemeKey;
  name: string;
  badge: string;
  subtitle: string;
  swatchHex: string;
  accentHex: string;
  // Classes aplicadas ao Mobile e Desktop
  appOuterBg: string;
  phoneShellBg: string;
  phoneBorder: string;
  topbarBg: string;
  topbarLabel: string;
  topbarSkuCard: string;
  topbarSkuName: string;
  topbarSkuValue: string;
  primaryBtn: string;
  secondaryBtn: string;
  tabContainer: string;
  tabActive: string;
  tabInactive: string;
  cardBg: string;
  cardHover: string;
  priceCardBg: string;
  priceValueText: string;
  profitBoxBg: string;
  bottomNavBg: string;
  bottomNavActive: string;
  bottomNavInactive: string;
  accentBadge: string;
}

export const DESIGN_THEMES: Record<ThemeKey, DesignTheme> = {
  'trigo-gold': {
    key: 'trigo-gold',
    name: '1. Trigo & Ouro Artesanal',
    badge: 'Recomendado Total Trigo',
    subtitle: 'Identidade quente inspirada em moagem, grãos de trigo dourados e panificação B2B',
    swatchHex: '#261C15',
    accentHex: '#D97706',
    appOuterBg: 'bg-[#EDE6DB]',
    phoneShellBg: 'bg-[#FAF6F0]',
    phoneBorder: 'border-[#D9CEBE]',
    topbarBg: 'bg-[#211813] text-[#FAF6F0] border-b border-[#382A21]',
    topbarLabel: 'text-amber-400/90',
    topbarSkuCard: 'bg-[#2E221B] border border-[#45342A]',
    topbarSkuName: 'text-[#C8B9A6]',
    topbarSkuValue: 'text-amber-300',
    primaryBtn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-950/20',
    secondaryBtn: 'bg-[#EFE8DC] hover:bg-[#E4DAC8] text-[#2B201A]',
    tabContainer: 'bg-[#E5DDD0]',
    tabActive: 'bg-[#211813] text-amber-300 shadow-sm',
    tabInactive: 'text-[#6E5D4F] hover:text-[#211813]',
    cardBg: 'bg-white border-[#E6DEC8]',
    cardHover: 'hover:border-amber-500/70 hover:shadow-md',
    priceCardBg: 'bg-amber-50/70 border-amber-200/80',
    priceValueText: 'text-[#211813]',
    profitBoxBg: 'bg-gradient-to-br from-[#211813] to-[#33241B] text-white border border-amber-500/30',
    bottomNavBg: 'bg-white/95 backdrop-blur border-t border-[#E6DEC8]',
    bottomNavActive: 'text-amber-700 font-bold border-t-2 border-amber-600 -mt-[9px]',
    bottomNavInactive: 'text-stone-400 font-medium',
    accentBadge: 'bg-amber-100 text-amber-900 border border-amber-300'
  },
  'fintech-navy': {
    key: 'fintech-navy',
    name: '2. Industrial Navy & Royal',
    badge: 'ERP Corporativo',
    subtitle: 'Visual fintech de alta densidade em azul marinho e azul royal para operações logísticas',
    swatchHex: '#0F172A',
    accentHex: '#2563EB',
    appOuterBg: 'bg-slate-200',
    phoneShellBg: 'bg-slate-50',
    phoneBorder: 'border-slate-300',
    topbarBg: 'bg-slate-900 text-white border-b border-slate-800',
    topbarLabel: 'text-sky-400',
    topbarSkuCard: 'bg-slate-800/90 border border-slate-700',
    topbarSkuName: 'text-slate-300',
    topbarSkuValue: 'text-sky-300',
    primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-950/20',
    secondaryBtn: 'bg-slate-100 hover:bg-slate-200 text-slate-800',
    tabContainer: 'bg-slate-200/90',
    tabActive: 'bg-blue-600 text-white shadow-sm',
    tabInactive: 'text-slate-600 hover:text-slate-900',
    cardBg: 'bg-white border-slate-200/90',
    cardHover: 'hover:border-blue-500 hover:shadow-md',
    priceCardBg: 'bg-blue-50/60 border-blue-200/80',
    priceValueText: 'text-blue-950',
    profitBoxBg: 'bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white border border-blue-500/30',
    bottomNavBg: 'bg-white border-t border-slate-200',
    bottomNavActive: 'text-blue-600 font-bold border-t-2 border-blue-600 -mt-[9px]',
    bottomNavInactive: 'text-slate-400 font-medium',
    accentBadge: 'bg-blue-50 text-blue-800 border border-blue-200'
  },
  'agro-emerald': {
    key: 'agro-emerald',
    name: '3. Esmeralda & Campo (Sol Forte)',
    badge: 'Alto Contraste Rua',
    subtitle: 'Projetado para máxima leitura na rua sob sol forte com verde agro e indicadores vibrantes',
    swatchHex: '#064E3B',
    accentHex: '#059669',
    appOuterBg: 'bg-stone-200',
    phoneShellBg: 'bg-[#F4F8F6]',
    phoneBorder: 'border-emerald-300',
    topbarBg: 'bg-emerald-950 text-white border-b border-emerald-900',
    topbarLabel: 'text-emerald-300',
    topbarSkuCard: 'bg-emerald-900/80 border border-emerald-700/80',
    topbarSkuName: 'text-emerald-100',
    topbarSkuValue: 'text-amber-300',
    primaryBtn: 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-sm',
    secondaryBtn: 'bg-emerald-100/80 hover:bg-emerald-200/70 text-emerald-950',
    tabContainer: 'bg-emerald-950/10',
    tabActive: 'bg-emerald-800 text-white shadow-sm',
    tabInactive: 'text-emerald-950/70 hover:text-emerald-950',
    cardBg: 'bg-white border-emerald-200/90',
    cardHover: 'hover:border-emerald-600 hover:shadow-md',
    priceCardBg: 'bg-emerald-50/70 border-emerald-200',
    priceValueText: 'text-emerald-950',
    profitBoxBg: 'bg-emerald-950 text-white border border-emerald-700',
    bottomNavBg: 'bg-white border-t border-emerald-200',
    bottomNavActive: 'text-emerald-800 font-bold border-t-2 border-emerald-700 -mt-[9px]',
    bottomNavInactive: 'text-stone-400 font-medium',
    accentBadge: 'bg-emerald-100 text-emerald-900 border border-emerald-300'
  },
  'classic-mono': {
    key: 'classic-mono',
    name: '4. Minimalista (Protótipo Original+)',
    badge: 'Base Aprovada',
    subtitle: 'O visual neutro do prototipo_app_vendas_pai.html refinado com tipografia e acabamento de estúdio',
    swatchHex: '#171717',
    accentHex: '#404040',
    appOuterBg: 'bg-neutral-200',
    phoneShellBg: 'bg-neutral-50',
    phoneBorder: 'border-neutral-300',
    topbarBg: 'bg-white text-neutral-900 border-b border-neutral-200',
    topbarLabel: 'text-neutral-400',
    topbarSkuCard: 'bg-neutral-100 border border-neutral-200',
    topbarSkuName: 'text-neutral-500',
    topbarSkuValue: 'text-neutral-900',
    primaryBtn: 'bg-neutral-900 hover:bg-neutral-800 text-white',
    secondaryBtn: 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800',
    tabContainer: 'bg-neutral-200',
    tabActive: 'bg-white text-neutral-900 shadow-sm',
    tabInactive: 'text-neutral-600',
    cardBg: 'bg-white border-neutral-200',
    cardHover: 'hover:border-neutral-400',
    priceCardBg: 'bg-neutral-50 border-neutral-200',
    priceValueText: 'text-neutral-900',
    profitBoxBg: 'bg-neutral-900 text-white',
    bottomNavBg: 'bg-white border-t border-neutral-200',
    bottomNavActive: 'text-neutral-900 font-bold border-t-2 border-neutral-900 -mt-[9px]',
    bottomNavInactive: 'text-neutral-400 font-medium',
    accentBadge: 'bg-neutral-100 text-neutral-800 border border-neutral-300'
  }
};
