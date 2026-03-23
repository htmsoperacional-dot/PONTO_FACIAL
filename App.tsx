
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CameraView from './components/CameraView';
import Spreadsheet, { getActualWorkedMinutes, getExpectedMinutes, minutesToFormatted } from './components/Spreadsheet';
import Calendar from './components/Calendar';
import { AppState, DailyLog, Employee } from './types';
import { identifyEmployee } from './services/geminiService';
import { sendConfirmationEmail } from './services/emailService';
import { DataService } from './services/dataService';
import { Icons, BUSINESS_HOURS } from './constants';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.KIOSK);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudUrl, setCloudUrl] = useState('');
  const [feedback, setFeedback] = useState<{msg: string, type: 'success' | 'error' | 'warning' | null}>({msg: '', type: null});
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Admin states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [adminTab, setAdminTab] = useState<'records' | 'employees' | 'sync'>('records');
  
  // Filtros
  const [filterName, setFilterName] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const [manualCpf, setManualCpf] = useState('');

  // Cadastro e Edição
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regPosition, setRegPosition] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhoto, setRegPhoto] = useState<string | null>(null);
  const [isCapturingReg, setIsCapturingReg] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    const storedEmployees = DataService.getEmployees();
    const storedLogs = DataService.getLogs();
    const storedUrl = DataService.getCloudUrl();
    
    setEmployees(storedEmployees);
    setLogs(storedLogs);
    setCloudUrl(storedUrl);

    if (sessionStorage.getItem('ponto_auth') === 'true') setIsLoggedIn(true);

    if (storedUrl) {
      handleSync();
    }
  }, []);

  const showFeedback = (msg: string, type: 'success' | 'error' | 'warning') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback({ msg: '', type: null }), 6000);
  };

  const handleSync = async () => {
    const url = DataService.getCloudUrl();
    if (!url) return;
    setIsSyncing(true);
    const result = await DataService.syncFromCloud();
    if (result) {
      setEmployees(result.employees);
      setLogs(result.logs);
      showFeedback("Dados sincronizados com a nuvem.", "success");
    } else {
      showFeedback("Falha ao sincronizar. Usando cache local.", "warning");
    }
    setIsSyncing(false);
  };

  const saveAndSync = async (newEmployees: Employee[], newLogs: DailyLog[]) => {
    DataService.saveEmployees(newEmployees);
    DataService.saveLogs(newLogs);
    setEmployees(newEmployees);
    setLogs(newLogs);
    
    if (cloudUrl) {
      await DataService.pushToCloud(newEmployees, newLogs);
    }
  };

  const processPunchRecord = (employee: Employee, method: 'facial' | 'manual' = 'facial') => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('pt-BR');
    
    let alreadyCompleted = false;
    let typeLabel = "";

    setLogs(prevLogs => {
      const existingIdx = prevLogs.findIndex(l => l.employeeId === employee.id && l.date === dateStr);
      let updatedLogs = [...prevLogs];
      let currentLog: DailyLog;

      if (existingIdx > -1) {
        currentLog = { ...updatedLogs[existingIdx] };
        if (!currentLog.entry) { currentLog.entry = timeStr; currentLog.method = method; typeLabel = "Entrada"; }
        else if (!currentLog.lunchStart) { currentLog.lunchStart = timeStr; typeLabel = "Saída Almoço"; }
        else if (!currentLog.lunchEnd) { currentLog.lunchEnd = timeStr; typeLabel = "Retorno Almoço"; }
        else if (!currentLog.exit) { currentLog.exit = timeStr; typeLabel = "Saída"; }
        else { alreadyCompleted = true; }
        updatedLogs[existingIdx] = currentLog;
      } else {
        currentLog = {
          date: dateStr, employeeId: employee.id, employeeName: employee.name,
          entry: timeStr, lunchStart: null, lunchEnd: null, exit: null, method: method
        };
        updatedLogs.push(currentLog);
        typeLabel = "Entrada";
      }

      if (!alreadyCompleted) {
        DataService.saveLogs(updatedLogs);
        if (employee.email) sendConfirmationEmail(employee, currentLog, typeLabel, timeStr);
        showFeedback(`${typeLabel} registrado para ${employee.name} às ${timeStr}`, 'success');
        if (cloudUrl) DataService.pushToCloud(employees, updatedLogs);
      } else {
        showFeedback(`${employee.name} já completou os registros de hoje!`, 'warning');
      }
      return updatedLogs;
    });
    
    setView(AppState.KIOSK);
    setManualCpf('');
  };

  const handlePunch = useCallback(async (base64Image: string) => {
    if (employees.length === 0) {
      showFeedback("Nenhum funcionário cadastrado.", 'warning');
      return;
    }
    setIsProcessing(true);
    const result = await identifyEmployee(base64Image, employees);
    if (result.identified && result.employeeId) {
      const employee = employees.find(e => e.id === result.employeeId);
      if (employee) processPunchRecord(employee, 'facial');
    } else {
      showFeedback(result.reason || "Não identificado.", 'error');
    }
    setIsProcessing(false);
  }, [employees]);

  const handleManualPunchSubmit = () => {
    const cleanCpf = manualCpf.replace(/\D/g, '');
    const employee = employees.find(e => e.cpf.replace(/\D/g, '') === cleanCpf);
    if (employee) {
      processPunchRecord(employee, 'manual');
    } else {
      showFeedback("CPF não encontrado na base de dados.", "error");
    }
  };

  const addOrUpdateEmployee = () => {
    if (!regName || !regPhoto || !regCpf) {
      showFeedback("Preencha os campos obrigatórios.", 'error');
      return;
    }

    setEmployees(prev => {
      let updated: Employee[];
      if (editingEmployeeId) {
        updated = prev.map(emp => 
          emp.id === editingEmployeeId 
          ? { ...emp, name: regName, photoUrl: regPhoto, cpf: regCpf, position: regPosition, email: regEmail }
          : emp
        );
        showFeedback(`${regName} atualizado com sucesso.`, 'success');
      } else {
        const newEmp: Employee = { 
          id: Math.random().toString(36).substr(2, 9), 
          name: regName, photoUrl: regPhoto, dob: '', cpf: regCpf, 
          position: regPosition, phone: '', email: regEmail
        };
        updated = [...prev, newEmp];
        showFeedback(`${newEmp.name} cadastrado com sucesso.`, 'success');
      }
      DataService.saveEmployees(updated);
      if (cloudUrl) DataService.pushToCloud(updated, logs);
      return updated;
    });
    resetForm();
  };

  const resetForm = () => {
    setRegName(''); setRegPhoto(null); setRegCpf(''); setRegPosition(''); setRegEmail('');
    setEditingEmployeeId(null); setIsCapturingReg(false);
  };

  const handleEditEmployee = (emp: Employee) => {
    setRegName(emp.name); setRegCpf(emp.cpf); setRegPosition(emp.position);
    setRegEmail(emp.email); setRegPhoto(emp.photoUrl); setEditingEmployeeId(emp.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEmployee = (empId: string, name: string) => {
    if (window.confirm(`Deseja realmente excluir o colaborador ${name}?`)) {
      setEmployees(prev => {
        const updated = prev.filter(e => e.id !== empId);
        DataService.saveEmployees(updated);
        if (cloudUrl) DataService.pushToCloud(updated, logs);
        return updated;
      });
      showFeedback(`${name} removido do sistema.`, 'success');
    }
  };

  const deleteLog = (employeeId: string, date: string) => {
    if (window.confirm(`Excluir registro do dia ${date}?`)) {
      setLogs(prev => {
        const updated = prev.filter(l => !(l.employeeId === employeeId && l.date === date));
        DataService.saveLogs(updated);
        if (cloudUrl) DataService.pushToCloud(employees, updated);
        return updated;
      });
      showFeedback("Registro de ponto excluído.", "success");
    }
  };

  const updateCloudUrl = () => {
    DataService.setCloudUrl(cloudUrl);
    showFeedback("URL da nuvem salva!", "success");
    handleSync();
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredLogs = useMemo(() => {
    const sorted = [...logs].sort((a, b) => {
        const [da, ma, ya] = a.date.split('/').map(Number);
        const [db, mb, yb] = b.date.split('/').map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });

    return sorted.filter(log => {
      const matchName = filterName ? log.employeeId === filterName : true;
      let matchRange = true;
      if (filterStartDate || filterEndDate) {
        const [d, m, y] = log.date.split('/').map(Number);
        const logDate = new Date(y, m - 1, d);
        if (filterStartDate && logDate < new Date(filterStartDate + 'T00:00:00')) matchRange = false;
        if (filterEndDate && logDate > new Date(filterEndDate + 'T23:59:59')) matchRange = false;
      }
      return matchName && matchRange;
    });
  }, [logs, filterName, filterStartDate, filterEndDate]);

  const generatePDF = () => {
    if (filteredLogs.length === 0) {
      showFeedback("Não há registros para gerar o relatório.", "warning");
      return;
    }

    const doc = new jsPDF();
    const employee = employees.find(e => e.id === filterName);
    const employeeName = employee ? employee.name : "Todos os Funcionários";
    const period = `${filterStartDate || 'Início'} até ${filterEndDate || 'Fim'}`;

    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text("EMILIANO COMUNICAÇÃO VISUAL", 105, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text("Relatório de Ponto Eletrônico", 105, 30, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Funcionário: ${employeeName.toUpperCase()}`, 14, 45);
    doc.text(`Período: ${period}`, 14, 52);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 59);

    let totalMinutesTrabalhados = 0;
    let totalMinutesExtras = 0;
    let totalMinutesFalta = 0;

    const tableData = filteredLogs.map(log => {
      const worked = getActualWorkedMinutes(log);
      const expected = getExpectedMinutes(log.date);
      const balance = worked - expected;

      totalMinutesTrabalhados += worked;
      if (balance > 0 && expected > 0) totalMinutesExtras += balance;
      if (balance < 0 && expected > 0) totalMinutesFalta += Math.abs(balance);

      return [
        log.date,
        log.employeeName,
        log.entry || '--',
        log.lunchStart || '--',
        log.lunchEnd || '--',
        log.exit || '--',
        minutesToFormatted(worked),
        balance === 0 || expected === 0 ? '--' : (balance > 0 ? `+${minutesToFormatted(balance)}` : minutesToFormatted(balance))
      ];
    });

    (doc as any).autoTable({
      startY: 65,
      head: [['Data', 'Funcionário', 'Entrada', 'Saída Alm.', 'Ret. Alm.', 'Saída', 'Total', 'Saldo']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: 'F', fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMO DO PERÍODO", 14, finalY);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total de Horas Trabalhadas: ${minutesToFormatted(totalMinutesTrabalhados)}`, 14, finalY + 10);
    doc.setTextColor(0, 150, 0);
    doc.text(`Total de Horas Extras: ${minutesToFormatted(totalMinutesExtras)}`, 14, finalY + 18);
    doc.setTextColor(200, 0, 0);
    doc.text(`Total de Horas Falta: ${minutesToFormatted(totalMinutesFalta)}`, 14, finalY + 26);

    doc.save(`Relatorio_Ponto_${employeeName.replace(/\s/g, '_')}_${new Date().getTime()}.pdf`);
    showFeedback("Relatório PDF gerado!", "success");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <div className="h-2 w-full bg-orange-500 shadow-lg relative z-[60]"></div>

      <header className="bg-gray-950 px-6 sticky top-0 z-50 shadow-xl border-b border-gray-900 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-24 flex flex-col items-center justify-center cursor-pointer text-center" onClick={() => setView(AppState.KIOSK)}>
                <span className="text-4xl font-black text-white leading-none">EMILIANO</span>
                <span className="text-[13px] font-bold text-orange-500 uppercase tracking-[0.4em] mt-0.5">COMUNICAÇÃO VISUAL</span>
            </div>
          </div>

          <div className="flex flex-col items-center bg-gray-900/50 rounded-2xl border border-gray-800 shadow-inner px-8 py-3">
            <span className="font-mono font-bold text-white text-5xl tracking-widest leading-none">{currentTime.toLocaleTimeString('pt-BR')}</span>
            <span className="text-orange-400 font-black uppercase tracking-widest text-[10px] mt-1">{currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
          </div>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <div className="flex gap-2 bg-gray-900 p-1.5 rounded-2xl border border-gray-800">
                <button onClick={() => setView(AppState.KIOSK)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${view === AppState.KIOSK ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>Terminal</button>
                <button onClick={() => setAdminTab('records')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${view === AppState.ADMIN ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>Gerenciar</button>
                <button onClick={() => { setIsLoggedIn(false); setView(AppState.KIOSK); }} className="px-4 py-2 rounded-xl text-[10px] font-black text-red-400 uppercase">Sair</button>
              </div>
            ) : (
              view !== AppState.LOGIN && <button onClick={() => setView(AppState.LOGIN)} className="px-8 py-3 bg-white text-gray-950 rounded-xl font-black uppercase text-xs hover:bg-orange-500 hover:text-white transition-all">Administrador</button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col">
        {feedback.msg && (
          <div className={`mb-6 p-4 rounded-2xl border-l-4 shadow-lg animate-in fade-in slide-in-from-top-4 ${feedback.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' : 'bg-orange-50 border-orange-500 text-orange-800'}`}>
            <p className="font-bold">{feedback.msg}</p>
          </div>
        )}

        {view === AppState.KIOSK && (
          <div className="flex-1 flex flex-col items-center justify-center gap-12 max-w-4xl mx-auto w-full">
            <div className="text-center space-y-2">
              <h1 className="text-5xl font-black text-gray-950 uppercase tracking-tighter">PONTO FACIAL</h1>
              <p className="text-gray-400 font-bold uppercase tracking-[0.3em] text-xs">Aguarde o reconhecimento para bater seu ponto</p>
            </div>
            <CameraView onCapture={handlePunch} isLoading={isProcessing} />
            <div className="flex flex-col items-center gap-8">
              <button onClick={() => setView(AppState.MANUAL_PUNCH)} className="px-10 py-5 bg-white border border-gray-200 text-gray-400 rounded-2xl font-black text-xs uppercase hover:border-orange-500 transition-all shadow-sm">PONTO MANUAL</button>
              <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 bg-white/50 px-8 py-4 rounded-3xl border border-gray-100">
                <div className="flex flex-col items-center">
                  <span className="text-orange-500 mb-1">Segunda a Sexta</span>
                  <span>{BUSINESS_HOURS.WEEKDAYS.MORNING} | {BUSINESS_HOURS.WEEKDAYS.AFTERNOON}</span>
                </div>
                <div className="w-px h-6 bg-gray-200"></div>
                <div className="flex flex-col items-center">
                  <span className="text-orange-500 mb-1">Sábado</span>
                  <span>{BUSINESS_HOURS.SATURDAY}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === AppState.MANUAL_PUNCH && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8 max-md mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
            <h1 className="text-3xl font-black text-gray-950 uppercase">Ponto Manual</h1>
            <div className="w-full max-w-sm bg-white p-8 rounded-[3rem] shadow-2xl border border-gray-100 space-y-6">
              <input 
                type="text" value={manualCpf} onChange={e => setManualCpf(e.target.value)}
                placeholder="CPF" className="w-full p-6 bg-gray-50 border-2 border-gray-100 rounded-2xl text-center text-2xl font-black outline-none focus:border-orange-500"
              />
              <button onClick={handleManualPunchSubmit} className="w-full p-6 bg-orange-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl">Confirmar Registro</button>
              <button onClick={() => setView(AppState.KIOSK)} className="w-full p-4 text-gray-400 font-black uppercase text-[10px]">Voltar</button>
            </div>
          </div>
        )}

        {isLoggedIn && (view === AppState.ADMIN || adminTab) && (
          <div className="flex-1 flex flex-col gap-8">
            <div className="flex gap-4 border-b border-gray-200">
              <button onClick={() => { setAdminTab('records'); setView(AppState.ADMIN); }} className={`pb-4 px-2 font-black uppercase text-xs tracking-widest border-b-4 ${adminTab === 'records' ? 'border-orange-500 text-gray-950' : 'border-transparent text-gray-300'}`}>Registros</button>
              <button onClick={() => { setAdminTab('employees'); setView(AppState.ADMIN); }} className={`pb-4 px-2 font-black uppercase text-xs tracking-widest border-b-4 ${adminTab === 'employees' ? 'border-orange-500 text-gray-950' : 'border-transparent text-gray-300'}`}>Equipe</button>
              <button onClick={() => { setAdminTab('sync'); setView(AppState.ADMIN); }} className={`pb-4 px-2 font-black uppercase text-xs tracking-widest border-b-4 ${adminTab === 'sync' ? 'border-orange-500 text-gray-950' : 'border-transparent text-gray-300'}`}>Cloud Sync</button>
            </div>

            {adminTab === 'records' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm flex flex-wrap items-end gap-6 justify-center">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 block px-2">Membro</label>
                    <select value={filterName} onChange={e => setFilterName(e.target.value)} className="p-3 bg-gray-50 rounded-xl font-bold min-w-[200px]">
                      <option value="">Todos</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 block px-2">Data Inicial</label>
                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="p-3 bg-gray-50 rounded-xl font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 block px-2">Data Final</label>
                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="p-3 bg-gray-50 rounded-xl font-bold" />
                  </div>
                  <div className="flex gap-2">
                      <button onClick={generatePDF} className="p-3 bg-orange-600 text-white rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-orange-700 shadow-lg">
                        <Icons.Download /> Gerar Relatório PDF
                      </button>
                      <button onClick={handleSync} disabled={isSyncing} className="p-3 bg-gray-100 text-gray-400 rounded-xl hover:text-orange-500">
                        <div className={isSyncing ? 'animate-spin' : ''}><Icons.History /></div>
                      </button>
                  </div>
                </div>
                <Spreadsheet logs={filteredLogs} onDelete={deleteLog} isAdmin={true} />
              </div>
            )}

            {adminTab === 'employees' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm space-y-8">
                  <h2 className="text-2xl font-black uppercase">{editingEmployeeId ? 'Editar Colaborador' : 'Cadastro Colaborador'}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Nome" className="p-4 bg-gray-50 rounded-xl font-bold md:col-span-2" />
                    <input value={regCpf} onChange={e => setRegCpf(e.target.value)} placeholder="CPF" className="p-4 bg-gray-50 rounded-xl font-bold" />
                    <input value={regPosition} onChange={e => setRegPosition(e.target.value)} placeholder="Cargo" className="p-4 bg-gray-50 rounded-xl font-bold" />
                    <input value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="E-mail" className="p-4 bg-gray-50 rounded-xl font-bold md:col-span-2" />
                    <div className="md:col-span-2">
                      {regPhoto ? (
                        <div className="relative w-32 h-32 mx-auto">
                          <img src={`data:image/jpeg;base64,${regPhoto}`} className="w-32 h-32 rounded-3xl object-cover border-4 border-orange-500" />
                          <button onClick={() => setRegPhoto(null)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"><Icons.Trash /></button>
                        </div>
                      ) : !isCapturingReg ? (
                        <button onClick={() => setIsCapturingReg(true)} className="w-full py-10 border-4 border-dashed border-gray-100 rounded-[2.5rem] text-gray-300 font-black uppercase text-[10px] hover:border-orange-500">Capturar Foto</button>
                      ) : (
                        <div className="mt-4 flex flex-col items-center gap-6 bg-gray-50 p-8 rounded-[3rem] border-2 border-dashed border-orange-200 animate-in fade-in slide-in-from-top-4">
                          <CameraView onCapture={img => { setRegPhoto(img); setIsCapturingReg(false); }} isLoading={false} buttonLabel="Tirar Foto" />
                          <button onClick={() => setIsCapturingReg(false)} className="px-10 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase border border-red-100 shadow-sm">Fechar Câmera</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button onClick={addOrUpdateEmployee} className="w-full p-5 bg-orange-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl">
                      {editingEmployeeId ? 'Salvar Alterações' : 'Cadastrar e Sincronizar'}
                    </button>
                    {editingEmployeeId && <button onClick={resetForm} className="w-full p-4 text-gray-400 font-black uppercase text-[10px]">Cancelar</button>}
                  </div>
                </div>
                <div className="space-y-4">
                  <h2 className="text-xl font-black uppercase">Colaboradores</h2>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {employees.map(emp => (
                      <div key={emp.id} className="group flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-orange-200">
                        <img src={`data:image/jpeg;base64,${emp.photoUrl}`} className="w-12 h-12 rounded-xl object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm uppercase truncate">{emp.name}</p>
                          <p className="text-[9px] font-bold text-orange-500 uppercase truncate">{emp.position}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditEmployee(emp)} className="p-2.5 text-blue-600 bg-blue-50 rounded-xl shadow-sm"><Icons.Edit /></button>
                          <button onClick={() => handleDeleteEmployee(emp.id, emp.name)} className="p-2.5 text-red-600 bg-red-50 rounded-xl shadow-sm"><Icons.Trash /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {adminTab === 'sync' && (
              <div className="max-w-2xl mx-auto w-full bg-white p-10 rounded-[3rem] shadow-sm text-center space-y-6">
                <Icons.Download />
                <h2 className="text-2xl font-black uppercase">Configuração da Nuvem</h2>
                <input type="text" value={cloudUrl} onChange={e => setCloudUrl(e.target.value)} placeholder="URL do Google Apps Script" className="w-full p-4 bg-gray-50 rounded-xl font-mono text-xs border-2 border-dashed border-gray-200" />
                <button onClick={updateCloudUrl} className="w-full p-4 bg-gray-950 text-white rounded-xl font-black uppercase text-xs">Salvar e Sincronizar</button>
              </div>
            )}
          </div>
        )}

        {view === AppState.LOGIN && (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm w-full text-center">
              <h2 className="text-2xl font-black uppercase mb-8">Login Gestor</h2>
              <form onSubmit={e => { e.preventDefault(); if (loginId === '0000' && loginPassword === '0000') { setIsLoggedIn(true); setView(AppState.ADMIN); } else { showFeedback("ID ou Senha inválidos", "error"); } }} className="space-y-4">
                <input type="text" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="ID" className="w-full p-4 bg-gray-50 rounded-xl font-bold" />
                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Senha" className="w-full p-4 bg-gray-50 rounded-xl font-bold" />
                <button type="submit" className="w-full p-5 bg-gray-950 text-white rounded-xl font-black uppercase text-xs">Entrar</button>
                <button type="button" onClick={() => setView(AppState.KIOSK)} className="w-full p-4 text-gray-400 font-black uppercase text-[10px]">Voltar</button>
              </form>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white py-6 px-6 border-t border-gray-200 text-center">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.5em]">Emiliano Comunicação Visual • Banco de Dados em Nuvem Ativo</p>
      </footer>
    </div>
  );
};

export default App;
