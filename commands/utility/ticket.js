const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');
const { readJson, writeJson } = require('../../utils/jsonStorage');

async function sendTempReply(interaction, embed) {
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    setTimeout(() => {
        interaction.deleteReply().catch(() => {});
    }, 5000);
}

// Default ticket settings
const defaultSettings = {
    inactivityEnabled: true,
    inactivityTime: 2,
    inactivityMessage: 'This ticket has been inactive for {time}. If you still need help, click the button below to notify support.',
    transcriptEnabled: false,
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket').setDescription('Ticket system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub => sub.setName('setup').setDescription('Setup ticket panel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(sub => sub.setName('supportrole').setDescription('Set support role')
            .addRoleOption(opt => opt.setName('role').setDescription('Support role').setRequired(true)))
        .addSubcommand(sub => sub.setName('close').setDescription('Close current ticket channel'))
        .addSubcommand(sub => sub.setName('settings').setDescription('Configure ticket system settings')
            .addStringOption(opt => opt.setName('setting').setDescription('Setting to change').setRequired(true)
                .addChoices(
                    { name: 'Inactivity Time (minutes)', value: 'inactivityTime' },
                    { name: 'Inactivity Enabled', value: 'inactivityEnabled' },
                    { name: 'Inactivity Message', value: 'inactivityMessage' },
                    { name: 'Transcript Enabled', value: 'transcriptEnabled' },
                ))
            .addStringOption(opt => opt.setName('value').setDescription('New value (true/false for toggles, number for times, text for message)').setRequired(true)))
        .addSubcommand(sub => sub.setName('viewsettings').setDescription('View current ticket settings')),

    async execute(interaction) {
        const config = readJson('config.json', {});
        const guildId = interaction.guild.id;
        if (!config[guildId]) config[guildId] = {};
        if (!config[guildId].ticketSettings) config[guildId].ticketSettings = { ...defaultSettings };
        const sub = interaction.options.getSubcommand();

        if (sub === 'setup') {
            const channel = interaction.options.getChannel('channel');

            const embed = createServerEmbed('ticket', {
                title: 'Support Tickets',
                description: 'Need help? Click the button below to create a private ticket and our team will assist you!',
                fields: [
                    { name: 'Response Time', value: 'Usually within a few hours', inline: true },
                    { name: 'What to Include', value: 'Describe your issue clearly', inline: true },
                ],
            }, interaction.guild);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('Create Ticket')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫')
            );

            await channel.send({ embeds: [embed], components: [row] });
            const replyEmbed = createServerEmbed('success', { title: 'Ticket Panel Created', description: `Panel sent to ${channel}.` }, interaction.guild);
            await sendTempReply(interaction, replyEmbed);

        } else if (sub === 'supportrole') {
            const role = interaction.options.getRole('role');
            config[guildId].supportRole = role.id;
            writeJson('config.json', config);
            const embed = createServerEmbed('success', { title: 'Support Role Set', description: `Support role set to **${role.name}**.` }, interaction.guild);
            await sendTempReply(interaction, embed);

        } else if (sub === 'close') {
            const channel = interaction.channel;
            if (!channel.name.startsWith('ticket-')) {
                return interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: 'This is not a ticket channel.' }, interaction.guild)], ephemeral: true });
            }

            const closingEmbed = createServerEmbed('info', {
                title: 'Closing Ticket',
                description: 'This ticket will be closed in **5 seconds**...',
            }, interaction.guild);
            await interaction.reply({ embeds: [closingEmbed] });

            setTimeout(async () => {
                try { await channel.delete('Ticket closed by user'); } catch {}
            }, 5000);

        } else if (sub === 'settings') {
            const setting = interaction.options.getString('setting');
            const value = interaction.options.getString('value');
            const settings = config[guildId].ticketSettings;
            let parsedValue;
            let displayValue = value;

            if (setting === 'inactivityTime') {
                parsedValue = parseInt(value);
                if (isNaN(parsedValue) || parsedValue < 1) {
                    return interaction.reply({
                        embeds: [createServerEmbed('error', { title: 'Invalid Value', description: 'Please provide a valid number of minutes (minimum 1).' }, interaction.guild)],
                        ephemeral: true
                    });
                }
                displayValue = `${parsedValue} minute${parsedValue !== 1 ? 's' : ''}`;
            } else if (setting === 'inactivityEnabled' || setting === 'transcriptEnabled') {
                const lower = value.toLowerCase();
                if (lower === 'true' || lower === 'yes' || lower === '1' || lower === 'on') {
                    parsedValue = true;
                    displayValue = 'Enabled';
                } else if (lower === 'false' || lower === 'no' || lower === '0' || lower === 'off') {
                    parsedValue = false;
                    displayValue = 'Disabled';
                } else {
                    return interaction.reply({
                        embeds: [createServerEmbed('error', { title: 'Invalid Value', description: 'Please use **true** or **false** for toggle settings.' }, interaction.guild)],
                        ephemeral: true
                    });
                }
            } else {
                parsedValue = value;
            }

            const oldValue = settings[setting];
            settings[setting] = parsedValue;
            writeJson('config.json', config);

            const embed = createServerEmbed('success', {
                title: 'Setting Updated',
                description: `**${setting}** has been updated.`,
                fields: [
                    { name: 'Old Value', value: String(oldValue ?? 'Not set'), inline: true },
                    { name: 'New Value', value: String(displayValue), inline: true },
                ]
            }, interaction.guild);
            await sendTempReply(interaction, embed);

        } else if (sub === 'viewsettings') {
            const settings = config[guildId].ticketSettings;
            const supportRole = config[guildId].supportRole ? `<@&${config[guildId].supportRole}>` : 'Not set';

            const embed = createServerEmbed('info', {
                title: 'Ticket System Settings',
                description: 'Current configuration for the ticket system.',
                fields: [
                    { name: 'Support Role', value: supportRole, inline: false },
                    { name: 'Inactivity Enabled', value: settings.inactivityEnabled ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'Inactivity Time', value: `${settings.inactivityTime} minute${settings.inactivityTime !== 1 ? 's' : ''}`, inline: true },
                    { name: 'Transcript Enabled', value: settings.transcriptEnabled ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'Inactivity Message', value: settings.inactivityMessage || defaultSettings.inactivityMessage, inline: false },
                ]
            }, interaction.guild);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};

