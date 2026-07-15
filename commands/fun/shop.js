const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');
const { readJson, writeJson } = require('../../utils/jsonStorage');

async function sendTempReply(interaction, embed) {
    await interaction.reply({ embeds: [embed], fetchReply: true });
    setTimeout(() => {
        interaction.deleteReply().catch(() => {});
    }, 5000);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop').setDescription('Manage shop items')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub => sub.setName('add').setDescription('Add item')
            .addStringOption(opt => opt.setName('name').setDescription('Item name').setRequired(true))
            .addIntegerOption(opt => opt.setName('price').setDescription('Price').setMinValue(1).setRequired(true))
            .addStringOption(opt => opt.setName('description').setDescription('Item description').setRequired(false))
            .addStringOption(opt => opt.setName('emoji').setDescription('Item emoji').setRequired(false))
            .addRoleOption(opt => opt.setName('role').setDescription('Role to give').setRequired(false)))
        .addSubcommand(sub => sub.setName('list').setDescription('List items'))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove item')
            .addStringOption(opt => opt.setName('name').setDescription('Item name').setRequired(true))),
    async execute(interaction) {
        const economy = readJson('economy.json', {});
        const guildId = interaction.guild.id;
        if (!economy[guildId]) economy[guildId] = {};
        if (!economy[guildId].shop) economy[guildId].shop = {};
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const name = interaction.options.getString('name').toLowerCase();
            economy[guildId].shop[name] = {
                name: interaction.options.getString('name'),
                price: interaction.options.getInteger('price'),
                description: interaction.options.getString('description') || 'No description',
                emoji: interaction.options.getString('emoji') || '📦',
                roleId: interaction.options.getRole('role')?.id || null,
            };
            writeJson('economy.json', economy);
            const embed = createServerEmbed('success', { title: 'Item Added', description: `**${economy[guildId].shop[name].emoji} ${name}** added to shop for **${economy[guildId].shop[name].price}** coins.` }, interaction.guild);
            await sendTempReply(interaction, embed);
        } else if (sub === 'list') {
            const items = Object.entries(economy[guildId].shop || {});
            const embed = createServerEmbed('shop', {
                title: 'Shop',
                description: items.length ? 'Available items:' : 'No items in shop.',
                fields: items.length ? items.map(([n, d]) => ({ name: `${d.emoji} ${d.name}`, value: `**${d.price}** coins
${d.description}`, inline: true })) : [],
            }, interaction.guild);
            await interaction.reply({ embeds: [embed] });
        } else if (sub === 'remove') {
            const name = interaction.options.getString('name').toLowerCase();
            if (!economy[guildId].shop?.[name]) return interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: 'Item not found.' }, interaction.guild)], ephemeral: true });
            delete economy[guildId].shop[name];
            writeJson('economy.json', economy);
            const embed = createServerEmbed('success', { title: 'Removed', description: `Item **${name}** removed from shop.` }, interaction.guild);
            await sendTempReply(interaction, embed);
        }
    },
};
