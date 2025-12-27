/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🎰 GAME COMMAND - Blackjack & More (v1.0)
 * 
 *  STATE MACHINE:
 *  /game → Select Game Type → Blackjack → Bet Entry → Game Play → Resolution
 * 
 *  INTERACTION LIFECYCLE:
 *  - reply() for initial responses
 *  - deferUpdate() for button clicks to prevent timeout
 *  - update() to change embeds/buttons
 *  - All interactions are EPHEMERAL (user-only)
 * 
 *  BLACKJACK RULES:
 *  - Standard 52-card deck, shuffled per game
 *  - Dealer stands on soft 17
 *  - Blackjack pays 1.5x, Win pays 1x, Push returns bet
 *  - House edge ~3-5%
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../database/db');
const deck = require('../utils/games/deck');
const xpService = require('../utils/games/xpTransaction');
const sessionManager = require('../utils/games/sessionManager');

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    MIN_BET: 10,
    MAX_BET_PERCENT: 0.25,  // 25% of balance
    HARD_CAP: 1000,
    BLACKJACK_MULTIPLIER: 1.5,  // 3:2 payout
    WIN_MULTIPLIER: 1.0,
    COLORS: {
        game: 0x9B59B6,      // Purple
        win: 0x57F287,       // Green
        loss: 0xED4245,      // Red
        push: 0xFEE75C,      // Yellow
        blackjack: 0xF1C40F  // Gold
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SLASH COMMAND
// ═══════════════════════════════════════════════════════════════════════════════

const data = new SlashCommandBuilder()
    .setName('game')
    .setDescription('🎰 Play games to win XP!');

// ═══════════════════════════════════════════════════════════════════════════════
//  EMBEDS
// ═══════════════════════════════════════════════════════════════════════════════

function gameSelectEmbed(userXP) {
    return new EmbedBuilder()
        .setColor(CONFIG.COLORS.game)
        .setTitle('🎰 Game Center')
        .setDescription(`💰 **Your XP:** ${userXP}\n\nSelect a game to play:`)
        .addFields(
            { name: '🃏 Blackjack', value: 'Beat the dealer to 21!', inline: true },
            { name: '✊ Rock Paper Scissors', value: 'Win XP risk-free!', inline: true },
            { name: '📝 Hangman', value: 'Guess words, earn XP!', inline: true }
        )
        .setFooter({ text: 'All games are ephemeral (only you can see)' });
}

function betEntryEmbed(userXP, minBet, maxBet) {
    return new EmbedBuilder()
        .setColor(CONFIG.COLORS.game)
        .setTitle('🃏 Blackjack - Place Your Bet')
        .setDescription(`💰 **Your XP:** ${userXP}`)
        .addFields(
            { name: '📊 Bet Range', value: `Min: **${minBet}** XP\nMax: **${maxBet}** XP`, inline: true },
            { name: '💰 Payouts', value: `Blackjack: **1.5x**\nWin: **1x**\nPush: **0**`, inline: true }
        )
        .setFooter({ text: 'Click a button or enter custom amount' });
}

function blackjackGameEmbed(session, hideDealer = true) {
    const playerValue = deck.calculateHandValue(session.player_hand);
    const dealerValue = hideDealer 
        ? deck.calculateHandValue([session.dealer_hand[0]]) 
        : deck.calculateHandValue(session.dealer_hand);
    
    const embed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.game)
        .setTitle('🃏 Blackjack')
        .setDescription(`💰 **Bet:** ${session.bet_amount} XP`)
        .addFields(
            { 
                name: `🎴 Your Hand (${playerValue.value}${playerValue.soft ? ' soft' : ''})`, 
                value: deck.formatHand(session.player_hand), 
                inline: false 
            },
            { 
                name: `🎴 Dealer ${hideDealer ? `(${dealerValue.value}+?)` : `(${dealerValue.value})`}`, 
                value: hideDealer ? deck.formatHand(session.dealer_hand, true) : deck.formatHand(session.dealer_hand), 
                inline: false 
            }
        );
    
    if (playerValue.bust) {
        embed.addFields({ name: '💥 BUST!', value: 'You went over 21!', inline: false });
    }
    
    return embed;
}

