export interface Market {
  id: string;
  question: string;
  description: string;
  conditionId: string;
  endDate: string;
  imageUrl?: string;
  active: boolean;
  outcomes: string[];
}

export interface OrderBook {
  market: string;
  bids: Order[];
  asks: Order[];
}

export interface Order {
  id: string;
  market: string;
  outcome: string;
  side: 'buy' | 'sell';
  price: string;
  size: string;
  timestamp: number;
  maker?: string;
}

export interface Trade {
  id: string;
  market: string;
  outcome: string;
  side: 'buy' | 'sell';
  price: string;
  size: string;
  timestamp: number;
  taker: string;
  maker: string;
}

export interface Position {
  market: string;
  outcome: string;
  side: 'yes' | 'no';
  size: string;
  averagePrice: string;
  unrealizedPnl: string;
  realizedPnl: string;
}

export interface Account {
  address: string;
  balance: string;
  positions: Position[];
}

export interface CreateOrderParams {
  market: string;
  outcome: 'yes' | 'no';
  side: 'buy' | 'sell';
  price: string;
  size: string;
  expiration?: number;
}

export interface OrderResponse {
  id: string;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  fills?: Fill[];
}

export interface Fill {
  id: string;
  price: string;
  size: string;
  timestamp: number;
}

export interface ArbitrageOpportunity {
  market: string;
  outcome: string;
  buyPrice: string;
  sellPrice: string;
  profitMargin: number;
  buyOrder: Order;
  sellOrder: Order;
}

