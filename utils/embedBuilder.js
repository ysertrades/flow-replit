const { EmbedBuilder } = require('discord.js');

const colors = {
    success: 0x57F287,
    error: 0xED4245,
    info: 0x5865F2,
    warning: 0xFEE75C,
    giveaway: 0xF47FFF,
    ticket: 0x00D4AA,
    userinfo: 0x9B59B6,
    shop: 0xF39C12,
    inventory: 0x3498DB,
    schedule: 0x9B5DE5,
    welcome: 0x2ECC71,
    leave: 0xE67E22,
};

// Auto-prefixed icon per embed type, used to give plain confirmation titles
// ("Removed", "Not Found", ...) a consistent, recognizable look without
// every command having to remember its own emoji.
const typeIcons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
    giveaway: '🎉',
    ticket: '🎫',
    userinfo: '👤',
    shop: '🛒',
    inventory: '🎒',
    schedule: '🗓️',
    welcome: '🌱',
    leave: '🍂',
};

// Matches an emoji (or emoji-presentation symbol) at the start of a string,
// so we don't double up when a title already has one (e.g. "🔨 Banned").
const LEADING_EMOJI = /^\p{Extended_Pictographic}/u;

function parseColor(colorInput) {
    if (!colorInput) return null;
    if (colorInput.startsWith('#')) {
        const parsed = parseInt(colorInput.slice(1), 16);
        return isNaN(parsed) ? null : parsed;
    }
    const parsed = parseInt(colorInput, 16);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFFFFFF) return parsed;
    return null;
}

function decorateTitle(type, title) {
    if (!title) return title;
    if (LEADING_EMOJI.test(title)) return title;
    const icon = typeIcons[type];
    return icon ? `${icon} ${title}` : title;
}

function createEmbed(type, options = {}) {
    const embed = new EmbedBuilder()
        .setColor(options.color || colors[type] || colors.info)
        .setTimestamp();

    if (options.title) embed.setTitle(decorateTitle(type, options.title));
    if (options.description) embed.setDescription(options.description);
    if (options.footer) embed.setFooter({ text: options.footer, iconURL: options.footerIcon });
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);
    if (options.author) embed.setAuthor({ name: options.author.name, iconURL: options.author.iconURL });
    if (options.fields) {
        for (const field of options.fields) {
            embed.addFields({
                name: field.name,
                value: field.value,
                inline: field.inline || false,
            });
        }
    }
    return embed;
}

// Guild-flavored variant: adds a consistent brand footer and a small
// author tag (server icon + name) so every embed sent by the bot — not just
// the ones that already set a thumbnail/author — carries the same polish.
function createServerEmbed(type, options = {}, guild) {
    const footerText = options.footer || `${guild?.name || 'Server'} • YSER Flow`;
    const author = options.author || (guild ? { name: 'YSER Flow', iconURL: guild.iconURL?.({ dynamic: true }) || undefined } : undefined);
    return createEmbed(type, { ...options, footer: footerText, author });
}

module.exports = { createEmbed, createServerEmbed, colors, parseColor };
