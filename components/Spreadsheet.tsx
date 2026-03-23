
import React from 'react';
import { DailyLog } from '../types';
import { Icons } from '../constants';

interface SpreadsheetProps {
  logs: DailyLog[];
  onDelete?: (employeeId: string, date: string) => void;
  isAdmin?: boolean;
}

export const timeToMinutes = (time: string | null): number | null => {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToFormatted = (totalMinutes: number): string => {
  const isNegative = totalMinutes < 0;
  const absMinutes = Math.abs(totalMinutes);
  const h = Math.floor(absMinutes / 60);
  const m = absMinutes % 60;
  return `${isNegative ? '-' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const getActualWorkedMinutes = (log: DailyLog): number => {
  const t1 = timeToMinutes(log.entry);
  const t2 = timeToMinutes(log.lunchStart);
  const t3 = timeToMinutes(log.lunchEnd);
  const t4 = timeToMinutes(log.exit);

  let totalMinutes = 0;
  if (t1 !== null && t2 !== null) totalMinutes += Math.max(0, t2 - t1);
  if (t3 !== null && t4 !== null) totalMinutes += Math.max(0, t4 - t3);
  
  // Se só tiver entrada e saída direta (sem almoço registrado)
  if (t1 !== null && t4 !== null && t2 === null && t3 === null) {
      totalMinutes = Math.max(0, t4 - t1);
  }

  return totalMinutes;
};

const calculateStatus = (entry: string | null): { label: string; color: string } => {
  if (!entry) return { label: '--', color: 'text-gray-300' };
  const minutes = timeToMinutes(entry);
  if (minutes === null) return { label: '--', color: 'text-gray-300' };

  if (minutes < 465) {
    return { label: 'Adiantado', color: 'bg-blue-50 text-blue-600' };
  } else if (minutes <= 495) {
    return { label: 'Pontual', color: 'bg-green-50 text-green-600' };
  } else {
    return { label: 'Atrasado', color: 'bg-red-50 text-red-600' };
  }
};

export const getExpectedMinutes = (dateStr: string): number => {
  try {
    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();

    if (dayOfWeek >= 1 && dayOfWeek <= 5) return 480; // 8h (Segunda a Sexta)
    if (dayOfWeek === 6) return 240; // 4h (Sábado)
    return 0; // Domingo
  } catch {
    return 480;
  }
};

const Spreadsheet: React.FC<SpreadsheetProps> = ({ logs, onDelete, isAdmin }) => {
  return (
    <div className="overflow-x-auto rounded-[3rem] border border-gray-200 shadow-xl bg-white p-2">
      <table className="w-full text-left border-collapse min-w-[1100px]">
        <thead>
          <tr className="bg-gray-950 text-white">
            <th className="p-6 font-black uppercase tracking-widest text-[10px] rounded-tl-[2.5rem]">Data</th>
            <th className="p-6 font-black uppercase tracking-widest text-[10px]">Funcionário</th>
            <th className="p-6 font-black uppercase tracking-widest text-[10px] text-center">Entrada</th>
            <th className="p-6 font-black uppercase tracking-widest text-[10px] text-center">Almoço</th>
            <th className="p-6 font-black uppercase tracking-widest text-[10px] text-center">Retorno</th>
            <th className="p-6 font-black uppercase tracking-widest text-[10px] text-center">Saída</th>
            <th className="p-6 font-black uppercase tracking-widest text-[10px] text-center">Status</th>
            <th className="p-6 font-black uppercase tracking-widest text-[10px] bg-orange-500 text-center">Total</th>
            <th className="p-6 font-black uppercase tracking-widest text-[10px] text-center">Saldo</th>
            <th className="p-6 font-black uppercase tracking-widest text-[10px] text-center rounded-tr-[2.5rem]">Ponto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.length === 0 ? (
            <tr>
              <td colSpan={10} className="p-20 text-center text-gray-300 font-bold uppercase tracking-widest text-xs">
                Nenhum dado processado no momento.
              </td>
            </tr>
          ) : (
            logs.map((log) => {
              const status = calculateStatus(log.entry);
              const workedMinutes = getActualWorkedMinutes(log);
              const expectedMinutes = getExpectedMinutes(log.date);
              
              const isSuccess = workedMinutes >= expectedMinutes && expectedMinutes > 0;
              const isDanger = workedMinutes < expectedMinutes && expectedMinutes > 0;

              const balance = workedMinutes - expectedMinutes;

              return (
                <tr key={`${log.employeeId}-${log.date}`} className="hover:bg-orange-50/50 transition-colors group">
                  <td className="p-6 text-gray-400 font-bold text-xs">{log.date}</td>
                  <td className="p-6 font-black text-gray-950 uppercase tracking-tighter">{log.employeeName}</td>
                  <td className="p-6 text-center">
                    <span className={log.entry ? "text-gray-900 font-bold" : "text-gray-200"}>
                      {log.entry || '--:--'}
                    </span>
                  </td>
                  <td className="p-6 text-center">
                    <span className={log.lunchStart ? "text-orange-500 font-bold" : "text-gray-200"}>
                      {log.lunchStart || '--:--'}
                    </span>
                  </td>
                  <td className="p-6 text-center">
                    <span className={log.lunchEnd ? "text-orange-500 font-bold" : "text-gray-200"}>
                      {log.lunchEnd || '--:--'}
                    </span>
                  </td>
                  <td className="p-6 text-center">
                    <span className={log.exit ? "text-gray-900 font-bold" : "text-gray-200"}>
                      {log.exit || '--:--'}
                    </span>
                  </td>
                  <td className="p-6 text-center">
                    <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className={`p-6 text-center font-black text-lg transition-colors 
                    ${isSuccess ? 'bg-green-50 text-green-700' : isDanger ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-400'}`}>
                    {minutesToFormatted(workedMinutes)}
                  </td>
                  <td className="p-6 text-center">
                    {balance === 0 || expectedMinutes === 0 ? (
                      <span className="text-gray-200 font-bold">--</span>
                    ) : balance > 0 ? (
                      <span className="text-xs font-black text-green-500">+{minutesToFormatted(balance)}</span>
                    ) : (
                      <span className="text-xs font-black text-red-500">{minutesToFormatted(balance)}</span>
                    )}
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${log.method === 'facial' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                        {log.method === 'manual' ? 'Manual' : 'Facial'}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => onDelete?.(log.employeeId, log.date)}
                          className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all flex items-center justify-center shadow-sm"
                          title="Excluir Registro"
                        >
                          <Icons.Trash />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Spreadsheet;
