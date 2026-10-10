use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use ephemeral_rollups_sdk::access_control::instructions::{
    CreateEphemeralPermissionCpi, UpdateEphemeralPermissionCpi,
};
use ephemeral_rollups_sdk::access_control::structs::{
    EphemeralMembersArgs, EphemeralPermission, Member, AUTHORITY_FLAG, TX_LOGS_FLAG,
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

// TODO: replace with YOUR program id (see steps after the first build).
declare_id!("FMKTJ4ASZfDWoRXg7bdZC24Y3es3tHFSqHH28PbCSeWi");

pub const PLAYER_CHOICE_SEED: &[u8] = b"player_choice";
pub const GAME_SEED: &[u8] = b"game";
pub const VAULT_SEED: &[u8] = b"vault";

pub const NUM_TERRITORIES: usize = 12;
pub const NEUTRAL: u8 = 255;

// World events (announced before each round, applied when it resolves)
pub const EVENT_CALM: u8 = 0;
pub const EVENT_QUAKE: u8 = 1; // one territory crumbles to neutral unless protected
pub const EVENT_STORM: u8 = 2; // Defend does nothing this round

// Hidden treasures (collected by capturing the territory)
pub const TREASURE_ARMOR: u8 = 1; // captured territory is protected for 2 rounds
pub const TREASURE_BANNER: u8 = 2; // your next attack breaks through any shield
pub const TREASURE_SPYKIT: u8 = 3; // +1 espionage use

#[ephemeral]
#[program]
pub mod anchor_rock_paper_scissor {

    use super::*;

    // 1) Create the game and auto-join as Player 1.
    // `target_wins` now means "number of rounds in the match" (use 5).
    pub fn create_game(
        ctx: Context<CreateGame>,
        game_id: u64,
        stake: u64,
        target_wins: u8,
    ) -> Result<()> {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.player1.to_account_info(),
                    to: ctx.accounts.game.to_account_info(),
                },
            ),
            ephemeral_rollups_sdk::ephemeral_accounts::rent(EphemeralPermission::size_of(2) as u32),
        )?;
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.player1.to_account_info(),
                    to: ctx.accounts.player_choice.to_account_info(),
                },
            ),
            ephemeral_rollups_sdk::ephemeral_accounts::rent(EphemeralPermission::size_of(1) as u32),
        )?;

        if stake > 0 {
            transfer(
                CpiContext::new(
                    ctx.accounts.system_program.key(),
                    Transfer {
                        from: ctx.accounts.player1.to_account_info(),
                        to: ctx.accounts.vault.to_account_info(),
                    },
                ),
                stake,
            )?;
        }

        let game = &mut ctx.accounts.game;
        let player1 = ctx.accounts.player1.key();

        game.game_id = game_id;
        game.player1 = Some(player1);
        game.player2 = None;
        game.player1_choice = None;
        game.player2_choice = None;
        game.round_result = RoundResult::None;
        game.stake = stake;
        game.paid = false;
        game.target_wins = target_wins.max(1); // total rounds in the match
        game.round = 1;
        game.init_board();

        msg!("Game {} created by {}", game_id, player1);

        let player_choice = &mut ctx.accounts.player_choice;
        player_choice.game_id = game_id;
        player_choice.player = player1;
        player_choice.choice = None;
        player_choice.spy_charges = 1;
        player_choice.spied = None;

        Ok(())
    }

    // 2) Player 2 joins.
    pub fn join_game(ctx: Context<JoinGame>, game_id: u64) -> Result<()> {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.player_choice.to_account_info(),
                },
            ),
            ephemeral_rollups_sdk::ephemeral_accounts::rent(EphemeralPermission::size_of(1) as u32),
        )?;

        let game = &mut ctx.accounts.game;
        let player = ctx.accounts.player.key();

        require!(!game.paid, GameError::GameSettled);
        require!(game.player1 != Some(player), GameError::CannotJoinOwnGame);
        require!(game.player2.is_none(), GameError::GameFull);

        if game.stake > 0 {
            transfer(
                CpiContext::new(
                    ctx.accounts.system_program.key(),
                    Transfer {
                        from: ctx.accounts.player.to_account_info(),
                        to: ctx.accounts.vault.to_account_info(),
                    },
                ),
                game.stake,
            )?;
        }

        game.player2 = Some(player);

        let player_choice = &mut ctx.accounts.player_choice;
        player_choice.game_id = game_id;
        player_choice.player = player;
        player_choice.choice = None;
        player_choice.spy_charges = 1;
        player_choice.spied = None;

        msg!("{} joined Game {} as player 2", player, game_id);
        Ok(())
    }

    // 3) Lock in a secret move (stored in the player's PRIVATE PlayerChoice account).
    pub fn make_choice(ctx: Context<MakeChoice>, _game_id: u64, choice: Move) -> Result<()> {
        let player_choice = &mut ctx.accounts.player_choice;
        require!(player_choice.choice.is_none(), GameError::AlreadyChose);
        require!(
            (choice.target as usize) < NUM_TERRITORIES,
            GameError::BadTarget
        );

        player_choice.choice = Some(choice);
        msg!("Player {:?} locked in a move", player_choice.player);
        Ok(())
    }

    // 4) Resolve the round: both moves are applied at once, then the permissions
    // flip to public so everyone can see what was played.
    pub fn reveal_round(ctx: Context<RevealRound>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let player1_choice = &mut ctx.accounts.player1_choice;
        let player2_choice = &mut ctx.accounts.player2_choice;
        let permission_program = ctx.accounts.permission_program.to_account_info();
        let permission_game = ctx.accounts.permission_game.to_account_info();
        let permission1 = ctx.accounts.permission1.to_account_info();
        let permission2 = ctx.accounts.permission2.to_account_info();
        let ephemeral_vault = ctx.accounts.ephemeral_vault.to_account_info();
        let magic_program = ctx.accounts.magic_program.to_account_info();

        game.player1_choice = player1_choice.choice;
        game.player2_choice = player2_choice.choice;

        game.player1.ok_or(GameError::MissingOpponent)?;
        game.player2.ok_or(GameError::MissingOpponent)?;

        let move1 = game.player1_choice.ok_or(GameError::MissingChoice)?;
        let move2 = game.player2_choice.ok_or(GameError::MissingChoice)?;

        // Simultaneous resolution against the same starting map.
        let kits = game.resolve(move1, move2);
        game.roll_event(move1, move2); // next round's world event
        player1_choice.spy_charges = player1_choice.spy_charges.saturating_add(kits.0);
        player2_choice.spy_charges = player2_choice.spy_charges.saturating_add(kits.1);
        game.round_result = RoundResult::Resolved;
        msg!(
            "Round {} resolved. Territories: {} vs {}",
            game.round,
            game.player1_wins,
            game.player2_wins
        );

        let public_args = || EphemeralMembersArgs {
            is_private: false,
            members: vec![],
        };

        UpdateEphemeralPermissionCpi {
            payer: game.to_account_info(),
            permissioned_account: game.to_account_info(),
            permission: permission_game,
            vault: ephemeral_vault.clone(),
            magic_program: magic_program.clone(),
            permission_program: permission_program.clone(),
            authority: game.to_account_info(),
            authority_is_signer: false,
            args: public_args(),
        }
        .invoke_signed(&[&[GAME_SEED, &game.game_id.to_le_bytes(), &[ctx.bumps.game]]])?;

        UpdateEphemeralPermissionCpi {
            payer: player1_choice.to_account_info(),
            permissioned_account: player1_choice.to_account_info(),
            permission: permission1,
            vault: ephemeral_vault.clone(),
            magic_program: magic_program.clone(),
            permission_program: permission_program.clone(),
            authority: player1_choice.to_account_info(),
            authority_is_signer: false,
            args: public_args(),
        }
        .invoke_signed(&[&[
            PLAYER_CHOICE_SEED,
            &player1_choice.game_id.to_le_bytes(),
            player1_choice.player.as_ref(),
            &[ctx.bumps.player1_choice],
        ]])?;

        UpdateEphemeralPermissionCpi {
            payer: player2_choice.to_account_info(),
            permissioned_account: player2_choice.to_account_info(),
            permission: permission2,
            vault: ephemeral_vault.clone(),
            magic_program: magic_program.clone(),
            permission_program: permission_program.clone(),
            authority: player2_choice.to_account_info(),
            authority_is_signer: false,
            args: public_args(),
        }
        .invoke_signed(&[&[
            PLAYER_CHOICE_SEED,
            &player2_choice.game_id.to_le_bytes(),
            player2_choice.player.as_ref(),
            &[ctx.bumps.player2_choice],
        ]])?;

        game.exit(&crate::ID)?;
        Ok(())
    }

    // 5) Next round: clear moves, flip permissions back to private.
    pub fn next_round(ctx: Context<NextRound>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let player1_choice = &mut ctx.accounts.player1_choice;
        let player2_choice = &mut ctx.accounts.player2_choice;
        let permission_program = ctx.accounts.permission_program.to_account_info();
        let permission_game = ctx.accounts.permission_game.to_account_info();
        let permission1 = ctx.accounts.permission1.to_account_info();
        let permission2 = ctx.accounts.permission2.to_account_info();
        let ephemeral_vault = ctx.accounts.ephemeral_vault.to_account_info();
        let magic_program = ctx.accounts.magic_program.to_account_info();

        require!(game.round_result != RoundResult::None, GameError::NotRevealed);

        let player1 = game.player1.ok_or(GameError::MissingOpponent)?;
        let player2 = game.player2.ok_or(GameError::MissingOpponent)?;
        let payer = ctx.accounts.payer.key();
        require!(payer == player1 || payer == player2, GameError::NotAPlayer);

        if game.is_match_decided() {
            // Rematch (free games only): fresh board, round 1.
            require!(game.stake == 0, GameError::MustClaimFirst);
            game.round = 1;
            game.init_board();
        } else {
            game.round += 1;
        }

        game.player1_choice = None;
        game.player2_choice = None;
        game.round_result = RoundResult::None;
        player1_choice.choice = None;
        player2_choice.choice = None;
        player1_choice.spied = None;
        player2_choice.spied = None;

        let member = |pubkey: Pubkey| Member {
            flags: AUTHORITY_FLAG | TX_LOGS_FLAG,
            pubkey,
        };
        let private_args = |members: Vec<Member>| EphemeralMembersArgs {
            is_private: true,
            members,
        };

        UpdateEphemeralPermissionCpi {
            payer: game.to_account_info(),
            permissioned_account: game.to_account_info(),
            permission: permission_game,
            vault: ephemeral_vault.clone(),
            magic_program: magic_program.clone(),
            permission_program: permission_program.clone(),
            authority: game.to_account_info(),
            authority_is_signer: false,
            args: private_args(vec![member(player1), member(player2)]),
        }
        .invoke_signed(&[&[GAME_SEED, &game.game_id.to_le_bytes(), &[ctx.bumps.game]]])?;

        UpdateEphemeralPermissionCpi {
            payer: player1_choice.to_account_info(),
            permissioned_account: player1_choice.to_account_info(),
            permission: permission1,
            vault: ephemeral_vault.clone(),
            magic_program: magic_program.clone(),
            permission_program: permission_program.clone(),
            authority: player1_choice.to_account_info(),
            authority_is_signer: false,
            args: private_args(vec![member(player1)]),
        }
        .invoke_signed(&[&[
            PLAYER_CHOICE_SEED,
            &player1_choice.game_id.to_le_bytes(),
            player1_choice.player.as_ref(),
            &[ctx.bumps.player1_choice],
        ]])?;

        UpdateEphemeralPermissionCpi {
            payer: player2_choice.to_account_info(),
            permissioned_account: player2_choice.to_account_info(),
            permission: permission2,
            vault: ephemeral_vault.clone(),
            magic_program: magic_program.clone(),
            permission_program: permission_program.clone(),
            authority: player2_choice.to_account_info(),
            authority_is_signer: false,
            args: private_args(vec![member(player2)]),
        }
        .invoke_signed(&[&[
            PLAYER_CHOICE_SEED,
            &player2_choice.game_id.to_le_bytes(),
            player2_choice.player.as_ref(),
            &[ctx.bumps.player2_choice],
        ]])?;

        msg!("Game {} advanced to round {}", game.game_id, game.round);
        Ok(())
    }

    // 🕵️ Espionage: copy the opponent's locked-in move into MY private account.
    // Only I can read my PlayerChoice, so only I learn it.
    pub fn spy(ctx: Context<Spy>) -> Result<()> {
        let game = &ctx.accounts.game;
        require!(game.round_result == RoundResult::None, GameError::RoundAlreadyRevealed);

        let me = ctx.accounts.player.key();
        let opp = ctx.accounts.opponent.key();
        let p1 = game.player1.ok_or(GameError::MissingOpponent)?;
        let p2 = game.player2.ok_or(GameError::MissingOpponent)?;
        require!(
            (me == p1 && opp == p2) || (me == p2 && opp == p1),
            GameError::NotAPlayer
        );

        let my_choice = &mut ctx.accounts.my_choice;
        let their_choice = &ctx.accounts.their_choice;
        require!(my_choice.spy_charges > 0, GameError::NoSpyCharges);
        let seen = their_choice.choice.ok_or(GameError::OpponentNotLocked)?;

        my_choice.spied = Some(seen);
        my_choice.spy_charges -= 1;
        msg!("A spy was sent!");
        Ok(())
    }

    // Commit + undelegate once the match is over (all rounds played).
    pub fn undelegate_all(ctx: Context<UndelegateAll>) -> Result<()> {
        require!(
            ctx.accounts.game.is_match_decided(),
            GameError::MatchNotDecided
        );
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[
            ctx.accounts.game.to_account_info(),
            ctx.accounts.player1_choice.to_account_info(),
            ctx.accounts.player2_choice.to_account_info(),
        ])
        .build_and_invoke()?;
        Ok(())
    }

    // 6) Settle. Most territories wins the pot; a tie refunds both stakes.
    pub fn claim_pot(ctx: Context<ClaimPot>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.is_match_decided(), GameError::MatchNotDecided);
        require!(!game.paid, GameError::AlreadyPaid);

        let player1 = game.player1.ok_or(GameError::MissingOpponent)?;
        let player2 = game.player2.ok_or(GameError::MissingOpponent)?;
        require!(
            ctx.accounts.player1.key() == player1,
            GameError::WrongPlayerAccount
        );
        require!(
            ctx.accounts.player2.key() == player2,
            GameError::WrongPlayerAccount
        );

        game.paid = true;

        if game.stake == 0 {
            return Ok(());
        }

        let game_id_bytes = game.game_id.to_le_bytes();
        let signer_seeds: &[&[&[u8]]] = &[&[VAULT_SEED, &game_id_bytes, &[ctx.bumps.vault]]];
        let p1 = ctx.accounts.player1.to_account_info();
        let p2 = ctx.accounts.player2.to_account_info();

        match game.match_winner() {
            Some(winner) => {
                let to = if winner == player1 { p1 } else { p2 };
                let pot = game.stake.checked_mul(2).ok_or(GameError::MathOverflow)?;
                pay_from_vault(
                    &ctx.accounts.vault,
                    &to,
                    pot,
                    &ctx.accounts.system_program,
                    signer_seeds,
                )?;
            }
            None => {
                pay_from_vault(
                    &ctx.accounts.vault,
                    &p1,
                    game.stake,
                    &ctx.accounts.system_program,
                    signer_seeds,
                )?;
                pay_from_vault(
                    &ctx.accounts.vault,
                    &p2,
                    game.stake,
                    &ctx.accounts.system_program,
                    signer_seeds,
                )?;
            }
        }

        Ok(())
    }

    pub fn cancel_game(ctx: Context<CancelGame>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let player1 = game.player1.ok_or(GameError::MissingOpponent)?;
        require!(
            ctx.accounts.player1.key() == player1,
            GameError::WrongPlayerAccount
        );
        require!(game.player2.is_none(), GameError::CannotCancelStarted);
        require!(!game.paid, GameError::AlreadyPaid);

        game.paid = true;

        if game.stake > 0 {
            let game_id_bytes = game.game_id.to_le_bytes();
            let signer_seeds: &[&[&[u8]]] = &[&[VAULT_SEED, &game_id_bytes, &[ctx.bumps.vault]]];
            pay_from_vault(
                &ctx.accounts.vault,
                &ctx.accounts.player1.to_account_info(),
                game.stake,
                &ctx.accounts.system_program,
                signer_seeds,
            )?;
        }
        msg!("Game {} cancelled, stake refunded to creator", game.game_id);
        Ok(())
    }

    pub fn delegate_pda(ctx: Context<DelegatePda>, account_type: AccountType) -> Result<()> {
        let seed_data = derive_seeds_from_account_type(&account_type);
        let seeds_refs: Vec<&[u8]> = seed_data.iter().map(|s| s.as_slice()).collect();

        let validator = ctx.accounts.validator.as_ref().map(|v| v.key());
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &seeds_refs,
            DelegateConfig {
                validator,
                ..Default::default()
            },
        )?;
        Ok(())
    }

    pub fn init_permission(
        ctx: Context<PermissionContextRps>,
        account_type: AccountType,
        members: Option<Vec<Member>>,
    ) -> Result<()> {
        if ctx.accounts.permission.lamports() > 0 {
            msg!("Permission already exists, skipping creation");
            return Ok(());
        }

        let seed_data = derive_seeds_from_account_type(&account_type);
        let (_, bump) = Pubkey::find_program_address(
            &seed_data.iter().map(|s| s.as_slice()).collect::<Vec<_>>(),
            &crate::ID,
        );
        let mut seeds = seed_data.clone();
        seeds.push(vec![bump]);
        let seed_refs: Vec<&[u8]> = seeds.iter().map(|s| s.as_slice()).collect();

        let (is_private, member_list) = match members {
            Some(m) => (true, m),
            None => (false, vec![]),
        };

        CreateEphemeralPermissionCpi {
            payer: ctx.accounts.permissioned_account.to_account_info(),
            permissioned_account: ctx.accounts.permissioned_account.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            args: EphemeralMembersArgs {
                is_private,
                members: member_list,
            },
        }
        .invoke_signed(&[seed_refs.as_slice()])?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CreateGame<'info> {
    #[account(
        init_if_needed,
        payer = player1,
        space = 8 + Game::LEN,
        seeds = [GAME_SEED, &game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,

    #[account(
        init_if_needed,
        payer = player1,
        space = 8 + PlayerChoice::LEN,
        seeds = [PLAYER_CHOICE_SEED, &game_id.to_le_bytes(), player1.key().as_ref()],
        bump
    )]
    pub player_choice: Account<'info, PlayerChoice>,

    /// CHECK: SOL escrow PDA, system-owned, holds the pot. Validated by seeds.
    #[account(mut, seeds = [VAULT_SEED, &game_id.to_le_bytes()], bump)]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub player1: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct JoinGame<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, &game_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,

    #[account(
        init_if_needed,
        payer = player,
        space = 8 + PlayerChoice::LEN,
        seeds = [PLAYER_CHOICE_SEED, &game_id.to_le_bytes(), player.key().as_ref()],
        bump
    )]
    pub player_choice: Account<'info, PlayerChoice>,

    /// CHECK: SOL escrow PDA, system-owned, holds the pot. Validated by seeds.
    #[account(mut, seeds = [VAULT_SEED, &game_id.to_le_bytes()], bump)]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct MakeChoice<'info> {
    #[account(
        mut,
        seeds = [PLAYER_CHOICE_SEED, &game_id.to_le_bytes(), player.key().as_ref()],
        bump
    )]
    pub player_choice: Account<'info, PlayerChoice>,

    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct RevealRound<'info> {
    #[account(mut, seeds = [GAME_SEED, &game.game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,

    #[account(
        mut,
        seeds = [PLAYER_CHOICE_SEED, &game.game_id.to_le_bytes(), game.player1.unwrap().as_ref()],
        bump
    )]
    pub player1_choice: Account<'info, PlayerChoice>,

    #[account(
        mut,
        seeds = [PLAYER_CHOICE_SEED, &game.game_id.to_le_bytes(), game.player2.unwrap().as_ref()],
        bump
    )]
    pub player2_choice: Account<'info, PlayerChoice>,
    /// CHECK: Checked by the permission program
    #[account(mut)]
    pub permission_game: UncheckedAccount<'info>,
    /// CHECK: Checked by the permission program
    #[account(mut)]
    pub permission1: UncheckedAccount<'info>,
    /// CHECK: Checked by the permission program
    #[account(mut)]
    pub permission2: UncheckedAccount<'info>,
    /// Anyone can trigger this
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: PERMISSION PROGRAM
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: verified by magic program
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: Magic Program
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct NextRound<'info> {
    #[account(mut, seeds = [GAME_SEED, &game.game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,

    #[account(
        mut,
        seeds = [PLAYER_CHOICE_SEED, &game.game_id.to_le_bytes(), game.player1.unwrap().as_ref()],
        bump
    )]
    pub player1_choice: Account<'info, PlayerChoice>,

    #[account(
        mut,
        seeds = [PLAYER_CHOICE_SEED, &game.game_id.to_le_bytes(), game.player2.unwrap().as_ref()],
        bump
    )]
    pub player2_choice: Account<'info, PlayerChoice>,
    /// CHECK: Checked by the permission program
    #[account(mut)]
    pub permission_game: UncheckedAccount<'info>,
    /// CHECK: Checked by the permission program
    #[account(mut)]
    pub permission1: UncheckedAccount<'info>,
    /// CHECK: Checked by the permission program
    #[account(mut)]
    pub permission2: UncheckedAccount<'info>,
    /// Must be one of the two players (checked in the handler)
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: PERMISSION PROGRAM
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: verified by magic program
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: Magic Program
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Spy<'info> {
    #[account(seeds = [GAME_SEED, &game.game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,
    #[account(
        mut,
        seeds = [PLAYER_CHOICE_SEED, &game.game_id.to_le_bytes(), player.key().as_ref()],
        bump
    )]
    pub my_choice: Account<'info, PlayerChoice>,
    #[account(
        seeds = [PLAYER_CHOICE_SEED, &game.game_id.to_le_bytes(), opponent.key().as_ref()],
        bump
    )]
    pub their_choice: Account<'info, PlayerChoice>,
    /// CHECK: the opponent's pubkey, validated against the game in the handler.
    pub opponent: UncheckedAccount<'info>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateAll<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [GAME_SEED, &game.game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,
    #[account(
        mut,
        seeds = [PLAYER_CHOICE_SEED, &game.game_id.to_le_bytes(), game.player1.unwrap().as_ref()],
        bump,
    )]
    pub player1_choice: Account<'info, PlayerChoice>,
    #[account(
        mut,
        seeds = [PLAYER_CHOICE_SEED, &game.game_id.to_le_bytes(), game.player2.unwrap().as_ref()],
        bump,
    )]
    pub player2_choice: Account<'info, PlayerChoice>,
}

