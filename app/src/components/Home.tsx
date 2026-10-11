import { useState } from "react";
import {
  DEFAULT_STAKE_SOL,
  STAKE_PRESETS_SOL,
  BEST_OF_PRESETS,
  DEFAULT_BEST_OF,
} from "../lib/config";
import { TERRITORY_NAMES, ACTION_LABEL } from "./ChoicePicker";
import { ACTION_ICON, IconAttack } from "./Icons";

interface Props {
  onStart: (kind: "solo" | "host", stakeSol: number, bestOf: number) => void;
}

// The opening position: three tiles each, six unclaimed.
const START_OWNERS = [0, 0, 0, 1, 1, 1, -1, -1, -1, -1, -1, -1];

function MiniMap() {
  return (
    <figure className="mm">
      <div className="mm-grid" role="img" aria-label="The opening board: you hold three territories, the enemy holds three, six are unclaimed.">
        {START_OWNERS.map((o, t) => (
          <div
            key={t}
            className={`mm-tile ${o === 0 ? "mm-mine" : o === 1 ? "mm-theirs" : "mm-open"}`}
          >
            <span className="mm-name">{TERRITORY_NAMES[t]}</span>
            {t === 6 && (
              <span className="mm-seal">
                <IconAttack size={18} />
              </span>
            )}
          </div>
        ))}
      </div>
      <figcaption className="mm-caption">
        Round one. Your order on Embergate is sealed. Theirs stays hidden until
        both are in.
      </figcaption>
    </figure>
  );
}

const ORDER_TEXT: Array<["attack" | "defend" | "fortify", string]> = [
  ["attack", "Take a territory. If both sides attack the same one, nobody gets it."],
  ["defend", "Hold one of your territories against attack this round."],
  ["fortify", "Hold one of yours for two rounds."],
];

export default function Home({ onStart }: Props) {
  const [picking, setPicking] = useState<"solo" | "host" | null>(null);
  const [stake, setStake] = useState(DEFAULT_STAKE_SOL);
  const [bestOf, setBestOf] = useState(DEFAULT_BEST_OF);

  return (
    <div className="page home-page">
      <main className="home">
        <section className="home-copy">
          <h1 className="title">Shadow War</h1>
          <p className="lead">
            Two commanders, twelve territories. Each round you seal one order in
            secret. Both orders open at the same moment, and whoever holds the
            most land at the end wins.
          </p>
        </section>

        <section className="home-actions" aria-label="Start a match">
          {!picking ? (
            <div className="mode-cards">
              <button
                className="mode-card mode-card-primary"
                onClick={() => setPicking("solo")}
              >
                <span className="mode-title">Play the robot</span>
                <span className="mode-desc">
                  Starts straight away. The robot seals an order of its own.
                </span>
              </button>
              <button className="mode-card" onClick={() => setPicking("host")}>
                <span className="mode-title">Challenge a friend</span>
                <span className="mode-desc">
                  Get a link or QR code to share. The match begins when they
                  join.
                </span>
              </button>
            </div>
          ) : (
            <StakeChooser
              mode={picking}
              stake={stake}
              setStake={setStake}
              bestOf={bestOf}
              setBestOf={setBestOf}
              onBack={() => setPicking(null)}
              onStart={() => onStart(picking, stake, bestOf)}
            />
          )}
        </section>

        <section className="home-map" aria-label="Example board">
          <MiniMap />
        </section>

        <section className="home-rules">
          <h2>Three orders</h2>
          <ul className="rules">
            {ORDER_TEXT.map(([kind, text]) => {
              const Icon = ACTION_ICON[kind];
              return (
                <li key={kind} className="rule">
                  <Icon size={26} />
                  <h3>{ACTION_LABEL[kind]}</h3>
                  <p>{text}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="home-notes">
          <div>
            <h2>Also in play</h2>
            <p>
              Spend your one spy charge to read the other side's sealed order.
              Earthquakes and storms change the rules from round to round.
              Treasure is hidden on unclaimed land.
            </p>
          </div>
          <div>
            <h2>Why nobody can peek</h2>
            <p>
              Orders live in a private account inside a TEE on a MagicBlock
              Ephemeral Rollup, readable only by their owner until both are in.
              When the match ends, the result settles to Solana.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        Built on{" "}
        <a href="https://docs.magicblock.gg" target="_blank" rel="noreferrer">
          MagicBlock Ephemeral Rollups
        </a>
        . Adapted from MagicBlock's open-source rock-paper-scissors example.
      </footer>
    </div>
  );
}

interface ChooserProps {
  mode: "solo" | "host";
  stake: number;
  setStake: (n: number) => void;
  bestOf: number;
  setBestOf: (n: number) => void;
  onBack: () => void;
  onStart: () => void;
}

function StakeChooser({
  mode,
  stake,
  setStake,
  bestOf,
  setBestOf,
  onBack,
  onStart,
}: ChooserProps) {
  return (
    <div className="card stake-card">
      <h3>{mode === "solo" ? "Play the robot" : "Challenge a friend"}</h3>

      <div className="stake-section">
        <p className="stake-sub">Rounds</p>
        <div className="stake-presets" role="group" aria-label="Rounds">
          {BEST_OF_PRESETS.map((n) => (
            <button
              key={n}
              className={`stake-preset ${bestOf === n ? "selected" : ""}`}
              aria-pressed={bestOf === n}
              onClick={() => setBestOf(n)}
            >
              {n === 1 ? "1 round" : `${n} rounds`}
            </button>
          ))}
        </div>
        <label className="stake-custom">
          Or set your own
          <input
            type="number"
            min={1}
            step={2}
            value={bestOf}
            onChange={(e) =>
              setBestOf(Math.max(1, Math.floor(Number(e.target.value) || 1)))
            }
          />
        </label>
        <p className="stake-pot">
          {bestOf === 1
            ? "One round decides it."
            : `Most territories after ${bestOf} rounds wins.`}
        </p>
      </div>

      <div className="stake-section">
        <p className="stake-sub">Stake</p>
        <div className="stake-presets" role="group" aria-label="Stake">
          {STAKE_PRESETS_SOL.map((s) => (
            <button
              key={s}
              className={`stake-preset ${stake === s ? "selected" : ""}`}
              aria-pressed={stake === s}
              onClick={() => setStake(s)}
            >
              {s === 0 ? "Free" : `${s} SOL`}
            </button>
          ))}
        </div>
        <label className="stake-custom">
          Or set your own (SOL)
          <input
            type="number"
            min={0}
            step={0.01}
            value={stake}
            onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <p className="stake-pot">
          {stake > 0 ? (
            <>
              Each player stakes this. The winner takes the{" "}
              <strong>{(stake * 2).toFixed(3)} SOL</strong> pot.
            </>
          ) : (
            "Free play. No SOL at stake."
          )}
        </p>
      </div>

      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn btn-primary" onClick={onStart}>
          {mode === "solo" ? "Start match" : "Create game"}
        </button>
      </div>
    </div>
  );
}
