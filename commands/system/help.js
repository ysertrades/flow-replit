const { SlashCommandBuilder } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands'),
    async execute(interaction) {
        const embed = createServerEmbed('info', {
            title: '📖 YSER Flow Command List',
            description: 'Here are all the available commands:',
            fields: [
                { name: '🛡️ Moderation', value: '`/warn`, `/mute`, `/unmute`, `/kick`, `/ban`, `/unban`, `/purge`', inline: false },
                { name: '📋 Utility', value: '`/embed`, `/button`, `/autoreply`, `/poll`, `/giveaway`, `/rank`, `/leaderboard`, `/schedule`', inline: false },
                { name: '⚙️ System', value: '`/config`, `/help`', inline: false },
                { name: '🎮 Fun', value: '`/daily`, `/balance`, `/shop`, `/buy`', inline: false },
                { name: '🎟️ Tickets', value: '`/ticket`', inline: false },
            ],
        }, interaction.guild);
        await interaction.reply({ embeds: [embed] });
    },
};
