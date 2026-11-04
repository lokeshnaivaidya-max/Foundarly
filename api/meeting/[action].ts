import validateAccessHandler from '../../src/server/meeting/validate-access.js';
import recordJoinHandler from '../../src/server/meeting/record-join.js';
import notifyWaitingHandler from '../../src/server/meeting/notify-waiting.js';

/**
 * Consolidated meeting API router (Vercel Hobby 12-function limit).
 *
 * Serves the SAME public URLs as before via a single Serverless Function:
 *   POST /api/meeting/validate-access  -> validateAccessHandler
 *   POST /api/meeting/record-join      -> recordJoinHandler
 *   POST /api/meeting/notify-waiting   -> notifyWaitingHandler
 *
 * Vercel maps the dynamic [action] segment onto req.query.action. Every action
 * keeps its own method validation, CORS, rate limiting, authentication,
 * authorization and response shapes — implemented in src/server/meeting/*.
 * Unknown actions receive an explicit 404.
 */
interface RequestLike {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
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
    case 'validate-access':
      return validateAccessHandler(req, res);
    case 'record-join':
      return recordJoinHandler(req, res);
    case 'notify-waiting':
      return notifyWaitingHandler(req, res);
    default:
      return res.status(404).json({
        success: false,
        error: 'Unknown meeting API action. Supported actions: validate-access, record-join, notify-waiting.',
      });
  }
}
