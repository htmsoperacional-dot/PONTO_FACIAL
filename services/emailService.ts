
import { Employee, DailyLog } from "../types";

/**
 * Simulates sending a confirmation email to the employee.
 * In a real-world scenario, this would call a backend API or a service like SendGrid/EmailJS.
 */
export const sendConfirmationEmail = async (employee: Employee, log: DailyLog, typeLabel: string, time: string) => {
  // We simulate an API delay
  await new Promise(resolve => setTimeout(resolve, 800));

  const emailBody = `
    Olá ${employee.name},
    
    Confirmamos o registro do seu ponto:
    Tipo: ${typeLabel}
    Data: ${log.date}
    Horário: ${time}
    
    Este é um e-mail automático gerado pelo sistema Ponto IA.
  `;

  // Log for debugging/demo purposes
  console.log(`%c [EMAIL SENT] To: ${employee.email}`, "color: #4f46e5; font-weight: bold;");
  console.log(emailBody);

  return true;
};
