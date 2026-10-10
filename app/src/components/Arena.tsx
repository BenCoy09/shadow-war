import type { ChoiceName } from "../lib/rps";
import { NEUTRAL } from "../lib/rps";
import type { Phase, ResultView, Role } from "../hooks/useGameMachine";
import { ACTION_EMOJI, TERRITORY_NAMES } from "./ChoicePicker";

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
  const opponentName = role === "solo" ? "Robot 🤖" : "Challenger";
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
  if (phase === "setting-up") status = "Setting up…";
  else if (revealing) status = "Moves revealed! 💥";
  else if (phase === "round-over") status = "Round resolved";
  else if (phase === "done")
    status =
      result?.outcome === "win"
        ? "YOU WIN! 🏆"
        : result?.outcome === "lose"
          ? "You lose 😵"
          : "Tie — shared victory 🤝";
  else if (role === "solo")
    status = opponentLocked ? "Robot locked in 🔒" : "Robot is thinking…";
  else status = opponentJoined ? "All moves are secret 🤫" : "Waiting for a challenger…";

  return (
    <div className="sw-board">
      <div className="sw-scoreboard">
        <div className="sw-side">
          <strong>You</strong>
          <span>{mine} 🏴</span>
        </div>
        <div className="sw-center">{status}</div>
        <div className="sw-side">
          <strong>{opponentName}</strong>
          <span>{theirs} 🏴</span>
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
          return (
            <button
              key={t}
              type="button"
              className={`sw-tile sw-${side} ${isSel ? "sw-selected" : ""}`}
              disabled={!canSelect}
              onClick={() => onSelect(t)}
            >
              <span className="sw-num">{t + 1}</span>
              <span className="sw-name">{TERRITORY_NAMES[t]}</span>
              {shielded && (
                <span className="sw-shield" title="Protected next round">
                  🛡️
                </span>
              )}
              <span className="sw-moves">
                {mm && (
                  <span className="sw-mark">
                    {ACTION_EMOJI[mm.kind]} You{showMoves ? "" : " 🔒"}
                  </span>
                )}
                {tm && (
                  <span className="sw-mark sw-mark-them">
                    {ACTION_EMOJI[tm.kind]} {role === "solo" ? "Robot" : "Opp"}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="sw-legend">
        ⚔️ Attack: capture · 🛡️ Defend: blocks this round · 🏰 Fortify: blocks 2
        rounds
      </p>
    </div>
  );
}
