const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getBalance } = require('../../utils/economyManager');

const gameSessions = new Map();
const blackjackGames = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casino')
    .setDescription('Play casino games and earn coins'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const balance = getBalance(userId);

    const embed = new EmbedBuilder()
      .setColor(0x1abc9c)
      .setTitle('🎰 YSER Casino')
      .setDescription('Select a game below to begin your gaming session.')
      .addFields(
        { name: '💰 Balance', value: '`' + balance + '` coins', inline: true },
        { name: '🎮 Active Game', value: '`None`', inline: true },
        { name: '📊 Last Result', value: '`Awaiting play...`', inline: true }
      )
      .setFooter({ text: 'YSER Flow Casino System | Responsible Gaming' })
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('casino_coinflip').setLabel('🪙 Coinflip').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('casino_blackjack').setLabel('🃏 Blackjack').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('casino_trading').setLabel('📈 Trading').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('casino_info').setLabel('ℹ️ Rules').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [buttons] });
  },
};

async function handleCasinoButton(interaction) {
  const userId = interaction.user.id;
  const customId = interaction.customId;

  if (customId === 'casino_info') {
    const infoEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('📜 Casino Rules')
      .addFields(
        { name: '🪙 Coinflip', value: '50% chance to win. Win = 2x your bet.', inline: false },
        { name: '🃏 Blackjack', value: 'Beat the dealer. Blackjack = 2.5x, Win = 2x, Push = 1x.', inline: false },
        { name: '📈 Trading', value: '1:1 (55%), 1:2 (40%), 1:3 (30%) risk/reward ratios.', inline: false },
        { name: '⚠️ Limits', value: 'Min: 50 coins | Max: 50,000 coins', inline: false }
      );
    await interaction.reply({ embeds: [infoEmbed], ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('casino_bet_' + customId.split('_')[1])
    .setTitle('Place Your Bet');

  const betInput = new TextInputBuilder()
    .setCustomId('bet_amount')
    .setLabel('Enter Bet Amount')
    .setPlaceholder('Min: 50 | Max: 50,000')
    .setStyle(TextInputStyle.Short);

  modal.addComponents(new ActionRowBuilder().addComponents(betInput));
  await interaction.showModal(modal);
}

async function handleCasinoModal(interaction) {
  const userId = interaction.user.id;
  const parts = interaction.customId.split('_');
  const game = parts[2];
  const betAmount = parseInt(interaction.fields.getTextInputValue('bet_amount'));

  if (isNaN(betAmount) || betAmount < 50 || betAmount > 50000) {
    return interaction.reply({ content: '❌ Invalid bet. Min: 50, Max: 50,000', ephemeral: true });
  }

  const { hasEnough } = require('../../utils/economyManager');
  if (!hasEnough(userId, betAmount)) {
    return interaction.reply({ content: '❌ Insufficient balance.', ephemeral: true });
  }

  gameSessions.set(userId, { game, bet: betAmount, stage: 'selection' });

  if (game === 'coinflip') {
    return handleCoinflipSelection(interaction, userId, betAmount);
  } else if (game === 'blackjack') {
    return handleBlackjackInit(interaction, userId, betAmount);
  } else if (game === 'trading') {
    return handleTradingSelection(interaction, userId, betAmount);
  }
}

async function handleCoinflipSelection(interaction, userId, bet) {
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('coinflip_heads_' + userId).setLabel('Heads').setStyle(ButtonStyle.Blurple),
    new ButtonBuilder().setCustomId('coinflip_tails_' + userId).setLabel('Tails').setStyle(ButtonStyle.Blurple)
  );

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle('🪙 Coinflip Game')
    .setDescription('Choose Heads or Tails!')
    .addFields(
      { name: '💰 Your Bet', value: '`' + bet + '` coins', inline: true },
      { name: '🎯 Win Multiplier', value: '`2x`', inline: true }
    )
    .setFooter({ text: 'Click your choice' });

  await interaction.reply({ embeds: [embed], components: [buttons] });
}

async function playCoinflipGame(interaction, userId, choice) {
  const session = gameSessions.get(userId);
  if (!session) return;

  const { playCoinflip } = require('../../utils/casinoEngine');
  const result = playCoinflip(userId, session.bet, choice);

  if (!result.success) {
    await interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    gameSessions.delete(userId);
    return;
  }

  const frames = ['🪙', '◐', '◓', '◑', '◒', '🪙'];
  let frameIndex = 0;

  const animEmbed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle('🪙 Flipping Coin...')
    .setDescription('Frame: ' + frames[frameIndex])
    .setFooter({ text: 'Spinning...' });

  const response = await interaction.reply({ embeds: [animEmbed] });

  for (let i = 0; i < 12; i++) {
    frameIndex = (frameIndex + 1) % frames.length;
    await new Promise(r => setTimeout(r, 150));
    await response.edit({
      embeds: [animEmbed.setDescription('Frame: ' + frames[frameIndex])],
    }).catch(() => {});
  }

  const resultEmbed = new EmbedBuilder()
    .setColor(result.won ? 0x2ecc71 : 0xe74c3c)
    .setTitle(result.won ? '✅ YOU WIN!' : '❌ YOU LOSE!')
    .setDescription('Result: **' + result.result.toUpperCase() + '**')
    .addFields(
      { name: '🎯 Your Choice', value: result.choice, inline: true },
      { name: '💰 Bet', value: result.bet + ' coins', inline: true },
      { name: '🏆 Winnings', value: result.won ? '+' + result.winnings : '-' + result.bet, inline: true },
      { name: '💳 New Balance', value: result.newBalance + ' coins', inline: false }
    );

  const playAgainBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('casino_replay_' + userId).setLabel('🔁 Play Again').setStyle(ButtonStyle.Success)
  );

  await response.edit({ embeds: [resultEmbed], components: [playAgainBtn] });
  gameSessions.delete(userId);
}

async function handleBlackjackInit(interaction, userId, bet) {
  const { initBlackjack } = require('../../utils/casinoEngine');
  const gameResult = initBlackjack(userId, bet);
  if (!gameResult.success) {
    await interaction.reply({ content: '❌ ' + gameResult.error, ephemeral: true });
    return;
  }

  blackjackGames.set(userId, gameResult);
  displayBlackjackGame(interaction, userId, gameResult, true);
}

async function displayBlackjackGame(interaction, userId, game, isInitial = false) {
  const { cardDisplay, calculateHandValue } = require('../../utils/casinoEngine');

  const playerValue = calculateHandValue(game.playerHand);
  const dealerValue = calculateHandValue(game.dealerHand);

  let description = '';
  if (game.gameActive) {
    description = '**Your Cards:**\n' + game.playerHand.map(cardDisplay).join(' ') + '\nTotal: **' + playerValue + '**\n\n**Dealer\'s Cards:**\n' + cardDisplay(game.dealerHand[0]) + ' [?]\nShowing: **' + calculateHandValue([game.dealerHand[0]]) + '+**';
  } else {
    const dealerDisplay = game.dealerHand.map(cardDisplay).join(' ');
    description = '**Your Cards:**\n' + game.playerHand.map(cardDisplay).join(' ') + '\nTotal: **' + playerValue + '**\n\n**Dealer\'s Cards:**\n' + dealerDisplay + '\nTotal: **' + dealerValue + '**';
  }

  const embed = new EmbedBuilder()
    .setColor(game.gameActive ? 0x3498db : (game.result === 'win' ? 0x2ecc71 : 0xe74c3c))
    .setTitle('🃏 Blackjack')
    .setDescription(description)
    .addFields({ name: '💰 Bet', value: game.bet + ' coins', inline: true })
    .setFooter({ text: game.result ? 'Result: ' + game.result : 'Your turn' });

  let components = [];
  if (game.gameActive) {
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit_' + userId).setLabel('Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand_' + userId).setLabel('Stand').setStyle(ButtonStyle.Danger)
      ),
    ];
  } else {
    const newBalance = getBalance(userId);
    components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('casino_replay_' + userId).setLabel('🔁 Play Again').setStyle(ButtonStyle.Success)
      ),
    ];
    embed.addFields(
      { name: '🏆 Result', value: game.result.toUpperCase(), inline: true },
      { name: '💳 New Balance', value: newBalance + ' coins', inline: true }
    );
  }

  if (isInitial) {
    await interaction.reply({ embeds: [embed], components });
  } else {
    await interaction.update({ embeds: [embed], components });
  }
}

