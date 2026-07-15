const { SlashCommandBuilder } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');
const { readJson, writeJson } = require('../../utils/jsonStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy').setDescription('Buy an item from the shop')
        .addStringOption(opt => opt.setName('item').setDescription('Item name').setRequired(true)),
    async execute(interaction) {
        const itemName = interaction.options.getString('item').toLowerCase();
        const economy = readJson('economy.json', {});
        const guildData = economy[interaction.guild.id] || {};
        const item = guildData.shop?.[itemName];

        if (!item) return interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: 'Item not found in shop.' }, interaction.guild)], ephemeral: true });

        const userData = guildData[interaction.user.id] || { balance: 0, inventory: [] };
        if (userData.balance < item.price) return interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: `You need **${item.price}** coins. You have **${userData.balance}**.` }, interaction.guild)], ephemeral: true });

        userData.balance -= item.price;
        userData.inventory.push({
            name: item.name,
            emoji: item.emoji,
            description: item.description,
            boughtAt: Date.now(),
        });

        if (!economy[interaction.guild.id]) economy[interaction.guild.id] = {};
        economy[interaction.guild.id][interaction.user.id] = userData;

        if (item.roleId) {
            const role = interaction.guild.roles.cache.get(item.roleId);
            if (role) {
                try { await interaction.member.roles.add(role); } catch {}
            }
        }

        writeJson('economy.json', economy);
        await interaction.reply({ embeds: [createServerEmbed('success', { title: 'Purchased', description: `You bought **${item.emoji} ${item.name}** for **${item.price}** coins!` }, interaction.guild)] });
    },
};
