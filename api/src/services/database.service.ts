import { Pool, PoolClient, QueryResult } from 'pg';
import { injectable } from 'tsyringe';
import { config } from '../config';
import { logger } from '../utils/logger';

@injectable()
export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.pool.on('connect', () => {
      logger.debug('Database connection established');
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error', err);
      process.exit(-1);
    });
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      logger.error('Error executing query', { text, error });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    const client = await this.pool.connect();
    
    // Set up query execution logging for this client
    const query = client.query;
    const release = client.release;
    
    // Set a timeout of 5 seconds
    const timeout = setTimeout(() => {
      logger.error('A client has been checked out for more than 5 seconds!');
      logger.error(`The last executed query on this client was: ${client['lastQuery']}`);
    }, 5000);
    
    // Monkey patch the query method to keep track of the last query
    client.query = (...args: any[]) => {
      client['lastQuery'] = args[0];
      return query.apply(client, args);
    };
    
    // Monkey patch the release method to clear the timeout
    client.release = () => {
      clearTimeout(timeout);
      client.query = query;
      client.release = release;
      return release.apply(client);
    };
    
    return client;
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Request management methods
  async getRequest(requestId: string): Promise<any> {
    const result = await this.query(
      'SELECT * FROM infrastructure_requests WHERE id = $1',
      [requestId]
    );
    return result.rows[0];
  }

  async updateRequestStatus(
    requestId: string, 
    status: string, 
    message?: string,
    data: any = {}
  ): Promise<void> {
    await this.query(
      `INSERT INTO infrastructure_requests (id, status, message, data, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE
       SET status = $2, message = $3, data = $4, updated_at = NOW()`,
      [requestId, status, message, data]
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
