const mongoose = require('mongoose');
const crypto = require('crypto');

const useMemory = !process.env.MONGODB_URI || String(process.env.NO_DB).toLowerCase() === 'true';

if (useMemory) {
  const conversations = [];

  class Conversation {
    constructor(obj = {}){
      this._id = obj._id || crypto.randomBytes(12).toString('hex');
      this.type = obj.type || 'dm'; // 'dm' | 'group'
      this.title = obj.title || '';
      this.participants = Array.isArray(obj.participants) ? obj.participants.map(String) : [];
      this.eventId = obj.eventId ? String(obj.eventId) : null;
      this.createdAt = obj.createdAt || new Date();
      this.updatedAt = obj.updatedAt || new Date();
    }

    async save(){
      this.updatedAt = new Date();
      const idx = conversations.findIndex(c => String(c._id) === String(this._id));
      if (idx >= 0) conversations[idx] = { ...conversations[idx], ...this };
      else conversations.push({ ...this });
      return this;
    }

    static async findById(id){
      const c = conversations.find(cv => String(cv._id) === String(id));
      return c ? new Conversation(c) : null;
    }

    static async find(filter = {}){
      let list = [...conversations];
      if (filter.type) list = list.filter(c => c.type === filter.type);
      if (filter.eventId) list = list.filter(c => String(c.eventId) === String(filter.eventId));
      if (filter.participantId) list = list.filter(c => c.participants.includes(String(filter.participantId)));
      return list.map(c => new Conversation(c));
    }

    static async findDM(userA, userB){
      const [a, b] = [String(userA), String(userB)].sort();
      return conversations.find(c => c.type === 'dm' && c.participants.includes(a) && c.participants.includes(b));
    }
  }

  module.exports = Conversation;
  return;
}

const conversationSchema = new mongoose.Schema({
  type: { type: String, enum: ['dm', 'group'], default: 'dm' },
  title: { type: String },
  participants: [{ type: String }],
  eventId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

conversationSchema.pre('save', function(next){ this.updatedAt = Date.now(); next(); });

module.exports = mongoose.model('Conversation', conversationSchema);
