const { SlashCommandBuilder, PermissionFlagsBits, ButtonStyle } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');
const { readJson, writeJson } = require('../../utils/jsonStorage');

async function sendTempReply(interaction, embed) {
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    setTimeout(() => {
        interaction.deleteReply().catch(() => {});
    }, 5000);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('button').setDescription('Manage buttons')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub => sub.setName('add').setDescription('Add button to embed')
            .addStringOption(opt => opt.setName('embed').setDescription('Embed template name').setRequired(true))
            .addStringOption(opt => opt.setName('id').setDescription('Button ID').setRequired(true))
            .addStringOption(opt => opt.setName('label').setDescription('Label').setRequired(true))
            .addStringOption(opt => opt.setName('type').setDescription('Type').setRequired(true).addChoices(
                { name: 'Link', value: 'link' }, { name: 'Role', value: 'role' }, { name: 'Custom', value: 'custom' }))
            .addStringOption(opt => opt.setName('style').setDescription('Style').setRequired(true).addChoices(
                { name: 'Primary', value: 'Primary' }, { name: 'Secondary', value: 'Secondary' },
                { name: 'Success', value: 'Success' }, { name: 'Danger', value: 'Danger' }, { name: 'Link', value: 'Link' }))
            .addStringOption(opt => opt.setName('url').setDescription('URL (Link only)').setRequired(false))
            .addRoleOption(opt => opt.setName('role').setDescription('Role (Role only)').setRequired(false))
            .addStringOption(opt => opt.setName('message').setDescription('Message (Custom only)').setRequired(false))
            .addStringOption(opt => opt.setName('emoji').setDescription('Emoji').setRequired(false)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove button')
            .addStringOption(opt => opt.setName('id').setDescription('Button ID').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('List buttons')),
    async execute(interaction) {
        const buttons = readJson('buttons.json', {});
        const guildId = interaction.guild.id;
        if (!buttons[guildId]) buttons[guildId] = {};
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const embedName = interaction.options.getString('embed').toLowerCase();
            const id = interaction.options.getString('id');
            const type = interaction.options.getString('type');
            const style = interaction.options.getString('style');
            if (buttons[guildId][id]) {
                const embed = createServerEmbed('error', { title: 'Error', description: 'Button ID already exists.' }, interaction.guild);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Validate link buttons
            if (type === 'link') {
                const url = interaction.options.getString('url');
                if (!url) {
                    const embed = createServerEmbed('error', { title: 'Error', description: 'Link buttons require a URL.' }, interaction.guild);
                    return interaction.reply({ embeds: [embed], flags: 64 });
                }
                if (style !== 'Link') {
                    const embed = createServerEmbed('error', { title: 'Error', description: 'Link buttons must use "Link" style.' }, interaction.guild);
                    return interaction.reply({ embeds: [embed], flags: 64 });
                }
            }

            const roleOption = interaction.options.getRole('role');

            buttons[guildId][id] = {
                id, embedName, label: interaction.options.getString('label'), type, style,
                url: interaction.options.getString('url') || null,
                roleId: roleOption ? roleOption.id : null,
                message: interaction.options.getString('message') || null,
                emoji: interaction.options.getString('emoji') || null,
            };
            writeJson('buttons.json', buttons);
            const embed = createServerEmbed('success', { title: 'Button Added', description: `Button **${id}** added to embed **${embedName}**.` }, interaction.guild);
            await sendTempReply(interaction, embed);
        } else if (sub === 'remove') {
            const id = interaction.options.getString('id');
            if (!buttons[guildId][id]) {
                const embed = createServerEmbed('error', { title: 'Error', description: 'Button not found.' }, interaction.guild);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }
            delete buttons[guildId][id];
            writeJson('buttons.json', buttons);
            const embed = createServerEmbed('success', { title: 'Removed', description: `Button **${id}** removed.` }, interaction.guild);
            await sendTempReply(interaction, embed);
        } else if (sub === 'list') {
            const list = Object.values(buttons[guildId] || {});
            const embed = createServerEmbed('info', { title: 'Buttons', description: list.length ? list.map(b => `• **${b.id}** → ${b.embedName} (${b.type})${b.roleId ? ` <@&${b.roleId}>` : ''}`).join('\n') : 'No buttons.' }, interaction.guild);
            await interaction.reply({ embeds: [embed] });
        }
    },
};
