const mongoose = require('mongoose');
const crypto = require('crypto');

const useMemory = !process.env.MONGODB_URI || String(process.env.NO_DB).toLowerCase() === 'true';

if (useMemory) {
  const posts = [];
  class Post {
    constructor(obj = {}) {
      this._id = obj._id || crypto.randomBytes(12).toString('hex');
      this.userId = String(obj.userId || '');
      this.userName = obj.userName || '';
      this.content = obj.content || '';
      this.mediaUrl = obj.mediaUrl || null;
      this.createdAt = obj.createdAt || new Date();
      this.likes = Array.isArray(obj.likes) ? obj.likes.map(String) : [];
      this.comments = Array.isArray(obj.comments) ? obj.comments : [];
    }
    async save(){
      const idx = posts.findIndex(p => String(p._id) === String(this._id));
      if (idx >= 0) posts[idx] = { ...posts[idx], ...this }; else posts.push({ ...this });
      return this;
    }
    static async create(obj){ const p = new Post(obj); return p.save(); }
    static async find(){ return posts.map(p => new Post(p)).sort((a,b) => b.createdAt - a.createdAt); }
    static async findById(id){ const p = posts.find(x => String(x._id) === String(id)); return p ? new Post(p) : null; }
  }
  module.exports = Post; return;
}

const postSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String },
  content: { type: String },
  mediaUrl: { type: String, default: null },
  likes: [{ type: String }],
  comments: [{ userId: String, userName: String, text: String, createdAt: { type: Date, default: Date.now } }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);