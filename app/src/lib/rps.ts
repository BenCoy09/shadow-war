import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as nacl from "tweetnacl";
import {
  permissionPdaFromAccount,
  getAuthToken,
  waitUntilPermissionActive,
  AUTHORITY_FLAG,
  TX_LOGS_FLAG,
  PERMISSION_PROGRAM_ID,
  MAGIC_PROGRAM_ID,
  type Member,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import rawIdl from "../idl/anchor_rock_paper_scissor.json";
import type { AnchorRockPaperScissor } from "../idl/anchor_rock_paper_scissor";
import { walletAdapterFrom } from "./wallet";
import {
  BASE_ENDPOINT,
  TEE_ENDPOINT,
  TEE_WS_ENDPOINT,
  PROGRAM_ID,
  ER_VALIDATOR,
  VAULT_ID,
  GAME_SEED,
  PLAYER_CHOICE_SEED,
  VAULT_SEED,
} from "./config";

export type ActionKind = "attack" | "defend" | "fortify";

export const ACTIONS: ActionKind[] = ["attack", "defend", "fortify"];
export const NUM_TERRITORIES = 12;
export const NEUTRAL = 255;

/** A secret move: what to do + which territory (0-11). */
export interface Move {
  kind: ActionKind;
  target: number;
}
/** Alias so the rest of the app keeps compiling. */
export type ChoiceName = Move;

/** How a Move looks when decoded from the chain. */
export type AnchorMove = { kind: Record<string, object>; target: number };

/** Simple robot: mostly attacks, sometimes protects its own land (3-5). */
export const randomChoice = (): Move => {
  const r = Math.random();
  if (r < 0.6) {
    const targets = [0, 1, 2, 6, 7, 8, 9, 10, 11];
    return {
      kind: "attack",
      target: targets[Math.floor(Math.random() * targets.length)],
    };
  }
  const own = [3, 4, 5];
  return {
    kind: r < 0.85 ? "defend" : "fortify",
    target: own[Math.floor(Math.random() * own.length)],
  };
};

/** Starting map: player 1 owns 0-2, player 2 owns 3-5, the rest is neutral. */
export const initialBoard = () => {
  const owner: number[] = Array(NUM_TERRITORIES).fill(NEUTRAL);
  for (let t = 0; t < 3; t++) {
    owner[t] = 0;
    owner[t + 3] = 1;
  }
  return { owner, shield: Array(NUM_TERRITORIES).fill(0) as number[] };
};

export interface GameAccount {
  gameId: BN;
  player1: PublicKey | null;
  player2: PublicKey | null;
  player1Choice: AnchorMove | null;
  player2Choice: AnchorMove | null;
  roundResult: Record<string, unknown>;
  stake: BN;
  paid: boolean;
  targetWins: number; // total rounds in the match
  player1Wins: number; // player 1's territory count
  player2Wins: number; // player 2's territory count
  round: number;
  owner: number[]; // 0 = player 1, 1 = player 2, 255 = neutral
  shield: number[];
}

export const resultIsSet = (game: GameAccount | null): boolean =>
  !!game && !!game.roundResult && !("none" in game.roundResult);

/** Player holding more territories right now (null on a tie). */
export const winnerKey = (game: GameAccount): PublicKey | null =>
  game.player1Wins > game.player2Wins
    ? game.player1
    : game.player2Wins > game.player1Wins
      ? game.player2
      : null;

/** The match is over once the last round has been revealed. */
export const matchDecided = (game: GameAccount | null): boolean =>
  !!game && resultIsSet(game) && game.round >= game.targetWins;

export const matchWinnerKey = (game: GameAccount): PublicKey | null =>
  matchDecided(game) ? winnerKey(game) : null;

export const choiceName = (c: AnchorMove | null): Move | null =>
  c ? { kind: Object.keys(c.kind)[0] as ActionKind, target: c.target } : null;

// Patch the IDL address so an env-var override takes effect everywhere.
const idl = {
  ...(rawIdl as object),
  address: PROGRAM_ID.toBase58(),
} as AnchorRockPaperScissor;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry a flaky network read (e.g. fetching a blockhash) a few times. */
async function retryFetch<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await sleep(700 * (i + 1));
    }
  }
  throw last;
}

