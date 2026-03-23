
import React, { useState } from 'react';
import { Icons } from '../constants';

interface CalendarProps {
  onSelectDate: (date: string) => void;
  selectedDate: string | null;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const Calendar: React.FC<CalendarProps> = ({ onSelectDate, selectedDate }) => {
  const [viewDate, setViewDate] = useState(new Date());

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const prevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${day.toString().padStart(2, '0')}/${(currentMonth + 1).toString().padStart(2, '0')}/${currentYear}`;
    onSelectDate(dateStr);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const dateStr = `${day.toString().padStart(2, '0')}/${(currentMonth + 1).toString().padStart(2, '0')}/${currentYear}`;
    return selectedDate === dateStr;
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-xl overflow-hidden w-full max-w-sm mx-auto animate-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="bg-gray-950 text-white p-6 flex justify-between items-center">
        <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
          <Icons.ChevronLeft />
        </button>
        <h3 className="font-black uppercase tracking-widest text-sm">
          {MONTHS[currentMonth]} {currentYear}
        </h3>
        <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
          <Icons.ChevronRight />
        </button>
      </div>

      {/* Grid */}
      <div className="p-6">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map(day => (
            <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {/* Empty slots for first week */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="p-2"></div>
          ))}
          
          {/* Days of month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const selected = isSelected(day);
            const today = isToday(day);
            
            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={`
                  p-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center relative group
                  ${selected 
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' 
                    : today 
                      ? 'bg-gray-950 text-white' 
                      : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600'
                  }
                `}
              >
                {day}
                {today && !selected && (
                  <span className="absolute bottom-1 w-1 h-1 bg-orange-500 rounded-full"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-50 p-4 border-t border-gray-100 text-center">
        <button 
          onClick={() => setViewDate(new Date())}
          className="text-[10px] font-black text-orange-600 uppercase tracking-widest hover:underline"
        >
          Ir para hoje
        </button>
      </div>
    </div>
  );
};

export default Calendar;
