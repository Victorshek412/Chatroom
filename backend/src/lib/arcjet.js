import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/node";
import { ENV } from "./env.js";

// Validate ARCJET_KEY before initialization
if (!ENV.ARCJET_KEY) {
  console.error("❌ Error: ARCJET_KEY environment variable is not set.");
  console.error("Please add ARCJET_KEY to your .env file.");
  process.exit(1);
}

const aj = arcjet({
  key: ENV.ARCJET_KEY,
  rules: [
    // Shield protects your app from common attacks e.g. SQL injection
    shield({ mode: "LIVE" }),
    // Create a bot detection rule
    detectBot({
      mode: "LIVE", // Blocks requests. Use "DRY_RUN" to log only
      // Block all bots except the following
      allow: [
        "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc
        // Uncomment to allow these other common bot categories
        // See the full list at https://arcjet.com/bot-list
        //"CATEGORY:MONITOR", // Uptime monitoring services
        //"CATEGORY:PREVIEW", // Link previews e.g. Slack, Discord
      ],
    }),
    // Create a token bucket rate limit. Other algorithms are supported.
    slidingWindow({
      mode: "LIVE", // Blocks requests. Use "DRY_RUN" to log only
      // Max 100 requests per minute per IP
      max: 100,
      interval: 60, // seconds
    }),
  ],
});

export default aj;
