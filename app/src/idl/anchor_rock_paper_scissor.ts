/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/anchor_rock_paper_scissor.json`.
 */
export type AnchorRockPaperScissor = {
  address: "FMKTJ4ASZfDWoRXg7bdZC24Y3es3tHFSqHH28PbCSeWi";
  metadata: {
    name: "anchorRockPaperScissor";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "cancelGame";
      discriminator: [121, 194, 154, 118, 103, 235, 149, 52];
      accounts: [
        {
          name: "game";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [103, 97, 109, 101];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
            ];
          };
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
            ];
          };
        },
        {
          name: "player1";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "claimPot";
      discriminator: [210, 85, 35, 217, 204, 65, 38, 17];
      accounts: [
        {
          name: "game";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [103, 97, 109, 101];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
            ];
          };
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
            ];
          };
        },
        {
          name: "player1";
          writable: true;
        },
        {
          name: "player2";
          writable: true;
        },
        {
          name: "payer";
          docs: ["Anyone can trigger the payout."];
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "createGame";
      discriminator: [124, 69, 75, 66, 184, 220, 72, 206];
      accounts: [
        {
          name: "game";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [103, 97, 109, 101];
              },
              {
                kind: "arg";
                path: "gameId";
              },
            ];
          };
        },
        {
          name: "playerChoice";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  99,
                  104,
                  111,
                  105,
                  99,
                  101,
                ];
              },
              {
                kind: "arg";
                path: "gameId";
              },
              {
                kind: "account";
                path: "player1";
              },
            ];
          };
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
              {
                kind: "arg";
                path: "gameId";
              },
            ];
          };
        },
        {
          name: "player1";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "gameId";
          type: "u64";
        },
        {
          name: "stake";
          type: "u64";
        },
        {
          name: "targetWins";
          type: "u8";
        },
      ];
    },
    {
      name: "delegatePda";
      discriminator: [248, 217, 193, 46, 124, 191, 64, 135];
      accounts: [
        {
          name: "bufferPda";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [98, 117, 102, 102, 101, 114];
              },
              {
                kind: "account";
                path: "pda";
              },
            ];
            program: {
              kind: "const";
              value: [
                213,
                56,
                25,
                49,
                182,
                94,
                164,
                241,
                106,
                54,
                250,
                126,
                65,
                210,
                233,
                192,
                174,
                213,
                91,
                126,
                198,
                193,
                48,
                254,
                145,
                132,
                7,
                203,
                75,
                9,
                173,
                199,
              ];
            };
          };
        },
        {
          name: "delegationRecordPda";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [100, 101, 108, 101, 103, 97, 116, 105, 111, 110];
              },
              {
                kind: "account";
                path: "pda";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "delegationMetadataPda";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                ];
              },
              {
                kind: "account";
                path: "pda";
              },
            ];
            program: {
              kind: "account";
              path: "delegationProgram";
            };
          };
        },
        {
          name: "pda";
          writable: true;
        },
        {
          name: "payer";
          signer: true;
        },
        {
          name: "validator";
          optional: true;
        },
        {
          name: "ownerProgram";
          address: "FMKTJ4ASZfDWoRXg7bdZC24Y3es3tHFSqHH28PbCSeWi";
        },
        {
          name: "delegationProgram";
          address: "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "accountType";
          type: {
            defined: {
              name: "accountType";
            };
          };
        },
      ];
    },
    {
      name: "initPermission";
      discriminator: [66, 14, 153, 250, 187, 36, 179, 236];
      accounts: [
        {
          name: "permissionedAccount";
          writable: true;
        },
        {
          name: "permission";
          writable: true;
        },
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "permissionProgram";
          address: "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1";
        },
        {
          name: "ephemeralVault";
          writable: true;
          address: "MagicVau1t999999999999999999999999999999999";
        },
        {
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "accountType";
          type: {
            defined: {
              name: "accountType";
            };
          };
        },
        {
          name: "members";
          type: {
            option: {
              vec: {
                defined: {
                  name: "member";
                };
              };
            };
          };
        },
      ];
    },
    {
      name: "joinGame";
      discriminator: [107, 112, 18, 38, 56, 173, 60, 128];
      accounts: [
        {
          name: "game";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [103, 97, 109, 101];
              },
              {
                kind: "arg";
                path: "gameId";
              },
            ];
          };
        },
        {
          name: "playerChoice";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  99,
                  104,
                  111,
                  105,
                  99,
                  101,
                ];
              },
              {
                kind: "arg";
                path: "gameId";
              },
              {
                kind: "account";
                path: "player";
              },
            ];
          };
        },
        {
          name: "vault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [118, 97, 117, 108, 116];
              },
              {
                kind: "arg";
                path: "gameId";
              },
            ];
          };
        },
        {
          name: "player";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "gameId";
          type: "u64";
        },
      ];
    },
    {
      name: "makeChoice";
      discriminator: [207, 18, 251, 32, 135, 122, 160, 77];
      accounts: [
        {
          name: "playerChoice";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  99,
                  104,
                  111,
                  105,
                  99,
                  101,
                ];
              },
              {
                kind: "arg";
                path: "gameId";
              },
              {
                kind: "account";
                path: "player";
              },
            ];
          };
        },
        {
          name: "player";
          writable: true;
          signer: true;
        },
      ];
      args: [
        {
          name: "gameId";
          type: "u64";
        },
        {
          name: "choice";
          type: {
            defined: {
              name: "move";
            };
          };
        },
      ];
    },
    {
      name: "nextRound";
      discriminator: [71, 165, 58, 85, 228, 54, 16, 73];
      accounts: [
        {
          name: "game";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [103, 97, 109, 101];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
            ];
          };
        },
        {
          name: "player1Choice";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  99,
                  104,
                  111,
                  105,
                  99,
                  101,
                ];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
              {
                kind: "account";
                path: "game.player1";
                account: "game";
              },
            ];
          };
        },
        {
          name: "player2Choice";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  99,
                  104,
                  111,
                  105,
                  99,
                  101,
                ];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
              {
                kind: "account";
                path: "game.player2";
                account: "game";
              },
            ];
          };
        },
        {
          name: "permissionGame";
          writable: true;
        },
        {
          name: "permission1";
          writable: true;
        },
        {
          name: "permission2";
          writable: true;
        },
        {
          name: "payer";
          docs: ["Must be one of the two players (checked in the handler)"];
          writable: true;
          signer: true;
        },
        {
          name: "permissionProgram";
          address: "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1";
        },
        {
          name: "ephemeralVault";
          writable: true;
          address: "MagicVau1t999999999999999999999999999999999";
        },
        {
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "processUndelegation";
      discriminator: [196, 28, 41, 206, 48, 37, 51, 167];
      accounts: [
        {
          name: "baseAccount";
          writable: true;
        },
        {
          name: "buffer";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  117,
                  110,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  101,
                  45,
                  98,
                  117,
                  102,
                  102,
                  101,
                  114,
                ];
              },
              {
                kind: "account";
                path: "baseAccount";
              },
            ];
            program: {
              kind: "const";
              value: [
                181,
                183,
                0,
                225,
                242,
                87,
                58,
                192,
                204,
                6,
                34,
                1,
                52,
                74,
                207,
                151,
                184,
                53,
                6,
                235,
                140,
                229,
                25,
                152,
                204,
                98,
                126,
                24,
                147,
                128,
                167,
                62,
              ];
            };
          };
        },
        {
          name: "payer";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "accountSeeds";
          type: {
            vec: "bytes";
          };
        },
      ];
    },
    {
      name: "revealRound";
      discriminator: [146, 249, 2, 210, 169, 145, 120, 6];
      accounts: [
        {
          name: "game";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [103, 97, 109, 101];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
            ];
          };
        },
        {
          name: "player1Choice";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  99,
                  104,
                  111,
                  105,
                  99,
                  101,
                ];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
              {
                kind: "account";
                path: "game.player1";
                account: "game";
              },
            ];
          };
        },
        {
          name: "player2Choice";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  99,
                  104,
                  111,
                  105,
                  99,
                  101,
                ];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
              {
                kind: "account";
                path: "game.player2";
                account: "game";
              },
            ];
          };
        },
        {
          name: "permissionGame";
          writable: true;
        },
        {
          name: "permission1";
          writable: true;
        },
        {
          name: "permission2";
          writable: true;
        },
        {
          name: "payer";
          docs: ["Anyone can trigger this"];
          writable: true;
          signer: true;
        },
        {
          name: "permissionProgram";
          address: "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1";
        },
        {
          name: "ephemeralVault";
          writable: true;
          address: "MagicVau1t999999999999999999999999999999999";
        },
        {
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "spy";
      discriminator: [70, 213, 113, 91, 2, 233, 55, 100];
      accounts: [
        {
          name: "game";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [103, 97, 109, 101];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
            ];
          };
        },
        {
          name: "myChoice";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  99,
                  104,
                  111,
                  105,
                  99,
                  101,
                ];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
              {
                kind: "account";
                path: "player";
              },
            ];
          };
        },
        {
          name: "theirChoice";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  99,
                  104,
                  111,
                  105,
                  99,
                  101,
                ];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
              {
                kind: "account";
                path: "opponent";
              },
            ];
          };
        },
        {
          name: "opponent";
        },
        {
          name: "player";
          writable: true;
          signer: true;
        },
      ];
      args: [];
    },
    {
      name: "undelegateAll";
      discriminator: [85, 123, 97, 145, 66, 22, 252, 69];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "game";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [103, 97, 109, 101];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
            ];
          };
        },
        {
          name: "player1Choice";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  99,
                  104,
                  111,
                  105,
                  99,
                  101,
                ];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
              {
                kind: "account";
                path: "game.player1";
                account: "game";
              },
            ];
          };
        },
        {
          name: "player2Choice";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  99,
                  104,
                  111,
                  105,
                  99,
                  101,
                ];
              },
              {
                kind: "account";
                path: "game.game_id";
                account: "game";
              },
              {
                kind: "account";
                path: "game.player2";
                account: "game";
              },
            ];
          };
        },
        {
          name: "magicProgram";
          address: "Magic11111111111111111111111111111111111111";
        },
        {
          name: "magicContext";
          writable: true;
          address: "MagicContext1111111111111111111111111111111";
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: "game";
      discriminator: [27, 90, 166, 125, 74, 100, 121, 18];
    },
    {
      name: "playerChoice";
      discriminator: [116, 20, 210, 159, 85, 200, 132, 149];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "alreadyChose";
      msg: "You already made your choice.";
    },
    {
      code: 6001;
      name: "cannotJoinOwnGame";
      msg: "You cannot join your own game.";
    },
    {
      code: 6002;
      name: "missingChoice";
      msg: "Both players must make a choice first.";
    },
    {
      code: 6003;
      name: "missingOpponent";
      msg: "Opponent not found.";
    },
    {
      code: 6004;
      name: "gameFull";
      msg: "Game is already full.";
    },
    {
      code: 6005;
      name: "notRevealed";
      msg: "The round has not been revealed yet.";
    },
    {
      code: 6006;
      name: "notAPlayer";
      msg: "Only a player of this game can do this.";
    },
    {
      code: 6007;
      name: "alreadyPaid";
      msg: "The pot has already been paid out.";
    },
    {
      code: 6008;
      name: "gameSettled";
      msg: "This game has already been settled.";
    },
    {
      code: 6009;
      name: "wrongPlayerAccount";
      msg: "Wrong player account for this game.";
    },
    {
      code: 6010;
      name: "cannotCancelStarted";
      msg: "Cannot cancel a game that already has two players.";
    },
    {
      code: 6011;
      name: "mathOverflow";
      msg: "Arithmetic overflow.";
    },
    {
      code: 6012;
      name: "matchNotDecided";
      msg: "The match is not decided yet.";
    },
    {
      code: 6013;
      name: "mustClaimFirst";
      msg: "Settle and claim the pot before starting a new match.";
    },
    {
      code: 6014;
      name: "badTarget";
      msg: "That territory does not exist.";
    },
    {
      code: 6015;
      name: "opponentNotLocked";
      msg: "Your opponent has not locked in a move yet.";
    },
    {
      code: 6016;
      name: "noSpyCharges";
      msg: "You have no espionage left.";
    },
    {
      code: 6017;
      name: "roundAlreadyRevealed";
      msg: "This round has already been revealed.";
    },
  ];
  types: [
    {
      name: "accountType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "game";
            fields: [
              {
                name: "gameId";
                type: "u64";
              },
            ];
          },
          {
            name: "playerChoice";
            fields: [
              {
                name: "gameId";
                type: "u64";
              },
              {
                name: "player";
                type: "pubkey";
              },
            ];
          },
        ];
      };
    },
    {
      name: "actionKind";
      type: {
        kind: "enum";
        variants: [
          {
            name: "attack";
          },
          {
            name: "defend";
          },
          {
            name: "fortify";
          },
        ];
      };
    },
    {
      name: "game";
      type: {
        kind: "struct";
        fields: [
          {
            name: "gameId";
            type: "u64";
          },
          {
            name: "player1";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "player2";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "player1Choice";
            type: {
              option: {
                defined: {
                  name: "move";
                };
              };
            };
          },
          {
            name: "player2Choice";
            type: {
              option: {
                defined: {
                  name: "move";
                };
              };
            };
          },
          {
            name: "roundResult";
            type: {
              defined: {
                name: "roundResult";
              };
            };
          },
          {
            name: "stake";
            type: "u64";
          },
          {
            name: "paid";
            type: "bool";
          },
          {
            name: "targetWins";
            type: "u8";
          },
          {
            name: "player1Wins";
            type: "u8";
          },
          {
            name: "player2Wins";
            type: "u8";
          },
          {
            name: "round";
            type: "u8";
          },
          {
            name: "owner";
            type: {
              array: ["u8", 12];
            };
          },
          {
            name: "shield";
            type: {
              array: ["u8", 12];
            };
          },
          {
            name: "eventKind";
            type: "u8";
          },
          {
            name: "eventTarget";
            type: "u8";
          },
          {
            name: "treasure";
            type: {
              array: ["u8", 12];
            };
          },
          {
            name: "banner";
            type: {
              array: ["u8", 2];
            };
          },
        ];
      };
    },
    {
      name: "member";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "flags";
            type: "u8";
          },
          {
            name: "pubkey";
            type: "pubkey";
          },
        ];
      };
    },
    {
      name: "move";
      type: {
        kind: "struct";
        fields: [
          {
            name: "kind";
            type: {
              defined: {
                name: "actionKind";
              };
            };
          },
          {
            name: "target";
            type: "u8";
          },
        ];
      };
    },
    {
      name: "playerChoice";
      type: {
        kind: "struct";
        fields: [
          {
            name: "gameId";
            type: "u64";
          },
          {
            name: "player";
            type: "pubkey";
          },
          {
            name: "choice";
            type: {
              option: {
                defined: {
                  name: "move";
                };
              };
            };
          },
          {
            name: "spyCharges";
            type: "u8";
          },
          {
            name: "spied";
            type: {
              option: {
                defined: {
                  name: "move";
                };
              };
            };
          },
        ];
      };
    },
    {
      name: "roundResult";
      type: {
        kind: "enum";
        variants: [
          {
            name: "resolved";
          },
          {
            name: "none";
          },
        ];
      };
    },
  ];
};
