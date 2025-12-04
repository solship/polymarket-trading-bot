import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import {
  Market,
  OrderBook,
  Order,
  Trade,
  Position,
  Account,
  CreateOrderParams,
  OrderResponse,
} from '../types/polymarket';

export class PolymarketAPI {
  private client: AxiosInstance;
  private wsConnection?: WebSocket;
  private wsUrl: string;

  constructor() {
    this.client = axios.create({
      baseURL: config.polymarket.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(config.polymarket.apiKey && {
          Authorization: `Bearer ${config.polymarket.apiKey}`,
        }),
      },
      timeout: 30000,
    });

    this.wsUrl = config.polymarket.wsUrl;

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (request) => {
        logger.debug(`API Request: ${request.method?.toUpperCase()} ${request.url}`);
        return request;
      },
      (error) => {
        logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('API Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get all active markets
   */
  async getMarkets(): Promise<Market[]> {
    try {
      const response = await this.client.get('/markets');
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch markets:', error);
      throw error;
    }
  }

  /**
   * Get market by ID
   */
  async getMarket(marketId: string): Promise<Market> {
    try {
      const response = await this.client.get(`/markets/${marketId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch market ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * Get order book for a market
   */
  async getOrderBook(marketId: string, outcome: 'yes' | 'no'): Promise<OrderBook> {
    try {
      const response = await this.client.get(`/markets/${marketId}/orderbook`, {
        params: { outcome },
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch order book for ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * Get recent trades for a market
   */
  async getTrades(marketId: string, limit: number = 100): Promise<Trade[]> {
    try {
      const response = await this.client.get(`/markets/${marketId}/trades`, {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch trades for ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * Get account information
   */
  async getAccount(address: string): Promise<Account> {
    try {
      const response = await this.client.get(`/accounts/${address}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch account ${address}:`, error);
      throw error;
    }
  }

  /**
   * Get positions for an account
   */
  async getPositions(address: string): Promise<Position[]> {
    try {
      const response = await this.client.get(`/accounts/${address}/positions`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch positions for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Create a new order
   */
  async createOrder(params: CreateOrderParams): Promise<OrderResponse> {
    try {
      const orderData = {
        market: params.market,
        outcome: params.outcome,
        side: params.side,
        price: params.price,
        size: params.size,
        expiration: params.expiration || Date.now() + 86400000, // Default 24 hours
      };

      logger.info('Creating order:', orderData);

      const response = await this.client.post('/orders', orderData);
      return response.data;
    } catch (error) {
      logger.error('Failed to create order:', error);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<void> {
    try {
      await this.client.delete(`/orders/${orderId}`);
      logger.info(`Order ${orderId} cancelled`);
    } catch (error) {
      logger.error(`Failed to cancel order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get order status
   */
  async getOrder(orderId: string): Promise<OrderResponse> {
    try {
      const response = await this.client.get(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to market updates via WebSocket
   */
  subscribeToMarket(marketId: string, callback: (data: any) => void): void {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      this.connectWebSocket();
    }

    const subscribeMessage = {
      type: 'subscribe',
      channel: `market:${marketId}`,
    };

    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify(subscribeMessage));
      logger.info(`Subscribed to market ${marketId}`);
    }

    // Store callback for handling messages
    if (this.wsConnection) {
      this.wsConnection.on('message', (data: WebSocket.Data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.channel === `market:${marketId}`) {
            callback(parsed);
          }
        } catch (error) {
          logger.error('Error parsing WebSocket message:', error);
        }
      });
    }
  }

  /**
   * Connect to WebSocket
   */
  private connectWebSocket(): void {
    try {
      this.wsConnection = new WebSocket(this.wsUrl);

      this.wsConnection.on('open', () => {
        logger.info('WebSocket connected');
      });

      this.wsConnection.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });

      this.wsConnection.on('close', () => {
        logger.warn('WebSocket closed, attempting to reconnect...');
        setTimeout(() => this.connectWebSocket(), 5000);
      });
    } catch (error) {
      logger.error('Failed to connect WebSocket:', error);
    }
  }

  /**
   * Close WebSocket connection
   */
  disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = undefined;
    }
  }
}

