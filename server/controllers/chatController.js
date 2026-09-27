const { validateEnv } = require('../config/env');
const env = validateEnv();

// In a real Nugen integration, you'd use their SDK or specific REST endpoint here.
// E.g. const NUGEN_API_KEY = process.env.NUGEN_API_KEY;
// const NUGEN_ENDPOINT = 'https://api.nugen.in/v1/chat/completions';

exports.handleChat = async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    // MOCK NUGEN INFERENCE
    // Since we don't have the real Nugen API Key in the environment yet, 
    // we return a mocked response. This ensures the app doesn't crash 
    // and satisfies the frontend integration perfectly.
    // Replace this block with your actual `fetch(NUGEN_ENDPOINT)` call once signed up.
    
    let botReply = '';
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      botReply = 'Namaskar! I am your HiddenGems-AI Concierge. How can I help you explore Ratnagiri today?';
    } else if (lowerMessage.includes('goa') || lowerMessage.includes('mumbai')) {
      botReply = 'I apologize, but I only specialize in the beautiful Ratnagiri district! Let me know if you want to explore local beaches or heritage sites here instead.';
    } else if (lowerMessage.includes('food') || lowerMessage.includes('eat')) {
      botReply = 'Ratnagiri is famous for its Konkani seafood and Alphonso mangoes! Have you checked out Hotel Amantran or our Hidden Food vibes on the map?';
    } else if (lowerMessage.includes('itinerary')) {
      botReply = 'I see you are planning an itinerary! If you tell me your budget and available time, I can recommend the perfect local merchants and spots.';
    } else {
      botReply = 'That sounds like a great plan! Ratnagiri has so much to offer. Let me know if you need specific verified local merchant recommendations.';
    }

    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 800));

    return res.json({
      success: true,
      data: {
        reply: botReply,
        model: 'nugen-aligned-ratnagiri-v1'
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, message: 'An internal error occurred during chat inference.' });
  }
};
