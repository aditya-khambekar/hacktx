import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ChevronDown = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
export const ArrowRight = (p: IconProps) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const ArrowUp = (p: IconProps) => <Icon {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Icon>;
export const Plus = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const Close = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const Menu = (p: IconProps) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;
export const Check = (p: IconProps) => <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>;
export const Sliders = (p: IconProps) => (
  <Icon {...p}><path d="M4 8h10M18 8h2M4 16h2M10 16h10" /><circle cx="16" cy="8" r="2" /><circle cx="8" cy="16" r="2" /></Icon>
);
export const Columns = (p: IconProps) => <Icon {...p}><rect x="3.5" y="5" width="17" height="14" rx="1.5" /><path d="M9.2 5v14M14.8 5v14" /></Icon>;
export const MapIcon = (p: IconProps) => <Icon {...p}><path d="m3.5 6.5 5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" /><path d="M9 4.5v13M15 6.5v13" /></Icon>;
export const Heart = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} fill={filled ? "currentColor" : "none"}><path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z" /></Icon>
);
export const Pin = (p: IconProps) => <Icon {...p}><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></Icon>;
export const Bed = (p: IconProps) => <Icon {...p}><path d="M3.5 18V6.5M3.5 14h17v4M20.5 14v-2.5a2.5 2.5 0 0 0-2.5-2.5h-7v5" /><circle cx="7" cy="11" r="1.6" /></Icon>;
export const Sparkle = (p: IconProps) => <Icon {...p}><path d="M12 3.5 13.8 10 20.5 12l-6.7 2-1.8 6.5-1.8-6.5L3.5 12l6.7-2z" /></Icon>;
export const Lease = (p: IconProps) => <Icon {...p}><rect x="5" y="3.5" width="14" height="17" rx="1.5" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></Icon>;
export const Info = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></Icon>;
export const Share = (p: IconProps) => <Icon {...p}><circle cx="17.5" cy="5.5" r="2.3" /><circle cx="6.5" cy="12" r="2.3" /><circle cx="17.5" cy="18.5" r="2.3" /><path d="m8.5 11 7-4.2M8.5 13l7 4.2" /></Icon>;
export const Clock = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>;
export const Walk = (p: IconProps) => <Icon {...p}><circle cx="13" cy="4.5" r="1.7" /><path d="m9.5 21 2.2-6.5L14 17v4M11.7 14.5l.8-5.5-3.5 1.8V14M12.5 9l2.3 2.8H18" /></Icon>;
export const Bike = (p: IconProps) => <Icon {...p}><circle cx="6" cy="16.5" r="3.5" /><circle cx="18" cy="16.5" r="3.5" /><path d="M6 16.5 9.5 9h6l2.5 7.5M9.5 9 12 16.5h-6M14 6h2.5" /></Icon>;
export const Star = (p: IconProps) => <Icon {...p} fill="currentColor" stroke="none"><path d="m12 3.6 2.5 5.4 5.9.6-4.4 4 1.3 5.8L12 16.4l-5.3 3 1.3-5.8-4.4-4 5.9-.6z" /></Icon>;
export const Tag = (p: IconProps) => <Icon {...p}><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z" /><circle cx="8" cy="8" r="1.3" /></Icon>;
export const Trash = (p: IconProps) => <Icon {...p}><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></Icon>;
export const Grid = (p: IconProps) => <Icon {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></Icon>;
export const Cloud = (p: IconProps) => <Icon {...p}><path d="M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.5a4.5 4.5 0 0 0 0 9z" /></Icon>;
export const PencilSquare = (p: IconProps) => <Icon {...p}><path d="M11 4.5H5.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V13" /><path d="m17.5 3.5 3 3L12 15l-3.5.5.5-3.5z" /></Icon>;
export const Calendar = (p: IconProps) => <Icon {...p}><rect x="4" y="5.5" width="16" height="14.5" rx="1.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></Icon>;
export const Receipt = (p: IconProps) => <Icon {...p}><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" /><path d="M9 8.5h6M9 12h6M9 15.5h3" /></Icon>;
export const Board = (p: IconProps) => <Icon {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><path d="M3.5 9h17M9 9v10.5" /></Icon>;
export const ArrowUpRight = (p: IconProps) => <Icon {...p}><path d="M7 17 17 7M9 7h8v8" /></Icon>;
export const Pencil = (p: IconProps) => <Icon {...p}><path d="m15.5 5.5 3 3L8 19l-4 1 1-4z" /><path d="m13.5 7.5 3 3" /></Icon>;
