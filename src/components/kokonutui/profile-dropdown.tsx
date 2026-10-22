"use client";

/**
 * @author: @dorianbaffier
 * @description: Account Menu adapted for Foundarly
 * @version: 2.0.0
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Settings,
  Sun,
  User,
  Calendar,
  Briefcase,
  ShieldCheck,
  Clock,
  Sparkles,
  Users,
} from "lucide-react";
import {
  animate,
  motion,
  type Transition,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import {
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface Account {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  initials?: string;
  plan?: string;
}

export type AccountStatus = "online" | "away" | "busy";
export type AccountTheme = "light" | "dark" | "system";

export interface ProfileMenuItem {
  label: string;
  icon?: ReactNode;
  value?: string;
  href?: string;
  external?: boolean;
  onSelect?: () => void;
}

interface ProfileDropdownProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  holdDuration?: number;
  className?: string;
}

const STATUSES: {
  id: AccountStatus;
  label: string;
  name: string;
  dot: string;
}[] = [
  { id: "online", label: "Online", name: "Online", dot: "bg-emerald-500" },
  { id: "away", label: "Away", name: "Away", dot: "bg-amber-400" },
  { id: "busy", label: "DND", name: "Do not disturb", dot: "bg-red-500" },
];

const THEMES = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
] as const;

const AVATAR_TONES = [
  "bg-primary/20 text-primary border border-primary/30",
  "bg-amber-500/20 text-amber-500 border border-amber-500/30",
  "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30",
];

const WHITESPACE = /\s+/;
const PANEL_W = 296;
const RADIUS = 18;
const SPRING: Transition = { type: "spring", duration: 0.3, bounce: 0 };
const INDICATOR_SPRING: Transition = {
  type: "spring",
  duration: 0.25,
  bounce: 0,
};
const INSTANT: Transition = { duration: 0 };
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const NAV_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);

const ITEM_CLASS =
  "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-xs font-medium text-foreground outline-none transition-colors duration-150 hover:bg-secondary focus:bg-secondary focus:text-primary";

type Phase = "closed" | "open" | "closing";
type Page = "main" | "accounts";
type Via = "pointer" | "keyboard";

function initialsOf(account: Account) {
  if (account.initials) {
    return account.initials;
  }
  return account.name
    .split(WHITESPACE)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function viaOf(event: MouseEvent): Via {
  return event.detail === 0 ? "keyboard" : "pointer";
}

function menuItems(root: HTMLElement | null) {
  if (!root) {
    return [];
  }
  return Array.from(root.querySelectorAll<HTMLElement>("[data-menu-item]"));
}

function sideTarget(items: HTMLElement[], current: HTMLElement, step: number) {
  const row = items.filter((item) => item.dataset.row === current.dataset.row);
  if (row.length < 2) {
    return;
  }
  const index = row.indexOf(current);
  return row[(index + step + row.length) % row.length];
}

function rowTarget(items: HTMLElement[], current: HTMLElement, step: number) {
  const rows = [...new Set(items.map((item) => item.dataset.row))];
  const index = rows.indexOf(current.dataset.row);
  const next = rows[(index + step + rows.length) % rows.length];
  const candidates = items.filter((item) => item.dataset.row === next);
  return (
    candidates.find((item) => item.getAttribute("aria-checked") === "true") ??
    candidates[0]
  );
}

function nextTarget(
  items: HTMLElement[],
  active: Element | null,
  key: string
): HTMLElement | undefined {
  if (key === "Home") {
    return items[0];
  }
  if (key === "End") {
    return items.at(-1);
  }
  const current = items.find((item) => item === active);
  if (!current) {
    return key === "ArrowUp" ? items.at(-1) : items[0];
  }
  if (key === "ArrowLeft" || key === "ArrowRight") {
    return sideTarget(items, current, key === "ArrowRight" ? 1 : -1);
  }
  return rowTarget(items, current, key === "ArrowDown" ? 1 : -1);
}

function Avatar({
  account,
  tone,
  className,
}: {
  account: Account;
  tone: number;
  status?: AccountStatus;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid shrink-0 select-none place-items-center rounded-full font-semibold text-[11px] tracking-wide overflow-hidden shadow-xs",
        AVATAR_TONES[tone % AVATAR_TONES.length],
        className
      )}
    >
      {account.avatarUrl ? (
        <img
          src={account.avatarUrl}
          alt={account.name}
          className="h-full w-full object-cover"
        />
      ) : (
        initialsOf(account)
      )}
    </span>
  );
}

function Identity({
  uid,
  shared,
  account,
  tone,
  transition,
  stacked,
}: {
  uid: string;
  shared: boolean;
  account: Account;
  tone: number;
  transition: Transition;
  stacked: boolean;
}) {
  const hidden = shared ? undefined : "invisible";
  return (
    <span
      className={cn(
        "flex min-w-0",
        stacked ? "flex-col items-start gap-2.5" : "items-center gap-1.5 xl:gap-2"
      )}
    >
      <motion.span
        className={cn("relative z-20 block shrink-0", hidden)}
        key={shared ? "avatar-shared" : "avatar-static"}
        layoutId={shared ? `${uid}-avatar` : undefined}
        transition={transition}
      >
        <Avatar
          account={account}
          className={stacked ? "size-9" : "size-7 xl:size-8"}
          tone={tone}
        />
      </motion.span>
      <span className="flex min-w-0 flex-col text-left">
        <motion.span
          className={cn(
            "relative z-20 block truncate font-semibold text-xs xl:text-sm text-foreground leading-tight",
            hidden
          )}
          key={shared ? "name-shared" : "name-static"}
          layoutId={shared ? `${uid}-name` : undefined}
          transition={transition}
        >
          {account.name}
        </motion.span>
        {stacked ? (
          <motion.span
            className={cn(
              "relative z-20 block truncate text-[11px] text-muted-foreground leading-3 mt-0.5",
              hidden
            )}
            key={shared ? "email-shared" : "email-static"}
            layoutId={shared ? `${uid}-email` : undefined}
            transition={transition}
          >
            {account.email}
          </motion.span>
        ) : (
          <motion.span
            className={cn(
              "relative z-20 hidden 2xl:block truncate text-[10px] xl:text-[11px] text-muted-foreground leading-tight",
              hidden
            )}
            key={shared ? "email-shared" : "email-static"}
            layoutId={shared ? `${uid}-email` : undefined}
            transition={transition}
          >
            {account.email}
          </motion.span>
        )}
      </span>
    </span>
  );
}

function Separator() {
  return <hr className="mx-2 my-1.5 h-px border-0 bg-border/60" />;
}

function HoldSignOut({
  duration,
  onComplete,
}: {
  duration: number;
  onComplete: (via: Via) => void;
}) {
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const [nudge, setNudge] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const nudgeTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(nudgeTimer.current);
    },
    []
  );

  const start = (via: Via) => {
    if (timer.current !== undefined || done) {
      return;
    }
    window.clearTimeout(nudgeTimer.current);
    setNudge(false);
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setHolding(false);
      setDone(true);
      onComplete(via);
    }, duration);
  };

  const cancel = () => {
    if (timer.current === undefined) {
      return;
    }
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setHolding(false);
    setNudge(true);
    nudgeTimer.current = window.setTimeout(() => setNudge(false), 1400);
  };

  const label = (
    <>
      <LogOut className="size-3.5 text-destructive" />
      <span className="flex-1 text-destructive font-medium">Sign out</span>
      <span className="text-[10px] text-muted-foreground font-mono">
        {nudge ? "Keep holding" : "Hold"}
      </span>
    </>
  );

  return (
    <button
      className={cn(ITEM_CLASS, "relative touch-none select-none overflow-hidden")}
      data-menu-item=""
      data-row="sign-out"
      onBlur={cancel}
      onClick={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!event.repeat) {
            start("keyboard");
          }
        }
      }}
      onKeyUp={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          cancel();
        }
      }}
      onPointerCancel={cancel}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        start("pointer");
      }}
      onPointerUp={cancel}
      role="menuitem"
      tabIndex={-1}
      type="button"
    >
      {label}
      <span className="sr-only">, press and hold to confirm</span>
      {/* The fill: an inverted copy of the row, revealed left to right */}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center gap-2.5 rounded-[12px] bg-destructive text-white px-2.5"
        style={{
          clipPath:
            holding || done
              ? "inset(0 0 0 0 round 12px)"
              : "inset(0 100% 0 0 round 12px)",
          transition: holding
            ? `clip-path ${duration}ms linear`
            : "clip-path 240ms cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <LogOut className="size-3.5 text-white" />
        <span className="flex-1 font-semibold text-white">Signing out...</span>
      </span>
    </button>
  );
}


