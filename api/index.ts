import 'dotenv/config';
import { createApiApp } from '../server/app.js';

// Vercel treats a file under /api that exports an Express app as a single
// serverless function; vercel.json rewrites every /api/* request here.
export default createApiApp();