#[derive(Accounts)]
pub struct ClaimPot<'info> {
    #[account(mut, seeds = [GAME_SEED, &game.game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,
    /// CHECK: SOL escrow PDA, system-owned. Validated by seeds.
    #[account(mut, seeds = [VAULT_SEED, &game.game_id.to_le_bytes()], bump)]
    pub vault: SystemAccount<'info>,
    /// CHECK: payout recipient, verified against game.player1 in the handler.
    #[account(mut)]
    pub player1: UncheckedAccount<'info>,
    /// CHECK: payout recipient, verified against game.player2 in the handler.
    #[account(mut)]
    pub player2: UncheckedAccount<'info>,
    /// Anyone can trigger the payout.
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelGame<'info> {
    #[account(mut, seeds = [GAME_SEED, &game.game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,
    /// CHECK: SOL escrow PDA, system-owned. Validated by seeds.
    #[account(mut, seeds = [VAULT_SEED, &game.game_id.to_le_bytes()], bump)]
    pub vault: SystemAccount<'info>,
    #[account(mut)]
    pub player1: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegatePda<'info> {
    /// CHECK: The PDA to delegate
    #[account(mut, del)]
    pub pda: UncheckedAccount<'info>,
    pub payer: Signer<'info>,
    /// CHECK: Checked by the delegate program
    pub validator: Option<UncheckedAccount<'info>>,
}

