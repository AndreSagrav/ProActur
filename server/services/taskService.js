const fs = require('fs');
const path = require('path');
const { getSupabaseClient } = require('./supabaseClient');

const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'tasks.json')
  : path.join(__dirname, '..', 'data', 'tasks.json');

const INITIAL_TASKS = [
  { id: 'task_1', title: 'Revisar entregable de seguridad con Carlos', priority: 'high', dueDate: new Date(Date.now() + 86400000).toISOString(), status: 'pending', source: 'meeting', meetingId: null, createdAt: new Date().toISOString() },
  { id: 'task_2', title: 'Pagar servicio de internet y servidores', priority: 'medium', dueDate: new Date(Date.now() + 259200000).toISOString(), status: 'pending', source: 'manual', meetingId: null, createdAt: new Date().toISOString() },
  { id: 'task_3', title: 'Enviar propuesta ejecutiva por correo', priority: 'high', dueDate: new Date().toISOString(), status: 'pending', source: 'manual', meetingId: null, createdAt: new Date().toISOString() }
];

class TaskService {
  constructor() {
    this.ensureLocalFileExists();
  }

  ensureLocalFileExists() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_TASKS, null, 2), 'utf8');
      }
    } catch (_) {}
  }

  readLocal() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      }
    } catch (_) {}
    return INITIAL_TASKS;
  }

  writeLocal(data) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (_) {}
  }

  async getAllTasks() {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          this.writeLocal(data);
          return data;
        }
      } catch (_) {}
    }
    return this.readLocal();
  }

  async createTask(taskData) {
    const tasks = this.readLocal();
    const newTask = {
      id: 'task_' + Date.now(),
      title: taskData.title || 'Nueva tarea',
      priority: taskData.priority || 'medium',
      dueDate: taskData.dueDate || new Date().toISOString(),
      status: 'pending',
      source: taskData.source || 'manual',
      meetingId: taskData.meetingId || null,
      createdAt: new Date().toISOString()
    };

    tasks.unshift(newTask);
    this.writeLocal(tasks);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('tasks').insert({
          id: newTask.id,
          title: newTask.title,
          priority: newTask.priority,
          due_date: newTask.dueDate,
          status: newTask.status,
          source: newTask.source,
          meeting_id: newTask.meetingId,
          created_at: newTask.createdAt
        });
      } catch (_) {}
    }

    return newTask;
  }

  async toggleTaskStatus(id) {
    const tasks = this.readLocal();
    const task = tasks.find(t => t.id === id);
    if (!task) return null;

    task.status = task.status === 'completed' ? 'pending' : 'completed';
    task.updatedAt = new Date().toISOString();
    this.writeLocal(tasks);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('tasks').update({ status: task.status, updated_at: task.updatedAt }).eq('id', id);
      } catch (_) {}
    }

    return task;
  }

  async deleteTask(id) {
    let tasks = this.readLocal();
    tasks = tasks.filter(t => t.id !== id);
    this.writeLocal(tasks);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('tasks').delete().eq('id', id);
      } catch (_) {}
    }
    return true;
  }
}

module.exports = new TaskService();
