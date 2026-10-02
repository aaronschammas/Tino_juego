'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTimer } from '@/context/TimerContext';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { apiGet, apiPatch } from '@/lib/api';
import { Task, TaskStatus, taskStatusLabels } from '@/types/task';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ChevronDown, Bell, Plus, Clock, Pause, Play, CheckCircle2 } from 'lucide-react';
import { normalizeDurationParts } from '@/lib/time';
import Portal from '@/components/ui/Portal';
import { MAX_TASK_HOURS, MAX_TASK_MINUTES, parseTaskDuration, TASK_DURATION_ERROR } from '@/lib/taskDuration';

function getTimerTaskOptions(tasks: Task[]) {
  return tasks.flatMap((task) => {
    if (task.subTasks?.length) {
      return task.subTasks.map((subTask) => ({
        task: subTask,
        label: `${task.title} / ${subTask.title}`,
        parentTitle: task.title,
        isSubTask: true,
      }));
    }

    return [{ task, label: task.title, isSubTask: false }];
  });
}

export default function TimerWidget() {
  const { user } = useAuth();
  const {
    activeTimer,
    isRunning,
    isPaused,
    elapsedSeconds,
    targetMinutes,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    updateTargetMinutes,
    isLoading,
    refreshTimer,
    acknowledgeExpiration,
  } = useTimer();
  const { projects, refetch, error: projectsError, isFetching: projectsFetching } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [targetHoursInput, setTargetHoursInput] = useState<string>('0');
  const [targetMinutesInput, setTargetMinutesInput] = useState<string>('30');
  const [hasManualDurationEdit, setHasManualDurationEdit] = useState(false);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [isClosingTimer, setIsClosingTimer] = useState(false);
  const [isStoppedOptimistically, setIsStoppedOptimistically] = useState(false);
  const [hasAlerted, setHasAlerted] = useState(false);
  const [showExpiredPrompt, setShowExpiredPrompt] = useState(false);
  const [expiredTimerData, setExpiredTimerData] = useState<{
    projectId: string;
    projectName?: string;
    taskId?: string;
    taskTitle?: string;
  } | null>(null);
  const [expiredHoursInput, setExpiredHoursInput] = useState<string>('0');
  const [expiredMinutesInput, setExpiredMinutesInput] = useState<string>('30');
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerTaskOptions = useMemo(() => getTimerTaskOptions(projectTasks), [projectTasks]);
  const configuredMinutes = parseTaskDuration(targetHoursInput, targetMinutesInput);
  const expiredConfiguredMinutes = parseTaskDuration(expiredHoursInput, expiredMinutesInput);

  useEffect(() => {
    if (!activeTimer) {
      setIsStoppedOptimistically(false);
    }
  }, [activeTimer]);

  useEffect(() => {
    const handleTimeExpired = (event: Event) => {
      const expiredTimer = (event as CustomEvent).detail;
      if (expiredTimer) {
        setExpiredTimerData({
          projectId: expiredTimer.projectId,
          projectName: expiredTimer.project?.name,
          taskId: expiredTimer.taskId,
          taskTitle: expiredTimer.task?.title,
        });
        setShowExpiredPrompt(true);
        playAlertSound();
        showNotification();
        try {
          window.focus();
        } catch (e) {
          console.warn('Failed to focus window on timer finish:', e);
        }
        setIsExpanded(true);
        setHasAlerted(true);
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('projects:updated'));
          window.dispatchEvent(new Event('task:updated'));
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('time:expired', handleTimeExpired);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('time:expired', handleTimeExpired);
      }
    };
  }, []);



  useEffect(() => {
    const syncProjects = () => {
      refetch({ background: true }).catch(() => undefined);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('projects:updated', syncProjects);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('projects:updated', syncProjects);
      }
    };
  }, [refetch]);

  useEffect(() => {
    const syncTasks = () => {
      if (selectedProjectId) {
        fetchTasksForProject(selectedProjectId);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('task:updated', syncTasks);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('task:updated', syncTasks);
      }
    };
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectTasks([]);
      setSelectedTaskId('');
      return;
    }

    fetchTasksForProject(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (hasManualDurationEdit) return;

    if (selectedTaskId && timerTaskOptions.length > 0) {
      const task = timerTaskOptions.find((option) => option.task.id === selectedTaskId)?.task;
      if (task?.estimatedHours) {
        const remainingHours = task.estimatedHours - (task.actualHours || 0);
        const totalMinutes = Math.round(remainingHours * 60);

        if (totalMinutes > 0) {
          setTargetHoursInput(Math.floor(totalMinutes / 60).toString());
          setTargetMinutesInput((totalMinutes % 60).toString());
        } else {
          setTargetHoursInput('0');
          setTargetMinutesInput('30');
        }
      } else {
        setTargetHoursInput('0');
        setTargetMinutesInput('30');
      }
    } else if (!selectedTaskId) {
      setTargetHoursInput('0');
      setTargetMinutesInput('30');
    }
  }, [selectedTaskId, timerTaskOptions, hasManualDurationEdit]);

  const fetchTasksForProject = async (projectId: string) => {
    try {
      setTasksLoading(true);
      const tasks = await apiGet<Task[]>(`/projects/${projectId}/tasks`);
      setProjectTasks(tasks);
    } catch (error) {
      setProjectTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  const playAlertSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('AudioContext is not supported on this browser');
        return;
      }
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      const audioCtx = audioContextRef.current;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1);
    } catch (e) {
      console.warn('Could not play alert sound', e);
    }
  };

  const showNotification = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      try {
        const n = new Notification('¡Tiempo de trabajo cumplido!', {
          icon: '/favicon.ico',
          body: '¿Deseas agregar más tiempo a esta sesión?',
          tag: 'tino-timer-alert',
          requireInteraction: true
        });
        n.onclick = () => {
          try {
            window.focus();
          } catch (e) {
            console.warn('Failed to focus window:', e);
          }
          setIsExpanded(true);
        };
      } catch (err) {
        console.warn('Notification constructor failed, trying Service Worker:', err);
        // Fallback to Service Worker registration if active (required for Android Chrome)
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then((registration) => {
              registration.showNotification('¡Tiempo de trabajo cumplido!', {
                icon: '/favicon.ico',
                body: '¿Deseas agregar más tiempo a esta sesión?',
                tag: 'tino-timer-alert',
              });
            })
            .catch((swErr) => {
              console.error('Service worker notification failed:', swErr);
            });
        }
      }
    }
  };

  useEffect(() => {
    if (isRunning && !isPaused && elapsedSeconds >= targetMinutes * 60) {
      if (!hasAlerted) {
        setHasAlerted(true);
        refreshTimer().catch(console.error);
      }
    } else if (elapsedSeconds < targetMinutes * 60) {
      setHasAlerted(false);
    }
  }, [isRunning, isPaused, elapsedSeconds, targetMinutes, hasAlerted, refreshTimer]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let titleInterval: ReturnType<typeof setInterval> | null = null;
    const originalTitle = document.title || 'Tino Tasks';

    if (isRunning && !isPaused && elapsedSeconds >= targetMinutes * 60) {
      let isAlertTitle = false;
      titleInterval = setInterval(() => {
        document.title = isAlertTitle ? originalTitle : '⏰ ¡Tiempo cumplido!';
        isAlertTitle = !isAlertTitle;
      }, 1000);
    }

    return () => {
      if (titleInterval) {
        clearInterval(titleInterval);
      }
      document.title = originalTitle;
    };
  }, [isRunning, isPaused, elapsedSeconds, targetMinutes]);

  const formatTime = (seconds: number) => {
    const isOver = seconds < 0;
    const absSeconds = Math.abs(Math.floor(seconds));
    const hrs = Math.floor(absSeconds / 3600);
    const mins = Math.floor((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;
    
    const timeStr = `${hrs > 0 ? hrs.toString().padStart(2, '0') + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return isOver ? `-${timeStr}` : timeStr;
  };

  const handleTargetDurationBlur = () => {
    const normalized = normalizeDurationParts(targetHoursInput, targetMinutesInput);
    setTargetHoursInput(normalized.hours);
    setTargetMinutesInput(normalized.minutes);
  };

  const handleExpiredDurationBlur = () => {
    const normalized = normalizeDurationParts(expiredHoursInput, expiredMinutesInput);
    setExpiredHoursInput(normalized.hours);
    setExpiredMinutesInput(normalized.minutes);
  };

  const handleStart = async () => {
    if (!selectedProjectId || !configuredMinutes || isLoading) return;
    try {
      const finalMinutes = configuredMinutes;

      const apiPromises: Promise<any>[] = [];

      if (selectedTaskId && user?.id) {
        const task = timerTaskOptions.find((option) => option.task.id === selectedTaskId)?.task;
        if (task && !task.assignedToId) {
          const assignPromise = apiPatch(`/projects/${selectedProjectId}/tasks/${selectedTaskId}`, { assignedToId: user.id })
            .then(() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('task:updated'));
              }
            });
          apiPromises.push(assignPromise);
        }
      }

      const startPromise = startTimer(selectedProjectId, selectedTaskId || undefined, finalMinutes);
      apiPromises.push(startPromise);

      setIsClosingModal(true);
      
      await Promise.all([
        new Promise(resolve => setTimeout(resolve, 400)),
        ...apiPromises.map(p => p.catch(() => undefined))
      ]);

      await startPromise;
      setShowProjectSelector(false);
      setIsClosingModal(false);
      setIsExpanded(true);
      setSelectedProjectId('');
      setSelectedTaskId('');
      setProjectTasks([]);
      setTargetHoursInput('0');
      setTargetMinutesInput('30');
      setHasManualDurationEdit(false);
    } catch (_error) {
      setIsClosingModal(false);
    }
  };

  const handleStartExpired = async () => {
    if (!expiredTimerData || !expiredConfiguredMinutes || isLoading) return;
    try {
      const finalMinutes = expiredConfiguredMinutes;

      const startPromise = startTimer(expiredTimerData.projectId, expiredTimerData.taskId || undefined, finalMinutes);

      setIsClosingModal(true);
      
      await Promise.all([
        new Promise(resolve => setTimeout(resolve, 400)),
        startPromise.catch(() => undefined)
      ]);

      await startPromise;
      acknowledgeExpiration().catch(() => undefined);
      setShowExpiredPrompt(false);
      setExpiredTimerData(null);
      setIsClosingModal(false);
      setIsExpanded(true);
      setExpiredHoursInput('0');
      setExpiredMinutesInput('30');
    } catch (_error) {
      setIsClosingModal(false);
    }
  };

  const handleStartExpiredWithMinutes = async (minutes: number) => {
    if (!expiredTimerData) return;
    try {
      const startPromise = startTimer(expiredTimerData.projectId, expiredTimerData.taskId || undefined, minutes);

      setIsClosingModal(true);
      
      await Promise.all([
        new Promise(resolve => setTimeout(resolve, 400)),
        startPromise.catch(() => undefined)
      ]);

      await startPromise;
      acknowledgeExpiration().catch(() => undefined);
      setShowExpiredPrompt(false);
      setExpiredTimerData(null);
      setIsClosingModal(false);
      setIsExpanded(true);
    } catch (_error) {
      setIsClosingModal(false);
    }
  };

  const handleCancelExpired = () => {
    acknowledgeExpiration().catch(() => undefined);
    setShowExpiredPrompt(false);
    setExpiredTimerData(null);
    setIsExpanded(false);
  };

  const handleStop = async () => {
    try {
      const stopPromise = stopTimer();

      setIsClosingTimer(true);
      
      // Wait exactly for the 400ms visual animation to finish
      await new Promise(resolve => setTimeout(resolve, 400));

      setIsStoppedOptimistically(true);
      setIsExpanded(false);
      setIsClosingTimer(false);

      // Await stopPromise in the background so it completes API request
      await stopPromise;
    } catch (_error) {
      setIsClosingTimer(false);
      setIsStoppedOptimistically(false);
    }
  };


  const handleAddMinutes = (minutes: number) => {
    updateTargetMinutes(targetMinutes + minutes);
    setHasAlerted(false);
    if (isPaused) {
      resumeTimer().catch(console.error);
    }
  };

  const handleTogglePause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPaused) {
      await resumeTimer();
    } else {
      await pauseTimer();
    }
  };

  const handleFinishTask = async () => {
    if (!activeTimer?.taskId) return;
    try {
      setTasksLoading(true);
      // Mark task as DONE
      await apiPatch(`/projects/${activeTimer.projectId}/tasks/${activeTimer.taskId}`, { status: TaskStatus.DONE });
      // Stop timer
      await handleStop();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('task:updated'));
      }
    } catch (err) {
      console.error('Error finishing task:', err);
    } finally {
      setTasksLoading(false);
    }
  };

  const headerBg = isPaused 
    ? 'bg-slate-700' 
    : 'bg-[linear-gradient(135deg,var(--color-primary-600),var(--color-primary-700))]';

  const dotColor = isPaused ? 'bg-slate-400' : 'bg-[var(--color-secondary-600)]';
  
  const progress = Math.min(Math.max((elapsedSeconds / (targetMinutes * 60)) * 100, 0), 100);

  const remainingSeconds = Math.max(0, targetMinutes * 60 - elapsedSeconds);

  const activeTasks = timerTaskOptions.filter((option) => option.task.status !== TaskStatus.DONE);
  const hasParentTasksWithSubTasks = projectTasks.some((task) => task.subTasks?.length);

  const showRunningTimer = isRunning && !isStoppedOptimistically;

  if (!isRunning && showExpiredPrompt && expiredTimerData) {
    return (
      <Portal>
        <div className={`fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-400 ${isClosingModal ? 'opacity-0' : 'opacity-100'}`}>
          <Card onClick={(e) => e.stopPropagation()} className={`w-full max-w-[480px] p-6 sm:p-8 shadow-2xl relative rounded-t-[24px] sm:rounded-2xl ${isClosingModal ? 'animate-modal-exit' : 'animate-page-enter'}`}>
            <button
              onClick={handleCancelExpired}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">TEMPORIZADOR</p>
                  <h3 className="text-[22px] font-extrabold text-gray-900 tracking-tight leading-none mt-1">
                    ¡Tiempo cumplido!
                  </h3>
                </div>
              </div>
              <div className="h-px bg-gray-100 w-full mb-6" />
              <p className="text-[14px] text-gray-500 font-medium leading-relaxed mb-4">
                La sesión de trabajo para el proyecto <strong className="text-gray-900">{expiredTimerData.projectName}</strong>{expiredTimerData.taskTitle ? <> y la tarea <strong className="text-gray-900">{expiredTimerData.taskTitle}</strong></> : ''} ha finalizado y se ha registrado con éxito.
              </p>
              <p className="text-[15px] font-bold text-gray-900 mb-2">
                ¿Deseas agregar más tiempo?
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Accesos rápidos</p>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleStartExpiredWithMinutes(5)}
                    className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 text-[13px] font-bold py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    +5 min
                  </button>
                  <button
                    onClick={() => handleStartExpiredWithMinutes(10)}
                    className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 text-[13px] font-bold py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    +10 min
                  </button>
                  <button
                    onClick={() => handleStartExpiredWithMinutes(15)}
                    className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 text-[13px] font-bold py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    +15 min
                  </button>
                  <button
                    onClick={() => handleStartExpiredWithMinutes(30)}
                    className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 text-[13px] font-bold py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    +30 min
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-gray-900">O ingresa un tiempo personalizado</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      id="expired-timer-hours"
                      type="number"
                      min="0"
                      max={MAX_TASK_HOURS}
                      step="1"
                      value={expiredHoursInput}
                      onChange={(e) => setExpiredHoursInput(e.target.value)}
                      onBlur={handleExpiredDurationBlur}
                      className="w-full bg-white border border-gray-200 rounded-lg pl-4 pr-10 py-3 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10 focus:border-[#1e3a5f] transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400 uppercase pointer-events-none">h</span>
                  </div>
                  <div className="relative">
                    <input
                      id="expired-timer-minutes"
                      type="number"
                      min="0"
                      max={MAX_TASK_MINUTES}
                      step="1"
                      value={expiredMinutesInput}
                      onChange={(e) => setExpiredMinutesInput(e.target.value)}
                      onBlur={handleExpiredDurationBlur}
                      className="w-full bg-white border border-gray-200 rounded-lg pl-4 pr-10 py-3 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10 focus:border-[#1e3a5f] transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400 uppercase pointer-events-none">m</span>
                  </div>
                </div>
                {expiredConfiguredMinutes === null ? <p role="alert" className="text-sm text-red-600">{TASK_DURATION_ERROR}</p> : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 mt-10">
              <button
                onClick={handleCancelExpired}
                className="text-[14px] font-bold text-gray-400 hover:text-gray-600 px-4 py-2 transition-colors"
              >
                Finalizar aquí
              </button>
              <button
                onClick={handleStartExpired}
                disabled={!expiredConfiguredMinutes || isLoading}
                className="flex items-center gap-2 bg-[#1e3a5f] text-white px-6 py-3 rounded-xl text-[14px] font-bold shadow-sm hover:bg-[#2c4f7c] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Iniciar temporizador
              </button>
            </div>
          </Card>
        </div>
      </Portal>
    );
  }

  if (!showRunningTimer && !showProjectSelector) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
        <div className="relative">
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
              }
              setShowProjectSelector(true);
            }}
            className="flex items-center gap-2 sm:gap-3 bg-[#1e3a5f] text-white px-5 py-3 sm:px-6 sm:py-4 rounded-full shadow-[0_10px_30px_-10px_rgba(30,58,95,0.5)] hover:shadow-[0_20px_40px_-15px_rgba(30,58,95,0.7)] hover:-translate-y-1 transition-all duration-300 group"
            title="Iniciar temporizador"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <span className="font-bold text-[13px] sm:text-[14px] tracking-tight">Temporizador</span>
          </button>
        </div>
      </div>
    );
  }

  if (showProjectSelector && !showRunningTimer) {
    return (
      <Portal>
        <div className={`fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-400 ${isClosingModal ? 'opacity-0' : 'opacity-100'}`}>
          <Card onClick={(e) => e.stopPropagation()} className={`w-full max-w-[480px] p-6 sm:p-8 shadow-2xl relative rounded-t-[24px] sm:rounded-2xl ${isClosingModal ? 'animate-modal-exit' : 'animate-page-enter'}`}>
            <button
              onClick={() => setShowProjectSelector(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>


            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#e8eef5] text-[#1e3a5f] flex items-center justify-center">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">CRONOMETRO</p>
                  <h3 className="text-[22px] font-extrabold text-gray-900 tracking-tight leading-none mt-1">
                    Iniciar seguimiento
                  </h3>
                </div>
              </div>
              <div className="h-px bg-gray-100 w-full mb-6" />
              <p className="text-[14px] text-gray-500 font-medium leading-relaxed">
                Registra tiempo al proyecto completo o vinculalo a una tarea puntual.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="timer-project-select" className="text-[13px] font-bold text-gray-900">Proyecto <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    id="timer-project-select"
                    value={selectedProjectId}
                    onChange={(event) => {
                      setSelectedProjectId(event.target.value);
                      setSelectedTaskId('');
                    }}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-[14px] font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10 focus:border-[#1e3a5f] transition-all cursor-pointer"
                  >
                    <option value="">Seleccionar proyecto</option>
                    {projects.filter((project) => project.isActive).map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="flex flex-col gap-2">
                  <label htmlFor="timer-task-select" className="text-[13px] font-bold text-gray-400">Tarea <span className="text-[11px] font-medium ml-1">(opcional)</span></label>
                  <div className="relative">
                    <select
                      id="timer-task-select"
                      value={selectedTaskId}
                      onChange={(event) => {
                        const taskId = event.target.value;
                        setSelectedTaskId(taskId);
                        if (taskId && !hasManualDurationEdit) {
                          const task = timerTaskOptions.find((option) => option.task.id === taskId)?.task;
                          if (task?.estimatedHours) {
                            const remaining = Math.round((task.estimatedHours - (task.actualHours || 0)) * 60);
                            if (remaining > 0) {
                              setTargetHoursInput(Math.floor(remaining / 60).toString());
                              setTargetMinutesInput((remaining % 60).toString());
                            }
                          }
                        }
                      }}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-[14px] font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10 focus:border-[#1e3a5f] transition-all cursor-pointer disabled:bg-gray-50 disabled:text-gray-400"
                      disabled={!selectedProjectId || tasksLoading}
                    >
                      <option value="">Sin vincular</option>
                      {activeTasks.map(({ task, label }) => (
                        <option key={task.id} value={task.id}>{label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  </div>
                  {selectedProjectId && !tasksLoading && activeTasks.length === 0 ? (
                    <p className="text-[11px] font-medium text-gray-500">No hay tareas disponibles para iniciar timer.</p>
                  ) : hasParentTasksWithSubTasks ? (
                    <p className="text-[11px] font-medium text-gray-500">Las tareas padre con subtareas no aparecen aca. Elegi una subtarea.</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-gray-900">Tiempo a trabajar <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input
                        id="timer-hours"
                        type="number"
                        min="0"
                        max={MAX_TASK_HOURS}
                        step="1"
                        value={targetHoursInput}
                        onChange={(e) => {
                          setHasManualDurationEdit(true);
                          setTargetHoursInput(e.target.value);
                        }}
                        onBlur={handleTargetDurationBlur}
                        className="w-full bg-white border border-gray-200 rounded-lg pl-4 pr-10 py-3 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10 focus:border-[#1e3a5f] transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400 uppercase pointer-events-none">h</span>
                    </div>
                    <div className="relative">
                      <input
                        id="timer-minutes"
                        type="number"
                        min="0"
                        max={MAX_TASK_MINUTES}
                        step="1"
                        value={targetMinutesInput}
                        onChange={(e) => {
                          setHasManualDurationEdit(true);
                          setTargetMinutesInput(e.target.value);
                        }}
                        onBlur={handleTargetDurationBlur}
                        className="w-full bg-white border border-gray-200 rounded-lg pl-4 pr-10 py-3 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10 focus:border-[#1e3a5f] transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400 uppercase pointer-events-none">m</span>
                    </div>
                  </div>
                  {configuredMinutes === null ? <p role="alert" className="text-sm text-red-600">{TASK_DURATION_ERROR}</p> : null}
                </div>
              </div>

              <div className="bg-[#f0f9ff] p-4 rounded-xl flex gap-3 border border-[#e0f2fe]">
                <div className="text-blue-500 shrink-0 mt-0.5">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-[13px] font-medium text-blue-700 leading-snug">
                  Te avisaremos cuando el tiempo termine para que puedas descansar o continuar.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 mt-10">
              <button
                onClick={() => setShowProjectSelector(false)}
                className="text-[14px] font-bold text-gray-400 hover:text-gray-600 px-4 py-2 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleStart}
                disabled={!selectedProjectId || !configuredMinutes || isLoading}
                className="flex items-center gap-2 bg-[#1e3a5f] text-white px-6 py-3 rounded-xl text-[14px] font-bold shadow-sm hover:bg-[#2c4f7c] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Iniciar temporizador
              </button>
            </div>
          </Card>
        </div>
      </Portal>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 transition-opacity duration-400 ${isClosingTimer ? 'opacity-0' : 'opacity-100'}`}>
      <Card className={`w-[calc(100vw-2rem)] sm:w-[24rem] overflow-hidden p-0 shadow-2xl rounded-2xl ${isClosingTimer ? 'animate-modal-exit' : 'animate-timer-enter'}`}>

        <div
          className={`cursor-pointer ${headerBg} px-5 py-4 text-white transition-all duration-300 hover:brightness-110 active:scale-[0.98] ${elapsedSeconds >= targetMinutes * 60 && !isPaused ? 'animate-pulse' : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${dotColor} ${!isPaused ? 'animate-pulse' : ''}`} />
              <span className="font-mono text-xl font-semibold tracking-tight">{formatTime(remainingSeconds)}</span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={handleTogglePause}
                disabled={isLoading}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors mr-1 disabled:opacity-50 disabled:cursor-not-allowed"
                title={isPaused ? 'Reanudar' : 'Pausar'}
              >
                {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
              </button>

              {elapsedSeconds >= targetMinutes * 60 ? (
                <span className="rounded-full bg-red-500/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-md animate-bounce">
                  TIEMPO CUMPLIDO
                </span>
              ) : isPaused ? (
                <span className="rounded-full bg-slate-500/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-md">
                  PAUSADO
                </span>
              ) : null}
              <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-[11px] font-bold uppercase tracking-wider">{isExpanded ? 'Ocultar' : 'Ver'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-3 h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-linear ${elapsedSeconds >= targetMinutes * 60 ? 'bg-red-400' : 'bg-blue-400'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div
          className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isExpanded && activeTimer ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        >
          <div className="overflow-hidden">
            <div className="space-y-5 p-5 border-t border-slate-100 bg-white">
              <div className="group">
                <p className="app-caption uppercase tracking-[0.12em] font-bold text-slate-400">Proyecto</p>
                <p className="mt-1 truncate text-[15px] font-bold text-slate-900">
                  {activeTimer?.project?.name}
                </p>
              </div>

              <div>
                <p className="app-caption uppercase tracking-[0.12em] font-bold text-slate-400">Tarea</p>
                <p className="mt-1 text-[14px] font-semibold text-slate-800 leading-snug">
                  {activeTimer?.task?.title || 'Tiempo registrado a nivel proyecto'}
                </p>
                {activeTimer?.task?.status ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {activeTimer?.task?.status ? taskStatusLabels[activeTimer.task.status] : ''}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimación</p>
                  <p className="mt-1 text-[14px] font-bold text-slate-900">
                    {Math.floor(targetMinutes / 60)}h {targetMinutes % 60}m
                  </p>
                </div>
                <div className={`rounded-xl p-3.5 border ${elapsedSeconds >= targetMinutes * 60 ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${elapsedSeconds >= targetMinutes * 60 ? 'text-red-400' : 'text-blue-400'}`}>
                    {elapsedSeconds >= targetMinutes * 60 ? 'Extra' : 'Restante'}
                  </p>
                  <p className={`mt-1 text-[14px] font-bold ${elapsedSeconds >= targetMinutes * 60 ? 'text-red-900' : 'text-blue-900'}`}>
                    {formatTime(remainingSeconds)}
                  </p>
                </div>
              </div>

              {elapsedSeconds >= targetMinutes * 60 && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 animate-in fade-in zoom-in-95">
                  <p className="text-[13px] font-bold text-amber-900 text-center mb-3">¿Deseas agregar más tiempo?</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => handleAddMinutes(5)}
                      className="bg-white border border-amber-200 hover:bg-amber-100 text-amber-900 text-[12px] font-bold py-2 rounded-lg transition-colors"
                    >
                      +5 min
                    </button>
                    <button 
                      onClick={() => handleAddMinutes(10)}
                      className="bg-white border border-amber-200 hover:bg-amber-100 text-amber-900 text-[12px] font-bold py-2 rounded-lg transition-colors"
                    >
                      +10 min
                    </button>
                    <button 
                      onClick={() => handleAddMinutes(15)}
                      className="bg-white border border-amber-200 hover:bg-amber-100 text-amber-900 text-[12px] font-bold py-2 rounded-lg transition-colors"
                    >
                      +15 min
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-3">
                {activeTimer?.taskId && (
                  <Button 
                    onClick={handleFinishTask} 
                    disabled={isLoading} 
                    variant="primary" 
                    fullWidth 
                    className="rounded-xl font-bold py-3 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Finalizar y Completar Tarea
                  </Button>
                )}
                
                <Button onClick={handleStop} disabled={isLoading} variant="danger" fullWidth className="rounded-xl font-bold py-3 outline outline-1 outline-red-100">
                  {isLoading ? 'Deteniendo...' : 'Detener temporizador'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>

  );
}
