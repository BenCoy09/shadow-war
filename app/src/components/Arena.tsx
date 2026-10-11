import type { ActionKind, ChoiceName } from "../lib/rps";
import { NEUTRAL } from "../lib/rps";
import type { Phase, ResultView, Role } from "../hooks/useGameMachine";
import { TERRITORY_NAMES } from "./ChoicePicker";
import {
  ACTION_ICON,
  IconAttack,
  IconDefend,
  IconFlag,
  IconFortify,
} from "./Icons";

interface Props {
  phase: Phase;
  role: Role;
  myChoice: ChoiceName | null;
  result: ResultView | null;
  opponentJoined: boolean;
  opponentLocked: boolean;
  board: { owner: number[]; shield: number[] };
  myIndex: number;
  selectedTarget: number | null;
  onSelect: (t: number) => void;
}

function Mark({
  kind,
  label,
  them,
  sealed,
}: {
  kind: ActionKind;
  label: string;
  them?: boolean;
  sealed?: boolean;
}) {
  const Icon = ACTION_ICON[kind];
  return (
    <span
      className={`sw-mark ${them ? "sw-mark-them" : ""} ${sealed ? "sw-mark-sealed" : ""}`}
      title={sealed ? "Sealed until both orders are in" : undefined}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}

export default function Arena({
  phase,
  role,
  myChoice,
  result,
  opponentJoined,
  opponentLocked,
  board,
  myIndex,
  selectedTarget,
  onSelect,
}: Props) {
  const opponentName = role === "solo" ? "Robot" : "Challenger";
  const revealing = phase === "revealing";
  const done = phase === "done" || phase === "round-over";
  const showMoves = (revealing || done) && !!result;
  const canSelect = phase === "pick";
  const theirIndex = myIndex === 0 ? 1 : 0;
  const mine = board.owner.filter((o) => o === myIndex).length;
  const theirs = board.owner.filter((o) => o === theirIndex).length;

  const myMove: ChoiceName | null = showMoves && result ? result.me : myChoice;
  const theirMove: ChoiceName | null = showMoves && result ? result.them : null;

  let status = "";
  if (phase === "setting-up") status = "Setting up the board";
  else if (revealing) status = "Orders opened";
  else if (phase === "round-over") status = "Round resolved";
  else if (phase === "done")
    status =
      result?.outcome === "win"
        ? "You win"
        : result?.outcome === "lose"
          ? "You lose"
          : "Tie. Shared victory";
  else if (role === "solo")
    status = opponentLocked ? "Robot has sealed its order" : "Robot is deciding";
  else
    status = opponentJoined
      ? "Both sides are sealing orders"
      : "Waiting for a challenger";

  return (
    <div className="sw-board">
      <div className="sw-scoreboard">
        <div className="sw-side">
          <span className="sw-side-name">You</span>
          <span className="sw-side-count">{mine}</span>
          <span className="sw-side-unit">territories</span>
        </div>
        <div className="sw-center" aria-live="polite">
          {status}
        </div>
        <div className="sw-side">
          <span className="sw-side-name">{opponentName}</span>
          <span className="sw-side-count">{theirs}</span>
          <span className="sw-side-unit">territories</span>
        </div>
      </div>

      <div className="sw-grid">
        {board.owner.map((o, t) => {
          const side =
            o === NEUTRAL ? "neutral" : o === myIndex ? "mine" : "theirs";
          const shielded = board.shield[t] > 0;
          const isSel = canSelect && selectedTarget === t;
          const mm = myMove && myMove.target === t ? myMove : null;
          const tm = theirMove && theirMove.target === t ? theirMove : null;
          const owner =
            side === "mine" ? "yours" : side === "theirs" ? "enemy" : "unclaimed";
          return (
            <button
              key={t}
              type="button"
              className={`sw-tile sw-${side} ${isSel ? "sw-selected" : ""}`}
              disabled={!canSelect}
              onClick={() => onSelect(t)}
              aria-label={`${TERRITORY_NAMES[t]}, ${owner}${shielded ? ", protected" : ""}`}
            >
              <span className="sw-top">
                <span className="sw-num">{t + 1}</span>
                <span className="sw-badges">
                  {side !== "neutral" && (
                    <IconFlag size={14} filled={side === "mine"} />
                  )}
                  {shielded && <IconDefend size={14} />}
                </span>
              </span>
              <span className="sw-moves">
                {mm && (
                  <Mark kind={mm.kind} label="You" sealed={!showMoves} />
                )}
                {tm && (
                  <Mark
                    kind={tm.kind}
                    label={role === "solo" ? "Robot" : "Opp"}
                    them
                  />
                )}
              </span>
              <span className="sw-name">{TERRITORY_NAMES[t]}</span>
            </button>
          );
        })}
      </div>

      <ul className="sw-legend">
        <li>
          <IconAttack size={16} /> Attack: capture it
        </li>
        <li>
          <IconDefend size={16} /> Defend: holds this round
        </li>
        <li>
          <IconFortify size={16} /> Fortify: holds for two rounds
        </li>
      </ul>
    </div>
  );
}