function blackjackResultEmbed(session, outcome, payout, newBalance) {
    const playerValue = deck.calculateHandValue(session.player_hand);
    const dealerValue = deck.calculateHandValue(session.dealer_hand);
    
    const colors = {
        blackjack: CONFIG.COLORS.blackjack,
        win: CONFIG.COLORS.win,
        loss: CONFIG.COLORS.loss,
        push: CONFIG.COLORS.push
    };
    
    const titles = {
        blackjack: '🎉 BLACKJACK!',
        win: '✅ YOU WIN!',
        loss: '❌ YOU LOSE',
        push: '🤝 PUSH'
    };
    
    const payoutText = {
        blackjack: `+${payout} XP (1.5x)`,
        win: `+${payout} XP`,
        loss: `-${session.bet_amount} XP`,
        push: `±0 XP (bet returned)`
    };
    
    return new EmbedBuilder()
        .setColor(colors[outcome])
        .setTitle(titles[outcome])
        .setDescription(`💰 **New Balance:** ${newBalance} XP`)
        .addFields(
            { name: `🎴 Your Hand (${playerValue.value})`, value: deck.formatHand(session.player_hand), inline: true },
            { name: `🎴 Dealer (${dealerValue.value})`, value: deck.formatHand(session.dealer_hand), inline: true },
            { name: '💵 Result', value: payoutText[outcome], inline: false }
        )
        .setFooter({ text: 'Thanks for playing! Use /game to play again.' });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BUTTONS & COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function gameSelectMenu() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('game_select')
            .setPlaceholder('Choose a game...')
            .addOptions([
                { label: 'Blackjack', value: 'blackjack', emoji: '🃏', description: 'Beat the dealer to 21!' },
                { label: 'Rock Paper Scissors', value: 'rps', emoji: '✊', description: 'Win XP, no loss on defeat!' },
                { label: 'Hangman', value: 'hangman', emoji: '📝', description: 'Guess the word, earn XP!' }
            ])
    );
}

function betButtons(maxBet) {
    const quickBets = [10, 25, 50, 100, 250].filter(b => b <= maxBet);
    
    const buttons = quickBets.map(bet => 
        new ButtonBuilder()
            .setCustomId(`bj_bet_${bet}`)
            .setLabel(`${bet} XP`)
            .setStyle(ButtonStyle.Primary)
    );
    
    buttons.push(
        new ButtonBuilder()
            .setCustomId('bj_bet_custom')
            .setLabel('Custom')
            .setEmoji('✏️')
            .setStyle(ButtonStyle.Secondary)
    );
    
    buttons.push(
        new ButtonBuilder()
            .setCustomId('bj_bet_max')
            .setLabel('MAX')
            .setStyle(ButtonStyle.Danger)
    );
    
    // Split into rows of 5
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }
    
    return rows;
}

function blackjackButtons(canDouble = false, canSurrender = false) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('bj_hit')
            .setLabel('Hit')
            .setEmoji('🃏')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('bj_stand')
            .setLabel('Stand')
            .setEmoji('✋')
            .setStyle(ButtonStyle.Success)
    );
    
    if (canDouble) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('bj_double')
                .setLabel('Double Down')
                .setEmoji('💰')
                .setStyle(ButtonStyle.Danger)
        );
    }
    
    return [row];
}

function playAgainButtons() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('bj_playagain')
            .setLabel('Play Again')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('game_back')
            .setLabel('Back to Games')
            .setStyle(ButtonStyle.Secondary)
    )];
}

function betModal() {
    return new ModalBuilder()
        .setCustomId('bj_bet_modal')
        .setTitle('Enter Bet Amount')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('bet_amount')
                    .setLabel('Bet Amount (XP)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('Enter a number')
                    .setMinLength(1)
                    .setMaxLength(10)
            )
        );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN EXECUTE
// ═══════════════════════════════════════════════════════════════════════════════

