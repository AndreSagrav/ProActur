import { useState, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock, MapPin, Link2, X, Loader2
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const DAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function CalendarView({ onSelectMeeting, onCreateEvent, onEditEvent }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchEvents() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/events?month=${currentMonth + 1}&year=${currentYear}`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[Calendar] Error:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchEvents(); }, [currentMonth, currentYear]);

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  }

  function goToday() {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDate(today.getDate());
  }

  // Generar grilla del mes
  function getCalendarDays() {
    const firstDay = new Date(currentYear, currentMonth, 1);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    // Dias del mes anterior
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, currentMonth: false });
    }

    // Dias del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, currentMonth: true });
    }

    // Dias del mes siguiente
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, currentMonth: false });
    }

    return days;
  }

  function getEventsForDay(day) {
    return events.filter(e => {
      const d = new Date(e.startTime);
      return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }

  const isToday = (day) => {
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  };

  const selectedEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  async function handleDeleteEvent(e, eventId) {
    e.stopPropagation();
    if (!confirm('Eliminar este evento?')) return;
    try {
      await fetch(`${API}/api/events/${eventId}`, { method: 'DELETE' });
      fetchEvents();
    } catch (err) {
      console.error(err);
    }
  }

  const displayDay = selectedDate || today.getDate();
  const displayEvents = getEventsForDay(displayDay);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
      {/* Calendar Card (7 cols on desktop) */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md flex flex-col justify-between">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-100">
              {MONTHS[currentMonth]} <span className="text-slate-400 font-normal">{currentYear}</span>
            </h2>
            <button
              onClick={goToday}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-all"
            >
              Hoy
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={nextMonth} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {getCalendarDays().map((d, idx) => {
            const dayEvents = d.currentMonth ? getEventsForDay(d.day) : [];
            const isSelected = d.currentMonth && d.day === selectedDate;
            const isTodayCell = d.currentMonth && isToday(d.day);

            return (
              <button
                key={idx}
                onClick={() => d.currentMonth && setSelectedDate(d.day === selectedDate ? null : d.day)}
                className={`relative p-1.5 rounded-xl text-xs transition-all min-h-[44px] flex flex-col items-center justify-start ${
                  !d.currentMonth
                    ? 'text-slate-700 cursor-default'
                    : isSelected
                      ? 'bg-indigo-600/25 text-white ring-1 ring-indigo-500/50'
                      : isTodayCell
                        ? 'bg-slate-800/80 text-indigo-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span className={`text-[11px] ${isTodayCell && !isSelected ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold' : ''}`}>
                  {d.day}
                </span>

                {/* Event dots */}
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {dayEvents.slice(0, 3).map((ev, i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: ev.color || '#6366f1' }}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[8px] text-slate-500">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Events Column (5 cols on desktop, debajo en moviles) */}
      <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md flex flex-col">
        <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-800/80">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              {displayDay} de {MONTHS[currentMonth]}
            </h3>
            <span className="text-[10px] text-slate-400">
              {displayEvents.length} evento{displayEvents.length === 1 ? '' : 's'} agendado{displayEvents.length === 1 ? '' : 's'}
            </span>
          </div>
          <button
            onClick={() => onCreateEvent?.({
              date: new Date(currentYear, currentMonth, displayDay)
            })}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Evento
          </button>
        </div>

        {displayEvents.length === 0 ? (
          <div className="p-8 text-center bg-slate-800/20 border border-dashed border-slate-800 rounded-xl my-auto">
            <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">Sin eventos para este día</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Toca '+ Evento' para agendar reuniones, tareas o seguimientos.</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {displayEvents.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => ev.meetingId ? onSelectMeeting?.(ev.meetingId) : onEditEvent?.(ev)}
                  className="p-3 rounded-xl border border-slate-800/60 bg-slate-800/40 hover:bg-slate-800/70 transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: ev.color || '#6366f1' }} />

                  <div className="pl-2 flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                        {ev.title}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(ev.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          {ev.endTime && ` - ${new Date(ev.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                        {ev.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {ev.location}
                          </span>
                        )}
                      </div>
                      {ev.meetingId && (
                        <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                          <Link2 className="w-2.5 h-2.5" /> Ver notas
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleDeleteEvent(e, ev.id)}
                      className="p-1 rounded text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
