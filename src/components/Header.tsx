import React from 'react';
import { Volume2, VolumeX, Bell, ShieldAlert, Users, Building2, User, Crown, LogOut, Moon, Sun, Settings } from 'lucide-react';
import { Vendor, UserSession, UserRole } from '../types/crm';
import { isSoundEnabled, setSoundEnabled } from '../utils/soundAlerts';
import { requestNotificationPermission, hasNotificationPermission, sendLeadPushNotification } from '../utils/pushNotifications';
import { supabase } from '../lib/supabase';

interface HeaderProps {
  currentSession: UserSession;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  activeLeadsCount: number;
  activeVendorsCount: number;
  vendors: Vendor[];
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSession,
  activeTab,
  setActiveTab,
  activeLeadsCount,
  activeVendorsCount,
  vendors,
  darkMode,
  onToggleDarkMode,
  onOpenSettings,
}) => {
  const [soundOn, setSoundOn] = React.useState(isSoundEnabled());
  const [notificationsGranted, setNotificationsGranted] = React.useState(hasNotificationPermission());

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
  };

  const handleRequestPush = async () => {
    const res = await requestNotificationPermission();
    if (res === 'granted') {
      setNotificationsGranted(true);
      sendLeadPushNotification(
        'Notificaciones Push Activadas',
        'Recibirás alertas inmediatas de asignaciones, advertencias de 30m y rotaciones.',
        'info'
      );
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'administracion':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
            <Crown className="w-3 h-3 text-red-600" />
            Administración
          </span>
        );
      case 'gerencia':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
            <Building2 className="w-3 h-3 text-indigo-600" />
            Gerencia
          </span>
        );
      case 'supervisor':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
            <Users className="w-3 h-3 text-purple-600" />
            Supervisor
          </span>
        );
      case 'vendedor':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
            <User className="w-3 h-3 text-emerald-600" />
            Vendedor
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-16">
          {/* Zone 1: Product identity */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                if (currentSession.role === 'vendedor') setActiveTab('assigned');
                else if (currentSession.role === 'supervisor') setActiveTab('monitoring');
                else if (currentSession.role === 'gerencia') setActiveTab('metrics');
                else setActiveTab('overview');
              }}
              className="text-left cursor-pointer group focus:outline-none"
            >
              <img src="/rotex-logo.jfif" alt="Rotex · Rotación inteligente de leads" className="h-11 w-36 rounded-md object-cover object-center shadow-sm ring-1 ring-slate-200 transition-opacity group-hover:opacity-85" />
            </button>
            <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-200">
              {getRoleBadge(currentSession.role)}
              <span className="text-xs text-slate-500 font-medium">{currentSession.name}</span>
            </div>
          </div>

          {/* Zone 2: Navigation Links (Strictly filtered by role) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {/* VENDEDOR TABS */}
            {currentSession.role === 'vendedor' && (
              <>
                <button
                  onClick={() => setActiveTab('assigned')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'assigned'
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Mis Datos Asignados
                </button>
                <button
                  onClick={() => setActiveTab('ranking')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'ranking'
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Ranking del Mes
                </button>
                <button onClick={() => setActiveTab('history')} className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${activeTab === 'history' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent hover:text-slate-900'}`}>Mi historial</button>
              </>
            )}

            {/* SUPERVISOR TABS */}
            {currentSession.role === 'supervisor' && (
              <>
                <button
                  onClick={() => setActiveTab('monitoring')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'monitoring'
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Monitoreo de Mi Equipo (Urgencia)
                </button>
                <button
                  onClick={() => setActiveTab('team')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'team'
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Mis Vendedores
                </button>
                <button
                  onClick={() => setActiveTab('rankings')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'rankings'
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Rankings
                </button>
              </>
            )}

            {/* GERENCIA TABS */}
            {currentSession.role === 'gerencia' && (
              <>
                <button
                  onClick={() => setActiveTab('metrics')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'metrics'
                      ? 'border-indigo-600 text-indigo-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Estadísticas Ejecutivas
                </button>
                <button
                  onClick={() => setActiveTab('structure')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'structure'
                      ? 'border-indigo-600 text-indigo-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Control de Estructura
                </button>
                <button
                  onClick={() => setActiveTab('portfolio')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'portfolio'
                      ? 'border-indigo-600 text-indigo-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Cartera
                </button>
                <button
                  onClick={() => setActiveTab('rankings')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'rankings'
                      ? 'border-indigo-600 text-indigo-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Rankings Generales
                </button>
              </>
            )}

            {/* ADMINISTRACION TABS */}
            {currentSession.role === 'administracion' && (
              <>
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'overview'
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Control Operativo
                </button>
                <button
                  onClick={() => setActiveTab('leads')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'leads'
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Rotación en Vivo
                </button>
                <button
                  onClick={() => setActiveTab('vendors')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'vendors'
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Vendedores & Parte Diario
                </button>
                <button
                  onClick={() => setActiveTab('rankings')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'rankings'
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Rankings
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`whitespace-nowrap shrink-0 transition-colors py-2 border-b-2 ${
                    activeTab === 'history'
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  Historial de Rotación
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: session controls */}
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={onOpenSettings} title="Configuración personal" className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"><Settings className="w-4 h-4" /></button>
            <button onClick={onToggleDarkMode} title={darkMode ? 'Usar modo claro' : 'Usar modo oscuro'} className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors">
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={() => void supabase.auth.signOut()} title="Cerrar sesión" className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"><LogOut className="w-4 h-4" /></button>

            {/* Audio chime toggle */}
            <button
              onClick={handleToggleSound}
              title={soundOn ? 'Sonido activado' : 'Sonido silenciado'}
              className={`p-2 rounded-lg border transition-colors ${
                soundOn
                  ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Push notification toggle */}
            {!notificationsGranted ? (
              <button
                onClick={handleRequestPush}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                title="Habilitar notificaciones push inmediatas"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Alertas Push</span>
              </button>
            ) : (
              <div
                className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg"
                title="Notificaciones push activas"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Alertas OK</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
