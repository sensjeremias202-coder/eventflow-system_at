const mongoose = require('mongoose');
const crypto = require('crypto');

const useMemory = !process.env.MONGODB_URI || String(process.env.NO_DB).toLowerCase() === 'true';

if (useMemory) {
  const events = [];

  class Event {
    constructor(obj = {}){
      this._id = obj._id || crypto.randomBytes(12).toString('hex');
      this.title = obj.title;
      this.description = obj.description || '';
      this.date = obj.date;
      this.time = obj.time;
      this.endDate = obj.endDate || obj.date;
      this.endTime = obj.endTime || obj.time;
      this.location = obj.location || '';
      this.address = obj.address || '';
      this.category = obj.category || '';
      this.status = obj.status || 'upcoming';
      this.capacity = obj.capacity ?? 50;
      this.organizer = obj.organizer || '';
      this.color = obj.color || '#1976d2';
      this.bannerUrl = obj.bannerUrl || '';
      this.attendees = Array.isArray(obj.attendees) ? obj.attendees : [];
      this.createdBy = obj.createdBy;
      this.createdAt = obj.createdAt || new Date();
      this.updatedAt = obj.updatedAt || new Date();
    }

    async save(){
      this.updatedAt = new Date();
      const idx = events.findIndex(e => String(e._id) === String(this._id));
      if (idx >= 0) events[idx] = { ...events[idx], ...this };
      else events.push({ ...this });
      return this;
    }

    async deleteOne(){
      const idx = events.findIndex(e => String(e._id) === String(this._id));
      if (idx >= 0) events.splice(idx,1);
      return { acknowledged: true };
    }

    static find(filter = {}){
      let list = [...events];
      if (filter.status) list = list.filter(e => e.status === filter.status);
      if (filter.category) list = list.filter(e => e.category === filter.category);
      if (filter.date){
        if (filter.date.$gte) list = list.filter(e => e.date >= filter.date.$gte);
        if (filter.date.$lte) list = list.filter(e => e.date <= filter.date.$lte);
      }
      if (filter.$or){
        list = list.filter(e => filter.$or.some(cond => {
          if (cond.title) return new RegExp(cond.title, 'i').test(e.title || '');
          if (cond.description) return new RegExp(cond.description, 'i').test(e.description || '');
          if (cond.location) return new RegExp(cond.location, 'i').test(e.location || '');
          return false;
        }));
      }
      const chain = {
        sort: () => ({
          skip: (n = 0) => ({
            limit: (m = list.length) => list.slice(Number(n) || 0, (Number(n) || 0) + (Number(m) || list.length))
          })
        })
      };
      return chain;
    }

    static async findById(id){
      const e = events.find(ev => String(ev._id) === String(id));
      // Retorna instância Event para manter interface
      return e ? new Event(e) : null;
    }

    static async deleteMany(){ events.length = 0; }
  }

  module.exports = Event;
  return;
}

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  time: { type: String, required: true }, // HH:mm
  endDate: { type: String },
  endTime: { type: String },
  location: { type: String, trim: true },
  address: { type: String, trim: true },
  category: { type: String, trim: true },
  status: { type: String, enum: ['upcoming', 'ongoing', 'completed', 'cancelled'], default: 'upcoming' },
  capacity: { type: Number, default: 50 },
  organizer: { type: String, trim: true },
  color: { type: String, trim: true, default: '#1976d2' },
  bannerUrl: { type: String, trim: true, default: '' },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update updatedAt on save
eventSchema.pre('save', function(next){ this.updatedAt = Date.now(); next(); });

module.exports = mongoose.model('Event', eventSchema);
