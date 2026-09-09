/* Template for api/config.js — the chatbot's API key configuration.
 *
 * 1. Copy:  cp api/config.sample.js api/config.js
 * 2. Paste your Cohere key below (get one: https://dashboard.cohere.com/api-keys)
 *
 * api/config.js is gitignored — it is NEVER committed.
 * On GitHub Pages, the deploy workflow (.github/workflows/deploy.yml)
 * generates this file automatically from the COHERE_API_KEY secret.
 */
window.QN_CHAT_CONFIG = {
    cohereApiKey: 'PUT_YOUR_COHERE_API_KEY_HERE'
};