async function execute(interaction) {
    const userId = interaction.user.id;
    await db.getOrCreateUser(userId);
    
    // Check for active session
    const activeSession = await sessionManager.getActiveSession(userId, 'blackjack');
    if (activeSession) {
        // Resume active game
        const canDouble = activeSession.player_hand.length === 2;
        return interaction.reply({
            embeds: [blackjackGameEmbed(activeSession)],
            components: blackjackButtons(canDouble),
            flags: MessageFlags.Ephemeral
        });
    }
    
    const balance = await xpService.getBalance(userId);
    
    // WHY: reply() is used for initial command response
    // This starts the interaction lifecycle
    await interaction.reply({
        embeds: [gameSelectEmbed(balance)],
        components: [gameSelectMenu()],
        flags: MessageFlags.Ephemeral  // User-only, no public spam
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BUTTON HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

async function handleButton(interaction) {
    const userId = interaction.user.id;
    const customId = interaction.customId;
    
    // WHY: deferUpdate() acknowledges the button click immediately
    // This prevents "interaction failed" errors on slow operations
    // We use deferUpdate (not deferReply) because we're updating an existing message
    await interaction.deferUpdate();
    
    // ═══════════════════════════════════════════════════════════════════════════
    //  BET BUTTONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (customId.startsWith('bj_bet_')) {
        const betType = customId.replace('bj_bet_', '');
        
        // Custom bet modal
        if (betType === 'custom') {
            // WHY: Can't show modal after deferUpdate, need to use followUp
            // Actually, we need to NOT defer for modals - let's handle this differently
            return;  // Handled separately in handleButtonNoDefer
        }
        
        // Calculate bet amount
        const balance = await xpService.getBalance(userId);
        const maxBet = await xpService.getMaxBet(userId, CONFIG.MAX_BET_PERCENT, CONFIG.HARD_CAP);
        
        let betAmount;
        if (betType === 'max') {
            betAmount = maxBet;
        } else {
            betAmount = parseInt(betType);
        }
        
        // Validate bet
        const validation = await xpService.canAffordBet(userId, betAmount, CONFIG.MIN_BET, CONFIG.MAX_BET_PERCENT, CONFIG.HARD_CAP);
        if (!validation.canAfford) {
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(CONFIG.COLORS.loss)
                    .setTitle('❌ Invalid Bet')
                    .setDescription(`You can't afford this bet!\n\n💰 Balance: ${validation.balance} XP\n📊 Max Bet: ${validation.maxBet} XP`)
                ],
                components: betButtons(validation.maxBet)
            });
        }
        
        // Start the game!
        return startBlackjackGame(interaction, userId, betAmount);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    //  GAME ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (customId === 'bj_hit') {
        return handleHit(interaction, userId);
    }
    
    if (customId === 'bj_stand') {
        return handleStand(interaction, userId);
    }
    
    if (customId === 'bj_double') {
        return handleDouble(interaction, userId);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    //  NAVIGATION
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (customId === 'bj_playagain') {
        const balance = await xpService.getBalance(userId);
        const maxBet = await xpService.getMaxBet(userId, CONFIG.MAX_BET_PERCENT, CONFIG.HARD_CAP);
        
        if (balance < CONFIG.MIN_BET) {
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(CONFIG.COLORS.loss)
                    .setTitle('❌ Not Enough XP')
                    .setDescription(`You need at least **${CONFIG.MIN_BET} XP** to play!\n\n💰 Balance: ${balance} XP`)
                ],
                components: []
            });
        }
        
        return interaction.editReply({
            embeds: [betEntryEmbed(balance, CONFIG.MIN_BET, maxBet)],
            components: betButtons(maxBet)
        });
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    //  RPS BUTTONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (customId.startsWith('rps_')) {
        const choice = customId.replace('rps_', '');
        if (['rock', 'paper', 'scissors'].includes(choice)) {
            return handleRPS(interaction, choice);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    //  HANGMAN BUTTONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (customId.startsWith('hm_')) {
        const action = customId.replace('hm_', '');
        
        if (action === 'playagain') {
            return startHangman(interaction);
        }
        
        if (action === 'quit') {
            const userId = interaction.user.id;
            hangmanGames.delete(userId);
            const balance = await xpService.getBalance(userId);
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(CONFIG.COLORS.push)
                    .setTitle('🚪 Game Quit')
                    .setDescription('You quit the Hangman game.')
                ],
                components: [gameSelectMenu()]
            });
        }
        
        // Ignore disabled show buttons (they're just for display)
        if (action.startsWith('show_')) {
            return;
        }
    }
    
    if (customId === 'game_back') {
        const balance = await xpService.getBalance(userId);
        return interaction.editReply({
            embeds: [gameSelectEmbed(balance)],
            components: [gameSelectMenu()]
        });
    }
}

/**
 * Handle buttons that need modals (can't defer first)
 */
