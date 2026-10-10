import type { Move } from "./rps";
import { TERRITORY_NAMES } from "../components/ChoicePicker";

type Board = {
  owner: number[];
  shield: number[];
  treasure: number[];
  event: { kind: number; target: number };
};

const NEUTRAL = 255;
const TREASURE_TEXT: Record<number, string> = {
  1: "Armor (protected for 2 rounds)",
  2: "a War Banner (your next attack breaks any shield)",
  3: "a Spy Kit (+1 espionage)",
};

/** Turn one resolved round into short story lines, from the viewer's side. */
export function describeRound(
  prev: Board,
  next: Board,
  me: Move,
  them: Move,
  myIndex: number,
): string[] {
  const lines: string[] = [];
  const place = (t: number) => TERRITORY_NAMES[t] ?? `territory ${t + 1}`;

  // The world event that applied to this round.
  if (prev.event.kind === 1 && prev.event.target < TERRITORY_NAMES.length) {
    const t = prev.event.target;
    lines.push(
      prev.owner[t] !== NEUTRAL && next.owner[t] === NEUTRAL
        ? `🌋 Earthquake! ${place(t)} crumbled into rubble.`
        : `🌋 Earthquake rattled ${place(t)}.`,
    );
  } else if (prev.event.kind === 2) {
    lines.push("🌪️ A storm raged: Defend did nothing this round.");
  }

  const sides: Array<{ move: Move; isMe: boolean; idx: number; other: Move }> = [
    { move: me, isMe: true, idx: myIndex, other: them },
    { move: them, isMe: false, idx: myIndex === 0 ? 1 : 0, other: me },
  ];

  for (const { move, isMe, idx, other } of sides) {
    const t = move.target;
    const where = place(t);
    if (move.kind === "attack") {
      const captured = next.owner[t] === idx && prev.owner[t] !== idx;
      const clash = other.kind === "attack" && other.target === t;
      if (captured) {
        lines.push(`${isMe ? "You" : "The enemy"} captured ${where}! ⚔️`);
      } else if (clash) {
        if (isMe) lines.push(`Both sides attacked ${where} - nobody took it. 💥`);
      } else {
        lines.push(
          `${isMe ? "Your" : "The enemy's"} attack on ${where} was blocked. 🛡️`,
        );
      }
    } else if (move.kind === "defend") {
      lines.push(`${isMe ? "You" : "The enemy"} defended ${where}. 🛡️`);
    } else {
      lines.push(
        `${isMe ? "You" : "The enemy"} fortified ${where} for two rounds. 🏰`,
      );
    }
  }

  // Treasures that were collected this round.
  for (let t = 0; t < prev.treasure.length; t++) {
    if (prev.treasure[t] && !next.treasure[t]) {
      const who = next.owner[t] === myIndex ? "You" : "The enemy";
      lines.push(
        `💎 ${who} found ${TREASURE_TEXT[prev.treasure[t]] ?? "a treasure"} in ${place(t)}!`,
      );
    }
  }
  return lines;
}
