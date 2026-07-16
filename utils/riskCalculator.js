const FUTURES_SPECS = {
  ES: {
    name: 'E-mini S&P 500',
    symbol: 'ES',
    tickSize: 0.25,
    tickValue: 12.5,
    pointValue: 50,
    microSymbol: 'MES',
    color: 0x2ecc71,
  },
  // ... rest of specs (same as before)
};

function calculateRisk(symbol, riskUsd, stopPoints) {
  const spec = FUTURES_SPECS[symbol.toUpperCase()];

  if (!spec) {
    return { error: `Unknown symbol: **${symbol}**. Supported: ${Object.keys(FUTURES_SPECS).join(', ')}` };
  }

  if (stopPoints <= 0) {
    return { error: 'Stop distance must be greater than 0.' };
  }

  if (riskUsd <= 0) {
    return { error: 'Risk amount must be greater than 0.' };
  }

  const standardRiskPerContract = stopPoints * spec.pointValue;
  const standardContracts = Math.floor(riskUsd / standardRiskPerContract);

  let microResult = null;
  if (spec.microSymbol) {
    const microSpec = FUTURES_SPECS[spec.microSymbol];
    const microRiskPerContract = stopPoints * microSpec.pointValue;
    const microContracts = Math.floor(riskUsd / microRiskPerContract);

    microResult = {
      symbol: spec.microSymbol,
      name: microSpec.name,
      contracts: microContracts,
      riskPerContract: microRiskPerContract,
      totalRisk: microContracts * microRiskPerContract,
    };
  }

  return {
    symbol: spec.symbol,
    name: spec.name,
    color: spec.color,
    riskUsd,
    stopPoints,
    standard: {
      symbol: spec.symbol,
      contracts: standardContracts,
      riskPerContract: standardRiskPerContract,
      totalRisk: standardContracts * standardRiskPerContract,
    },
    micro: microResult,
    needsMicro: standardContracts === 0,
  };
}

function formatUsd(value) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = { calculateRisk, formatUsd, FUTURES_SPECS };
