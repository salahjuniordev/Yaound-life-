import type { LucideIcon } from 'lucide-react';
import {
  AlarmClock,
  Banknote,
  BarChart3,
  Bike,
  BookOpen,
  BookText,
  Briefcase,
  Calendar,
  Camera,
  Car,
  CarTaxiFront,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  Cloud,
  CloudDownload,
  CloudRain,
  CloudSun,
  Droplet,
  Footprints,
  Gift,
  Hand,
  HandCoins,
  HandHeart,
  Handshake,
  Heart,
  HeartHandshake,
  Home,
  Landmark,
  Lock,
  Map,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquareQuote,
  Moon,
  Newspaper,
  PartyPopper,
  Play,
  Send,
  Settings,
  ShoppingBasket,
  Smartphone,
  Smile,
  Square,
  SquareCheckBig,
  Star,
  Store,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Truck,
  UserPlus,
  UserRound,
  Users,
  Utensils,
  Wallet,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';

export const ICONS = {
  journal: BookOpen,
  messages: MessageCircle,
  wallet: Wallet,
  jobs: Briefcase,
  business: Store,
  njangi: Handshake,
  news: Newspaper,
  social: Megaphone,
  contacts: Users,
  glossary: BookText,
  stats: BarChart3,
  settings: Settings,

  play: Play,
  newLife: UserPlus,
  account: UserRound,
  cloudDownload: CloudDownload,
  cloud: Cloud,
  offline: WifiOff,

  cash: Banknote,
  momo: Smartphone,
  bank: Landmark,
  debt: TrendingDown,

  rain: CloudRain,
  cloudSun: CloudSun,
  sun: Sun,
  moon: Moon,
  holiday: PartyPopper,
  taxi: CarTaxiFront,
  moto: Bike,
  car: Car,
  garage: Car,
  power: Zap,
  event: Zap,

  act: Hand,
  interact: Hand,
  hint: Target,
  travel: Map,
  route: Map,
  map: Map,
  home: Home,
  city: Landmark,
  phone: Smartphone,
  send: Send,
  back: ChevronLeft,
  close: X,
  more: ChevronDown,

  location: MapPin,
  camera: Camera,
  contactNote: MessageSquareQuote,

  trust: Handshake,
  affection: Heart,
  respect: Star,
  greet: Hand,
  chat: MessageCircle,
  help: HeartHandshake,
  gift: Gift,
  invite: Calendar,
  apologize: HandHeart,
  restaurant: Utensils,
  walk: Footprints,
  contribution: HandCoins,

  check: Check,
  done: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  clock: Clock,
  alarm: AlarmClock,
  stepDone: SquareCheckBig,
  stepTodo: Square,
  milestone: Star,
  trophy: Trophy,
  hidden: CircleHelp,
  locked: Lock,
  skillUp: TrendingUp,

  market: ShoppingBasket,
  delivery: Truck,
  marketing: Megaphone,
  premises: Store,

  needEnergy: Zap,
  needFood: Utensils,
  needHygiene: Droplet,
  needHealth: Heart,
  needMood: Smile,
  needSocial: Users,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  const Cmp = ICONS[name];
  return (
    <Cmp
      size={size}
      strokeWidth={2}
      className={className ? `icon ${className}` : 'icon'}
      aria-hidden="true"
      focusable="false"
    />
  );
}

export function SoccerBallIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `icon ${className}` : 'icon'}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9.25" />
      <path d="M12 7.6l3.4 2.5-1.3 4h-4.2l-1.3-4z" />
      <path d="M12 7.6V2.9M15.4 10.1l4.4-1.4M14.1 14.1l2.7 3.8M9.9 14.1l-2.7 3.8M8.6 10.1L4.2 8.7" />
    </svg>
  );
}

export function MboaMark({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="44" cy="17" r="6" />
      <path d="M6 52h52" />
      <path d="M9 52V38h9v14" />
      <path d="M20 52V27h13v25" />
      <path d="M35 52V39h8v13" />
      <path d="M45 52V31h9v21" />
      <path d="M23 33h2.5M27.5 33H30M23 38h2.5M27.5 38H30M23 43h2.5M27.5 43H30" />
      <path d="M47 37h1.5M50.5 37H52M47 42h1.5M50.5 42H52" />
    </svg>
  );
}