async function handleTradingSelection(interaction, userId, bet) {
  const directionButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('trading_buy_' + userId).setLabel('📈 BUY').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('trading_sell_' + userId).setLabel('📉 SELL').setStyle(ButtonStyle.Danger)
  );

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('📈 Trading Game')
    .setDescription('Choose your market direction!')
    .addFields({ name: '💰 Bet', value: bet + ' coins', inline: true })
    .setFooter({ text: 'Select BUY or SELL' });

  await interaction.reply({ embeds: [embed], components: [directionButtons] });
}

async function handleTradingRiskReward(interaction, userId, direction) {
  const rrButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('trading_rr1_' + userId + '_' + direction).setLabel('1:1 (55%)').setStyle(ButtonStyle.Blurple),
    new ButtonBuilder().setCustomId('trading_rr2_' + userId + '_' + direction).setLabel('1:2 (40%)').setStyle(ButtonStyle.Blurple),
    new ButtonBuilder().setCustomId('trading_rr3_' + userId + '_' + direction).setLabel('1:3 (30%)').setStyle(ButtonStyle.Blurple)
  );

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('📈 Risk/Reward Ratio')
    .setDescription('Select your risk/reward ratio for **' + direction.toUpperCase() + '** position')
    .addFields(
      { name: '1:1', value: 'Lower risk, 2x multiplier, 55% win chance', inline: false },
      { name: '1:2', value: 'Medium risk, 3x multiplier, 40% win chance', inline: false },
      { name: '1:3', value: 'High risk, 4x multiplier, 30% win chance', inline: false }
    )
    .setFooter({ text: 'Choose wisely!' });

  await interaction.reply({ embeds: [embed], components: [rrButtons] });
}

