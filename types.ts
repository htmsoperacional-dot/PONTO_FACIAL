
export type PunchType = 'entry' | 'lunch_start' | 'lunch_end' | 'exit';

export interface PunchRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: Date;
  type: PunchType;
  imageUrl?: string;
}

export interface DailyLog {
  date: string; // DD/MM/YYYY
  employeeId: string;
  employeeName: string;
  entry: string | null;
  lunchStart: string | null;
  lunchEnd: string | null;
  exit: string | null;
  method?: 'facial' | 'manual';
}

export interface Employee {
  id: string;
  name: string;
  photoUrl: string; // Base64 reference for identification
  dob: string;
  cpf: string;
  position: string;
  phone: string;
  email: string;
}

export enum AppState {
  KIOSK = 'KIOSK',
  ADMIN = 'ADMIN',
  REGISTER = 'REGISTER',
  LOGIN = 'LOGIN',
  MANUAL_PUNCH = 'MANUAL_PUNCH'
}