/**
 * One client per identity (host, joiner, robot): a base-layer connection plus
 * a lazily authenticated TEE/ER connection — all ER reads/writes go through
 * this identity's auth token, which is what keeps the opponent's choice hidden.
 */
export class RpsClient {
  readonly keypair: Keypair;
  readonly baseConnection: Connection;
  readonly program: Program<AnchorRockPaperScissor>;
  private teeConnection: Connection | null = null;
  private teeTokenExpiry = 0;
  private teeTokenizedUrl: string | null = null;

  constructor(keypair: Keypair) {
    this.keypair = keypair;
    this.baseConnection = new Connection(BASE_ENDPOINT, "confirmed");
    const provider = new anchor.AnchorProvider(
      this.baseConnection,
      walletAdapterFrom(keypair) as anchor.Wallet,
      { commitment: "confirmed" },
    );
    this.program = new Program<AnchorRockPaperScissor>(idl, provider);
  }

  get publicKey(): PublicKey {
    return this.keypair.publicKey;
  }

  // ---------- PDAs ----------

  gamePda(gameId: BN): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(GAME_SEED), gameId.toArrayLike(Buffer, "le", 8)],
      this.program.programId,
    )[0];
  }

  choicePda(gameId: BN, player: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(PLAYER_CHOICE_SEED),
        gameId.toArrayLike(Buffer, "le", 8),
        player.toBuffer(),
      ],
      this.program.programId,
    )[0];
  }

  vaultPda(gameId: BN): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_SEED), gameId.toArrayLike(Buffer, "le", 8)],
      this.program.programId,
    )[0];
  }

  // ---------- TEE connection (auth token per identity) ----------

  async teeConn(): Promise<Connection> {
    if (this.teeConnection && Date.now() < this.teeTokenExpiry - 60_000) {
      return this.teeConnection;
    }
    const cacheKey = `rps-tee-token-${TEE_ENDPOINT}-${this.publicKey.toBase58()}`;
    let auth: { token: string; expiresAt: number } | null = null;
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) auth = JSON.parse(cached);
    } catch {
      auth = null;
    }
    const expMs = (a: { expiresAt: number }) =>
      a.expiresAt > 1e12 ? a.expiresAt : a.expiresAt * 1000;
    if (!auth || expMs(auth) - Date.now() < 60_000) {
      auth = await getAuthToken(TEE_ENDPOINT, this.publicKey, (message) =>
        Promise.resolve(nacl.sign.detached(message, this.keypair.secretKey)),
      );
      window.localStorage.setItem(cacheKey, JSON.stringify(auth));
    }
    const base = TEE_ENDPOINT.replace(/\/$/, "");
    const ws = TEE_WS_ENDPOINT.replace(/\/$/, "");
    this.teeTokenizedUrl = `${base}?token=${auth.token}`;
    this.teeConnection = new Connection(this.teeTokenizedUrl, {
      wsEndpoint: `${ws}?token=${auth.token}`,
      commitment: "confirmed",
    });
    this.teeTokenExpiry = expMs(auth);
    return this.teeConnection;
  }

  /** Tokenized TEE RPC URL for explorer links — only set once authenticated. */
  get teeExplorerRpc(): string | null {
    return this.teeTokenizedUrl;
  }

  // ---------- tx helpers ----------

  private async sendBase(ixs: TransactionInstruction[]): Promise<string> {
    const tx = new Transaction().add(...ixs);
    tx.feePayer = this.publicKey;
    tx.recentBlockhash = (
      await retryFetch(() => this.baseConnection.getLatestBlockhash())
    ).blockhash;
    return sendAndConfirmTransaction(this.baseConnection, tx, [this.keypair], {
      skipPreflight: true,
      commitment: "confirmed",
    });
  }

  private async sendEr(ixs: TransactionInstruction[]): Promise<string> {
    const conn = await this.teeConn();
    const tx = new Transaction().add(...ixs);
    tx.feePayer = this.publicKey;
    tx.recentBlockhash = (
      await retryFetch(() => conn.getLatestBlockhash())
    ).blockhash;
    return sendAndConfirmTransaction(conn, tx, [this.keypair], {
      skipPreflight: true,
      commitment: "confirmed",
    });
  }

  /** Wait for a delegated PDA to show up on the ER before touching it there. */
  async waitUntilOnEr(pda: PublicKey, timeoutMs = 15_000): Promise<void> {
    const conn = await this.teeConn();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const info = await conn.getAccountInfo(pda).catch(() => null);
      if (info) return;
      await sleep(500);
    }
    throw new Error(`Account ${pda.toBase58()} not visible on the ER in time`);
  }

  // ---------- game flow (mirrors tests/rock-paper-scissor.ts) ----------

  /** Base layer: create the game (auto-join as player 1) + delegate p1's choice PDA. */
  async createGameAndDelegate(
    gameId: BN,
    stakeLamports: BN,
    targetWins: number,
  ): Promise<string> {
    const createIx = await this.program.methods
      .createGame(gameId, stakeLamports, targetWins)
      .accountsPartial({
        game: this.gamePda(gameId),
        playerChoice: this.choicePda(gameId, this.publicKey),
        vault: this.vaultPda(gameId),
        player1: this.publicKey,
      })
      .instruction();
    const delegateChoiceIx = await this.program.methods
      .delegatePda({ playerChoice: { gameId, player: this.publicKey } })
      .accountsPartial({
        payer: this.publicKey,
        validator: ER_VALIDATOR,
        pda: this.choicePda(gameId, this.publicKey),
      })
      .instruction();
    return this.sendBase([createIx, delegateChoiceIx]);
  }

  /** Base layer: join as player 2 + delegate the game PDA and p2's choice PDA. */
  async joinGameAndDelegate(gameId: BN): Promise<string> {
    const joinIx = await this.program.methods
      .joinGame(gameId)
      .accountsPartial({
        game: this.gamePda(gameId),
        playerChoice: this.choicePda(gameId, this.publicKey),
        vault: this.vaultPda(gameId),
        player: this.publicKey,
      })
      .instruction();
    const delegateGameIx = await this.program.methods
      .delegatePda({ game: { gameId } })
      .accountsPartial({
        payer: this.publicKey,
        validator: ER_VALIDATOR,
        pda: this.gamePda(gameId),
      })
      .instruction();
    const delegateChoiceIx = await this.program.methods
      .delegatePda({ playerChoice: { gameId, player: this.publicKey } })
      .accountsPartial({
        payer: this.publicKey,
        validator: ER_VALIDATOR,
        pda: this.choicePda(gameId, this.publicKey),
      })
      .instruction();
    return this.sendBase([joinIx, delegateGameIx, delegateChoiceIx]);
  }

  private initPermissionIx(
    gameId: BN,
    target: "game" | "choice",
    members: Member[],
  ) {
    const account =
      target === "game"
        ? this.gamePda(gameId)
        : this.choicePda(gameId, this.publicKey);
    const accountType =
      target === "game"
        ? { game: { gameId } }
        : { playerChoice: { gameId, player: this.publicKey } };
    return this.program.methods
      .initPermission(accountType, members)
      .accountsPartial({
        permissionedAccount: account,
        permission: permissionPdaFromAccount(account),
        authority: this.publicKey,
        permissionProgram: PERMISSION_PROGRAM_ID,
        ephemeralVault: VAULT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
      })
      .instruction();
  }

  /** ER: make my choice PDA private to me alone — the opponent can't peek. */
  async initOwnChoicePermission(gameId: BN): Promise<string> {
    const choicePda = this.choicePda(gameId, this.publicKey);
    await this.waitUntilOnEr(choicePda);
    const ix = await this.initPermissionIx(gameId, "choice", [
      { flags: AUTHORITY_FLAG | TX_LOGS_FLAG, pubkey: this.publicKey },
    ]);
    const sig = await this.sendEr([ix]);
    await waitUntilPermissionActive(TEE_ENDPOINT, choicePda);
    return sig;
  }

  /** ER (player 2): game readable by both players + my choice private to me. */
  async initGameAndOwnChoicePermissions(
    gameId: BN,
    player1: PublicKey,
  ): Promise<string> {
    const choicePda = this.choicePda(gameId, this.publicKey);
    await this.waitUntilOnEr(this.gamePda(gameId));
    await this.waitUntilOnEr(choicePda);
    const gameIx = await this.initPermissionIx(gameId, "game", [
      { flags: AUTHORITY_FLAG | TX_LOGS_FLAG, pubkey: player1 },
      { flags: AUTHORITY_FLAG | TX_LOGS_FLAG, pubkey: this.publicKey },
    ]);
    const choiceIx = await this.initPermissionIx(gameId, "choice", [
      { flags: AUTHORITY_FLAG | TX_LOGS_FLAG, pubkey: this.publicKey },
    ]);
    const sig = await this.sendEr([gameIx, choiceIx]);
    await waitUntilPermissionActive(TEE_ENDPOINT, choicePda);
    return sig;
  }

  /** ER: lock in my choice. Runs inside the TEE — nobody else can read it. */
  async makeChoice(gameId: BN, choice: ChoiceName): Promise<string> {
    const ix = await this.program.methods
      .makeChoice(
        gameId,
        { kind: { [choice.kind]: {} }, target: choice.target } as never,
      )
      .accountsPartial({
        playerChoice: this.choicePda(gameId, this.publicKey),
        player: this.publicKey,
      })
      .instruction();
    return this.sendEr([ix]);
  }

  // ---------- reads ----------

  private decodeGame(data: Buffer): GameAccount {
    return this.program.coder.accounts.decode("game", data) as GameAccount;
  }

  async fetchGameBase(gameId: BN): Promise<GameAccount | null> {
    const info = await this.baseConnection.getAccountInfo(this.gamePda(gameId));
    return info ? this.decodeGame(info.data) : null;
  }

  async fetchGameEr(gameId: BN): Promise<GameAccount | null> {
    const conn = await this.teeConn();
    const info = await conn.getAccountInfo(this.gamePda(gameId));
    return info ? this.decodeGame(info.data) : null;
  }

  /** Best source of truth wherever the game currently lives (ER first, then base). */
  async fetchGameAnywhere(gameId: BN): Promise<GameAccount | null> {
    const er = await this.fetchGameEr(gameId).catch(() => null);
    if (er) return er;
    return this.fetchGameBase(gameId).catch(() => null);
  }

  /** Lamports currently escrowed in the game vault (the pot). */
  async vaultBalance(gameId: BN): Promise<number> {
    return this.baseConnection.getBalance(this.vaultPda(gameId)).catch(() => 0);
  }

  /** Is the game back on the base layer (undelegated)? */
  async isOnBase(gameId: BN): Promise<boolean> {
    const info = await this.baseConnection
      .getAccountInfo(this.gamePda(gameId))
      .catch(() => null);
    return !!info && info.owner.equals(this.program.programId);
  }

  /** My own choice — readable only through my authenticated TEE connection. */
  async fetchMyChoiceEr(gameId: BN): Promise<ChoiceName | null> {
    const conn = await this.teeConn();
    const info = await conn.getAccountInfo(
      this.choicePda(gameId, this.publicKey),
    );
    if (!info) return null;
    const decoded = this.program.coder.accounts.decode(
      "playerChoice",
      info.data,
    ) as unknown as { choice: AnchorMove | null };
    return choiceName(decoded.choice);
  }

  // ---------- reveal + settle ----------

  private async revealTx(
    gameId: BN,
    player1: PublicKey,
    player2: PublicKey,
  ): Promise<Transaction> {
    const gamePda = this.gamePda(gameId);
    const p1Choice = this.choicePda(gameId, player1);
    const p2Choice = this.choicePda(gameId, player2);
    return this.program.methods
      .revealRound()
      .accountsPartial({
        game: gamePda,
        player1Choice: p1Choice,
        player2Choice: p2Choice,
        permissionGame: permissionPdaFromAccount(gamePda),
        permission1: permissionPdaFromAccount(p1Choice),
        permission2: permissionPdaFromAccount(p2Choice),
        payer: this.publicKey,
        permissionProgram: PERMISSION_PROGRAM_ID,
        ephemeralVault: VAULT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
      })
      .transaction();
  }

  /**
   * Simulate first, send only when it would succeed (i.e. both choices are
   * in) — so waiting clients never spam failed reveals.
   */
  async tryReveal(
    gameId: BN,
    player1: PublicKey,
    player2: PublicKey,
  ): Promise<string | null> {
    const conn = await this.teeConn();
    const tx = await this.revealTx(gameId, player1, player2);
    tx.feePayer = this.publicKey;
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    const sim = await conn.simulateTransaction(tx).catch(() => null);
    if (!sim || sim.value.err) return null;
    return sendAndConfirmTransaction(conn, tx, [this.keypair], {
      skipPreflight: true,
      commitment: "confirmed",
    });
  }

  /** ER: advance the match — clears the round (or starts a new match), re-privatizes. */
  async nextRound(
    gameId: BN,
    player1: PublicKey,
    player2: PublicKey,
  ): Promise<string> {
    const gamePda = this.gamePda(gameId);
    const p1Choice = this.choicePda(gameId, player1);
    const p2Choice = this.choicePda(gameId, player2);
    const ix = await this.program.methods
      .nextRound()
      .accountsPartial({
        game: gamePda,
        player1Choice: p1Choice,
        player2Choice: p2Choice,
        permissionGame: permissionPdaFromAccount(gamePda),
        permission1: permissionPdaFromAccount(p1Choice),
        permission2: permissionPdaFromAccount(p2Choice),
        payer: this.publicKey,
        permissionProgram: PERMISSION_PROGRAM_ID,
        ephemeralVault: VAULT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
      })
      .instruction();
    return this.sendEr([ix]);
  }

  /** ER: commit + undelegate game and both choices back to the base layer. */
  async undelegateAll(
    gameId: BN,
    player1: PublicKey,
    player2: PublicKey,
  ): Promise<string> {
    const ix = await this.program.methods
      .undelegateAll()
      .accountsPartial({
        payer: this.publicKey,
        game: this.gamePda(gameId),
        player1Choice: this.choicePda(gameId, player1),
        player2Choice: this.choicePda(gameId, player2),
      })
      .instruction();
    return this.sendEr([ix]);
  }

  /** Base layer (after undelegate): pay the winner / refund a tie. Idempotent. */
  async claimPot(
    gameId: BN,
    player1: PublicKey,
    player2: PublicKey,
  ): Promise<string> {
    const ix = await this.program.methods
      .claimPot()
      .accountsPartial({
        game: this.gamePda(gameId),
        vault: this.vaultPda(gameId),
        player1,
        player2,
        payer: this.publicKey,
      })
      .instruction();
    return this.sendBase([ix]);
  }

  /** Base layer: refund the creator's stake when nobody joined. */
  async cancelGame(gameId: BN): Promise<string> {
    const ix = await this.program.methods
      .cancelGame()
      .accountsPartial({
        game: this.gamePda(gameId),
        vault: this.vaultPda(gameId),
        player1: this.publicKey,
      })
      .instruction();
    return this.sendBase([ix]);
  }
}
