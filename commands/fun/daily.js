const { SlashCommandBuilder } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');
const { readJson, writeJson } = require('../../utils/jsonStorage');

const cooldowns = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily').setDescription('Claim daily reward'),
    async execute(interaction) {
        const key = `${interaction.guild.id}-${interaction.user.id}`;
        const lastClaim = cooldowns.get(key) || 0;
        const now = Date.now();
        const dayMs = 86400000;

        if (now - lastClaim < dayMs) {
            const remaining = Math.ceil((dayMs - (now - lastClaim)) / 3600000);
            return interaction.reply({ embeds: [createServerEmbed('warning', { title: 'Cooldown', description: `Wait ${remaining} hours.` }, interaction.guild)], ephemeral: true });
        }

        const economy = readJson('economy.json', {});
        const guildId = interaction.guild.id;
        if (!economy[guildId]) economy[guildId] = {};
        if (!economy[guildId][interaction.user.id]) economy[guildId][interaction.user.id] = { balance: 0, inventory: [] };

        const reward = Math.floor(Math.random() * 500) + 100;
        economy[guildId][interaction.user.id].balance += reward;
        writeJson('economy.json', economy);
        cooldowns.set(key, now);

        await interaction.reply({ embeds: [createServerEmbed('success', { title: 'Daily Reward', description: `You received **${reward}** coins!` }, interaction.guild)] });
    },
};