#[derive(Accounts)]
pub struct PermissionContextRps<'info> {
    /// CHECK: The delegated PDA whose access is being gated.
    #[account(mut)]
    pub permissioned_account: UncheckedAccount<'info>,
    /// CHECK: verified by permission program
    #[account(mut)]
    pub permission: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: PERMISSION PROGRAM
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: verified by magic program
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: Magic Program
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

#[account]
pub struct Game {
    pub game_id: u64,
    pub player1: Option<Pubkey>,
    pub player2: Option<Pubkey>,
    pub player1_choice: Option<Move>,
    pub player2_choice: Option<Move>,
    pub round_result: RoundResult, // None = round in progress, Resolved = revealed
    pub stake: u64,
    pub paid: bool,
    pub target_wins: u8,  // total rounds in the match
    pub player1_wins: u8, // player 1's territory count
    pub player2_wins: u8, // player 2's territory count
    pub round: u8,        // current round, 1-based
    pub owner: [u8; NUM_TERRITORIES],  // 0 = player 1, 1 = player 2, 255 = neutral
    pub shield: [u8; NUM_TERRITORIES], // rounds of protection left
    pub event_kind: u8,   // this round's world event
    pub event_target: u8, // earthquake target territory (255 = none)
    pub treasure: [u8; NUM_TERRITORIES], // hidden treasure type per territory (0 = none)
    pub banner: [u8; 2],  // War Banner ready for player 1 / player 2
}

