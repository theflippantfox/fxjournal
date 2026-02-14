// src/lib/server/storage.ts
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'src/lib/server/data';

// Ensure data directory exists
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

// Generic read function
export async function readData<T>(filename: string, defaultValue: T): Promise<T> {
  await ensureDataDir();
  const filepath = join(DATA_DIR, filename);
  
  try {
    if (existsSync(filepath)) {
      const content = await readFile(filepath, 'utf-8');
      return JSON.parse(content);
    }
    return defaultValue;
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return defaultValue;
  }
}

// Generic write function
export async function writeData<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir();
  const filepath = join(DATA_DIR, filename);
  
  try {
    await writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    throw error;
  }
}

// Specific data accessors
export const storage = {
  // Trades
  async getTrades() {
    return readData('trades.json', []);
  },
  async saveTrades(trades: any[]) {
    return writeData('trades.json', trades);
  },
  
  // Accounts
  async getAccounts() {
    return readData('accounts.json', [
      {
        id: 'default',
        name: 'Main Account',
        broker: '',
        currency: 'USD',
        balance: 10000,
        initialBalance: 10000,
        color: '#00d4ff',
        createdAt: new Date().toISOString()
      }
    ]);
  },
  async saveAccounts(accounts: any[]) {
    return writeData('accounts.json', accounts);
  },
  
  // Instruments
  async getInstruments() {
    return readData('instruments.json', [
      // Forex majors
      'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
      // Forex minors
      'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/CHF', 'AUD/JPY', 'EUR/AUD', 'GBP/CAD',
      'GBP/AUD', 'AUD/NZD', 'EUR/CAD', 'EUR/NZD', 'GBP/NZD', 'CAD/JPY', 'CHF/JPY',
      // Metals
      'XAU/USD', 'XAG/USD',
      // Indices
      'US30', 'US500', 'NAS100', 'GER40', 'UK100', 'JPN225',
      // Crypto
      'BTC/USD', 'ETH/USD', 'SOL/USD',
      // Energy
      'USOIL', 'UKOIL'
    ]);
  },
  async saveInstruments(instruments: string[]) {
    return writeData('instruments.json', instruments);
  },
  
  // Active account ID
  async getActiveAccountId() {
    return readData('active-account.json', { id: 'default' });
  },
  async saveActiveAccountId(accountId: string) {
    return writeData('active-account.json', { id: accountId });
  }
};
