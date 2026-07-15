const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');
const { readJson, writeJson } = require('../../utils/jsonStorage');
const { generateScheduleId, parseScheduleTime, parseUtcOffset, nextWeekdayTimestamp } = require('../../utils/scheduler');

async function sendTempReply(interaction, embed) {
    await interaction.reply({ embeds: [embed], fetchReply: true });
    setTimeout(() => {
        interaction.deleteReply().catch(() => {});
    }, 5000);
}

const frequencyLabels = {
    once: 'Once',
    weekdays: 'Every Weekday (Mon–Fri)',
    everyday: 'Every Day',
};

const frequencyIcons = {
    once: '📌',
    weekdays: '📅',
    everyday: '🔁',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('schedule').setDescription('Schedule an embed template to be sent automatically')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub => sub.setName('create').setDescription('Schedule an embed to be sent')
            .addStringOption(opt => opt.setName('embed').setDescription('Embed template name').setRequired(true))
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send to').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
            .addStringOption(opt => opt.setName('time').setDescription('HH:mm, YYYY-MM-DD HH:mm, or relative like 30m/2h/1d').setRequired(true))
            .addStringOption(opt => opt.setName('frequency').setDescription('How often to repeat').setRequired(true)
                .addChoices(
                    { name: 'Once', value: 'once' },
                    { name: 'Every Weekday (Mon–Fri)', value: 'weekdays' },
                    { name: 'Every Day', value: 'everyday' },
                ))
            .addStringOption(opt => opt.setName('mention').setDescription('Mention @everyone, @here, or a role ID').setRequired(false))
            .addStringOption(opt => opt.setName('timezone').setDescription('Your UTC offset for the time you entered, e.g. -4 or +5:30 (default: UTC)').setRequired(false)))
        .addSubcommand(sub => sub.setName('list').setDescription('List all scheduled embeds'))
        .addSubcommand(sub => sub.setName('cancel').setDescription('Cancel a scheduled embed')
            .addStringOption(opt => opt.setName('id').setDescription('Schedule ID').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const schedules = readJson('schedules.json', {});
        if (!schedules[guildId]) schedules[guildId] = {};

        if (sub === 'create') {
            const embedName = interaction.options.getString('embed').toLowerCase();
            const channel = interaction.options.getChannel('channel');
            const timeInput = interaction.options.getString('time');
            const frequency = interaction.options.getString('frequency');
            const mention = interaction.options.getString('mention') || null;
            const timezoneInput = interaction.options.getString('timezone');

            const embeds = readJson('embeds.json', {});
            if (!embeds[guildId]?.[embedName]) {
                return interaction.reply({
                    embeds: [createServerEmbed('error', { title: 'Template Not Found', description: `No embed template named **${embedName}** exists. Create one first with \`/embed create\`.` }, interaction.guild)],
                    ephemeral: true,
                });
            }

            const offsetMinutes = parseUtcOffset(timezoneInput);
            if (offsetMinutes === null) {
                return interaction.reply({
                    embeds: [createServerEmbed('error', { title: 'Invalid Timezone', description: 'Use a UTC offset like `-4`, `+5:30`, or `0`.' }, interaction.guild)],
                    ephemeral: true,
                });
            }

            let time = parseScheduleTime(timeInput, offsetMinutes);
            if (!time) {
                return interaction.reply({
                    embeds: [createServerEmbed('error', {
                        title: 'Invalid Time',
                        description: 'Use one of these formats:\n• `HH:mm` — e.g. `09:00`\n• `YYYY-MM-DD HH:mm` — e.g. `2026-07-20 14:30`\n• Relative — e.g. `30m`, `2h`, `1d`\n\nFor `HH:mm` and full dates, remember to set `timezone` if you\'re not on UTC — otherwise the time is read as UTC.',
                    }, interaction.guild)],
                    ephemeral: true,
                });
            }
            if (frequency === 'weekdays') time = nextWeekdayTimestamp(time, offsetMinutes);

            const id = generateScheduleId(Object.keys(schedules[guildId]));
            schedules[guildId][id] = {
                id,
                embedName,
                channelId: channel.id,
                time,
                frequency,
                mention,
                offsetMinutes,
                createdBy: interaction.user.id,
                createdAt: Date.now(),
            };
            writeJson('schedules.json', schedules);

            const tzLabel = offsetMinutes === 0 ? 'UTC' : `UTC${offsetMinutes > 0 ? '+' : '-'}${Math.floor(Math.abs(offsetMinutes) / 60)}${Math.abs(offsetMinutes) % 60 ? ':' + String(Math.abs(offsetMinutes) % 60).padStart(2, '0') : ''}`;
            const embed = createServerEmbed('schedule', {
                title: 'Schedule Created',
                description: `Your embed **${embedName}** is now on autopilot. 🚀`,
                fields: [
                    { name: '🆔 Schedule ID', value: `\`${id}\``, inline: true },
                    { name: '📍 Channel', value: `${channel}`, inline: true },
                    { name: `${frequencyIcons[frequency]} Frequency`, value: frequencyLabels[frequency], inline: true },
                    { name: '🌐 Timezone Used', value: tzLabel, inline: true },
                    { name: '⏰ Next Send', value: `<t:${Math.floor(time / 1000)}:F>\n(<t:${Math.floor(time / 1000)}:R>)`, inline: false },
                ],
            }, interaction.guild);
            await sendTempReply(interaction, embed);

        } else if (sub === 'list') {
            const list = Object.values(schedules[guildId] || {}).sort((a, b) => a.time - b.time);
            if (list.length === 0) {
                return interaction.reply({
                    embeds: [createServerEmbed('schedule', { title: 'Scheduled Embeds', description: 'No embeds are currently scheduled.\nCreate one with `/schedule create`.' }, interaction.guild)],
                });
            }

            const shown = list.slice(0, 20);
            const embed = createServerEmbed('schedule', {
                title: 'Scheduled Embeds',
                description: `**${list.length}** schedule${list.length !== 1 ? 's' : ''} active in this server.`,
                fields: shown.map(s => ({
                    name: `\`${s.id}\`  •  ${frequencyIcons[s.frequency]} ${frequencyLabels[s.frequency]}`,
                    value: `📋 Embed: **${s.embedName}**\n📍 Channel: <#${s.channelId}>\n⏰ Next: <t:${Math.floor(s.time / 1000)}:R>\n👤 By <@${s.createdBy}>`,
                    inline: false,
                })),
            }, interaction.guild);
            if (list.length > shown.length) {
                embed.setFooter({ text: `Showing 20 of ${list.length} • ${interaction.guild.name} • YSER Flow` });
            }
            await interaction.reply({ embeds: [embed] });

        } else if (sub === 'cancel') {
            const id = interaction.options.getString('id').toUpperCase();
            if (!schedules[guildId][id]) {
                return interaction.reply({
                    embeds: [createServerEmbed('error', { title: 'Not Found', description: `No schedule with ID \`${id}\` exists. Use \`/schedule list\` to see active schedules.` }, interaction.guild)],
                    ephemeral: true,
                });
            }
            const removed = schedules[guildId][id];
            delete schedules[guildId][id];
            writeJson('schedules.json', schedules);
            const embed = createServerEmbed('success', {
                title: 'Schedule Cancelled',
                description: `Schedule \`${id}\` for embed **${removed.embedName}** has been cancelled.`,
            }, interaction.guild);
            await sendTempReply(interaction, embed);
        }
    },
};