async function playTradingGame(interaction, userId, direction, riskReward) {
  const session = gameSessions.get(userId);
  if (!session) return;

  const { playTrading } = require('../../utils/casinoEngine');
  const result = playTrading(userId, session.bet, direction, riskReward);
  if (!result.success) {
    await interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    return;
  }

  const chartEmbed = new EmbedBuilder()
    .setColor(result.won ? 0x2ecc71 : 0xe74c3c)
    .setTitle(result.won ? '✅ Trade WON!' : '❌ Trade LOST!')
    .setDescription('```\n' + result.chart + '\n```')
    .addFields(
      { name: '📊 Direction', value: direction.toUpperCase(), inline: true },
      { name: '⚖️ Risk/Reward', value: riskReward, inline: true },
      { name: '💰 Bet', value: result.bet + ' coins', inline: true },
      { name: '🏆 Winnings', value: result.won ? '+' + result.winnings : '-' + result.bet, inline: true },
      { name: '💳 New Balance', value: result.newBalance + ' coins', inline: false }
    )
    .setFooter({ text: 'Trade completed' });

  const playAgainBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('casino_replay_' + userId).setLabel('🔁 Trade Again').setStyle(ButtonStyle.Success)
  );

  await interaction.reply({ embeds: [chartEmbed], components: [playAgainBtn] });
  gameSessions.delete(userId);
}

module.exports.handleCasinoButton = handleCasinoButton;
module.exports.handleCasinoModal = handleCasinoModal;
module.exports.playCoinflipGame = playCoinflipGame;
module.exports.handleBlackjackInit = handleBlackjackInit;
module.exports.displayBlackjackGame = displayBlackjackGame;
module.exports.handleTradingSelection = handleTradingSelection;
module.exports.handleTradingRiskReward = handleTradingRiskReward;
module.exports.playTradingGame = playTradingGame;
module.exports.blackjackGames = blackjackGames;
module.exports.gameSessions = gameSessions;
