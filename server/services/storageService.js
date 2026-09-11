const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'meetings.json');

class StorageService {
  constructor() {
    this.ensureFileExists();
  }

  ensureFileExists() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  }

  getAllMeetings() {
    try {
      this.ensureFileExists();
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(content || '[]');
    } catch (err) {
      console.error('Error leyendo meetings.json:', err);
      return [];
    }
  }

  getMeetingById(id) {
    const meetings = this.getAllMeetings();
    return meetings.find(m => m.id === id);
  }

  saveMeeting(meeting) {
    const meetings = this.getAllMeetings();
    const newMeeting = {
      id: meeting.id || 'meet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      createdAt: new Date().toISOString(),
      ...meeting
    };

    const existingIndex = meetings.findIndex(m => m.id === newMeeting.id);
    if (existingIndex >= 0) {
      meetings[existingIndex] = newMeeting;
    } else {
      meetings.unshift(newMeeting); // Más reciente primero
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(meetings, null, 2), 'utf8');
    return newMeeting;
  }

  deleteMeeting(id) {
    let meetings = this.getAllMeetings();
    meetings = meetings.filter(m => m.id !== id);
    fs.writeFileSync(DATA_FILE, JSON.stringify(meetings, null, 2), 'utf8');
    return true;
  }
}

module.exports = new StorageService();
