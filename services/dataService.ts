
import { Employee, DailyLog } from "../types";

const KEYS = {
  EMPLOYEES: 'ponto_employees',
  LOGS: 'ponto_logs',
  CLOUD_URL: 'ponto_cloud_url'
};

export const DataService = {
  // Configuração da Nuvem
  getCloudUrl: () => localStorage.getItem(KEYS.CLOUD_URL) || '',
  setCloudUrl: (url: string) => localStorage.setItem(KEYS.CLOUD_URL, url),

  // Local Storage (Cache)
  getEmployees: (): Employee[] => {
    const data = localStorage.getItem(KEYS.EMPLOYEES);
    return data ? JSON.parse(data) : [];
  },

  saveEmployees: (employees: Employee[]) => {
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(employees));
  },

  getLogs: (): DailyLog[] => {
    const data = localStorage.getItem(KEYS.LOGS);
    return data ? JSON.parse(data) : [];
  },

  saveLogs: (logs: DailyLog[]) => {
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
  },

  // Sincronização com Nuvem (Google Sheets)
  syncFromCloud: async (): Promise<{employees: Employee[], logs: DailyLog[]} | null> => {
    const url = DataService.getCloudUrl();
    if (!url) return null;

    try {
      const response = await fetch(url + '?action=getData');
      const data = await response.json();
      
      if (data.employees) DataService.saveEmployees(data.employees);
      if (data.logs) DataService.saveLogs(data.logs);
      
      return data;
    } catch (e) {
      console.error("Erro na sincronização (GET):", e);
      return null;
    }
  },

  pushToCloud: async (employees: Employee[], logs: DailyLog[]): Promise<boolean> => {
    const url = DataService.getCloudUrl();
    if (!url) return false;

    try {
      const response = await fetch(url, {
        method: 'POST',
        mode: 'no-cors', // Necessário para Google Apps Script se não houver backend de proxy
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveData',
          employees,
          logs
        })
      });
      return true;
    } catch (e) {
      console.error("Erro na sincronização (POST):", e);
      return false;
    }
  }
};
