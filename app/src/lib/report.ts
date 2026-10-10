import type { Move } from "./rps";
import { TERRITORY_NAMES } from "../components/ChoicePicker";

type Board = { owner: number[]; shield: number[] };

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
  return lines;
}