async function handleButtonNoDefer(interaction) {
    const customId = interaction.customId;
    
    if (customId === 'bj_bet_custom') {
        // WHY: showModal() must be called without deferring first
        // Modals require immediate response
        return interaction.showModal(betModal());
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SELECT MENU HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

async function handleSelectMenu(interaction) {
    const userId = interaction.user.id;
    const selected = interaction.values[0];
    
    // WHY: deferUpdate() for select menus to acknowledge selection
    await interaction.deferUpdate();
    
    if (selected === 'blackjack') {
        // Check if can afford
        const balance = await xpService.getBalance(userId);
        const maxBet = await xpService.getMaxBet(userId, CONFIG.MAX_BET_PERCENT, CONFIG.HARD_CAP);
        
        if (balance < CONFIG.MIN_BET) {
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(CONFIG.COLORS.loss)
                    .setTitle('❌ Not Enough XP')
                    .setDescription(`You need at least **${CONFIG.MIN_BET} XP** to play Blackjack!\n\n💰 Balance: ${balance} XP\n\nComplete tasks to earn XP!`)
                ],
                components: [gameSelectMenu()]
            });
        }
        
        // Check for active session
        if (await sessionManager.hasActiveSession(userId, 'blackjack')) {
            const session = await sessionManager.getActiveSession(userId, 'blackjack');
            const canDouble = session.player_hand.length === 2;
            return interaction.editReply({
                embeds: [blackjackGameEmbed(session)],
                components: blackjackButtons(canDouble)
            });
        }
        
        return interaction.editReply({
            embeds: [betEntryEmbed(balance, CONFIG.MIN_BET, maxBet)],
            components: betButtons(maxBet)
        });
    }
    
    // Rock Paper Scissors
    if (selected === 'rps') {
        return interaction.editReply({
            embeds: [rpsEmbed()],
            components: rpsButtons()
        });
    }
    
    // Hangman
    if (selected === 'hangman') {
        return startHangman(interaction);
    }
    
    // Other games - coming soon
    return interaction.editReply({
        embeds: [new EmbedBuilder()
            .setColor(CONFIG.COLORS.push)
            .setTitle('🚧 Coming Soon!')
            .setDescription('This game is still in development.')
        ],
        components: [gameSelectMenu()]
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MODAL HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

async function handleModal(interaction) {
    const userId = interaction.user.id;
    const customId = interaction.customId;
    
    if (customId === 'bj_bet_modal') {
        const betInput = interaction.fields.getTextInputValue('bet_amount');
        const betAmount = parseInt(betInput);
        
        if (isNaN(betAmount) || betAmount <= 0) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(CONFIG.COLORS.loss)
                    .setTitle('❌ Invalid Bet')
                    .setDescription('Please enter a valid number!')
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Validate bet
        const validation = await xpService.canAffordBet(userId, betAmount, CONFIG.MIN_BET, CONFIG.MAX_BET_PERCENT, CONFIG.HARD_CAP);
        if (!validation.canAfford) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(CONFIG.COLORS.loss)
                    .setTitle('❌ Invalid Bet')
                    .setDescription(`Bet must be between **${validation.minBet}** and **${validation.maxBet}** XP!\n\n💰 Balance: ${validation.balance} XP`)
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        
        // WHY: For modal submissions, we use reply() + editReply() pattern
        // because we're starting a new message flow
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return startBlackjackGame(interaction, userId, betAmount, true);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BLACKJACK GAME LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

async function startBlackjackGame(interaction, userId, betAmount, isModalResponse = false) {
    // Deduct bet (escrow)
    const betResult = await xpService.processXPTransaction(userId, -betAmount, 'blackjack_loss', null);
    if (!betResult.success) {
        const method = isModalResponse ? 'editReply' : 'editReply';
        return interaction[method]({
            embeds: [new EmbedBuilder()
                .setColor(CONFIG.COLORS.loss)
                .setTitle('❌ Transaction Failed')
                .setDescription(betResult.error || 'Could not process bet')
            ],
            components: []
        });
    }
    
    // Create session
    const sessionResult = await sessionManager.createSession(userId, 'blackjack', betAmount);
    if (!sessionResult.success) {
        // Refund bet
        await xpService.processXPTransaction(userId, betAmount, 'blackjack_push', null);
        
        return interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(CONFIG.COLORS.loss)
                .setTitle('❌ Game Error')
                .setDescription(sessionResult.error)
            ],
            components: []
        });
    }
    
    // Deal cards
    const newDeck = deck.shuffleDeck(deck.createDeck());
    const dealt = deck.dealInitialHands(newDeck);
    
    // Store initial game state
    await sessionManager.createBlackjackHand(
        sessionResult.sessionId,
        dealt.playerHand,
        dealt.dealerHand,
        dealt.deck
    );
    
    // Update transaction with session reference
    // (Note: In production, you'd want to do this atomically)
    
    // Build session object for display
    const session = {
        id: sessionResult.sessionId,
        bet_amount: betAmount,
        player_hand: dealt.playerHand,
        dealer_hand: dealt.dealerHand,
        deck_state: dealt.deck
    };
    
    // Check for immediate blackjack
    const playerBJ = deck.isBlackjack(dealt.playerHand);
    const dealerBJ = deck.isBlackjack(dealt.dealerHand);
    
    if (playerBJ || dealerBJ) {
        // Immediate resolution
        return resolveGame(interaction, session, userId);
    }
    
    // Normal game - show buttons
    const canDouble = betResult.balanceAfter >= betAmount; // Can afford to double
    
    return interaction.editReply({
        embeds: [blackjackGameEmbed(session)],
        components: blackjackButtons(canDouble)
    });
}

async function handleHit(interaction, userId) {
    const session = await sessionManager.getActiveSession(userId, 'blackjack');
    if (!session) {
        return interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(CONFIG.COLORS.loss)
                .setTitle('❌ No Active Game')
                .setDescription('Start a new game with /game')
            ],
            components: []
        });
    }
    
    // Draw a card
    const { drawn, deck: newDeck } = deck.drawCards(session.deck_state, 1);
    session.player_hand.push(drawn[0]);
    session.deck_state = newDeck;
    
    // Update DB
    await sessionManager.updateBlackjackHand(
        session.id,
        session.player_hand,
        session.dealer_hand,
        session.deck_state,
        'hit'
    );
    
    // Check for bust
    const playerValue = deck.calculateHandValue(session.player_hand);
    if (playerValue.bust) {
        return resolveGame(interaction, session, userId);
    }
    
    // Continue game (can't double after hit)
    return interaction.editReply({
        embeds: [blackjackGameEmbed(session)],
        components: blackjackButtons(false)
    });
}