// Handle ticket-related buttons: "Create Ticket" from the panel, "Close Ticket" inside a ticket
module.exports.handleButton = async function(interaction) {
    if (interaction.customId === 'close_ticket') {
        const channel = interaction.channel;
        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: 'This is not a ticket channel.' }, interaction.guild)], ephemeral: true });
        }
        const closingEmbed = createServerEmbed('info', {
            title: 'Closing Ticket',
            description: 'This ticket will be closed in **5 seconds**...',
        }, interaction.guild);
        await interaction.reply({ embeds: [closingEmbed] });
        setTimeout(async () => {
            try { await channel.delete('Ticket closed by user'); } catch {}
        }, 5000);
        return;
    }

    if (interaction.customId !== 'create_ticket') return;

    const guild = interaction.guild;
    const config = readJson('config.json', {});
    const guildId = guild.id;
    const supportRoleId = config[guildId]?.supportRole;

    const existing = guild.channels.cache.find(
        c => c.name === `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}` && c.parentId
    ) || guild.channels.cache.find(c => c.topic === `ticket-owner:${interaction.user.id}`);

    if (existing) {
        return interaction.reply({
            embeds: [createServerEmbed('error', { title: 'Ticket Already Open', description: `You already have an open ticket: ${existing}` }, guild)],
            ephemeral: true,
        });
    }

    await interaction.deferReply({ ephemeral: true });

    const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
    ];
    if (supportRoleId) {
        overwrites.push({ id: supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
    }

    const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90) || `ticket-${interaction.user.id}`;

    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        topic: `ticket-owner:${interaction.user.id}`,
        permissionOverwrites: overwrites,
    });

    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
    );

    const welcomeEmbed = createServerEmbed('ticket', {
        title: 'Ticket Opened',
        description: `Welcome ${interaction.user}! Support will be with you shortly.\n\nDescribe your issue and a team member will assist you.`,
        fields: supportRoleId ? [{ name: 'Support Team', value: `<@&${supportRoleId}>`, inline: false }] : [],
    }, guild);

    await channel.send({ content: supportRoleId ? `<@&${supportRoleId}>` : undefined, embeds: [welcomeEmbed], components: [closeRow] });

    await interaction.editReply({
        embeds: [createServerEmbed('success', { title: 'Ticket Created', description: `Your ticket has been created: ${channel}` }, guild)],
    });
};
