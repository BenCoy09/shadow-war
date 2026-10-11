import type { ComponentType, SVGProps } from "react";
import type { ActionKind } from "../lib/rps";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "size"> {
  size?: number;
}

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Crossed swords. */
export const IconAttack = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4l10 10M12 16l4-4M14 14l5 5" />
    <path d="M20 4L10 14M8 12l4 4M10 14l-5 5" />
  </Svg>
);

export const IconDefend = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l7 3v5.5c0 4.6-3 7.7-7 9.5-4-1.8-7-4.9-7-9.5V6z" />
  </Svg>
);

/** A crenellated wall with a gate. */
export const IconFortify = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 21V7h3v2h2V7h4v2h2V7h3v14z" />
    <path d="M10 21v-4a2 2 0 0 1 4 0v4" />
  </Svg>
);

export const IconFlag = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="M6 21V4" />
    <path
      d="M6 5h12l-2.5 4L18 13H6"
      fill={filled ? "currentColor" : "none"}
    />
  </Svg>
);

/** A wax seal: the mark of a locked-in order. */
export const IconSeal = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" />
  </Svg>
);

export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const ACTION_ICON: Record<ActionKind, ComponentType<IconProps>> = {
  attack: IconAttack,
  defend: IconDefend,
  fortify: IconFortify,
};