async function handleStand(interaction, userId) {
    const session = await sessionManager.getActiveSession(userId, 'blackjack');
    if (!session) {
        return interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(CONFIG.COLORS.loss)
                .setTitle('❌ No Active Game')
                .setDescription('Start a new game with /game')
            ],
            components: []
        });
    }
    
    // Dealer plays
    const { hand: finalDealerHand, deck: finalDeck } = deck.dealerPlay(session.dealer_hand, session.deck_state);
    session.dealer_hand = finalDealerHand;
    session.deck_state = finalDeck;
    
    // Update DB
    await sessionManager.updateBlackjackHand(
        session.id,
        session.player_hand,
        session.dealer_hand,
        session.deck_state,
        'stand'
    );
    
    return resolveGame(interaction, session, userId);
}

async function handleDouble(interaction, userId) {
    const session = await sessionManager.getActiveSession(userId, 'blackjack');
    if (!session) {
        return interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(CONFIG.COLORS.loss)
                .setTitle('❌ No Active Game')
                .setDescription('Start a new game with /game')
            ],
            components: []
        });
    }
    
    // Can only double on first two cards
    if (session.player_hand.length !== 2) {
        return interaction.editReply({
            embeds: [blackjackGameEmbed(session)],
            components: blackjackButtons(false)
        });
    }
    
    // Deduct additional bet
    const doubleResult = await xpService.processXPTransaction(userId, -session.bet_amount, 'blackjack_loss', session.id);
    if (!doubleResult.success) {
        return interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(CONFIG.COLORS.loss)
                .setTitle('❌ Cannot Double')
                .setDescription('Not enough XP to double down!')
            ],
            components: blackjackButtons(false)
        });
    }
    
    // Update bet amount in session (conceptually - we track via transactions)
    // Note: The bet_amount in DB stays the same, but we'll calculate payout based on doubled bet
    
    // Draw exactly one card
    const { drawn, deck: newDeck } = deck.drawCards(session.deck_state, 1);
    session.player_hand.push(drawn[0]);
    session.deck_state = newDeck;
    
    // Update DB - mark as doubled
    await sessionManager.updateBlackjackHand(
        session.id,
        session.player_hand,
        session.dealer_hand,
        session.deck_state,
        'double'
    );
    
    // Check for bust
    const playerValue = deck.calculateHandValue(session.player_hand);
    if (playerValue.bust) {
        // Double loss already deducted, just end game
        session.bet_amount *= 2; // For display purposes
        return resolveGame(interaction, session, userId, true);
    }
    
    // Dealer plays
    const { hand: finalDealerHand, deck: finalDeck } = deck.dealerPlay(session.dealer_hand, session.deck_state);
    session.dealer_hand = finalDealerHand;
    session.deck_state = finalDeck;
    session.bet_amount *= 2; // For display and payout purposes
    
    return resolveGame(interaction, session, userId, true);
}