function ThemeRow({
  uid,
  theme,
  onChange,
  reduced,
}: {
  uid: string;
  theme: AccountTheme;
  onChange: (theme: AccountTheme) => void;
  reduced: boolean;
}) {
  return (
    <fieldset
      aria-label="Theme"
      className="m-0 flex min-w-0 items-center justify-between border-0 py-1 pr-1 pl-2.5"
    >
      <span className="text-[11px] text-muted-foreground font-medium">Theme</span>
      <span className="flex rounded-lg bg-secondary/80 p-0.5 border border-border/40">
        {THEMES.map(({ id, label, Icon }) => {
          const checked = id === theme;
          return (
            <button
              aria-checked={checked}
              aria-label={label}
              className="relative grid h-6 w-8 place-items-center rounded-md text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground aria-checked:text-foreground"
              data-menu-item=""
              data-row="theme"
              key={id}
              onClick={() => onChange(id)}
              role="menuitemradio"
              tabIndex={-1}
              type="button"
            >
              {checked ? (
                <motion.span
                  className="absolute inset-0 rounded-md bg-background shadow-xs border border-border/60"
                  layoutId={`${uid}-theme`}
                  transition={reduced ? INSTANT : INDICATOR_SPRING}
                />
              ) : null}
              <Icon className="relative size-3" />
            </button>
          );
        })}
      </span>
    </fieldset>
  );
}

