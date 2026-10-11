import type { ActionKind, ChoiceName } from "../lib/rps";
import { ACTION_ICON, IconSeal } from "./Icons";

export const ACTION_LABEL: Record<ActionKind, string> = {
  attack: "Attack",
  defend: "Defend",
  fortify: "Fortify",
};

export const ACTION_HELP: Record<ActionKind, string> = {
  attack: "Capture it",
  defend: "Hold this round",
  fortify: "Hold two rounds",
};

export const TERRITORY_NAMES = [
  "Northhold",
  "Ashfall",
  "Ironvale",
  "Sunreach",
  "Moonfen",
  "Stormwatch",
  "Embergate",
  "Frostpeak",
  "Goldmere",
  "Shadowmoor",
  "Duskwood",
  "Highcrown",
];

interface Props {
  onPick: (c: ChoiceName) => void;
  disabled?: boolean;
  selected?: ChoiceName | null;
  target: number | null;
  board: { owner: number[]; shield: number[] };
  myIndex: number;
}

export default function ChoicePicker({
  onPick,
  disabled,
  selected,
  target,
  board,
  myIndex,
}: Props) {
  const hasTarget = target !== null;
  const owned = hasTarget && board.owner[target as number] === myIndex;
  const kinds: ActionKind[] = ["attack", "defend", "fortify"];

  return (
    <div className="picker">
      <p className="picker-hint">
        {disabled
          ? "Sealing your order…"
          : !hasTarget
            ? "Pick a territory on the map, then seal your order."
            : `${TERRITORY_NAMES[target as number]}: choose an order`}
      </p>
      <div className="picker-row">
        {kinds.map((kind) => {
          // Attack enemy/neutral land; defend or fortify your own.
          const valid = hasTarget && (kind === "attack" ? !owned : owned);
          const isSelected =
            !!selected && selected.kind === kind && selected.target === target;
          const Icon = ACTION_ICON[kind];
          return (
            <button
              key={kind}
              className={`choice-btn ${isSelected ? "selected" : ""}`}
              onClick={() => onPick({ kind, target: target as number })}
              disabled={disabled || !valid}
              aria-pressed={isSelected}
            >
              {isSelected && (
                <span className="choice-seal">
                  <IconSeal size={22} />
                </span>
              )}
              <Icon size={28} />
              <span className="choice-label">{ACTION_LABEL[kind]}</span>
              <span className="choice-help">{ACTION_HELP[kind]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
