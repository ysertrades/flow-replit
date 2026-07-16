const { getBalance, addCoins, removeCoins } = require('./economyManager');

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ value, suit });
    }
  }
  return shuffle(deck);
}

function cardDisplay(card) {
  return '[' + card.value + card.suit + ']';
}

function calculateHandValue(cards) {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.value === 'A') {
      aces += 1;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  return value;
}

function playCoinflip(userId, bet, choice, winChance = 0.48) {
  if (!['heads', 'tails'].includes(choice.toLowerCase())) {
    return { success: false, error: 'Invalid choice. Use heads or tails.' };
  }

  const userBalance = getBalance(userId);
  if (userBalance < bet) {
    return { success: false, error: 'Insufficient balance.' };
  }

  removeCoins(userId, bet);

  const result = Math.random() < winChance;
  const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
  const playerWon = choice.toLowerCase() === coinResult && result;

  let winnings = 0;
  if (playerWon) {
    winnings = Math.floor(bet * 2);
    addCoins(userId, winnings);
  }

  return {
    success: true,
    result: coinResult,
    won: playerWon,
    choice: choice.toLowerCase(),
    bet,
    winnings,
    newBalance: getBalance(userId),
  };
}

function initBlackjack(userId, bet) {
  const userBalance = getBalance(userId);
  if (userBalance < bet) {
    return { success: false, error: 'Insufficient balance.' };
  }

  removeCoins(userId, bet);

  const deck = createDeck();
  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];

  return {
    success: true,
    userId,
    bet,
    deck,
    playerHand,
    dealerHand,
    gameActive: true,
    result: null,
  };
}

function blackjackHit(gameState) {
  if (!gameState.gameActive) {
    return { success: false, error: 'Game not active.' };
  }

  gameState.playerHand.push(gameState.deck.pop());
  const playerValue = calculateHandValue(gameState.playerHand);

  if (playerValue > 21) {
    gameState.gameActive = false;
    gameState.result = 'bust';
    return { success: true, gameState, bust: true };
  }

  return { success: true, gameState, bust: false };
}

function blackjackStand(gameState) {
  if (!gameState.gameActive) {
    return { success: false, error: 'Game not active.' };
  }

  let dealerValue = calculateHandValue(gameState.dealerHand);
  while (dealerValue < 17 && gameState.deck.length > 0) {
    gameState.dealerHand.push(gameState.deck.pop());
    dealerValue = calculateHandValue(gameState.dealerHand);
  }

  gameState.gameActive = false;

  const playerValue = calculateHandValue(gameState.playerHand);
  const isBlackjack = gameState.playerHand.length === 2 && playerValue === 21;

  let winnings = 0;
  let result = 'loss';

  if (playerValue > 21) {
    result = 'bust';
  } else if (dealerValue > 21) {
    result = 'win';
    winnings = isBlackjack ? Math.floor(gameState.bet * 2.5) : Math.floor(gameState.bet * 2);
  } else if (playerValue > dealerValue) {
    result = 'win';
    winnings = Math.floor(gameState.bet * 2);
  } else if (playerValue === dealerValue) {
    result = 'push';
    winnings = gameState.bet;
  }

  if (winnings > 0) {
    addCoins(gameState.userId, winnings);
  }

  gameState.result = result;
  gameState.winnings = winnings;
  gameState.finalBalance = getBalance(gameState.userId);

  return { success: true, gameState };
}

function playTrading(userId, bet, direction, riskReward = '1:1') {
  const userBalance = getBalance(userId);
  if (userBalance < bet) {
    return { success: false, error: 'Insufficient balance.' };
  }

  const rrMap = {
    '1:1': { multiplier: 2, winChance: 0.55 },
    '1:2': { multiplier: 3, winChance: 0.40 },
    '1:3': { multiplier: 4, winChance: 0.30 },
  };

  if (!rrMap[riskReward]) {
    return { success: false, error: 'Invalid risk/reward ratio.' };
  }

  removeCoins(userId, bet);

  const config = rrMap[riskReward];
  const won = Math.random() < config.winChance;

  let winnings = 0;
  if (won) {
    winnings = Math.floor(bet * config.multiplier);
    addCoins(userId, winnings);
  }

  const chart = generateTradingChart(direction, won);

  return {
    success: true,
    bet,
    direction,
    riskReward,
    won,
    winnings,
    newBalance: getBalance(userId),
    chart,
  };
}

function generateTradingChart(direction, won) {
  const lines = [];
  const height = 10;

  let values = [];
  let basePrice = 50;

  for (let i = 0; i < 20; i++) {
    if (direction === 'buy') {
      basePrice += (won ? 1 : -1) * Math.random() * 5;
    } else {
      basePrice += (won ? -1 : 1) * Math.random() * 5;
    }
    values.push(Math.max(20, Math.floor(basePrice)));
  }

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  for (let h = height - 1; h >= 0; h--) {
    let line = '';
    for (let i = 0; i < values.length; i++) {
      const normalized = (values[i] - minVal) / range;
      const barHeight = Math.round(normalized * height);
      if (barHeight >= h) {
        line += won ? '█' : '▁';
      } else {
        line += ' ';
      }
    }
    if (line.trim()) lines.push(line);
  }

  lines.push('└' + '─'.repeat(19));

  return lines.join('\n');
}

module.exports = {
  shuffle,
  createDeck,
  cardDisplay,
  calculateHandValue,
  playCoinflip,
  initBlackjack,
  blackjackHit,
  blackjackStand,
  playTrading,
  generateTradingChart,
};
