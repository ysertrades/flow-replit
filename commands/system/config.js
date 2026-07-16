const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
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
        .setName('config')
        .setDescription('Configure server settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('welcome').setDescription('Set welcome channel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
            .addStringOption(opt => opt.setName('message').setDescription('Message ({user}, {server})').setRequired(false)))
        .addSubcommand(sub => sub.setName('leave').setDescription('Set leave channel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
            .addStringOption(opt => opt.setName('message').setDescription('Message').setRequired(false)))
        .addSubcommand(sub => sub.setName('autorole').setDescription('Auto-role on join')
            .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true)))
        .addSubcommand(sub => sub.setName('logs').setDescription('Logs channel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(sub => sub.setName('view').setDescription('View configuration'))
        .addSubcommand(sub => sub.setName('perm').setDescription('Set which roles can use a command')
            .addStringOption(opt => opt.setName('command').setDescription('Command name').setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('Role to allow').setRequired(true)))
        .addSubcommand(sub => sub.setName('removecmdperm').setDescription('Remove a role from a command')
            .addStringOption(opt => opt.setName('command').setDescription('Command name').setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))),
    async execute(interaction) {
        const config = readJson('config.json', {});
        const guildId = interaction.guild.id;
        if (!config[guildId]) config[guildId] = {};
        const sub = interaction.options.getSubcommand();

        if (sub === 'welcome') {
            config[guildId].welcomeChannel = interaction.options.getChannel('channel').id;
            const msg = interaction.options.getString('message');
            if (msg) config[guildId].welcomeMessage = msg;
            writeJson('config.json', config);
            const embed = createServerEmbed('success', { title: 'Welcome Configured', description: 'Welcome channel set.' }, interaction.guild);
            await sendTempReply(interaction, embed);
        } else if (sub === 'leave') {
            config[guildId].leaveChannel = interaction.options.getChannel('channel').id;
            const msg = interaction.options.getString('message');
            if (msg) config[guildId].leaveMessage = msg;
            writeJson('config.json', config);
            const embed = createServerEmbed('success', { title: 'Leave Configured', description: 'Leave channel set.' }, interaction.guild);
            await sendTempReply(interaction, embed);
        } else if (sub === 'autorole') {
            config[guildId].autoRole = interaction.options.getRole('role').id;
            writeJson('config.json', config);
            const embed = createServerEmbed('success', { title: 'Auto-Role Set', description: 'Auto-role configured.' }, interaction.guild);
            await sendTempReply(interaction, embed);
        } else if (sub === 'logs') {
            config[guildId].logsChannel = interaction.options.getChannel('channel').id;
            writeJson('config.json', config);
            const embed = createServerEmbed('success', { title: 'Logs Configured', description: 'Logs channel set.' }, interaction.guild);
            await sendTempReply(interaction, embed);
        } else if (sub === 'view') {
            const cfg = config[guildId] || {};
            const embed = createServerEmbed('info', {
                title: 'Configuration',
                fields: [
                    { name: 'Welcome', value: cfg.welcomeChannel ? `<#${cfg.welcomeChannel}>` : 'Not set', inline: true },
                    { name: 'Leave', value: cfg.leaveChannel ? `<#${cfg.leaveChannel}>` : 'Not set', inline: true },
                    { name: 'Auto Role', value: cfg.autoRole ? `<@&${cfg.autoRole}>` : 'Not set', inline: true },
                    { name: 'Logs', value: cfg.logsChannel ? `<#${cfg.logsChannel}>` : 'Not set', inline: true },
                    { name: 'Support Role', value: cfg.supportRole ? `<@&${cfg.supportRole}>` : 'Not set', inline: true },
                ],
            }, interaction.guild);
            await interaction.reply({ embeds: [embed] });
        } else if (sub === 'perm') {
            const commandName = interaction.options.getString('command').toLowerCase();
            const role = interaction.options.getRole('role');
            if (!config[guildId].commandPermissions) config[guildId].commandPermissions = {};
            if (!config[guildId].commandPermissions[commandName]) config[guildId].commandPermissions[commandName] = [];
            if (!config[guildId].commandPermissions[commandName].includes(role.id)) {
                config[guildId].commandPermissions[commandName].push(role.id);
            }
            writeJson('config.json', config);
            const embed = createServerEmbed('success', { title: 'Permission Set', description: `Role **${role.name}** can now use "/${commandName}".` }, interaction.guild);
            await sendTempReply(interaction, embed);
        } else if (sub === 'removecmdperm') {
            const commandName = interaction.options.getString('command').toLowerCase();
            const role = interaction.options.getRole('role');
            if (config[guildId].commandPermissions?.[commandName]) {
                config[guildId].commandPermissions[commandName] = config[guildId].commandPermissions[commandName].filter(id => id !== role.id);
                if (config[guildId].commandPermissions[commandName].length === 0) {
                    delete config[guildId].commandPermissions[commandName];
                }
            }
            writeJson('config.json', config);
            const embed = createServerEmbed('success', { title: 'Permission Removed', description: `Role **${role.name}** removed from "/${commandName}".` }, interaction.guild);
            await sendTempReply(interaction, embed);
        }
    },
    // Futures Pairs
    futuresPairs: [
        { symbol: "NQ", tickSize: 0.25, tickValue: 5, microSymbol: "MNQ", microTickValue: 0.5 },
        { symbol: "ES", tickSize: 0.25, tickValue: 12.5, microSymbol: "MES", microTickValue: 1.25 },
        { symbol: "YM", tickSize: 1, tickValue: 5, microSymbol: "MYM", microTickValue: 0.5 },
        { symbol: "RTY", tickSize: 0.1, tickValue: 5, microSymbol: "M2K", microTickValue: 0.5 },
        { symbol: "GC", tickSize: 0.1, tickValue: 10, microSymbol: "MGC", microTickValue: 1 },
        { symbol: "SI", tickSize: 0.005, tickValue: 25, microSymbol: "SIL", microTickValue: 5 }
    ]
};
