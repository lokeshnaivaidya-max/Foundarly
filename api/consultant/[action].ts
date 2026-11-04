import meHandler from '../../src/server/consultant/me.js';
import bookingsHandler from '../../src/server/consultant/bookings.js';

/**
 * Consolidated consultant API router (Vercel Hobby 12-function limit).
 *
 * Serves the SAME public URLs as before via a single Serverless Function:
 *   GET  /api/consultant/me        -> meHandler
 *   GET  /api/consultant/bookings  -> bookingsHandler
 *
 * Vercel maps the dynamic [action] segment onto req.query.action. Every action
 * keeps its own authentication, authorization, CORS, validation, bounded
 * execution and response shapes — implemented in src/server/consultant/*.
 * Unknown actions receive an explicit 404; nothing here is publicly accessible
 * (each action enforces Bearer authentication itself).
 */
interface RequestLike {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

interface ResponseLike {
  status: (code: number) => ResponseLike;
  json: (data: unknown) => ResponseLike;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const rawAction = req.query?.action;
  const action = Array.isArray(rawAction) ? rawAction[0] : rawAction;

  switch (action) {
    case 'me':
      return meHandler(req, res);
    case 'bookings':
      return bookingsHandler(req, res);
    default:
      return res.status(404).json({
        success: false,
        error: 'Unknown consultant API action. Supported actions: me, bookings.',
      });
  }
}
