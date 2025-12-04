export class TradingBotError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TradingBotError';
    Object.setPrototypeOf(this, TradingBotError.prototype);
  }
}

export class APIError extends TradingBotError {
  constructor(message: string, public statusCode?: number, details?: any) {
    super(message, 'API_ERROR', details);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

export class ValidationError extends TradingBotError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class InsufficientFundsError extends TradingBotError {
  constructor(message: string = 'Insufficient funds', details?: any) {
    super(message, 'INSUFFICIENT_FUNDS', details);
    this.name = 'InsufficientFundsError';
    Object.setPrototypeOf(this, InsufficientFundsError.prototype);
  }
}