impl Game {
    pub const LEN: usize = 8              // game_id
        + (32 + 1) * 2                    // player1, player2
        + (1 + 2) * 2                     // player1_choice, player2_choice (Option<Move>)
        + 1                               // round_result
        + 8                               // stake
        + 1                               // paid
        + 4                               // target_wins, player1_wins, player2_wins, round
        + NUM_TERRITORIES                 // owner
        + NUM_TERRITORIES                 // shield
        + 2                               // event_kind, event_target
        + NUM_TERRITORIES                 // treasure
        + 2;                              // banner

    /// Fresh map: player 1 owns 0-2, player 2 owns 3-5, the rest are neutral.
    pub fn init_board(&mut self) {
        self.owner = [NEUTRAL; NUM_TERRITORIES];
        for t in 0..3 {
            self.owner[t] = 0;
            self.owner[t + 3] = 1;
        }
        self.shield = [0; NUM_TERRITORIES];
        self.event_kind = EVENT_CALM;
        self.event_target = NEUTRAL;
        self.banner = [0; 2];
        // Hide 3 treasures on neutral territories 6-11 (pseudo-random from the game id).
        let mut tiles = [6usize, 7, 8, 9, 10, 11];
        let mut s = mix(self.game_id);
        for i in (1..6usize).rev() {
            s = mix(s);
            let j = (s % (i as u64 + 1)) as usize;
            tiles.swap(i, j);
        }
        self.treasure = [0; NUM_TERRITORIES];
        self.treasure[tiles[0]] = TREASURE_ARMOR;
        self.treasure[tiles[1]] = TREASURE_BANNER;
        self.treasure[tiles[2]] = TREASURE_SPYKIT;
        self.recount();
    }