async function resolveGame(interaction, session, userId, isDoubled = false) {
    const outcome = deck.determineOutcome(session.player_hand, session.dealer_hand);
    
    // Calculate payout
    let payout = 0;
    let xpSource = 'blackjack_loss';
    
    // Note: Bet was already deducted at game start
    // For doubled games, additional bet was deducted during double
    const totalBet = session.bet_amount;
    
    switch (outcome) {
        case 'blackjack':
            // Return bet + 1.5x profit
            payout = Math.floor(totalBet + totalBet * CONFIG.BLACKJACK_MULTIPLIER);
            xpSource = 'blackjack_blackjack';
            break;
        case 'win':
            // Return bet + 1x profit
            payout = totalBet + totalBet * CONFIG.WIN_MULTIPLIER;
            xpSource = 'blackjack_win';
            break;
        case 'push':
            // Return bet only
            payout = totalBet;
            xpSource = 'blackjack_push';
            break;
        case 'loss':
            // Bet already deducted, no payout
            payout = 0;
            xpSource = 'blackjack_loss';
            break;
    }
    
    // Process payout
    if (payout > 0) {
        await xpService.processXPTransaction(userId, payout, xpSource, session.id);
    }
    
    // End session
    await sessionManager.endSession(session.id, outcome, payout);
    
    // Get new balance
    const newBalance = await xpService.getBalance(userId);
    
    // Calculate net change for display
    const netChange = outcome === 'loss' ? 0 : payout - totalBet;
    
    return interaction.editReply({
        embeds: [blackjackResultEmbed(session, outcome, netChange, newBalance)],
        components: playAgainButtons()
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ✊ ROCK PAPER SCISSORS
//  - Button-based UI
//  - Player vs Bot
//  - Win: +15 XP | Lose: 0 XP | Tie: 0 XP
//  - Ephemeral result message
// ═══════════════════════════════════════════════════════════════════════════════

const RPS_REWARD = 15;
const RPS_CHOICES = ['rock', 'paper', 'scissors'];
const RPS_EMOJI = { rock: '🪨', paper: '📄', scissors: '✂️' };
const RPS_BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

function rpsEmbed() {
    return new EmbedBuilder()
        .setColor(CONFIG.COLORS.game)
        .setTitle('✊ Rock Paper Scissors')
        .setDescription('Choose your move!\n\n🏆 **Win:** +15 XP\n❌ **Lose:** 0 XP\n🤝 **Tie:** 0 XP')
        .setFooter({ text: 'No XP loss - risk free!' });
}

function rpsButtons() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rps_rock').setLabel('Rock').setEmoji('🪨').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('rps_paper').setLabel('Paper').setEmoji('📄').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('rps_scissors').setLabel('Scissors').setEmoji('✂️').setStyle(ButtonStyle.Primary)
    )];
}

function rpsResultEmbed(playerChoice, botChoice, outcome, xpGained, newBalance) {
    const colors = { win: CONFIG.COLORS.win, loss: CONFIG.COLORS.loss, tie: CONFIG.COLORS.push };
    const titles = { win: '🎉 You Win!', loss: '😢 You Lose!', tie: '🤝 It\'s a Tie!' };
    
    return new EmbedBuilder()
        .setColor(colors[outcome])
        .setTitle(titles[outcome])
        .setDescription(`You chose ${RPS_EMOJI[playerChoice]} **${playerChoice.toUpperCase()}**\nBot chose ${RPS_EMOJI[botChoice]} **${botChoice.toUpperCase()}**`)
        .addFields(
            { name: '💰 XP', value: outcome === 'win' ? `+${xpGained} XP` : '±0 XP', inline: true },
            { name: '💵 Balance', value: `${newBalance} XP`, inline: true }
        )
        .setFooter({ text: 'Play again? Click a button!' });
}