function LinkItem({
  item,
  index,
  onSelect,
}: {
  item: ProfileMenuItem;
  index: number;
  onSelect: (event: MouseEvent, run?: () => void) => void;
}) {
  const inner = (
    <>
      <span className="text-muted-foreground">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {item.value ? (
        <span className="text-[10px] font-mono text-muted-foreground">{item.value}</span>
      ) : null}
    </>
  );
  const common = {
    className: ITEM_CLASS,
    "data-menu-item": "",
    "data-row": `item-${index}`,
    onClick: (event: MouseEvent) => onSelect(event, item.onSelect),
    role: "menuitem",
    tabIndex: -1,
  } as const;
  if (item.href) {
    return (
      <a
        {...common}
        href={item.href}
        {...(item.external && { rel: "noopener noreferrer", target: "_blank" })}
      >
        {inner}
      </a>
    );
  }
  return (
    <button {...common} type="button">
      {inner}
    </button>
  );
}

export default function ProfileDropdown({
  holdDuration = 1200,
  className,
  ...props
}: ProfileDropdownProps) {
  const uid = useId();
  const navigate = useNavigate();
  const reduced = useReducedMotion() === true;
  const { user, profile, isAdmin, isSuperAdmin, isDeveloperAdmin, isConsultant, isClient, signOut } = useAuth();
  const { theme: appTheme, setTheme: setAppTheme } = useTheme();

  const [phase, setPhase] = useState<Phase>("closed");
  const [instant, setInstant] = useState(false);
  const [openSeq, setOpenSeq] = useState(0);

  const handleThemeChange = (newTheme: AccountTheme) => {
    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setAppTheme(prefersDark ? "dark" : "light");
    } else {
      setAppTheme(newTheme);
    }
  };

  const currentThemeId: AccountTheme = appTheme === "dark" ? "dark" : "light";

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>("closed");
  phaseRef.current = phase;
  const openIntent = useRef<{
    focus: "first" | "last" | "menu";
    resume: boolean;
  }>({ focus: "menu", resume: false });
  const closeSeq = useRef(0);
  const targetH = useRef(0);

  const w = useMotionValue(0);
  const h = useMotionValue(0);
  const bodyOpacity = useMotionValue(1);
  const outerClip = useMotionTemplate`inset(0px 0px calc(100% - ${h}px) calc(100% - ${w}px) round ${RADIUS}px)`;
  const innerClip = useMotionTemplate`inset(1px 1px calc(100% - ${h}px + 1px) calc(100% - ${w}px + 1px) round ${RADIUS - 1}px)`;

  // Role resolution
  const planLabel = isSuperAdmin
    ? "Super Admin"
    : isDeveloperAdmin
    ? "Dev Admin"
    : isAdmin
    ? "Admin"
    : isConsultant
    ? "Consultant"
    : "Client";

  const account: Account = {
    id: user?.id || "guest",
    name: profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Foundarly Member",
    email: user?.email || "",
    avatarUrl: profile?.avatar_url || (user?.user_metadata?.avatar_url as string | null),
    plan: planLabel,
  };

  const tone = isConsultant ? 1 : isAdmin ? 2 : 0;
  const sharedTransition = instant ? INSTANT : SPRING;
  const sharedInPanel = phase === "open";
  const menuId = `${uid}-menu`;

  // Dynamic menu items according to website role
  const menuItemsList: ProfileMenuItem[] = [];

  if (isClient) {
    menuItemsList.push(
      {
        label: "My Bookings",
        icon: <Calendar className="size-3.5 text-primary" />,
        onSelect: () => navigate("/my-bookings"),
      },
      {
        label: "Become a Consultant",
        icon: <Briefcase className="size-3.5 text-amber-500" />,
        onSelect: () => navigate("/apply-consultant"),
      },
      {
        label: "Our Network",
        icon: <Users className="size-3.5 text-blue-500" />,
        onSelect: () => navigate("/network"),
      }
    );
  }

  if (isConsultant) {
    menuItemsList.push(
      {
        label: "Consultant Dashboard",
        icon: <Briefcase className="size-3.5 text-primary" />,
        onSelect: () => navigate("/consultant/dashboard"),
      },
      {
        label: "My Availability",
        icon: <Clock className="size-3.5 text-emerald-500" />,
        value: "Live",
        onSelect: () => navigate("/consultant/dashboard?tab=availability"),
      },
      {
        label: "Payout Requests",
        icon: <CreditCard className="size-3.5 text-amber-500" />,
        onSelect: () => navigate("/consultant/dashboard?tab=payouts"),
      },
      {
        label: "Our Network",
        icon: <Users className="size-3.5 text-blue-500" />,
        onSelect: () => navigate("/network"),
      }
    );
  }

  if (isAdmin || isSuperAdmin || isDeveloperAdmin) {
    menuItemsList.push(
      {
        label: "Admin Dashboard",
        icon: <ShieldCheck className="size-3.5 text-primary" />,
        onSelect: () => navigate("/admin"),
      },
      {
        label: "Consultant Applications",
        icon: <Briefcase className="size-3.5 text-amber-500" />,
        onSelect: () => navigate("/admin/consultants/applications"),
      },
      {
        label: "UPI Payment Approvals",
        icon: <CreditCard className="size-3.5 text-emerald-500" />,
        onSelect: () => navigate("/admin/upi-verification"),
      },
      {
        label: "Platform Settings",
        icon: <Settings className="size-3.5 text-muted-foreground" />,
        onSelect: () => navigate("/admin/settings"),
      }
    );
  }

  const openMenu = (via: Via, focus: "first" | "last" | "menu") => {
    if (phaseRef.current === "open") {
      return;
    }
    openIntent.current = { focus, resume: phaseRef.current === "closing" };
    closeSeq.current += 1;
    setInstant(via === "keyboard" || reduced);
    setPhase("open");
    setOpenSeq((seq) => seq + 1);
  };

  const closeMenu = (via: Via, returnFocus: boolean) => {
    if (phaseRef.current !== "open") {
      return;
    }
    const trigger = triggerRef.current;
    if (returnFocus) {
      trigger?.focus({ preventScroll: true });
    }
    if (via === "keyboard" || reduced || !trigger) {
      setInstant(true);
      setPhase("closed");
      return;
    }
    setInstant(false);
    setPhase("closing");
    const seq = ++closeSeq.current;
    animate(bodyOpacity, 0, { duration: 0.12, ease: EASE_OUT });
    animate(w, trigger.offsetWidth, SPRING);
    animate(h, trigger.offsetHeight, SPRING).then(() => {
      if (closeSeq.current === seq) {
        setPhase("closed");
      }
    });
  };

  const select = (event: MouseEvent, run?: () => void) => {
    run?.();
    closeMenu(viaOf(event), true);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      navigate("/");
    } catch (e: any) {
      toast.error(e?.message || "Failed to sign out");
    }
  };

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const main = mainRef.current;
    if (openSeq === 0 || phaseRef.current !== "open" || !trigger || !main) {
      return;
    }
    const availableW = typeof window !== "undefined" ? Math.min(PANEL_W, window.innerWidth - 24) : PANEL_W;
    targetH.current = main.offsetHeight;
    if (instant) {
      w.jump(availableW);
      h.jump(targetH.current);
      bodyOpacity.jump(1);
    } else {
      if (!openIntent.current.resume) {
        w.jump(trigger.offsetWidth);
        h.jump(trigger.offsetHeight);
        bodyOpacity.jump(0);
      }
      animate(w, availableW, SPRING);
      animate(h, targetH.current, SPRING);
      animate(bodyOpacity, 1, { duration: 0.2, delay: 0.05, ease: EASE_OUT });
    }
    const list = menuItems(main);
    const targets = {
      first: list[0],
      last: list.at(-1),
      menu: main.querySelector<HTMLElement>("[role=menu]"),
    };
    targets[openIntent.current.focus]?.focus({ preventScroll: true });
  }, [openSeq]);

  useEffect(() => {
    if (phase !== "open") {
      return;
    }
    const onDown = (event: globalThis.PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        closeMenu("pointer", false);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [phase]);

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      closeMenu("keyboard", true);
      return;
    }
    if (!NAV_KEYS.has(event.key)) {
      return;
    }
    event.preventDefault();
    const active = document.activeElement;
    const target = nextTarget(menuItems(mainRef.current), active, event.key);
    if (target) {
      target.focus({ preventScroll: true });
    }
  };

  const onPanelPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") {
      return;
    }
    const item = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-menu-item]"
    );
    if (item && document.activeElement !== item) {
      item.focus({ preventScroll: true });
    }
  };

  return (
    <div
      className={cn(
        "relative isolate inline-block",
        phase !== "closed" && "z-50",
        className
      )}
      ref={wrapperRef}
      {...props}
    >
      <button
        aria-controls={sharedInPanel ? menuId : undefined}
        aria-expanded={sharedInPanel}
        aria-haspopup="menu"
        className="flex w-auto max-w-[130px] sm:max-w-[150px] lg:max-w-[160px] xl:max-w-[185px] 2xl:max-w-[220px] items-center gap-1.5 xl:gap-2 rounded-full border border-border/60 bg-secondary/40 p-1 xl:p-1.5 pr-2 xl:pr-2.5 text-left outline-none transition-all duration-150 hover:border-primary/40 hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-primary/40 min-w-0 shrink-0"
        onClick={(event) => {
          const via = viaOf(event);
          openMenu(via, via === "keyboard" ? "first" : "menu");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu("keyboard", event.key === "ArrowDown" ? "first" : "last");
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span className="min-w-0 flex-1">
          <Identity
            account={account}
            shared={!sharedInPanel}
            stacked={false}
            tone={tone}
            transition={sharedTransition}
            uid={uid}
          />
        </span>
        <ChevronsUpDown
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-opacity duration-150",
            phase !== "closed" && "opacity-0"
          )}
        />
      </button>

      {phase === "closed" ? null : (
        <div
          className="pointer-events-none absolute top-0 right-0 z-50 max-w-[calc(100vw-1.5rem)]"
          style={{ width: PANEL_W }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 [filter:drop-shadow(0_12px_24px_rgba(0,0,0,0.12))] dark:[filter:drop-shadow(0_12px_28px_rgba(0,0,0,0.6))]"
          >
            <motion.div
              className="absolute inset-0 bg-border/80 backdrop-blur-xl"
              style={{ clipPath: outerClip }}
            />
            <motion.div
              className="absolute inset-0 bg-card/95 backdrop-blur-2xl"
              style={{ clipPath: innerClip }}
            />
          </div>
          <motion.div
            className={cn("relative", sharedInPanel && "pointer-events-auto")}
            onKeyDown={onPanelKeyDown}
            onPointerMove={onPanelPointerMove}
            style={{ clipPath: innerClip }}
          >
            <div
              className="shrink-0 p-2 max-w-full"
              ref={mainRef}
              style={{ width: PANEL_W, maxWidth: "calc(100vw - 1.5rem)" }}
            >
              <div className="flex items-start justify-between px-2 pt-2 pb-2.5">
                <Identity
                  account={account}
                  shared={sharedInPanel}
                  stacked
                  tone={tone}
                  transition={sharedTransition}
                  uid={uid}
                />
                {account.plan ? (
                  <motion.span
                    className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30"
                    style={{ opacity: bodyOpacity }}
                  >
                    {account.plan}
                  </motion.span>
                ) : null}
              </div>

              <motion.div
                aria-label={account.name}
                className="outline-none"
                id={menuId}
                role="menu"
                style={{ opacity: bodyOpacity }}
                tabIndex={-1}
              >
                <ThemeRow
                  onChange={handleThemeChange}
                  reduced={reduced}
                  theme={currentThemeId}
                  uid={uid}
                />
                <Separator />
                {menuItemsList.map((item, index) => (
                  <LinkItem
                    index={index}
                    item={item}
                    key={item.label}
                    onSelect={select}
                  />
                ))}
                <Separator />
                <HoldSignOut
                  duration={holdDuration}
                  onComplete={(via) => {
                    handleSignOut();
                    closeMenu(via, true);
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
