const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../../config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("risk")
        .setDescription("Futures risk calculator")
        .addNumberOption(opt => opt.setName("riskamount").setDescription("Risk amount in $").setRequired(true))
        .addNumberOption(opt => opt.setName("stoppoints").setDescription("Stop loss in points").setRequired(true))
        .addStringOption(opt => opt.setName("symbol").setDescription("Futures symbol")
            .setRequired(true)
            .addChoices(
                { name: "NQ (E-mini Nasdaq)", value: "NQ" },
                { name: "ES (E-mini S&P 500)", value: "ES" },
                { name: "YM (E-mini Dow)", value: "YM" },
                { name: "RTY (E-mini Russell)", value: "RTY" },
                { name: "GC (Gold)", value: "GC" },
                { name: "SI (Silver)", value: "SI" }
            )),

    async execute(interaction) {
        const riskAmount = interaction.options.getNumber("riskamount");
        const stopPoints = interaction.options.getNumber("stoppoints");
        const symbol = interaction.options.getString("symbol");

        const pair = config.futuresPairs.find(p => p.symbol === symbol);
        if (!pair) {
            return interaction.reply({ content: "❌ Invalid symbol.", ephemeral: true });
        }

        // Calculate ticks
        const ticks = stopPoints / pair.tickSize;

        // Standard contracts
        const riskPerStandard = ticks * pair.tickValue;
        const standardContracts = Math.floor(riskAmount / riskPerStandard);

        // Micro contracts
        const riskPerMicro = ticks * pair.microTickValue;
        const microContracts = Math.floor(riskAmount / riskPerMicro);

        // Determine best option
        let bestOption, altOption;

        if (standardContracts >= 1) {
            bestOption = { type: pair.symbol, contracts: standardContracts, exactRisk: (standardContracts * riskPerStandard).toFixed(2) };
            if (microContracts > standardContracts * (pair.tickValue / pair.microTickValue)) {
                altOption = { type: pair.microSymbol, contracts: microContracts, exactRisk: (microContracts * riskPerMicro).toFixed(2) };
            }
        } else {
            bestOption = { type: pair.microSymbol, contracts: microContracts, exactRisk: (microContracts * riskPerMicro).toFixed(2) };
        }

        const embed = new EmbedBuilder()
            .setColor(0x474747)
            .setTitle(`🏅 ${symbol} Risk Calculation`)
            .addFields(
                { name: "Risk Amount", value: `$${riskAmount.toFixed(2)}`, inline: true },
                { name: "Stop Points", value: `${stopPoints}`, inline: true },
                { name: "​", value: "​", inline: true },
                { name: "✅ Best Contract", value: `**${bestOption.type}** — ${bestOption.contracts} contract(s)\nExact risk: $${bestOption.exactRisk}`, inline: false }
            )
            .setTimestamp();

        if (altOption) {
            embed.addFields({
                name: "🔄 Alternative",
                value: `**${altOption.type}** — ${altOption.contracts} contract(s)\nExact risk: $${altOption.exactRisk}`,
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    }
};