async function handleRPS(interaction, playerChoice) {
    const userId = interaction.user.id;
    
    // Bot makes random choice
    const botChoice = RPS_CHOICES[Math.floor(Math.random() * 3)];
    
    // Determine outcome
    let outcome;
    let gameState;
    if (playerChoice === botChoice) {
        outcome = 'tie';
        gameState = 'push';
    } else if (RPS_BEATS[playerChoice] === botChoice) {
        outcome = 'win';
        gameState = 'won';
    } else {
        outcome = 'loss';
        gameState = 'lost';
    }
    
    // Award XP on win only (no loss on defeat as per spec)
    let xpGained = 0;
    if (outcome === 'win') {
        xpGained = RPS_REWARD;
        await xpService.processXPTransaction(userId, RPS_REWARD, 'game_reward', null);
    }
    
    // Record game result for stats tracking
    await db.recordGameResult(userId, 'rps', gameState, xpGained);
    
    const newBalance = await xpService.getBalance(userId);
    
    // Show result with play again buttons
    await interaction.editReply({
        embeds: [rpsResultEmbed(playerChoice, botChoice, outcome, xpGained, newBalance)],
        components: [...rpsButtons(), new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('game_back').setLabel('Back to Games').setStyle(ButtonStyle.Secondary)
        )]
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  📝 HANGMAN
//  - Word guessing game
//  - XP reward based on remaining lives
//  - Button-based letter selection
//  - Ephemeral, timeout-safe
// ═══════════════════════════════════════════════════════════════════════════════

const HANGMAN_WORDS = [
    // Simple common words for Hangman
    'APPLE', 'TABLE', 'CHAIR', 'PHONE', 'RIVER',
    'HOUSE', 'LIGHT', 'TRAIN', 'WATER', 'BREAD',
    'PAPER', 'MUSIC', 'HAPPY', 'DREAM', 'SMILE',
    'BEACH', 'CLOUD', 'DANCE', 'MONEY', 'CLOCK',
    'EARTH', 'FLOWER', 'GRASS', 'HORSE', 'JUICE',
    'CANDY', 'PIZZA', 'TIGER', 'WHALE', 'ZEBRA',
    'NIGHT', 'PIANO', 'STORM', 'QUEEN', 'MAGIC'
];

const HANGMAN_STAGES = [
    '```\n  +---+\n      |\n      |\n      |\n      |\n=========```',
    '```\n  +---+\n  O   |\n      |\n      |\n      |\n=========```',
    '```\n  +---+\n  O   |\n  |   |\n      |\n      |\n=========```',
    '```\n  +---+\n  O   |\n /|   |\n      |\n      |\n=========```',
    '```\n  +---+\n  O   |\n /|\\  |\n      |\n      |\n=========```',
    '```\n  +---+\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
    '```\n  +---+\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```'
];

const hangmanGames = new Map();

function getHangmanReward(livesRemaining) {
    // More lives = more XP
    return Math.max(10, livesRemaining * 10);
}

function hangmanEmbed(game) {
    const displayWord = game.word.split('').map(c => game.guessed.has(c) ? c : '＿').join(' ');
    const wrongGuesses = [...game.guessed].filter(c => !game.word.includes(c));
    
    const embed = new EmbedBuilder()
        .setColor(game.lives > 3 ? CONFIG.COLORS.game : game.lives > 1 ? CONFIG.COLORS.push : CONFIG.COLORS.loss)
        .setTitle('📝 Hangman')
        .setDescription(`${HANGMAN_STAGES[6 - game.lives]}\n\n**Word:** \`${displayWord}\``)
        .addFields(
            { name: '❤️ Lives', value: '❤️'.repeat(game.lives) + '🖤'.repeat(6 - game.lives), inline: true },
            { name: '❌ Wrong', value: wrongGuesses.length ? wrongGuesses.join(', ') : '*None*', inline: true },
            { name: '🏆 Reward', value: `${getHangmanReward(game.lives)} XP`, inline: true }
        )
        .setFooter({ text: 'Click a letter to guess!' });
    
    return embed;
}

function hangmanWinEmbed(game, xpGained, newBalance) {
    return new EmbedBuilder()
        .setColor(CONFIG.COLORS.win)
        .setTitle('🎉 You Won!')
        .setDescription(`The word was: **${game.word}**`)
        .addFields(
            { name: '💰 XP Earned', value: `+${xpGained} XP`, inline: true },
            { name: '💵 Balance', value: `${newBalance} XP`, inline: true }
        )
        .setFooter({ text: 'Great job!' });
}

function hangmanLoseEmbed(game, newBalance) {
    return new EmbedBuilder()
        .setColor(CONFIG.COLORS.loss)
        .setTitle('💀 Game Over!')
        .setDescription(`${HANGMAN_STAGES[6]}\n\nThe word was: **${game.word}**`)
        .addFields(
            { name: '💰 XP Earned', value: '0 XP', inline: true },
            { name: '💵 Balance', value: `${newBalance} XP`, inline: true }
        )
        .setFooter({ text: 'Better luck next time!' });
}

// FIXED: Use select menu for letters (Discord limits buttons to 5 per row, 5 rows max)
function hangmanComponents(game) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    
    // Filter out already guessed letters
    const availableLetters = alphabet.filter(letter => !game.guessed.has(letter));
    
    if (availableLetters.length === 0) {
        // All letters guessed - show only back button
        return [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('game_back').setLabel('Back to Games').setStyle(ButtonStyle.Secondary)
        )];
    }
    
    // Create select menu options for available letters
    const options = availableLetters.map(letter => ({
        label: letter,
        value: `letter_${letter}`,
        description: `Guess the letter ${letter}`
    }));
    
    // Split into chunks of 25 (Discord select menu limit)
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('hm_letter_select')
        .setPlaceholder('🔤 Choose a letter to guess...')
        .addOptions(options.slice(0, 25)); // Max 25 options
    
    const components = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // Show guessed letters as a visual reference using buttons (max 5 per row)
    const guessedLetters = [...game.guessed];
    if (guessedLetters.length > 0) {
        // Show correct/wrong feedback for up to 10 recent guesses (2 rows of 5)
        const recentGuesses = guessedLetters.slice(-10);
        
        for (let i = 0; i < recentGuesses.length; i += 5) {
            const rowLetters = recentGuesses.slice(i, i + 5);
            if (rowLetters.length > 0) {
                const buttons = rowLetters.map(letter => {
                    const correct = game.word.includes(letter);
                    return new ButtonBuilder()
                        .setCustomId(`hm_show_${letter}_${Date.now()}`) // Unique ID to prevent duplicates
                        .setLabel(letter)
                        .setStyle(correct ? ButtonStyle.Success : ButtonStyle.Danger)
                        .setDisabled(true);
                });
                components.push(new ActionRowBuilder().addComponents(buttons));
            }
        }
    }
    
    // Add quit button
    components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('hm_quit').setLabel('Quit Game').setEmoji('🚪').setStyle(ButtonStyle.Danger)
    ));
    
    return components.slice(0, 5); // Max 5 action rows
}

