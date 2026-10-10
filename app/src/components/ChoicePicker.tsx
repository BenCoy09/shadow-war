import type { ActionKind, ChoiceName } from "../lib/rps";

export const ACTION_EMOJI: Record<ActionKind, string> = {
  attack: "⚔️",
  defend: "🛡️",
  fortify: "🏰",
};

export const ACTION_LABEL: Record<ActionKind, string> = {
  attack: "Attack",
  defend: "Defend",
  fortify: "Fortify",
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
          ? "Locking in…"
          : !hasTarget
            ? "Tap a territory on the map, then choose your secret move 🤫"
            : `${TERRITORY_NAMES[target as number]} selected — choose your move`}
      </p>
      <div className="picker-row">
        {kinds.map((kind) => {
          // Attack enemy/neutral land; defend or fortify your own.
          const valid = hasTarget && (kind === "attack" ? !owned : owned);
          const isSelected =
            !!selected && selected.kind === kind && selected.target === target;
          return (
            <button
              key={kind}
              className={`choice-btn ${isSelected ? "selected" : ""}`}
              onClick={() => onPick({ kind, target: target as number })}
              disabled={disabled || !valid}
            >
              <span className="choice-emoji">{ACTION_EMOJI[kind]}</span>
              <span className="choice-label">{ACTION_LABEL[kind]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
