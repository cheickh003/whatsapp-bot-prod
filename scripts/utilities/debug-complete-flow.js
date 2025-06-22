require('dotenv').config();
const { appwriteService } = require('./dist/services/appwrite.service');
const { memoryService } = require('./dist/services/memory.service');
const { aiService } = require('./dist/services/ai.service');

async function debugCompleteFlow() {
  try {
    console.log('=== DEBUGGING COMPLETE MESSAGE FLOW ===\n');
    
    const phoneNumber = '2250703079410@c.us';
    
    // Step 1: Check existing data
    console.log('1. CHECKING EXISTING DATA:');
    const conv = await appwriteService.getOrCreateConversation(phoneNumber);
    console.log('   Conversation ID:', conv.$id);
    
    const history = await appwriteService.getConversationHistory(conv.$id, 50);
    console.log('   Total messages in DB:', history.length);
    
    if (history.length > 0) {
      console.log('\n   Last 5 messages:');
      history.slice(-5).forEach((msg, idx) => {
        console.log(`   ${idx + 1}. [${msg.role}] ${msg.content.substring(0, 100)}...`);
      });
    }
    
    // Step 2: Test message processing
    console.log('\n2. TESTING MESSAGE PROCESSING:');
    const testMessage = 'Comment je m\'appelle?';
    console.log('   Sending:', testMessage);
    
    // Load context
    const context = await memoryService.loadConversationContext(phoneNumber);
    console.log('   Context loaded - History length:', context.messageHistory.length);
    
    // Convert to messages
    const messages = aiService.convertHistoryToMessages(context.messageHistory);
    console.log('   Converted to', messages.length, 'BaseMessage objects');
    
    // Add current message
    const { HumanMessage } = require('@langchain/core/messages');
    messages.push(new HumanMessage(testMessage));
    
    // Show what will be sent to AI
    console.log('\n3. MESSAGES BEING SENT TO AI:');
    console.log('   Total messages:', messages.length);
    console.log('\n   First 3 messages:');
    messages.slice(0, 3).forEach((msg, idx) => {
      const role = msg._getType() === 'human' ? 'Human' : msg._getType() === 'ai' ? 'AI' : 'System';
      console.log(`   ${idx + 1}. [${role}] ${msg.content.toString().substring(0, 100)}...`);
    });
    
    console.log('\n   Last 3 messages:');
    messages.slice(-3).forEach((msg, idx) => {
      const role = msg._getType() === 'human' ? 'Human' : msg._getType() === 'ai' ? 'AI' : 'System';
      console.log(`   ${idx + 1}. [${role}] ${msg.content.toString().substring(0, 100)}...`);
    });
    
    // Process with AI
    console.log('\n4. SENDING TO AI...');
    const response = await aiService.processMessage(conv.$id, testMessage, messages);
    console.log('\n   AI Response:', response);
    
    // Check if history includes "cheickh"
    console.log('\n5. CHECKING FOR NAME IN HISTORY:');
    const hasName = history.some(msg => msg.content.toLowerCase().includes('cheickh'));
    console.log('   History contains "cheickh":', hasName);
    
    if (hasName) {
      const nameMessages = history.filter(msg => msg.content.toLowerCase().includes('cheickh'));
      console.log('   Messages mentioning "cheickh":');
      nameMessages.forEach((msg, idx) => {
        console.log(`   ${idx + 1}. [${msg.role}] ${msg.content}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

setTimeout(debugCompleteFlow, 2000);