function hangmanEndButtons() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('hm_playagain').setLabel('Play Again').setEmoji('🔄').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('game_back').setLabel('Back to Games').setStyle(ButtonStyle.Secondary)
    )];
}

async function startHangman(interaction) {
    const userId = interaction.user.id;
    
    try {
        // Pick random word
        const word = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
        
        const game = {
            word,
            guessed: new Set(),
            lives: 6
        };
        
        hangmanGames.set(userId, game);
        
        await interaction.editReply({
            embeds: [hangmanEmbed(game)],
            components: hangmanComponents(game)
        });
    } catch (error) {
        console.error('[HANGMAN START ERROR]', error);
        try {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(CONFIG.COLORS.loss)
                    .setTitle('Failed to Start')
                    .setDescription('Could not start Hangman. Please try again.')
                ],
                components: [gameSelectMenu()]
            });
        } catch (e) {
            // Interaction may have already been handled
        }
    }
}

async function handleHangmanGuess(interaction, letter) {
    const userId = interaction.user.id;
    const game = hangmanGames.get(userId);
    
    if (!game) {
        return interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(CONFIG.COLORS.loss)
                .setTitle('❌ Game Expired')
                .setDescription('Start a new game!')
            ],
            components: hangmanEndButtons()
        });
    }
    
    // Add guess
    game.guessed.add(letter);
    
    // Check if wrong guess
    if (!game.word.includes(letter)) {
        game.lives--;
    }
    
    // Check win condition
    const won = game.word.split('').every(c => game.guessed.has(c));
    
    // Check lose condition
    if (game.lives === 0) {
        hangmanGames.delete(userId);
        const newBalance = await xpService.getBalance(userId);
        
        // Record loss for stats
        await db.recordGameResult(userId, 'hangman', 'lost', 0);
        
        return interaction.editReply({
            embeds: [hangmanLoseEmbed(game, newBalance)],
            components: hangmanEndButtons()
        });
    }
    
    if (won) {
        const xpGained = getHangmanReward(game.lives);
        await xpService.processXPTransaction(userId, xpGained, 'game_reward', null);
        const newBalance = await xpService.getBalance(userId);
        hangmanGames.delete(userId);
        
        // Record win for stats
        await db.recordGameResult(userId, 'hangman', 'won', xpGained);
        
        return interaction.editReply({
            embeds: [hangmanWinEmbed(game, xpGained, newBalance)],
            components: hangmanEndButtons()
        });
    }
    
    // Continue game with updated components
    await interaction.editReply({
        embeds: [hangmanEmbed(game)],
        components: hangmanComponents(game)
    });
}

// Handle hangman letter select menu
async function handleHangmanSelect(interaction) {
    const userId = interaction.user.id;
    const selected = interaction.values[0]; // e.g., "letter_A"
    
    if (!selected || !selected.startsWith('letter_')) {
        await interaction.deferUpdate();
        return;
    }
    
    const letter = selected.replace('letter_', '');
    
    try {
        // Defer update first
        await interaction.deferUpdate();
        
        // Process the guess
        await handleHangmanGuess(interaction, letter);
    } catch (error) {
        console.error('[HANGMAN ERROR]', error);
        try {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(CONFIG.COLORS.loss)
                    .setTitle('Game Error')
                    .setDescription('Something went wrong. Please try again.')
                ],
                components: hangmanEndButtons()
            });
        } catch (e) {
            // Interaction may have already been handled
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    data,
    execute,
    handleButton,
    handleButtonNoDefer,
    handleSelectMenu,
    handleModal,
    startHangman,
    handleHangmanGuess,
    handleHangmanSelect,
    CONFIG
};
