import {
  Accessibility, AirVent, Armchair, Baby, BedDouble, Briefcase, Cake, CakeSlice,
  Camera, Car, CarFront, CarTaxiFront, ChefHat, ClipboardList, Disc3, DoorOpen,
  Flame, Flower2, Gem, GraduationCap, Handshake, Heart, Lightbulb, Monitor,
  MicVocal, MoveVertical, Music, PartyPopper, Sailboat, ScrollText, Sparkles,
  Speaker, Star, Sun, Trees, Utensils, Video, Waves, Wifi, Wine, Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Veritabanındaki `icon` alanı bir lucide ikon adı tutuyor. Dinamik import
 * yerine açık bir eşleme kullanılıyor: bundle'a yalnızca gerçekten kullanılan
 * ikonlar giriyor ve olmayan bir ad sessizce boşluk bırakmıyor.
 */
const ICONS: Record<string, LucideIcon> = {
  accessibility: Accessibility, "air-vent": AirVent, armchair: Armchair, baby: Baby,
  "bed-double": BedDouble, briefcase: Briefcase, cake: Cake, "cake-slice": CakeSlice,
  camera: Camera, car: Car, "car-front": CarFront, "car-taxi-front": CarTaxiFront,
  "chef-hat": ChefHat, "clipboard-list": ClipboardList, "disc-3": Disc3,
  "door-open": DoorOpen, flame: Flame, "flower-2": Flower2, gem: Gem,
  "graduation-cap": GraduationCap, handshake: Handshake, heart: Heart,
  lightbulb: Lightbulb, monitor: Monitor, "mic-vocal": MicVocal,
  "move-vertical": MoveVertical, music: Music, "party-popper": PartyPopper,
  sailboat: Sailboat, "scroll-text": ScrollText, sparkles: Sparkles,
  speaker: Speaker, star: Star, sun: Sun, trees: Trees, utensils: Utensils,
  video: Video, waves: Waves, wifi: Wifi, wine: Wine, zap: Zap,
};

export function Icon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const Cmp = name ? ICONS[name] : undefined;
  if (!Cmp) return null;
  return <Cmp className={className} aria-hidden />;
}

export function hasIcon(name: string | null | undefined): boolean {
  return Boolean(name && ICONS[name]);
}
