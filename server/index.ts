import 'dotenv/config';
import { createApp } from './app';
import { loadConfig } from './config';

const { port, deps } = loadConfig(process.env);

if (deps.ai.name === 'rules') console.warn('[ai] GEMINI_API_KEY not set. Using the built-in rule-based advisor.');

createApp(deps).listen(port, () => {
  console.log(`Smog Shield API listening on http://localhost:${port} (advisor: ${deps.ai.name})`);
});
