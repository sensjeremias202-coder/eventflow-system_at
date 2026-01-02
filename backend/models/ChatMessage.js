const mongoose = require('mongoose');
const crypto = require('crypto');

const useMemory = !process.env.MONGODB_URI || String(process.env.NO_DB).toLowerCase() === 'true';

if (useMemory) {
  const messages = [];

  class ChatMessage {
    constructor(obj = {}){
      this._id = obj._id || crypto.randomBytes(12).toString('hex');
      this.conversationId = String(obj.conversationId);
      this.senderId = String(obj.senderId);
      this.senderName = obj.senderName || '';
      this.text = String(obj.text || '');
      this.time = obj.time || '';
      this.status = obj.status || 'delivered';
      this.createdAt = obj.createdAt || new Date();
    }

    async save(){
      const idx = messages.findIndex(m => String(m._id) === String(this._id));
      if (idx >= 0) messages[idx] = { ...messages[idx], ...this };
      else messages.push({ ...this });
      return this;
    }

    static async find(filter = {}){
      let list = messages.filter(m => String(m.conversationId) === String(filter.conversationId));
      const page = Number(filter.page || 1);
      const limit = Number(filter.limit || 50);
      const start = (page - 1) * limit;
      return list.slice(start, start + limit).map(m => new ChatMessage(m));
    }
  }

  module.exports = ChatMessage;
  return;
}

const chatMessageSchema = new mongoose.Schema({
  conversationId: { type: String, index: true },
  senderId: { type: String },
  senderName: { type: String },
  text: { type: String },
  time: { type: String },
  status: { type: String, default: 'delivered' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
