# Shadow War

A two-player territory strategy game where **every move is secret until both players have locked in**, then all moves resolve at the same instant. Built for **MagicBlock Solana Blitz v9**.

- **Live demo:** https://shadow-war-eight.vercel.app
- **Demo video:** https://youtu.be/WjOx9reoTK8
- **Program (Solana devnet):** `FMKTJ4ASZfDWoRXg7bdZC24Y3es3tHFSqHH28PbCSeWi`

## The game

12 territories, 2 players, 5 rounds. You start with 3 territories, your opponent starts with 3, and 6 are neutral. Each round you secretly pick **one** move on **one** territory:

| Move | Effect |
| --- | --- |
| ⚔️ **Attack** | Capture a neutral or enemy territory, if you are the only attacker and it is not protected |
| 🛡️ **Defend** | Your territory is immune to attacks this round |
| 🏰 **Fortify** | Your territory is immune to attacks this round and the next |

If both players attack the same territory, **nobody captures it**. After round 5, whoever holds the most territories wins. A tie is a shared victory.

The tension: if you attack, you leave your own land undefended. Do you guess your opponent will attack, or play it safe?

## Beyond the basics

- **🕵️ Espionage:** each player gets one charge per game. The `spy` instruction copies the opponent's locked-in move into the spy's own private account, readable only by them, before the round resolves.
- **🌋 World events:** each round ends by picking an event for the next one. An **Earthquake** crumbles a named territory to neutral unless it is shielded, and a **Storm** makes Defend do nothing that round.
- **💎 Hidden treasures:** three treasures are hidden on neutral land: **Armor** (a 2-round shield on capture), a **War Banner** (your next attack breaks any shield) and a **Spy Kit** (one extra espionage charge).

Note on randomness: events and treasure placement use a deterministic on-chain hash (seeded from game id, round, both moves and slot), **not** MagicBlock VRF. Switching to VRF is on the roadmap.

## How MagicBlock is used

Hidden, simultaneous moves are the whole game, so privacy and speed are part of the gameplay rather than decoration.

- **Private Ephemeral Rollup (TEE):** each player's move lives in its own `PlayerChoice` account. Its ephemeral permission lists only that player, so the opponent cannot read it, and reads require an authenticated TEE token.
- **Simultaneous resolution on-chain:** once both moves are locked in, `reveal_round` reads both and applies them against the same starting map, so nobody gets a first-mover advantage. It then flips the permissions to public so everyone can verify what was played.
- **Fast rounds:** moves, reveals and round resets all run on the ephemeral rollup, so a round takes seconds.
- **Commit and undelegate:** when the match ends, the final state is committed back to Solana devnet, where the result is settled.

## How it was built

Built on top of MagicBlock's open-source `rock-paper-scissor` example (the account delegation and permission plumbing). The Shadow War work is:

- A new Anchor program model: territory map, shields, move types, and the simultaneous resolution rules (`programs/anchor-rock-paper-scissor/src/lib.rs`).
- A new React frontend: the territory map, move picker, reveal view and a round-by-round battle report (`app/`).

## Run it locally

```bash
cd app
yarn install
yarn dev
```

Open http://localhost:5173. The app uses a throwaway wallet stored in your browser. If the automatic devnet airdrop is rate-limited, copy the address shown on screen and fund it at https://faucet.solana.com.

**Modes:** play against the built-in robot, or host a game and open the invite link in a second tab or browser to play both sides.

## Roadmap

- Random world events using MagicBlock's verifiable randomness
- 3-4 players, alliances and betrayal
- Auto-defend when a player misses the round deadline
- A smarter robot opponent

## Built by

Benjamin Hunpe