    pub fn recount(&mut self) {
        let mut p1 = 0u8;
        let mut p2 = 0u8;
        for t in 0..NUM_TERRITORIES {
            if self.owner[t] == 0 {
                p1 += 1;
            } else if self.owner[t] == 1 {
                p2 += 1;
            }
        }
        self.player1_wins = p1;
        self.player2_wins = p2;
    }

    /// Both moves are read first, then applied together, so order never matters.
    /// Returns how many Spy Kits each player collected this round.
    pub fn resolve(&mut self, move1: Move, move2: Move) -> (u8, u8) {
        let moves = [move1, move2];
        let mut shield = self.shield;
        let mut attacked = [[false; 2]; NUM_TERRITORIES];
        let mut attacked_any = [false; 2];

        for p in 0..2usize {
            let m = moves[p];
            let t = m.target as usize;
            if t >= NUM_TERRITORIES {
                continue;
            }
            let mine = self.owner[t] == p as u8;
            match m.kind {
                // Storm: Defend does nothing this round.
                ActionKind::Defend if mine && self.event_kind != EVENT_STORM => {
                    shield[t] = shield[t].max(1)
                }
                ActionKind::Fortify if mine => shield[t] = shield[t].max(2),
                ActionKind::Attack if !mine => {
                    attacked[t][p] = true;
                    attacked_any[p] = true;
                }
                _ => {} // invalid move: does nothing
            }
        }

        // Earthquake: the marked territory crumbles to neutral unless protected.
        let mut new_owner = self.owner;
        if self.event_kind == EVENT_QUAKE {
            let q = self.event_target as usize;
            if q < NUM_TERRITORIES && shield[q] == 0 {
                new_owner[q] = NEUTRAL;
            }
        }

        let mut kits = [0u8; 2];
        let mut armor = [false; NUM_TERRITORIES];
        let mut gained_banner = [false; 2];

        for t in 0..NUM_TERRITORIES {
            let a0 = attacked[t][0];
            let a1 = attacked[t][1];
            if a0 && a1 {
                continue; // contested: nobody captures
            }
            let attacker = if a0 {
                0usize
            } else if a1 {
                1usize
            } else {
                continue;
            };
            // A War Banner breaks through any shield.
            if shield[t] > 0 && self.banner[attacker] == 0 {
                continue; // blocked
            }
            new_owner[t] = attacker as u8;
            match self.treasure[t] {
                TREASURE_ARMOR => armor[t] = true,
                TREASURE_BANNER => gained_banner[attacker] = true,
                TREASURE_SPYKIT => kits[attacker] += 1,
                _ => {}
            }
            self.treasure[t] = 0;
        }

        // Attacking spends a banner; newly found banners are ready for next round.
        for p in 0..2usize {
            if attacked_any[p] {
                self.banner[p] = 0;
            }
            if gained_banner[p] {
                self.banner[p] = 1;
            }
        }

        self.owner = new_owner;
        for t in 0..NUM_TERRITORIES {
            self.shield[t] = shield[t].saturating_sub(1);
            if armor[t] {
                self.shield[t] = 2;
            }
        }
        self.recount();
        (kits[0], kits[1])
    }

