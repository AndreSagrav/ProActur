// Colección de diseños de Canvas artísticos y vistosos para libretas
export const CANVAS_STYLES = [
  {
    id: 'sunset-aurora',
    name: 'Atardecer Dorado',
    bgGradient: 'from-amber-500 via-rose-500 to-purple-800',
    spineColor: 'bg-amber-900 border-r border-amber-700/50',
    ribbonColor: 'bg-amber-300',
    plaqueBg: 'bg-slate-950/80 backdrop-blur-md border-amber-500/30',
    accentColor: '#f59e0b',
    textColor: 'text-amber-100',
    badge: 'Canvas Art',
    desc: 'Degradado atardecer cálido con tonos oro y rosa'
  },
  {
    id: 'neon-teal',
    name: 'Aurora Boreal',
    bgGradient: 'from-emerald-400 via-teal-600 to-indigo-900',
    spineColor: 'bg-teal-950 border-r border-emerald-600/50',
    ribbonColor: 'bg-emerald-300',
    plaqueBg: 'bg-slate-950/80 backdrop-blur-md border-emerald-500/30',
    accentColor: '#10b981',
    textColor: 'text-emerald-100',
    badge: 'Neón Teal',
    desc: 'Luces del norte esmeralda y turquesa vibrante'
  },
  {
    id: 'cyber-synthwave',
    name: 'Cyber Synthwave',
    bgGradient: 'from-fuchsia-600 via-purple-700 to-slate-950',
    spineColor: 'bg-fuchsia-950 border-r border-fuchsia-700/50',
    ribbonColor: 'bg-fuchsia-300',
    plaqueBg: 'bg-slate-950/80 backdrop-blur-md border-fuchsia-500/30',
    accentColor: '#ec4899',
    textColor: 'text-fuchsia-100',
    badge: 'Synthwave',
    desc: 'Estilo retro 80s con magenta y violeta eléctrico'
  },
  {
    id: 'ocean-blueprint',
    name: 'Plano Blueprint',
    bgGradient: 'from-cyan-600 via-blue-700 to-slate-950',
    spineColor: 'bg-blue-950 border-r border-cyan-700/50',
    ribbonColor: 'bg-cyan-300',
    plaqueBg: 'bg-slate-950/80 backdrop-blur-md border-cyan-500/30',
    accentColor: '#06b6d4',
    textColor: 'text-cyan-100',
    badge: 'Blueprint',
    desc: 'Diseño arquitectónico azul rey y cian técnico'
  },
  {
    id: 'moleskine-gold',
    name: 'Cuero Moleskine',
    bgGradient: 'from-stone-900 via-neutral-900 to-zinc-950',
    spineColor: 'bg-black border-r border-amber-600/40',
    ribbonColor: 'bg-amber-400',
    plaqueBg: 'bg-neutral-950/90 backdrop-blur-md border-amber-600/40',
    accentColor: '#d97706',
    textColor: 'text-amber-200',
    badge: 'Edición Cuero',
    desc: 'Textura de piel oscura con detalles en dorado'
  },
  {
    id: 'pastel-watercolor',
    name: 'Acuarela Pastel',
    bgGradient: 'from-pink-400 via-rose-400 to-purple-600',
    spineColor: 'bg-rose-900 border-r border-pink-500/50',
    ribbonColor: 'bg-rose-200',
    plaqueBg: 'bg-slate-950/80 backdrop-blur-md border-rose-400/30',
    accentColor: '#f43f5e',
    textColor: 'text-rose-100',
    badge: 'Acuarela',
    desc: 'Pinceladas suaves en tonos pastel y violeta'
  },
  {
    id: 'solar-flare',
    name: 'Fuego Solar',
    bgGradient: 'from-orange-500 via-amber-600 to-red-800',
    spineColor: 'bg-amber-950 border-r border-orange-600/50',
    ribbonColor: 'bg-yellow-300',
    plaqueBg: 'bg-slate-950/80 backdrop-blur-md border-orange-500/30',
    accentColor: '#ea580c',
    textColor: 'text-orange-100',
    badge: 'Fuego Solar',
    desc: 'Energía radiante de fuego, mandarina y sol'
  },
  {
    id: 'obsidian-indigo',
    name: 'Obsidiana Indigo',
    bgGradient: 'from-indigo-600 via-violet-700 to-slate-950',
    spineColor: 'bg-slate-950 border-r border-indigo-700/50',
    ribbonColor: 'bg-indigo-300',
    plaqueBg: 'bg-slate-950/80 backdrop-blur-md border-indigo-500/30',
    accentColor: '#6366f1',
    textColor: 'text-indigo-100',
    badge: 'Canvas Indigo',
    desc: 'Elegancia clásica en violeta y azul profundo'
  }
];

export function getCanvasStyle(styleIdOrColor) {
  if (!styleIdOrColor) return CANVAS_STYLES[0];
  const found = CANVAS_STYLES.find(s => s.id === styleIdOrColor || s.accentColor === styleIdOrColor);
  return found || CANVAS_STYLES[0];
}
