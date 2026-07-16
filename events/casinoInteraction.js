const { Events } = require('discord.js');
const casinoCmd = require('../commands/economy/casino');
const { blackjackHit, blackjackStand } = require('../utils/casinoEngine');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isButton() && interaction.customId.startsWith('casino_')) {
      const parts = interaction.customId.split('_');
      const action = parts[1];
      const game = parts[2];

      if (action === 'replay') {
        const userId = parts[2];
        if (interaction.user.id !== userId) {
          return interaction.reply({ content: 'This is not your game!', ephemeral: true });
        }
        return await casinoCmd.execute(interaction);
      }

      if (game === 'coinflip' || game === 'blackjack' || game === 'trading') {
        return casinoCmd.handleCasinoButton(interaction);
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith('coinflip_')) {
      const parts = interaction.customId.split('_');
      const choice = parts[1];
      const userId = parts[2];
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your game!', ephemeral: true });
      }
      await interaction.deferUpdate();
      return casinoCmd.playCoinflipGame(interaction, userId, choice);
    }

    if (interaction.isButton() && interaction.customId.startsWith('bj_')) {
      const parts = interaction.customId.split('_');
      const action = parts[1];
      const userId = parts[2];
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your game!', ephemeral: true });
      }

      const game = casinoCmd.blackjackGames.get(userId);
      if (!game) {
        return interaction.reply({ content: 'Game not found!', ephemeral: true });
      }

      if (action === 'hit') {
        const result = blackjackHit(game);
        if (result.success) {
          casinoCmd.blackjackGames.set(userId, result.gameState);
          return casinoCmd.displayBlackjackGame(interaction, userId, result.gameState);
        }
      } else if (action === 'stand') {
        const result = blackjackStand(game);
        if (result.success) {
          casinoCmd.blackjackGames.set(userId, result.gameState);
          return casinoCmd.displayBlackjackGame(interaction, userId, result.gameState);
        }
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith('trading_')) {
      const parts = interaction.customId.split('_');
      const action = parts[1];
      const userId = parts[2];

      if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your game!', ephemeral: true });
      }

      if (action === 'buy' || action === 'sell') {
        return casinoCmd.handleTradingRiskReward(interaction, userId, action);
      } else if (action === 'rr1' || action === 'rr2' || action === 'rr3') {
        const direction = parts[3];
        const rrMap = { rr1: '1:1', rr2: '1:2', rr3: '1:3' };
        const rr = rrMap[action];
        return casinoCmd.playTradingGame(interaction, userId, direction, rr);
      }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('casino_bet_')) {
      return casinoCmd.handleCasinoModal(interaction);
    }
  },
};