    /// Pick next round's world event from this round's (until now secret) moves.
    pub fn roll_event(&mut self, m1: Move, m2: Move) {
        let mut s = mix(self.game_id ^ ((self.round as u64) << 56));
        s = mix(s ^ (m1.target as u64) ^ ((m1.kind as u8 as u64) << 8));
        s = mix(s ^ ((m2.target as u64) << 16) ^ ((m2.kind as u8 as u64) << 24));
        self.event_target = NEUTRAL;
        match s % 5 {
            0 => self.event_kind = EVENT_CALM,
            1 | 2 => {
                // Earthquake: hits one territory somebody currently owns.
                let mut owned = [0u8; NUM_TERRITORIES];
                let mut n = 0usize;
                for t in 0..NUM_TERRITORIES {
                    if self.owner[t] != NEUTRAL {
                        owned[n] = t as u8;
                        n += 1;
                    }
                }
                if n == 0 {
                    self.event_kind = EVENT_CALM;
                } else {
                    self.event_kind = EVENT_QUAKE;
                    self.event_target = owned[((s >> 8) % (n as u64)) as usize];
                }
            }
            _ => self.event_kind = EVENT_STORM,
        }
    }

    /// Over once the last round has been revealed.
    pub fn is_match_decided(&self) -> bool {
        self.round_result != RoundResult::None && self.round >= self.target_wins
    }

