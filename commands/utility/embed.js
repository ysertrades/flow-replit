const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const { createServerEmbed, parseColor, colors } = require('../../utils/embedBuilder');
const { readJson, writeJson } = require('../../utils/jsonStorage');

async function sendTempReply(interaction, embed) {
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    setTimeout(() => {
        interaction.deleteReply().catch(() => {});
    }, 5000);
}

// In-memory storage for active edit sessions
const activeEdits = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed').setDescription('Manage embed templates')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub => sub.setName('create').setDescription('Create template')
            .addStringOption(opt => opt.setName('name').setDescription('Name').setRequired(true))
            .addStringOption(opt => opt.setName('description').setDescription('Description').setRequired(true))
            .addStringOption(opt => opt.setName('title').setDescription('Title').setRequired(false))
            .addStringOption(opt => opt.setName('color').setDescription('Hex color (e.g. #5865F2)').setRequired(false))
            .addStringOption(opt => opt.setName('footer').setDescription('Footer text').setRequired(false))
            .addStringOption(opt => opt.setName('thumbnail').setDescription('Thumbnail URL').setRequired(false))
            .addStringOption(opt => opt.setName('image').setDescription('Image URL').setRequired(false)))
        .addSubcommand(sub => sub.setName('edit').setDescription('Edit template interactively')
            .addStringOption(opt => opt.setName('name').setDescription('Name').setRequired(true)))
        .addSubcommand(sub => sub.setName('delete').setDescription('Delete template')
            .addStringOption(opt => opt.setName('name').setDescription('Name').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('List templates'))
        .addSubcommand(sub => sub.setName('send').setDescription('Send template')
            .addStringOption(opt => opt.setName('name').setDescription('Name').setRequired(true))
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(false))
            .addStringOption(opt => opt.setName('mention').setDescription('Mention @everyone, @here, or a role ID').setRequired(false))),

    async execute(interaction) {
        const embeds = readJson('embeds.json', {});
        const guildId = interaction.guild.id;
        if (!embeds[guildId]) embeds[guildId] = {};
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            const name = interaction.options.getString('name').toLowerCase();
            if (embeds[guildId][name]) {
                const embed = createServerEmbed('error', { title: 'Error', description: `Template **${name}** already exists.` }, interaction.guild);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }
            const colorInput = interaction.options.getString('color');
            embeds[guildId][name] = {
                title: interaction.options.getString('title') || null,
                description: interaction.options.getString('description'),
                color: colorInput || '#5865F2',
                footer: interaction.options.getString('footer') || null,
                thumbnail: interaction.options.getString('thumbnail') || null,
                image: interaction.options.getString('image') || null,
                fields: [],
            };
            writeJson('embeds.json', embeds);
            const embed = createServerEmbed('success', { title: 'Template Created', description: `Embed template **${name}** has been saved.` }, interaction.guild);
            await sendTempReply(interaction, embed);

        } else if (sub === 'edit') {
            const name = interaction.options.getString('name').toLowerCase();
            const template = embeds[guildId]?.[name];
            if (!template) {
                const embed = createServerEmbed('error', { title: 'Error', description: `Template **${name}** not found.` }, interaction.guild);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Store the active edit session
            const sessionId = `${interaction.user.id}-${Date.now()}`;
            activeEdits.set(sessionId, { guildId, name, userId: interaction.user.id });

            // Build preview embed
            const previewEmbed = new (require('discord.js').EmbedBuilder)()
                .setColor(parseColor(template.color) || 0x5865F2)
                .setDescription(template.description || null)
                .setTimestamp();
            if (template.title) previewEmbed.setTitle(template.title);
            if (template.footer) previewEmbed.setFooter({ text: template.footer });
            if (template.thumbnail) previewEmbed.setThumbnail(template.thumbnail);
            if (template.image) previewEmbed.setImage(template.image);

            // Build edit buttons
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`embed_edit_title_${sessionId}`).setLabel('📝 Title').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`embed_edit_desc_${sessionId}`).setLabel('📝 Description').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`embed_edit_color_${sessionId}`).setLabel('🎨 Color').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`embed_edit_footer_${sessionId}`).setLabel('📌 Footer').setStyle(ButtonStyle.Primary),
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`embed_edit_thumb_${sessionId}`).setLabel('🖼️ Thumbnail').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`embed_edit_image_${sessionId}`).setLabel('🖼️ Image').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`embed_edit_save_${sessionId}`).setLabel('💾 Save & Exit').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`embed_edit_cancel_${sessionId}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Danger),
            );

            await interaction.reply({
                content: `Editing embed template **${name}**. Click a button to edit that field.`,
                embeds: [previewEmbed],
                components: [row1, row2],
                flags: 64,
            });

        } else if (sub === 'delete') {
            const name = interaction.options.getString('name').toLowerCase();
            if (!embeds[guildId][name]) {
                const embed = createServerEmbed('error', { title: 'Error', description: `Template **${name}** not found.` }, interaction.guild);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }
            delete embeds[guildId][name];
            writeJson('embeds.json', embeds);
            const embed = createServerEmbed('success', { title: 'Template Deleted', description: `Embed template **${name}** deleted.` }, interaction.guild);
            await sendTempReply(interaction, embed);

        } else if (sub === 'list') {
            const names = Object.keys(embeds[guildId]);
            const embed = createServerEmbed('info', { title: 'Embed Templates', description: names.length ? names.map(n => `• **${n}**`).join('\n') : 'No templates saved yet.' }, interaction.guild);
            await interaction.reply({ embeds: [embed] });

        } else if (sub === 'send') {
            const name = interaction.options.getString('name').toLowerCase();
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const mention = interaction.options.getString('mention');

            const payload = buildEmbedPayload(interaction.guild, name);
            if (!payload) {
                const embed = createServerEmbed('error', { title: 'Error', description: `Template **${name}** not found.` }, interaction.guild);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            let content = undefined;
            if (mention) {
                if (mention === '@everyone') content = '@everyone';
                else if (mention === '@here') content = '@here';
                else if (mention.match(/^\d+$/)) content = `<@&${mention}>`;
            }

            await channel.send({ content, embeds: [payload.embed], components: payload.components });
            const embed = createServerEmbed('success', { title: 'Sent', description: `Embed **${name}** sent to ${channel}.` }, interaction.guild);
            await sendTempReply(interaction, embed);
        }
    },
};

// Builds the { embed, components } payload for a saved embed template, including
// any buttons attached to it. Returns null if the template doesn't exist.
// Shared by `/embed send` and the schedule runner so both stay in sync.
function buildEmbedPayload(guild, name) {
    const embeds = readJson('embeds.json', {});
    const template = embeds[guild.id]?.[name];
    if (!template) return null;

    const sentEmbed = createServerEmbed('info', {
        title: template.title,
        description: template.description,
        color: parseColor(template.color) || 0x5865F2,
        footer: template.footer,
        thumbnail: template.thumbnail,
        image: template.image,
        fields: template.fields,
    }, guild);

    const buttons = readJson('buttons.json', {});
    const guildButtons = buttons[guild.id] || {};
    const templateButtons = Object.values(guildButtons).filter(b => b.embedName === name);
    const rows = [];
    let currentRow = new ActionRowBuilder();
    for (const btn of templateButtons) {
        if (currentRow.components.length >= 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }

        if (btn.type === 'link' && btn.url) {
            const b = new ButtonBuilder()
                .setLabel(btn.label)
                .setStyle(ButtonStyle.Link)
                .setURL(btn.url);
            if (btn.emoji) b.setEmoji(btn.emoji);
            currentRow.addComponents(b);
        } else {
            const b = new ButtonBuilder()
                .setCustomId(btn.id)
                .setLabel(btn.label)
                .setStyle(ButtonStyle[btn.style] || ButtonStyle.Primary);
            if (btn.emoji) b.setEmoji(btn.emoji);
            currentRow.addComponents(b);
        }
    }
    if (currentRow.components.length > 0) rows.push(currentRow);

    return { embed: sentEmbed, components: rows.length > 0 ? rows : [] };
}

module.exports.buildEmbedPayload = buildEmbedPayload;

// Handle button interactions for embed editing
module.exports.handleEmbedButton = async function(interaction) {
    if (!interaction.customId.startsWith('embed_edit_')) return false;

    const parts = interaction.customId.split('_');
    const action = parts[2];
    const sessionId = parts[3];
    const session = activeEdits.get(sessionId);

    if (!session) {
        return interaction.reply({
            embeds: [createServerEmbed('error', { title: 'Session Expired', description: 'This edit session has expired. Run `/embed edit` again.' }, interaction.guild)],
            flags: 64,
        });
    }

    if (session.userId !== interaction.user.id) {
        return interaction.reply({
            embeds: [createServerEmbed('error', { title: 'Not Your Session', description: 'You did not start this edit session.' }, interaction.guild)],
            flags: 64,
        });
    }

    const embeds = readJson('embeds.json', {});
    const template = embeds[session.guildId]?.[session.name];
    if (!template) {
        activeEdits.delete(sessionId);
        return interaction.reply({
            embeds: [createServerEmbed('error', { title: 'Template Not Found', description: 'This template no longer exists.' }, interaction.guild)],
            flags: 64,
        });
    }

    if (action === 'save') {
        activeEdits.delete(sessionId);
        const embed = createServerEmbed('success', { title: 'Saved', description: `Embed template **${session.name}** has been saved.` }, interaction.guild);
        return interaction.update({ content: null, embeds: [embed], components: [] });
    }

    if (action === 'cancel') {
        activeEdits.delete(sessionId);
        const embed = createServerEmbed('info', { title: 'Cancelled', description: 'Edit session cancelled. No changes were saved.' }, interaction.guild);
        return interaction.update({ content: null, embeds: [embed], components: [] });
    }

    // Open modal for text input fields
    const modal = new ModalBuilder()
        .setCustomId(`embed_modal_${action}_${sessionId}`)
        .setTitle('Edit Embed Field');

    let label, placeholder, currentValue, maxLength = 4000;

    switch (action) {
        case 'title':
            label = 'Title';
            placeholder = 'Enter new title...';
            currentValue = template.title || '';
            maxLength = 256;
            break;
        case 'desc':
            label = 'Description';
            placeholder = 'Enter new description...';
            currentValue = template.description || '';
            maxLength = 4000;
            break;
        case 'color':
            label = 'Color (Hex)';
            placeholder = '#5865F2';
            currentValue = template.color || '#5865F2';
            maxLength = 7;
            break;
        case 'footer':
            label = 'Footer Text';
            placeholder = 'Enter footer text...';
            currentValue = template.footer || '';
            maxLength = 2048;
            break;
        case 'thumb':
            label = 'Thumbnail URL';
            placeholder = 'https://example.com/image.png';
            currentValue = template.thumbnail || '';
            maxLength = 4000;
            break;
        case 'image':
            label = 'Image URL';
            placeholder = 'https://example.com/image.png';
            currentValue = template.image || '';
            maxLength = 4000;
            break;
        default:
            return;
    }

    const input = new TextInputBuilder()
        .setCustomId('value')
        .setLabel(label)
        .setStyle(action === 'desc' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setPlaceholder(placeholder)
        .setValue(currentValue)
        .setMaxLength(maxLength)
        .setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
};

// Handle modal submissions for embed editing
module.exports.handleEmbedModal = async function(interaction) {
    if (!interaction.customId.startsWith('embed_modal_')) return false;

    const parts = interaction.customId.split('_');
    const action = parts[2];
    const sessionId = parts[3];
    const session = activeEdits.get(sessionId);

    if (!session) {
        return interaction.reply({
            embeds: [createServerEmbed('error', { title: 'Session Expired', description: 'This edit session has expired.' }, interaction.guild)],
            flags: 64,
        });
    }

    const value = interaction.fields.getTextInputValue('value');
    const embeds = readJson('embeds.json', {});
    const template = embeds[session.guildId][session.name];

    switch (action) {
        case 'title':
            template.title = value || null;
            break;
        case 'desc':
            template.description = value || '';
            break;
        case 'color':
            template.color = value || '#5865F2';
            break;
        case 'footer':
            template.footer = value || null;
            break;
        case 'thumb':
            template.thumbnail = value || null;
            break;
        case 'image':
            template.image = value || null;
            break;
    }

    writeJson('embeds.json', embeds);

    // Rebuild preview
    const previewEmbed = new (require('discord.js').EmbedBuilder)()
        .setColor(parseColor(template.color) || 0x5865F2)
        .setDescription(template.description || null)
        .setTimestamp();
    if (template.title) previewEmbed.setTitle(template.title);
    if (template.footer) previewEmbed.setFooter({ text: template.footer });
    if (template.thumbnail) previewEmbed.setThumbnail(template.thumbnail);
    if (template.image) previewEmbed.setImage(template.image);

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`embed_edit_title_${sessionId}`).setLabel('📝 Title').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`embed_edit_desc_${sessionId}`).setLabel('📝 Description').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`embed_edit_color_${sessionId}`).setLabel('🎨 Color').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`embed_edit_footer_${sessionId}`).setLabel('📌 Footer').setStyle(ButtonStyle.Primary),
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`embed_edit_thumb_${sessionId}`).setLabel('🖼️ Thumbnail').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`embed_edit_image_${sessionId}`).setLabel('🖼️ Image').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`embed_edit_save_${sessionId}`).setLabel('💾 Save & Exit').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`embed_edit_cancel_${sessionId}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Danger),
    );

    await interaction.update({
        content: `Editing embed template **${session.name}**. Click a button to edit that field.`,
        embeds: [previewEmbed],
        components: [row1, row2],
    });
    return true;
};
