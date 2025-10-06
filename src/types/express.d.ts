import { Session } from '../services/sessionService';
import { Client } from '../services/clientService';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
      client?: Client;
      session?: Session;
    }
  }
}

export {};