    /// None while in progress, or on a tie.
    pub fn match_winner(&self) -> Option<Pubkey> {
        if !self.is_match_decided() {
            return None;
        }
        if self.player1_wins > self.player2_wins {
            self.player1
        } else if self.player2_wins > self.player1_wins {
            self.player2
        } else {
            None
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum RoundResult {
    Resolved,
    None,
}

#[account]
pub struct PlayerChoice {
    pub game_id: u64,
    pub player: Pubkey,
    pub choice: Option<Move>,
    pub spy_charges: u8,     // espionage uses left (private to the owner)
    pub spied: Option<Move>, // what my spy saw this round (private to the owner)
}
impl PlayerChoice {
    pub const LEN: usize = 8 + 8 + 32 + 3 + 1 + 3;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ActionKind {
    Attack,
    Defend,
    Fortify,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub struct Move {
    pub kind: ActionKind,
    pub target: u8,
}

#[error_code]
pub enum GameError {
    #[msg("You already made your choice.")]
    AlreadyChose,
    #[msg("You cannot join your own game.")]
    CannotJoinOwnGame,
    #[msg("Both players must make a choice first.")]
    MissingChoice,
    #[msg("Opponent not found.")]
    MissingOpponent,
    #[msg("Game is already full.")]
    GameFull,
    #[msg("The round has not been revealed yet.")]
    NotRevealed,
    #[msg("Only a player of this game can do this.")]
    NotAPlayer,
    #[msg("The pot has already been paid out.")]
    AlreadyPaid,
    #[msg("This game has already been settled.")]
    GameSettled,
    #[msg("Wrong player account for this game.")]
    WrongPlayerAccount,
    #[msg("Cannot cancel a game that already has two players.")]
    CannotCancelStarted,
    #[msg("Arithmetic overflow.")]
    MathOverflow,
    #[msg("The match is not decided yet.")]
    MatchNotDecided,
    #[msg("Settle and claim the pot before starting a new match.")]
    MustClaimFirst,
    #[msg("That territory does not exist.")]
    BadTarget,
    #[msg("Your opponent has not locked in a move yet.")]
    OpponentNotLocked,
    #[msg("You have no espionage left.")]
    NoSpyCharges,
    #[msg("This round has already been revealed.")]
    RoundAlreadyRevealed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum AccountType {
    Game { game_id: u64 },
    PlayerChoice { game_id: u64, player: Pubkey },
}

/// Small deterministic mixer (splitmix64) for events and treasure placement.
fn mix(mut x: u64) -> u64 {
    x = x.wrapping_add(0x9E37_79B9_7F4A_7C15);
    x = (x ^ (x >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    x = (x ^ (x >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    x ^ (x >> 31)
}

fn pay_from_vault<'info>(
    vault: &SystemAccount<'info>,
    to: &AccountInfo<'info>,
    amount: u64,
    system_program: &Program<'info, System>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    transfer(
        CpiContext::new_with_signer(
            system_program.key(),
            Transfer {
                from: vault.to_account_info(),
                to: to.clone(),
            },
            signer_seeds,
        ),
        amount,
    )
}

fn derive_seeds_from_account_type(account_type: &AccountType) -> Vec<Vec<u8>> {
    match account_type {
        AccountType::Game { game_id } => {
            vec![GAME_SEED.to_vec(), game_id.to_le_bytes().to_vec()]
        }
        AccountType::PlayerChoice { game_id, player } => {
            vec![
                PLAYER_CHOICE_SEED.to_vec(),
                game_id.to_le_bytes().to_vec(),
                player.to_bytes().to_vec(),
            ]
        }
    }
}
