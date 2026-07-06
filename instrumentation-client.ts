import { initBotId } from 'botid/client/core';

// BotID client challenge. Runs invisibly and only attaches classification
// headers to the protected routes below, so real recruiters never see a
// challenge. The public chatbot and its scheduling handoff are the abuse
// vectors (each triggers Anthropic calls / a candidate email), so they are
// the protected endpoints. Server routes verify with checkBotId().
initBotId({
  protect: [
    { path: '/api/chat', method: 'POST' },
    { path: '/api/chat/schedule', method: 'POST' },
  ],
});
