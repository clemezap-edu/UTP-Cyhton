import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { ScheduleSection } from './ScheduleSection';
import { SubjectsSection } from './SubjectsSection';
import { GraphSection } from './GraphSection';
import { Subject, Schedule } from './types';

export default function App() {
  const [activeSection, setActiveSection] = useState('schedule');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const sections = [
    { id: 'schedule', name: 'Horario', icon: '📅' },
    { id: 'subjects', name: 'Materias', icon: '📚' },
    { id: 'graph', name: 'Grafo', icon: '🕸️' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Sistema de Gestión de Horarios
          </h1>
        </div>
      </header>
      
      <div className="flex">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} sections={sections} />

        {/* Main Content */}
        <main className="flex-1 p-8">
          {activeSection === 'schedule' && (
            <ScheduleSection
              schedules={schedules}
              onSchedulesChange={setSchedules}
              subjects={subjects}
            />
          )}
          {activeSection === 'subjects' && (
            <SubjectsSection subjects={subjects} onSubjectsChange={setSubjects} />
          )}
          {activeSection === 'graph' && (
            <GraphSection schedules={schedules} subjects={subjects} />
          )}
        </main>
      </div>
    </div>
  );
}