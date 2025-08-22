// Replace the generateActingGuide function with this:
async function generateActingGuide(data) {
  try {
    const Anthropic = require('@anthropic-ai/sdk').default;
    
    const anthropic = new Anthropic({
      apiKey: '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',
    });

    const message = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 2000,
      messages: [{
        role: "user", 
        content: `Create a detailed professional acting guide for ${data.characterName} in "${data.productionTitle}". Analyze this script: ${data.sceneText}`
      }]
    });

    return message.content[0].text;
  } catch (error) {
    console.log('Anthropic failed:', error.message);
    return generateFallbackGuide(data);
  }
}
