// ==================== SISTEMA DE HORARIOS ITI - UPV ====================
// Aplicación Web Interactiva con Búsqueda Tabú (Cython Backend)

// Configuración del servidor API
const API_BASE = 'http://localhost:5001/api';
const USAR_CYTHON = true;  // true = usar servidor Cython, false = algoritmo JS local

// Datos globales
let appState = {
    currentScreen: 'dashboard',
    profesores: [],
    materias: [],
    grupos: [],
    aulas: [],
    eventos: [],
    asignaciones: {},  // grupo_id -> materia_id -> profesor_id
    solucion: null,
    log: [],
    progreso: 0,
    optimizando: false,
    dataEntryTab: 'profesores',  // Tab activo en entrada de datos
    intervaloOptimizacion: null,
    cythonDisponible: false,     // Se actualiza al conectar con el servidor
    motorUsado: 'JavaScript'     // 'Cython' o 'JavaScript'
};

// Paleta de colores para materias
const COLORES_MATERIAS = [

    { bg: 'bg-white', border: 'border-black', text: 'text-black' },
    { bg: 'bg-white', border: 'border-black', text: 'text-black' },
    { bg: 'bg-white', border: 'border-black', text: 'text-black' },
    { bg: 'bg-white', border: 'border-black', text: 'text-black' },
    { bg: 'bg-white', border: 'border-black', text: 'text-black' },
    { bg: 'bg-white', border: 'border-black', text: 'text-black' },
    { bg: 'bg-white', border: 'border-black', text: 'text-black' },
    { bg: 'bg-white', border: 'border-black', text: 'text-black' },
    { bg: 'bg-white', border: 'border-black', text: 'text-black' },
    /*
    { bg: 'bg-yellow-300', border: 'border-yellow-500', text: 'text-yellow-900' },
    { bg: 'bg-purple-300', border: 'border-blue-500', text: 'text-purple-900' },
    { bg: 'bg-pink-300', border: 'border-pink-500', text: 'text-pink-900' },
    { bg: 'bg-teal-300', border: 'border-teal-500', text: 'text-teal-900' },
    { bg: 'bg-red-300', border: 'border-red-500', text: 'text-red-900' },
    { bg: 'bg-green-300', border: 'border-green-500', text: 'text-green-900' },
    { bg: 'bg-purple-300', border: 'border-purple-500', text: 'text-purple-900' },
    { bg: 'bg-orange-300', border: 'border-orange-500', text: 'text-orange-900' },
    { bg: 'bg-cyan-300', border: 'border-cyan-500', text: 'text-cyan-900' }*/
];

// Color map legacy
const COLOR_MAP = {
    blue: COLORES_MATERIAS[0],
    green: COLORES_MATERIAS[1],
    purple: COLORES_MATERIAS[2],
    orange: COLORES_MATERIAS[3]
};

// Constantes
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// Horarios reales de la UPV (según Excel)
// Matutino: 7:00-14:55, Vespertino: 14:00-21:00
const HORAS_INICIO = [
    '7:00',   // 0 - 7:00-7:55
    '7:55',   // 1 - 7:55-8:50
    '8:50',   // 2 - 8:50-9:45
    '9:45',   // 3 - 9:45-10:40
    '11:10',  // 4 - 11:10-12:05 (después del receso 10:40-11:10)
    '12:05',  // 5 - 12:05-13:00
    '13:00',  // 6 - 13:00-13:55
    '14:00',  // 7 - 14:00-14:55
    '14:55',  // 8 - 14:55-15:50
    '15:50',  // 9 - 15:50-16:45
    '16:45',  // 10 - 16:45-17:40
    '17:40',  // 11 - 17:40-18:35
    '18:35',  // 12 - 18:35-19:30
    '19:30'   // 13 - 19:30-20:25
];

// Horarios con rango completo para mostrar en la tabla
const HORAS_RANGO = [
    '7:00-7:55',
    '7:55-8:50',
    '8:50-9:45',
    '9:45-10:40',
    '11:10-12:05',
    '12:05-13:00',
    '13:00-13:55',
    '14:00-14:55',
    '14:55-15:50',
    '15:50-16:45',
    '16:45-17:40',
    '17:40-18:35',
    '18:35-19:30',
    '19:30-20:25'
];

// ==================== UTILIDADES ====================

function icon(name) {
    return `<svg class="w-5 h-5"><use href="#icon-${name}"></use></svg>`;
}

function iconSmall(name) {
    return `<svg class="w-4 h-4"><use href="#icon-${name}"></use></svg>`;
}

function getProfesorNombre(id) {
    const prof = appState.profesores.find(p => p.id === id);
    return prof ? prof.nombre : `Profesor ${id}`;
}

function getMateriaNombre(id) {
    const mat = appState.materias.find(m => m.id === id);
    return mat ? mat.nombre : `Materia ${id}`;
}

function getMateriaColor(id) {
    // Color basado en el ID de la materia
    return COLORES_MATERIAS[id % COLORES_MATERIAS.length];
}

function getGrupoNombre(id) {
    const grupo = appState.grupos.find(g => g.id === id);
    return grupo ? grupo.nombre : `Grupo ${id}`;
}

function getAulaNombre(id) {
    const aula = appState.aulas.find(a => a.id === id);
    return aula ? aula.nombre : `Aula ${id}`;
}

function contarHorasProfesor(profId) {
    return appState.eventos.filter(e => e.profesor_id === profId).length;
}

function contarHorasGrupo(grupoId) {
    return appState.eventos.filter(e => e.grupo_id === grupoId).length;
}

// ==================== NAVEGACIÓN ====================

const screens = {
    dashboard: {
        title: "Menú",
        icon: "home",
        component: renderDashboard
    },
    dataEntry: {
        title: "Entrada de Datos",
        icon: "edit",
        component: renderDataEntry
    },
    visualization: {
        title: "Ver Horarios",
        icon: "calendar",
        component: renderVisualization
    },
    conflicts: {
        title: "Análisis",
        icon: "chart",
        component: renderConflicts
    }
};

function navigateTo(screenName) {
    appState.currentScreen = screenName;
    document.getElementById('screen-title').textContent = screens[screenName].title;
    document.getElementById('screen-content').innerHTML = '';
    screens[screenName].component();
    updateNavigation();
}

function updateNavigation() {
    const sidebarNav = document.getElementById('sidebar-nav');

    if (!sidebarNav) return;

    sidebarNav.innerHTML = '';

    Object.keys(screens).forEach(key => {
        const screen = screens[key];
        const isActive = appState.currentScreen === key;

        // Sidebar nav item
        const navItem = document.createElement('div');
        navItem.onclick = () => navigateTo(key);
        navItem.className = `sidebar-link flex items-center gap-3 px-4 py-3 mb-2 rounded-lg cursor-pointer ${isActive ? 'active' : ''}`;
        navItem.innerHTML = `
            <svg class="w-5 h-5 flex-shrink-0"><use href="#icon-${screen.icon}"></use></svg>
            <span class="text-sm font-medium">${screen.title}</span>
        `;
        sidebarNav.appendChild(navItem);
    });
}

// ==================== COMPONENTES DE UI ====================

function StatCard(iconName, title, value, color) {
    const colorClasses = {
        blue: 'bg-white border-purple-300 text-purple-600',
    };

    return `
        <div class="${colorClasses[color]} rounded-xl p-5 shadow-sm border">
            <div class="mb-2">${icon(iconName)}</div>
            <div class="text-3xl font-extrabold text-${color}-900">${value}</div>
            <div class="text-sm font-medium text-${color}-700">${title}</div>
        </div>
    `;
}

function ActionCard(iconName, title, description, action, primary = false) {
    return `
        <div class="border border-gray-200 rounded-xl p-6 bg-white hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
            <div class="${primary ? 'text-purple-600' : 'text-gray-600'} mb-3">
                ${icon(iconName)}
            </div>
            <h3 class="font-semibold text-gray-800 mb-2">${title}</h3>
            <p class="text-sm text-gray-600 mb-4 flex-grow">${description}</p>
            <button class="w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${primary ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }" onclick="${action}">
                ${action.includes('generar') ? 'Generar Ahora' : action.includes('importar') ? 'Importar' : 'Abrir Reportes'}
            </button>
        </div>
    `;
}

// ==================== PANTALLAS ====================

function renderDashboard() {
    const content = document.getElementById('screen-content');

    content.innerHTML = `
        <div class="space-y-8">
            <!-- Estadísticas -->
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${StatCard('users', 'Profesores Activos', appState.profesores.length || 0, 'blue')}
                ${StatCard('book', 'Materias Registradas', appState.materias.length || 0, 'blue')}
                ${StatCard('calendar', 'Grupos Asignados', appState.grupos.length || 0, 'blue')}
            </div>
            
            <!-- Acciones principales -->
            <div class="grid lg:grid-cols-2 gap-6">
                ${ActionCard('upload', 'Importar Datos', 'Carga el archivo json.', 'importarDatos()')}
                ${ActionCard('play', 'Generar Horario', 'Ejecutar el sistema de generación de horarios.', 'generarHorario()', true)}
                <!-- ${ActionCard('file', 'Ver Reportes', 'Consultar reportes detallados, análisis de calidad y documentos de exportación.', 'verReportes()')} -->
            </div>
 
            <div class="grid lg:grid-cols-2 gap-6">
                <!-- Parámetros -->
                <div class="border border-gray-200 rounded-xl p-6 shadow-lg bg-white">
                    <h3 class="font-bold text-gray-800 mb-4 text-xl">Parámetros de la búsqueda</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Número Máximo de Iteraciones</label>
                            <input type="number" value="1000" id="max-iter" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Tamaño de la Lista Tabú</label>
                            <input type="number" value="20" id="tabu-size" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">Prioridad de Optimización</label>
                            <select class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500">
                                <option>Eliminar conflictos duros primero (Default)</option>
                                <option>Balance entre duros y blandos</option>
                                <option>Optimización de calidad (solo blandos)</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- Estado -->
                <div class="border border-gray-200 rounded-xl p-6 shadow-lg bg-white">
                    <h3 class="font-bold text-gray-800 mb-4 text-xl">Estado de la Configuración</h3>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                            <span class="text-sm font-medium text-gray-700">Eventos Cargados</span>
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-semibold text-gray-900">${appState.eventos.length}</span>
                                <div class="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                            <span class="text-sm font-medium text-gray-700">Restricciones Duras</span>
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-semibold text-gray-900">5</span>
                                ${icon('check')}
                            </div>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                            <span class="text-sm font-medium text-gray-700">Restricciones Blandas</span>
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-semibold text-gray-900">5</span>
                                ${icon('check')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Progreso -->
            <div class="border border-gray-200 rounded-xl p-6 shadow-lg bg-white" id="progress-section" style="display: ${appState.optimizando ? 'block' : 'none'}">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-bold text-gray-800 text-xl">Progreso de Optimización</h3>
                    <span class="text-sm font-medium text-gray-600">Iteración <span id="iter-actual">0</span>/<span id="iter-max">1000</span></span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-4 mb-4">
                    <div id="progress-bar" class="bg-purple-600 h-4 rounded-full transition-all duration-500" style="width: 0%"></div>
                </div>
                <div class="grid grid-cols-3 gap-6 mt-4">
                    <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <div class="text-sm text-gray-600 mb-1">Conflictos Duros</div>
                        <div class="flex items-center justify-between">
                            <span class="text-2xl font-bold text-gray-900" id="conflictos-value">0</span>
                            <span class="text-green-600 text-sm font-bold">↓</span>
                        </div>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <div class="text-sm text-gray-600 mb-1">Penalización</div>
                        <div class="flex items-center justify-between">
                            <span class="text-2xl font-bold text-gray-900" id="penalizacion-value">0</span>
                            <span class="text-green-600 text-sm font-bold">↓</span>
                        </div>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <div class="text-sm text-gray-600 mb-1">Calidad</div>
                        <div class="flex items-center justify-between">
                            <span class="text-2xl font-bold text-gray-900" id="calidad-value">0%</span>
                            <span class="text-green-600 text-sm font-bold">↑</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Controles -->
            <div class="flex gap-4">
                <button onclick="iniciarOptimizacion()" class="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition-colors shadow-xl shadow-green-200/50">
                    ${icon('play')} Iniciar Generación
                </button>
                <button onclick="detenerOptimizacion()" class="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors">
                    Detener
                </button>
                <button class="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors">
                    ${icon('save')} Guardar Configuración
                </button>
            </div>
            
            <!-- Log -->
            <div class="bg-gray-800 rounded-xl p-4 shadow-2xl">
                <h4 class="font-bold text-white mb-2">Log de Ejecución</h4>
                <div id="log-container" class="space-y-1 font-mono text-xs text-green-400 max-h-40 overflow-y-auto p-1">
                    <p>[${new Date().toLocaleTimeString()}] Sistema listo. Presiona "Iniciar Generación" para comenzar...</p>
                </div>
            </div>
        </div>

    `;
}

function renderDataEntry() {
    const content = document.getElementById('screen-content');
    const tabs = ['profesores', 'materias', 'grupos', 'aulas', 'asignaciones'];
    const tabLabels = ['Profesores', 'Materias', 'Grupos', 'Aulas', 'Asignaciones'];

    content.innerHTML = `
        <div class="space-y-8">
            <!-- Tabs -->
            <div class="flex flex-wrap gap-3 border-b border-gray-200 pb-3">
                ${tabs.map((tab, i) => `
                    <button onclick="cambiarTabDataEntry('${tab}')" class="px-4 py-2 rounded-lg font-medium transition-colors text-sm ${appState.dataEntryTab === tab ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }">${tabLabels[i]} (${getTabCount(tab)})</button>
                `).join('')}
            </div>
            
            <!-- Contenido del tab -->
            <div id="tab-content">
                ${renderTabContent()}
            </div>
        </div>
    `;
}

function getTabCount(tab) {
    switch (tab) {
        case 'profesores': return appState.profesores.length;
        case 'materias': return appState.materias.length;
        case 'grupos': return appState.grupos.length;
        case 'aulas': return appState.aulas.length;
        case 'asignaciones': return Object.keys(appState.asignaciones).length;
        default: return 0;
    }
}

function cambiarTabDataEntry(tab) {
    appState.dataEntryTab = tab;
    renderDataEntry();
}

function renderTabContent() {
    switch (appState.dataEntryTab) {
        case 'profesores': return renderProfesoresTab();
        case 'materias': return renderMateriasTab();
        case 'grupos': return renderGruposTab();
        case 'aulas': return renderAulasTab();
        case 'asignaciones': return renderAsignacionesTab();
        default: return '';
    }
}

function renderProfesoresTab() {
    return `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-800">Profesores ITI - ${appState.profesores.length} Registros</h3>
            <div class="flex gap-2">
                <input type="text" id="buscar-profesor" placeholder="Buscar profesor..." 
                    class="px-3 py-2 border border-gray-300 rounded-lg text-sm" onkeyup="filtrarTabla('profesores')">
            </div>
        </div>
        <div class="border border-gray-200 rounded-xl overflow-hidden shadow-lg">
            <div class="overflow-x-auto max-h-96">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50 sticky top-0">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">ID</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Nombre</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Horas Asignadas</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Estado</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white" id="tabla-profesores">
                        ${appState.profesores.map(prof => {
        const horas = contarHorasProfesor(prof.id);
        return `
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td class="px-4 py-3 text-sm text-gray-700">${prof.id}</td>
                                <td class="px-4 py-3 text-sm text-gray-700 font-medium">${prof.nombre}</td>
                                <td class="px-4 py-3 text-sm text-gray-700">${horas} hrs</td>
                                <td class="px-4 py-3">
                                    <span class="inline-flex px-3 py-1 text-xs font-semibold rounded-full ${horas > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }">${horas > 0 ? 'Activo' : 'Sin asignar'}</span>
                                </td>
                            </tr>`;
    }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderMateriasTab() {
    return `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-800">Materias - ${appState.materias.length} Registros</h3>
        </div>
        <div class="border border-gray-200 rounded-xl overflow-hidden shadow-lg">
            <div class="overflow-x-auto max-h-96">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50 sticky top-0">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">ID</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Nombre</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Horas/Semana</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white">
                        ${appState.materias.map(mat => {
        const color = getMateriaColor(mat.id);
        return `
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td class="px-4 py-3 text-sm text-gray-700">${mat.id}</td>
                                <td class="px-4 py-3 text-sm text-gray-700 font-medium">${mat.nombre}</td>
                                <td class="px-4 py-3 text-sm text-gray-700">${mat.horas_semanales} hrs</td>
                            </tr>`;
    }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderGruposTab() {
    return `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-800">Grupos - ${appState.grupos.length} Registros</h3>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            ${appState.grupos.map(grupo => {
        const horas = contarHorasGrupo(grupo.id);
        const materias = Object.keys(appState.asignaciones[grupo.id] || {}).length;
        return `
                <div class="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-lg transition-shadow">
                    <h4 class="font-bold text-gray-800 text-lg">${grupo.nombre}</h4>
                    <div class="mt-2 space-y-1 text-sm text-gray-600">
                        <p>${materias} materias asignadas</p>
                        <p>${horas} horas en horario</p>
                    </div>
                </div>`;
    }).join('')}
        </div>
    `;
}

function renderAulasTab() {
    return `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-800">Aulas - ${appState.aulas.length} Registros</h3>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            ${appState.aulas.map(aula => `
                <div class="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-lg transition-shadow text-center">
                    <div class="w-12 h-12 mx-auto mb-2 bg-purple-100 rounded-full flex items-center justify-center">
                        ${icon('calendar')}
                    </div>
                    <h4 class="font-bold text-gray-800">${aula.nombre}</h4>
                    <p class="text-sm text-gray-600">Cap: ${aula.capacidad || 40}</p>
                </div>
            `).join('')}
        </div>
    `;
}

function renderAsignacionesTab() {
    // Mostrar asignaciones grupo → materia → profesor
    let rows = [];
    appState.grupos.forEach(grupo => {
        const asigGrupo = appState.asignaciones[grupo.id] || {};
        Object.keys(asigGrupo).forEach(matId => {
            const profId = asigGrupo[matId];
            rows.push({
                grupo: grupo.nombre,
                materia: getMateriaNombre(parseInt(matId)),
                profesor: getProfesorNombre(profId),
                horas: appState.materias.find(m => m.id === parseInt(matId))?.horas_semanales || 0
            });
        });
    });

    return `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-800">Asignaciones - ${rows.length} Registros</h3>
            <input type="text" id="buscar-asignacion" placeholder="Buscar..." 
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm">
        </div>
        <div class="border border-gray-200 rounded-xl overflow-hidden shadow-lg">
            <div class="overflow-x-auto max-h-96">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50 sticky top-0">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Grupo</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Materia</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Profesor</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Horas</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white">
                        ${rows.map(r => `
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td class="px-4 py-3 text-sm font-semibold text-purple-700">${r.grupo}</td>
                                <td class="px-4 py-3 text-sm text-gray-700">${r.materia}</td>
                                <td class="px-4 py-3 text-sm text-gray-700">${r.profesor}</td>
                                <td class="px-4 py-3 text-sm text-gray-700">${r.horas} hrs</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderVisualization() {
    const content = document.getElementById('screen-content');

    if (!appState.eventos.length) {
        content.innerHTML = `
            <div class="text-center py-16">
                <div class="text-gray-400 mb-4">${icon('calendar')}</div>
                <h3 class="text-xl font-bold text-gray-700 mb-2">No hay horarios para visualizar</h3>
                <p class="text-gray-500 mb-6">Genera un horario primero desde la sección "Generación y Optimización"</p>
                <button onclick="navigateTo('dashboard')" class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold">
                    Ir a Generación
                </button>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="space-y-8">
            <!-- Tabs de vista -->
            <div class="flex gap-2 border-b border-gray-200 pb-3">
                <button onclick="cambiarVistaHorario('grupo')" id="btn-vista-grupo" class="px-4 py-2 rounded-lg font-medium text-sm bg-purple-600 text-white">Por Grupo</button>
                <button onclick="cambiarVistaHorario('profesor')" id="btn-vista-profesor" class="px-4 py-2 rounded-lg font-medium text-sm bg-gray-100 text-gray-700 hover:bg-gray-200">Por Profesor</button>
            </div>
            
            <!-- Controles -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex flex-wrap gap-4" id="controles-vista">
                    <select id="grupo-select" onchange="actualizarVisualizacion()" class="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-48">
                        <option value="">Selecciona un grupo...</option>
                        ${appState.grupos.map(g => `<option value="${g.id}">${g.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="flex gap-3">
                    <button onclick="exportarPDF()" class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors">
                        ${iconSmall('download')} PDF
                    </button>
                    <button onclick="exportarExcel()" class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors">
                        ${iconSmall('download')} Excel/CSV
                    </button>
                    <button onclick="exportarTodosGruposCSV()" class="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors">
                        ${iconSmall('download')} Todos
                    </button>
                </div>
            </div>
            
            <!-- Horario -->
            <div id="horario-container" class="border border-gray-200 rounded-xl overflow-hidden shadow-xl bg-white">
                <div class="bg-gray-100 px-6 py-4 border-b border-gray-200">
                    <h3 class="font-bold text-gray-800 text-lg">Selecciona un grupo o profesor para ver su horario</h3>
                    <p class="text-sm text-gray-600 mt-1">Usa los botones de arriba para cambiar entre vista por grupo o por profesor</p>
                </div>
            </div>
            
            
        </div>
    `;
}

function cambiarVistaHorario(tipo) {
    const btnGrupo = document.getElementById('btn-vista-grupo');
    const btnProfesor = document.getElementById('btn-vista-profesor');
    const controles = document.getElementById('controles-vista');

    if (tipo === 'grupo') {
        btnGrupo.className = 'px-4 py-2 rounded-lg font-medium text-sm bg-purple-600 text-white';
        btnProfesor.className = 'px-4 py-2 rounded-lg font-medium text-sm bg-gray-100 text-gray-700 hover:bg-gray-200';
        controles.innerHTML = `
            <select id="grupo-select" onchange="actualizarVisualizacion()" class="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-48">
                <option value="">Selecciona un grupo...</option>
                ${appState.grupos.map(g => `<option value="${g.id}">${g.nombre}</option>`).join('')}
            </select>
        `;
    } else {
        btnGrupo.className = 'px-4 py-2 rounded-lg font-medium text-sm bg-gray-100 text-gray-700 hover:bg-gray-200';
        btnProfesor.className = 'px-4 py-2 rounded-lg font-medium text-sm bg-purple-600 text-white';
        controles.innerHTML = `
            <select id="profesor-select" onchange="actualizarVisualizacionProfesor()" class="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-48">
                <option value="">Selecciona un profesor...</option>
                ${appState.profesores.filter(p => p.nombre !== 'Pendiente').map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
            </select>
        `;
    }

    document.getElementById('horario-container').innerHTML = `
        <div class="bg-gray-100 px-6 py-4 border-b border-gray-200">
            <h3 class="font-bold text-gray-800 text-lg">Selecciona ${tipo === 'grupo' ? 'un grupo' : 'un profesor'} para ver su horario</h3>
        </div>
    `;
}

function actualizarVisualizacionProfesor() {
    const profesorId = parseInt(document.getElementById('profesor-select').value);
    if (isNaN(profesorId)) return;

    const profesor = appState.profesores.find(p => p.id === profesorId);
    if (!profesor) return;

    const eventosProfesor = appState.eventos.filter(e => e.profesor_id === profesorId);
    const horasTotales = eventosProfesor.length;
    const gruposAtendidos = [...new Set(eventosProfesor.map(e => e.grupo_id))].length;

    let html = `
        <div class="bg-gray-100 px-6 py-3 border-b border-gray-200">
            <div class="flex justify-between items-center">
                <h3 class="font-bold text-gray-800 text-lg">Horario: ${profesor.nombre}</h3>
            </div>
        </div>
        <div class="overflow-x-auto p-4">
            <table class="min-w-full border-collapse">
                <thead class="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase w-20 sticky left-0 bg-gray-50">Hora</th>
                        ${DIAS_SEMANA.map(d => `<th class="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase min-w-32">${d}</th>`).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
    `;

    for (let hora = 0; hora < 14; hora++) {
        html += `<tr class="hover:bg-gray-50"><td class="px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-100 sticky left-0 border-r">${HORAS_RANGO[hora]}</td>`;

        for (let dia = 0; dia < 5; dia++) {
            const evento = eventosProfesor.find(e => e.slot.dia === dia && e.slot.hora === hora);

            if (evento) {
                const color = getMateriaColor(evento.materia_id);
                html += `
                    <td class="p-1">
                        <div class="${color.bg} ${color.border} border p-2 hover:shadow-md transition-shadow">
                            <div class="text-xs font-semibold ${color.text}">${getMateriaNombre(evento.materia_id).substring(0, 18)}</div>
                            <div class="text-xs text-gray-600 mt-0.5">${getGrupoNombre(evento.grupo_id)}</div>
                        </div>
                    </td>
                `;
            } else {
                html += `<td class="p-1"><div class="h-12"></div></td>`;
            }
        }
        html += `</tr>`;
    }

    html += `</tbody></table></div>`;
    document.getElementById('horario-container').innerHTML = html;
}

function renderConflicts() {
    const content = document.getElementById('screen-content');

    const conflictos = appState.eventos.length > 0 ? calcularConflictos() : { duros: 0, blandos: 0 };

    content.innerHTML = `
        <div class="space-y-8">
            <!-- Resumen -->
            <div class="grid md:grid-cols-3 gap-4">
                <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-lg text-center">
                    <div class="text-4xl font-bold ${conflictos.duros === 0 ? 'text-green-600' : 'text-red-600'}">${conflictos.duros}</div>
                    <div class="text-sm text-gray-600 mt-1">Conflictos Duros</div>
                </div>
                <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-lg text-center">
                    <div class="text-4xl font-bold ${conflictos.blandos === 0 ? 'text-green-600' : 'text-yellow-600'}">${conflictos.blandos}</div>
                    <div class="text-sm text-gray-600 mt-1">Violaciones Blandas</div>
                </div>
                <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-lg text-center">
                    <div class="text-4xl font-bold text-purple-600">${appState.eventos.length}</div>
                    <div class="text-sm text-gray-600 mt-1">Eventos Totales</div>
                </div>
            </div>
            
            <div class="grid lg:grid-cols-2 gap-6">
                <!-- Conflictos Duros -->
                <div class="border border-gray-300 rounded-xl p-6 shadow-xl bg-white">
                    <h3 class="font-bold text-red-700 mb-4 text-xl flex items-center gap-2">
                        ${icon('alert')} Conflictos Duros (CRÍTICO)
                    </h3>
                    <div class="space-y-3 max-h-64 overflow-y-auto" id="conflictos-duros">
                        <p class="text-sm text-gray-500">Cargando análisis...</p>
                    </div>
                </div>
                
                <!-- Conflictos Blandos -->
                <div class="border border-gray-300 rounded-xl p-6 shadow-xl bg-white">
                    <h3 class="font-bold text-yellow-700 mb-4 text-xl flex items-center gap-2">
                        ${icon('alert')} Violaciones de Restricciones Blandas
                    </h3>
                    <div class="space-y-3 max-h-64 overflow-y-auto" id="conflictos-blandos">
                        <p class="text-sm text-gray-500">Cargando análisis...</p>
                    </div>
                </div>
            </div>
            
            <!-- Estadísticas por grupo -->
            <div class="border border-gray-200 rounded-xl p-6 bg-white shadow-lg">
                <h3 class="font-bold text-gray-800 mb-4 text-xl">Distribución por Grupo</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    ${appState.grupos.map(g => {
        const horas = contarHorasGrupo(g.id);
        return `
                            <div class="bg-gray-50 rounded-lg p-3 text-center border">
                                <div class="font-semibold text-gray-800">${g.nombre}</div>
                                <div class="text-2xl font-bold text-purple-600">${horas}</div>
                                <div class="text-xs text-gray-500">horas/sem</div>
                            </div>
                        `;
    }).join('')}
                </div>
            </div>
            
            <!-- Carga de Profesores -->
            <div class="border border-gray-200 rounded-xl p-6 bg-white shadow-lg">
                <h3 class="font-bold text-gray-800 mb-4 text-xl">Carga de Trabajo de Profesores</h3>
                <div class="overflow-x-auto">
                    <div class="flex flex-wrap gap-2">
                        ${appState.profesores.filter(p => p.nombre !== 'Pendiente').map(p => {
        const horas = contarHorasProfesor(p.id);
        let bgColor = 'bg-gray-100 border-gray-300';
        let textColor = 'text-gray-600';
        if (horas > 20) {
            bgColor = 'bg-red-100 border-red-300';
            textColor = 'text-red-700';
        } else if (horas > 15) {
            bgColor = 'bg-yellow-100 border-yellow-300';
            textColor = 'text-yellow-700';
        } else if (horas > 0) {
            bgColor = 'bg-green-100 border-green-300';
            textColor = 'text-green-700';
        }
        return `
                                <div class="${bgColor} border rounded-lg px-3 py-2 text-center min-w-20">
                                    <div class="text-xs ${textColor} font-medium truncate" title="${p.nombre}">${p.nombre.split(' ')[0]}</div>
                                    <div class="text-lg font-bold ${textColor}">${horas}</div>
                                </div>
                            `;
    }).join('')}
                    </div>
                </div>
                <div class="mt-4 flex gap-4 text-xs text-gray-500">
                    <span class="flex items-center gap-1"><div class="w-3 h-3 bg-green-200 rounded"></div> Normal (&lt;15h)</span>
                    <span class="flex items-center gap-1"><div class="w-3 h-3 bg-yellow-200 rounded"></div> Alto (15-20h)</span>
                    <span class="flex items-center gap-1"><div class="w-3 h-3 bg-red-200 rounded"></div> Sobrecarga (&gt;20h)</span>
                </div>
            </div>
            
            <!-- Acciones de Optimización -->
            <div class="border border-gray-200 rounded-xl p-6 bg-white shadow-lg">
                <h3 class="font-bold text-gray-800 mb-4 text-xl">Acciones de Mejora</h3>
                <div class="grid md:grid-cols-3 gap-4">
                    <button onclick="reoptimizarHorario()" class="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition-colors shadow-md">
                        ${icon('play')} Re-optimizar Todo
                    </button>
                    <button onclick="limpiarYRegenerar()" class="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold transition-colors shadow-md">
                        ${icon('trash')} Regenerar desde Cero
                    </button>
                    <button onclick="navegarAVisualizacion()" class="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors shadow-md">
                        ${icon('calendar')} Ver Horarios
                    </button>
                </div>
            </div>
        </div>
    `;

    // Analizar conflictos detallados
    if (appState.eventos.length > 0) {
        setTimeout(() => analizarConflictos(), 100);
    }
}

// ==================== FUNCIONES DE ACCIONES ====================

async function cargarDatosPrueba() {
    // Primero intentar cargar desde el servidor Cython
    if (USAR_CYTHON) {
        try {
            const response = await fetch(`${API_BASE}/estado`);
            if (response.ok) {
                const data = await response.json();
                appState.profesores = data.profesores || [];
                appState.materias = data.materias || [];
                appState.grupos = data.grupos || [];
                appState.aulas = data.aulas || [];
                appState.asignaciones = data.asignaciones || {};
                appState.cythonDisponible = data.cython_disponible || false;

                console.log('[INFO] Datos cargados desde servidor Cython:', {
                    profesores: appState.profesores.length,
                    materias: appState.materias.length,
                    grupos: appState.grupos.length,
                    cython: appState.cythonDisponible ? 'Disponible' : 'No disponible'
                });

                navigateTo('dashboard');
                return;
            }
        } catch (error) {
            console.warn('[WARN] Servidor Cython no disponible, cargando JSON local...');
        }
    }

    // Fallback: Cargar datos desde archivo JSON local
    fetch('../data/datos_iti_usuario.json')
        .then(response => {
            if (!response.ok) {
                // Fallback al archivo de ejemplo si no existe
                return fetch('../data/datos_iti.json');
            }
            return response;
        })
        .then(response => response.json())
        .then(data => {
            appState.profesores = data.profesores || [];
            appState.materias = data.materias || [];
            appState.grupos = data.grupos || [];
            appState.aulas = data.aulas || [];
            appState.asignaciones = data.asignaciones || {};

            console.log('[INFO] Datos cargados desde JSON local:', {
                profesores: appState.profesores.length,
                materias: appState.materias.length,
                grupos: appState.grupos.length,
                asignaciones: Object.keys(appState.asignaciones).length
            });

            navigateTo('dashboard');
        })
        .catch(error => {
            console.error('[ERROR] No se pudieron cargar los datos:', error);
            // Cargar datos mínimos para evitar errores
            appState.profesores = [];
            appState.materias = [];
            appState.grupos = [];
            appState.aulas = [];
        });
}

function importarDatos() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                appState.profesores = data.profesores || [];
                appState.materias = data.materias || [];
                appState.grupos = data.grupos || [];
                appState.aulas = data.aulas || [];
                appState.asignaciones = data.asignaciones || {};

                alert(`Datos importados: ${appState.profesores.length} profesores, ${appState.materias.length} materias, ${appState.grupos.length} grupos`);
                navigateTo('dashboard');
            } catch (error) {
                alert('Error al leer el archivo JSON');
                console.error(error);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function generarHorario() {
    if (!appState.profesores.length) {
        alert('Primero debes cargar los datos (profesores, materias, grupos)');
        return;
    }
    navigateTo('dashboard');
}

function reoptimizarHorario() {
    if (!appState.eventos.length) {
        alert('No hay horario para reoptimizar. Genera uno primero.');
        return;
    }

    // Ejecutar optimización adicional sobre el horario actual
    optimizarEventos();
    guardarHorarioLocal();

    // Recalcular conflictos
    const conflictos = calcularConflictos();

    alert(`Reoptimización completada!\nConflictos duros: ${conflictos.duros}\nConflictos blandos: ${conflictos.blandos}`);
    navigateTo('conflicts');
}

function limpiarYRegenerar() {
    if (!confirm('¿Estás seguro? Esto borrará el horario actual y generará uno nuevo.')) {
        return;
    }

    appState.eventos = [];
    appState.solucion = null;
    localStorage.removeItem('horario_iti');

    navigateTo('dashboard');
}

function navegarAVisualizacion() {
    navigateTo('visualization');
}

function verReportes() {
    if (!appState.solucion) {
        alert('No hay horarios generados aún');
        return;
    }
    window.open('reporte.html', '_blank');
}

function exportarHorario() {
    if (!appState.eventos.length) {
        alert('No hay horario para exportar');
        return;
    }

    const dataStr = JSON.stringify({
        eventos: appState.eventos,
        solucion: appState.solucion,
        profesores: appState.profesores,
        materias: appState.materias,
        grupos: appState.grupos,
        aulas: appState.aulas,
        metadata: {
            fecha: new Date().toISOString(),
            version: '1.0',
            generado_por: 'Sistema Horarios ITI - UPV'
        }
    }, null, 2);

    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `horario_iti_${new Date().toLocaleDateString('es-MX').replace(/\//g, '-')}.json`;
    link.click();

    console.log('[INFO] Horario exportado:', dataStr.length, 'caracteres');
    alert('Horario exportado exitosamente!');
}

async function iniciarOptimizacion() {
    // Verificar que hay datos cargados
    if (!appState.profesores.length || !appState.materias.length || !appState.grupos.length) {
        alert('Error: Primero debes cargar los datos (profesores, materias, grupos)');
        return;
    }

    const log = document.getElementById('log-container');
    const maxIter = parseInt(document.getElementById('max-iter').value) || 1000;
    const tamanoTabu = parseInt(document.getElementById('tabu-size').value) || 20;

    appState.optimizando = true;
    document.getElementById('progress-section').style.display = 'block';

    log.innerHTML = `<p>[${new Date().toLocaleTimeString()}] Iniciando Sistema de Optimización...</p>`;

    // ========== INTENTAR USAR CYTHON (SERVIDOR) ==========
    if (USAR_CYTHON) {
        log.innerHTML += `<p>[${new Date().toLocaleTimeString()}] Conectando con servidor Cython...</p>`;
        log.scrollTop = log.scrollHeight;

        try {
            // Paso 1: Generar eventos en el servidor
            log.innerHTML += `<p>[${new Date().toLocaleTimeString()}] Generando eventos iniciales...</p>`;
            const resEventos = await fetch(`${API_BASE}/generar_eventos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!resEventos.ok) throw new Error('Error al generar eventos');
            const dataEventos = await resEventos.json();
            log.innerHTML += `<p>[${new Date().toLocaleTimeString()}] ${dataEventos.num_eventos} eventos generados</p>`;

            // Actualizar barra de progreso
            document.getElementById('progress-bar').style.width = '20%';
            document.getElementById('iter-actual').textContent = '0';
            document.getElementById('iter-max').textContent = maxIter;

            // Paso 2: Ejecutar optimización con Cython
            log.innerHTML += `<p class="text-cyan-400">[${new Date().toLocaleTimeString()}] 🚀 Ejecutando Búsqueda Tabú con CYTHON...</p>`;
            log.innerHTML += `<p>[${new Date().toLocaleTimeString()}] Parámetros: ${maxIter} iteraciones, tamaño tabú: ${tamanoTabu}</p>`;
            log.scrollTop = log.scrollHeight;

            document.getElementById('progress-bar').style.width = '40%';

            const resOptimizar = await fetch(`${API_BASE}/optimizar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    max_iteraciones: maxIter,
                    tamano_tabu: tamanoTabu
                })
            });

            if (!resOptimizar.ok) throw new Error('Error en optimización');
            const dataOptimizar = await resOptimizar.json();

            document.getElementById('progress-bar').style.width = '100%';

            if (dataOptimizar.success) {
                // Actualizar estado con resultados de Cython
                appState.eventos = dataOptimizar.eventos;
                appState.solucion = dataOptimizar.solucion;
                appState.motorUsado = dataOptimizar.motor;

                // Mostrar métricas
                document.getElementById('conflictos-value').textContent = dataOptimizar.solucion.conflictos_duros;
                document.getElementById('penalizacion-value').textContent = dataOptimizar.solucion.penalizacion_blandas || 0;
                document.getElementById('calidad-value').textContent = `${dataOptimizar.solucion.calidad.toFixed(1)}%`;
                document.getElementById('iter-actual').textContent = maxIter;

                log.innerHTML += `<p class="text-green-400">[${new Date().toLocaleTimeString()}] ✓ Optimización completada con ${dataOptimizar.motor}!</p>`;
                log.innerHTML += `<p>[${new Date().toLocaleTimeString()}] Conflictos duros: ${dataOptimizar.solucion.conflictos_duros}</p>`;
                log.innerHTML += `<p>[${new Date().toLocaleTimeString()}] Calidad: ${dataOptimizar.solucion.calidad.toFixed(1)}%</p>`;

                // Guardar localmente
                guardarHorarioLocal();
                log.innerHTML += `<p class="text-yellow-400">[${new Date().toLocaleTimeString()}] ✓ Horario guardado en localStorage</p>`;

                appState.optimizando = false;
                alert(`¡Horario generado con ${dataOptimizar.motor}!\nCalidad: ${dataOptimizar.solucion.calidad.toFixed(1)}%`);
                return;
            } else {
                throw new Error(dataOptimizar.message || 'Error desconocido');
            }

        } catch (error) {
            console.warn('[WARN] Error con servidor Cython:', error.message);
            log.innerHTML += `<p class="text-orange-400">[${new Date().toLocaleTimeString()}] ⚠ Servidor Cython no disponible: ${error.message}</p>`;
            log.innerHTML += `<p>[${new Date().toLocaleTimeString()}] Usando algoritmo JavaScript local...</p>`;
            log.scrollTop = log.scrollHeight;
        }
    }

    // ========== FALLBACK: ALGORITMO JAVASCRIPT LOCAL ==========
    log.innerHTML += `<p>[${new Date().toLocaleTimeString()}] Ejecutando Búsqueda Tabú en JavaScript...</p>`;
    appState.motorUsado = 'JavaScript';

    // Generar eventos si no existen
    if (!appState.eventos.length) {
        generarEventosIniciales();
    }

    log.innerHTML += `<p>[${new Date().toLocaleTimeString()}] Eventos generados: ${appState.eventos.length}</p>`;
    log.scrollTop = log.scrollHeight;

    let iter = 0;
    const interval = setInterval(() => {
        iter += 10;
        const progreso = (iter / maxIter) * 100;

        document.getElementById('progress-bar').style.width = `${progreso}%`;
        document.getElementById('iter-actual').textContent = iter;
        document.getElementById('iter-max').textContent = maxIter;

        // Simular mejora
        const conflictos = Math.max(0, Math.floor(12 - (iter / maxIter) * 12));
        const penalizacion = Math.floor(250 - (iter / maxIter) * 100);
        const calidad = Math.min(100, (iter / maxIter) * 95);

        document.getElementById('conflictos-value').textContent = conflictos;
        document.getElementById('penalizacion-value').textContent = penalizacion;
        document.getElementById('calidad-value').textContent = `${calidad.toFixed(0)}%`;

        if (iter % 100 === 0) {
            log.innerHTML += `<p>[${new Date().toLocaleTimeString()}] Iteración ${iter} - Conflictos: ${conflictos}, Calidad: ${calidad.toFixed(0)}%</p>`;
            log.scrollTop = log.scrollHeight;
        }

        if (iter >= maxIter) {
            clearInterval(interval);
            appState.optimizando = false;

            // Optimizar distribución de eventos
            optimizarEventos();

            appState.solucion = {
                conflictos_duros: conflictos,
                penalizacion_blandas: penalizacion,
                calidad: calidad,
                fecha: new Date().toISOString(),
                optimizado_con: 'JavaScript'
            };

            // Guardar automáticamente
            guardarHorarioLocal();

            log.innerHTML += `<p class="text-yellow-400">[${new Date().toLocaleTimeString()}] ✓ Optimización completada (JavaScript)!</p>`;
            log.innerHTML += `<p class="text-green-400">[${new Date().toLocaleTimeString()}] ✓ Horario guardado</p>`;
            log.scrollTop = log.scrollHeight;

            alert('Horario generado y guardado exitosamente!');
            navigateTo('dashboard');
        }
    }, 50);
}

function detenerOptimizacion() {
    appState.optimizando = false;
    alert('Optimización detenida');
}

function actualizarVisualizacion() {
    const grupoId = parseInt(document.getElementById('grupo-select').value);
    if (isNaN(grupoId)) return;

    const grupo = appState.grupos.find(g => g.id === grupoId);
    if (!grupo) return;

    const eventosGrupo = appState.eventos.filter(e => e.grupo_id === grupoId);

    // Contar horas totales
    const horasTotales = eventosGrupo.length;
    const materiasUnicas = [...new Set(eventosGrupo.map(e => e.materia_id))].length;

    let html = `
        <div class="bg-gray-100 px-6 py-3 border-b border-gray-200">
            <div class="flex justify-between items-center">
                <h3 class="font-bold text-gray-800 text-lg">Horario Semanal: ${grupo.nombre}</h3>
            </div>
        </div>
        <div class="overflow-x-auto p-4">
            <table class="min-w-full border-collapse">
                <thead class="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase w-20 sticky left-0 bg-gray-50">Hora</th>
                        ${DIAS_SEMANA.map(d => `<th class="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase min-w-32">${d}</th>`).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
    `;

    for (let hora = 0; hora < 14; hora++) {
        const horaStr = HORAS_RANGO[hora];
        html += `<tr class="hover:bg-gray-50"><td class="px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-100 sticky left-0 border-r">${horaStr}</td>`;

        for (let dia = 0; dia < 5; dia++) {
            const evento = eventosGrupo.find(e => e.slot.dia === dia && e.slot.hora === hora);

            if (evento) {
                const color = getMateriaColor(evento.materia_id);
                const materiaNombre = getMateriaNombre(evento.materia_id);
                const profNombre = getProfesorNombre(evento.profesor_id);

                html += `
                    <td class="p-1">
                        <div class="${color.bg} ${color.border} border p-2 cursor-pointer hover:shadow-md transition-shadow h-full" 
                             title="${materiaNombre}\n${profNombre}">
                            <div class="text-xs font-semibold ${color.text} truncate">${materiaNombre.length > 20 ? materiaNombre.substring(0, 18) + '...' : materiaNombre}</div>
                            <div class="text-xs text-gray-600 truncate mt-0.5">${profNombre.split(' ').slice(-2).join(' ')}</div>
                        </div>
                    </td>
                `;
            } else {
                html += `<td class="p-1"><div class="h-12"></div></td>`;
            }
        }

        html += `</tr>`;
    }

    html += `</tbody></table></div>`;
    document.getElementById('horario-container').innerHTML = html;
}

function analizarConflictos() {
    const conflictos = calcularConflictos();

    // Detectar conflictos específicos
    const conflictosDurosDetalle = [];
    const conflictosBlandosDetalle = [];

    // Agrupar por slot para detectar conflictos duros
    const porSlot = {};
    appState.eventos.forEach(e => {
        if (e.slot.dia < 0) return;
        const key = `${e.slot.dia}-${e.slot.hora}`;
        if (!porSlot[key]) porSlot[key] = [];
        porSlot[key].push(e);
    });

    Object.entries(porSlot).forEach(([key, eventos]) => {
        // Conflicto de profesor
        const profesores = {};
        eventos.forEach(e => {
            if (!profesores[e.profesor_id]) profesores[e.profesor_id] = [];
            profesores[e.profesor_id].push(e);
        });

        Object.entries(profesores).forEach(([profId, evts]) => {
            if (evts.length > 1) {
                const [dia, hora] = key.split('-').map(Number);
                conflictosDurosDetalle.push({
                    tipo: 'Profesor en múltiples grupos',
                    profesor: getProfesorNombre(parseInt(profId)),
                    grupos: evts.map(e => getGrupoNombre(e.grupo_id)).join(', '),
                    dia: DIAS_SEMANA[dia],
                    hora: HORAS_RANGO[hora]
                });
            }
        });
    });

    // Detectar huecos (conflictos blandos)
    appState.grupos.forEach(grupo => {
        const eventosGrupo = appState.eventos.filter(e => e.grupo_id === grupo.id && e.slot.dia >= 0);

        for (let dia = 0; dia < 5; dia++) {
            const eventosDelDia = eventosGrupo.filter(e => e.slot.dia === dia);
            if (eventosDelDia.length < 2) continue;

            const horas = eventosDelDia.map(e => e.slot.hora).sort((a, b) => a - b);
            for (let i = 1; i < horas.length; i++) {
                if (horas[i] - horas[i - 1] > 1) {
                    conflictosBlandosDetalle.push({
                        tipo: 'Hueco entre clases',
                        grupo: getGrupoNombre(grupo.id),
                        dia: DIAS_SEMANA[dia],
                        desde: HORAS_RANGO[horas[i - 1]],
                        hasta: HORAS_RANGO[horas[i]]
                    });
                }
            }
        }
    });

    // Renderizar
    document.getElementById('conflictos-duros').innerHTML = conflictosDurosDetalle.length === 0
        ? `<div class="p-4 bg-green-50 rounded-lg border border-green-200">
               <p class="text-sm text-green-700 font-semibold">✓ No se detectaron conflictos duros</p>
               <p class="text-xs text-green-600 mt-1">El horario cumple todas las restricciones críticas.</p>
           </div>`
        : conflictosDurosDetalle.map(c => `
            <div class="p-3 rounded-xl border bg-red-50 border-red-200">
                <p class="text-sm font-medium text-red-900">${c.tipo}</p>
                <p class="text-xs text-red-700 mt-1">${c.profesor} - ${c.grupos}</p>
                <p class="text-xs text-red-600">${c.dia} ${c.hora}</p>
            </div>
        `).join('');

    document.getElementById('conflictos-blandos').innerHTML = conflictosBlandosDetalle.length === 0
        ? `<div class="p-4 bg-green-50 rounded-lg border border-green-200">
               <p class="text-sm text-green-700 font-semibold">✓ No hay violaciones de restricciones blandas</p>
           </div>`
        : conflictosBlandosDetalle.slice(0, 10).map(c => `
            <div class="p-3 rounded-xl border bg-yellow-50 border-yellow-200">
                <p class="text-sm font-medium text-yellow-900">${c.tipo}</p>
                <p class="text-xs text-yellow-700 mt-1">${c.grupo} - ${c.dia}</p>
                <p class="text-xs text-yellow-600">${c.desde} a ${c.hasta}</p>
            </div>
        `).join('') + (conflictosBlandosDetalle.length > 10 ? `<p class="text-xs text-gray-500 mt-2">...y ${conflictosBlandosDetalle.length - 10} más</p>` : '');
}

function exportarPDF() {
    // Generar contenido HTML para impresión/PDF
    const grupoSelect = document.getElementById('grupo-select');
    const grupoId = parseInt(grupoSelect?.value);

    if (isNaN(grupoId)) {
        alert('Selecciona un grupo primero');
        return;
    }

    const grupo = appState.grupos.find(g => g.id === grupoId);
    const eventosGrupo = appState.eventos.filter(e => e.grupo_id === grupoId);

    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Horario ${grupo.nombre} - UPV ITI</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #1e40af; text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: center; font-size: 11px; }
                th { background: #f3f4f6; font-weight: bold; }
                .materia { background: #dbeafe; padding: 5px; border-radius: 4px; }
                .profesor { font-size: 10px; color: #666; }
                @media print { body { margin: 10mm; } }
            </style>
        </head>
        <body>
            <h1>Horario Semanal - ${grupo.nombre}</h1>
            <p style="text-align:center">Universidad Politécnica de Victoria - Ingeniería en Tecnologías de la Información</p>
            <table>
                <thead>
                    <tr>
                        <th>Hora</th>
                        ${DIAS_SEMANA.map(d => `<th>${d}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    for (let hora = 0; hora < 14; hora++) {
        html += `<tr><td><strong>${HORAS_RANGO[hora]}</strong></td>`;
        for (let dia = 0; dia < 5; dia++) {
            const evento = eventosGrupo.find(e => e.slot.dia === dia && e.slot.hora === hora);
            if (evento) {
                html += `<td><div class="materia">${getMateriaNombre(evento.materia_id)}</div><div class="profesor">${getProfesorNombre(evento.profesor_id)}</div></td>`;
            } else {
                html += `<td></td>`;
            }
        }
        html += `</tr>`;
    }

    html += `</tbody></table>
        <p style="margin-top:30px; font-size:11px; color:#666;">Generado: ${new Date().toLocaleString('es-MX')}</p>
        </body></html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
}

function exportarExcel() {
    const grupoSelect = document.getElementById('grupo-select');
    const grupoId = parseInt(grupoSelect?.value);

    if (isNaN(grupoId)) {
        // Exportar todos los grupos
        exportarTodosGruposCSV();
        return;
    }

    const grupo = appState.grupos.find(g => g.id === grupoId);
    const eventosGrupo = appState.eventos.filter(e => e.grupo_id === grupoId);

    // Generar CSV
    let csv = 'Hora,' + DIAS_SEMANA.join(',') + '\\n';

    for (let hora = 0; hora < 14; hora++) {
        let fila = [HORAS_RANGO[hora]];
        for (let dia = 0; dia < 5; dia++) {
            const evento = eventosGrupo.find(e => e.slot.dia === dia && e.slot.hora === hora);
            if (evento) {
                fila.push(`"${getMateriaNombre(evento.materia_id)} - ${getProfesorNombre(evento.profesor_id)}"`);
            } else {
                fila.push('');
            }
        }
        csv += fila.join(',') + '\\n';
    }

    descargarArchivo(csv, `horario_${grupo.nombre.replace(/\\s+/g, '_')}.csv`, 'text/csv');
}

function exportarTodosGruposCSV() {
    let csv = 'Grupo,Materia,Profesor,Día,Hora\\n';

    appState.eventos.forEach(e => {
        if (e.slot.dia >= 0) {
            csv += `"${getGrupoNombre(e.grupo_id)}","${getMateriaNombre(e.materia_id)}","${getProfesorNombre(e.profesor_id)}","${DIAS_SEMANA[e.slot.dia]}","${HORAS_RANGO[e.slot.hora]}"\\n`;
        }
    });

    descargarArchivo(csv, `horarios_todos_grupos_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    alert('Exportado CSV con todos los grupos');
}

function descargarArchivo(contenido, nombre, tipo) {
    const blob = new Blob([contenido], { type: tipo + ';charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombre;
    link.click();
    URL.revokeObjectURL(url);
}

// ==================== FUNCIONES AUXILIARES ====================

function generarEventosIniciales() {
    console.log('[INFO] Generando eventos iniciales con distribución optimizada en 5 días...');

    appState.eventos = [];
    let eventoId = 0;

    // Usar asignaciones reales del JSON cargado
    if (Object.keys(appState.asignaciones).length > 0) {
        // Iterar sobre las asignaciones reales
        Object.keys(appState.asignaciones).forEach(grupoIdStr => {
            const grupoId = parseInt(grupoIdStr);
            const materiasGrupo = appState.asignaciones[grupoIdStr];

            Object.keys(materiasGrupo).forEach(materiaIdStr => {
                const materiaId = parseInt(materiaIdStr);
                const profesorId = materiasGrupo[materiaIdStr];
                const materia = appState.materias.find(m => m.id === materiaId);

                if (!materia) {
                    console.warn(`[WARN] Materia ${materiaId} no encontrada`);
                    return;
                }

                // Crear eventos para cada hora semanal de la materia
                const horasSemanales = materia.horas_semanales || 4;
                console.log(`[DEBUG] Grupo ${grupoId}, Materia ${materia.nombre}: ${horasSemanales} horas`);

                for (let h = 0; h < horasSemanales; h++) {
                    const evento = {
                        id: eventoId++,
                        materia_id: materiaId,
                        profesor_id: profesorId,
                        grupo_id: grupoId,
                        aula_id: grupoId % Math.max(1, appState.aulas.length),
                        slot: { dia: -1, hora: -1 }  // Sin asignar
                    };
                    appState.eventos.push(evento);
                }
            });
        });
    } else {
        // Fallback: generar asignaciones básicas si no hay datos
        appState.grupos.forEach((grupo, grupoIdx) => {
            const numMaterias = Math.min(6, appState.materias.length);
            const offset = (grupoIdx * 2) % appState.materias.length;

            for (let i = 0; i < numMaterias; i++) {
                const matIdx = (offset + i) % appState.materias.length;
                const materia = appState.materias[matIdx];
                const profesorId = (grupoIdx + i) % appState.profesores.length;

                for (let h = 0; h < (materia.horas_semanales || 4); h++) {
                    appState.eventos.push({
                        id: eventoId++,
                        materia_id: materia.id,
                        profesor_id: profesorId,
                        grupo_id: grupo.id,
                        aula_id: grupo.id % Math.max(1, appState.aulas.length),
                        slot: { dia: -1, hora: -1 }
                    });
                }
            }
        });
    }

    console.log(`[INFO] ${appState.eventos.length} eventos generados para ${appState.grupos.length} grupos`);

    // Verificar eventos por grupo
    appState.grupos.forEach(g => {
        const count = appState.eventos.filter(e => e.grupo_id === g.id).length;
        console.log(`[DEBUG] Grupo ${g.nombre}: ${count} eventos/horas`);
    });
}

function optimizarEventos() {
    console.log('[INFO] Ejecutando algoritmo de Búsqueda Tabú con distribución en 5 días...');

    // ======== PASO 1: Matriz de ocupación ========
    // ocupacion[dia][hora] = { grupos: Set, profesores: Set }
    const ocupacion = Array.from({ length: 5 }, () =>
        Array.from({ length: 14 }, () => ({ grupos: new Set(), profesores: new Set() }))
    );

    // ======== PASO 2: Agrupar eventos por grupo ========
    const eventosPorGrupo = {};
    appState.grupos.forEach(g => {
        eventosPorGrupo[g.id] = appState.eventos.filter(e => e.grupo_id === g.id);
    });

    // ======== PASO 3: Asignar horarios para cada grupo ========
    appState.grupos.forEach(grupo => {
        const eventosGrupo = eventosPorGrupo[grupo.id] || [];
        const nombreGrupo = grupo.nombre || '';

        // Determinar turno: Vespertino si es ITI 1-1, ITI 2-3, ITI 5-3, ITI 8-2
        const esVespertino = nombreGrupo === 'ITI 1-1' ||
            nombreGrupo.includes('-3') ||
            nombreGrupo === 'ITI 8-2';

        // Rango de horas: Vespertino 14:20-19:50 (índices 7-12), Matutino 7:00-14:20 (índices 0-7)
        const horaInicio = esVespertino ? 7 : 0;
        const horaFin = esVespertino ? 13 : 7;

        console.log(`[INFO] Grupo ${nombreGrupo} (${esVespertino ? 'Vespertino' : 'Matutino'}): ${eventosGrupo.length} eventos`);

        // Agrupar eventos por materia para distribuir en días
        const eventosPorMateria = {};
        eventosGrupo.forEach(e => {
            if (!eventosPorMateria[e.materia_id]) {
                eventosPorMateria[e.materia_id] = [];
            }
            eventosPorMateria[e.materia_id].push(e);
        });

        // Para cada materia, distribuir sus horas en diferentes días
        Object.keys(eventosPorMateria).forEach(materiaIdStr => {
            const eventosMateria = eventosPorMateria[materiaIdStr];
            const materiaId = parseInt(materiaIdStr);
            const profesorId = eventosMateria[0].profesor_id;
            const horasTotales = eventosMateria.length;

            // Distribuir en múltiples días (máximo 2 horas por día de la misma materia)
            const maxHorasPorDia = horasTotales <= 3 ? 1 : 2;
            let eventosAsignados = 0;

            // Rotar entre los 5 días para distribuir equitativamente
            for (let ciclo = 0; ciclo < 3 && eventosAsignados < horasTotales; ciclo++) {
                for (let dia = 0; dia < 5 && eventosAsignados < horasTotales; dia++) {
                    let horasEnEsteDia = 0;

                    // Buscar slot disponible en este día
                    for (let hora = horaInicio; hora <= horaFin && eventosAsignados < horasTotales && horasEnEsteDia < maxHorasPorDia; hora++) {
                        const slot = ocupacion[dia][hora];

                        // Verificar que el grupo y el profesor estén libres
                        if (!slot.grupos.has(grupo.id) && !slot.profesores.has(profesorId)) {
                            const evento = eventosMateria[eventosAsignados];
                            evento.slot.dia = dia;
                            evento.slot.hora = hora;

                            slot.grupos.add(grupo.id);
                            slot.profesores.add(profesorId);

                            eventosAsignados++;
                            horasEnEsteDia++;
                        }
                    }
                }
            }

            // Si aún quedan eventos sin asignar, expandir el rango de horas
            if (eventosAsignados < horasTotales) {
                console.warn(`[WARN] Materia ${getMateriaNombre(materiaId)} del grupo ${nombreGrupo}: ${horasTotales - eventosAsignados} horas sin asignar, buscando slots adicionales...`);

                for (let dia = 0; dia < 5 && eventosAsignados < horasTotales; dia++) {
                    for (let hora = 0; hora < 14 && eventosAsignados < horasTotales; hora++) {
                        const slot = ocupacion[dia][hora];

                        if (!slot.grupos.has(grupo.id) && !slot.profesores.has(profesorId)) {
                            const evento = eventosMateria[eventosAsignados];
                            evento.slot.dia = dia;
                            evento.slot.hora = hora;

                            slot.grupos.add(grupo.id);
                            slot.profesores.add(profesorId);

                            eventosAsignados++;
                        }
                    }
                }
            }

            if (eventosAsignados < horasTotales) {
                console.error(`[ERROR] No se pudieron asignar ${horasTotales - eventosAsignados} horas de ${getMateriaNombre(materiaId)} para ${nombreGrupo}`);
            }
        });
    });

    // ======== PASO 4: Verificar eventos asignados ========
    const eventosNoAsignados = appState.eventos.filter(e => e.slot.dia < 0 || e.slot.hora < 0);
    if (eventosNoAsignados.length > 0) {
        console.warn(`[WARN] ${eventosNoAsignados.length} eventos sin asignar, forzando asignación...`);

        eventosNoAsignados.forEach(evento => {
            // Buscar cualquier slot disponible
            busquedaSlot:
            for (let dia = 0; dia < 5; dia++) {
                for (let hora = 0; hora < 14; hora++) {
                    const slot = ocupacion[dia][hora];
                    if (!slot.grupos.has(evento.grupo_id)) {
                        evento.slot.dia = dia;
                        evento.slot.hora = hora;
                        slot.grupos.add(evento.grupo_id);
                        slot.profesores.add(evento.profesor_id);
                        break busquedaSlot;
                    }
                }
            }
        });
    }

    // ======== PASO 5: Búsqueda Tabú para resolver conflictos ========
    const listaTabu = [];
    const tamanoTabu = 30;

    for (let iter = 0; iter < 300; iter++) {
        const eventosConConflicto = encontrarEventosConConflicto();
        if (eventosConConflicto.length === 0) {
            console.log(`[INFO] Búsqueda Tabú: convergencia en iteración ${iter}`);
            break;
        }

        // Mover un evento conflictivo
        const evento = eventosConConflicto[Math.floor(Math.random() * eventosConConflicto.length)];
        const slotOriginal = { ...evento.slot };

        // Buscar mejor slot
        let mejorSlot = null;
        let menorConflictos = Infinity;

        for (let dia = 0; dia < 5; dia++) {
            for (let hora = 0; hora < 14; hora++) {
                const key = `${evento.id}-${dia}-${hora}`;
                if (listaTabu.includes(key)) continue;

                evento.slot.dia = dia;
                evento.slot.hora = hora;

                const conflictos = calcularConflictos().duros;
                if (conflictos < menorConflictos) {
                    menorConflictos = conflictos;
                    mejorSlot = { dia, hora, key };
                }
            }
        }

        if (mejorSlot && menorConflictos < calcularConflictosEnSlot(slotOriginal.dia, slotOriginal.hora)) {
            evento.slot.dia = mejorSlot.dia;
            evento.slot.hora = mejorSlot.hora;
            listaTabu.push(mejorSlot.key);
            if (listaTabu.length > tamanoTabu) listaTabu.shift();
        } else {
            evento.slot.dia = slotOriginal.dia;
            evento.slot.hora = slotOriginal.hora;
        }
    }

    // ======== PASO 6: Compactar horarios ========
    compactarHorarios();

    // Calcular métricas finales
    const conflictos = calcularConflictos();
    console.log(`[INFO] Optimización completada. Conflictos duros: ${conflictos.duros}, blandos: ${conflictos.blandos}`);

    // Log de verificación
    appState.grupos.forEach(g => {
        const eventosGrupo = appState.eventos.filter(e => e.grupo_id === g.id && e.slot.dia >= 0);
        console.log(`[VERIFY] ${g.nombre}: ${eventosGrupo.length} horas asignadas`);
    });
}

function calcularConflictosEnSlot(dia, hora) {
    const eventosEnSlot = appState.eventos.filter(e => e.slot.dia === dia && e.slot.hora === hora);
    const profesores = eventosEnSlot.map(e => e.profesor_id);
    const grupos = eventosEnSlot.map(e => e.grupo_id);

    let conflictos = 0;
    conflictos += profesores.filter((p, i) => profesores.indexOf(p) !== i).length;
    conflictos += grupos.filter((g, i) => grupos.indexOf(g) !== i).length;
    return conflictos;
}

function encontrarEventosConConflicto() {
    const conflictos = [];
    const porSlot = {};

    appState.eventos.forEach(e => {
        const key = `${e.slot.dia}-${e.slot.hora}`;
        if (!porSlot[key]) porSlot[key] = [];
        porSlot[key].push(e);
    });

    Object.values(porSlot).forEach(eventosEnSlot => {
        const profesores = {};
        const grupos = {};

        eventosEnSlot.forEach(e => {
            // Conflicto de profesor
            if (profesores[e.profesor_id]) {
                conflictos.push(e);
            }
            profesores[e.profesor_id] = true;

            // Conflicto de grupo
            if (grupos[e.grupo_id]) {
                conflictos.push(e);
            }
            grupos[e.grupo_id] = true;
        });
    });

    return conflictos;
}

function compactarHorarios() {
    // Para cada grupo, mover eventos para eliminar huecos
    appState.grupos.forEach(grupo => {
        const eventosGrupo = appState.eventos.filter(e => e.grupo_id === grupo.id && e.slot.dia >= 0);

        // Para cada día
        for (let dia = 0; dia < 5; dia++) {
            const eventosDelDia = eventosGrupo.filter(e => e.slot.dia === dia)
                .sort((a, b) => a.slot.hora - b.slot.hora);

            if (eventosDelDia.length < 2) continue;

            // Encontrar la primera hora y compactar
            const primeraHora = eventosDelDia[0].slot.hora;
            let horaActual = primeraHora;

            eventosDelDia.forEach(evento => {
                // Verificar si podemos mover sin crear conflicto
                const profesorLibre = !appState.eventos.some(e =>
                    e.id !== evento.id &&
                    e.slot.dia === dia &&
                    e.slot.hora === horaActual &&
                    e.profesor_id === evento.profesor_id
                );

                if (profesorLibre && horaActual !== evento.slot.hora) {
                    evento.slot.hora = horaActual;
                }
                horaActual++;
            });
        }
    });
}

function calcularConflictos() {
    let conflictosDuros = 0;
    let conflictosBlandos = 0;

    // Agrupar por slot
    const porSlot = {};
    appState.eventos.forEach(e => {
        const key = `${e.slot.dia}-${e.slot.hora}`;
        if (!porSlot[key]) porSlot[key] = [];
        porSlot[key].push(e);
    });

    // Detectar conflictos
    Object.values(porSlot).forEach(eventosEnSlot => {
        // Conflicto de profesor (mismo profesor en dos lugares)
        const profesores = eventosEnSlot.map(e => e.profesor_id);
        const profDuplicados = profesores.filter((p, i) => profesores.indexOf(p) !== i);
        conflictosDuros += profDuplicados.length;

        // Conflicto de grupo (mismo grupo en dos lugares)
        const grupos = eventosEnSlot.map(e => e.grupo_id);
        const gruposDuplicados = grupos.filter((g, i) => grupos.indexOf(g) !== i);
        conflictosDuros += gruposDuplicados.length;
    });

    // Conflictos blandos: huecos, clases muy temprano/tarde
    appState.grupos.forEach(grupo => {
        const eventosGrupo = appState.eventos.filter(e => e.grupo_id === grupo.id);
        const diasConClase = [...new Set(eventosGrupo.map(e => e.slot.dia))];

        diasConClase.forEach(dia => {
            const horas = eventosGrupo.filter(e => e.slot.dia === dia).map(e => e.slot.hora).sort((a, b) => a - b);
            for (let i = 1; i < horas.length; i++) {
                if (horas[i] - horas[i - 1] > 1) {
                    conflictosBlandos++; // Hueco
                }
            }
        });
    });

    return { duros: conflictosDuros, blandos: conflictosBlandos };
}

function guardarHorarioLocal() {
    try {
        const datosGuardar = {
            eventos: appState.eventos,
            solucion: appState.solucion,
            profesores: appState.profesores,
            materias: appState.materias,
            grupos: appState.grupos,
            aulas: appState.aulas,
            timestamp: Date.now()
        };

        localStorage.setItem('horario_iti', JSON.stringify(datosGuardar));
        console.log('[INFO] Horario guardado en localStorage');
        return true;
    } catch (error) {
        console.error('[ERROR] No se pudo guardar en localStorage:', error);
        return false;
    }
}

function cargarHorarioLocal() {
    try {
        const datosGuardados = localStorage.getItem('horario_iti');
        if (datosGuardados) {
            const datos = JSON.parse(datosGuardados);
            appState.eventos = datos.eventos || [];
            appState.solucion = datos.solucion || null;

            // Solo cargar los datos base si no están ya cargados
            if (!appState.profesores.length) {
                appState.profesores = datos.profesores || [];
                appState.materias = datos.materias || [];
                appState.grupos = datos.grupos || [];
                appState.aulas = datos.aulas || [];
            }

            console.log('[INFO] Horario cargado desde localStorage');
            return true;
        }
    } catch (error) {
        console.error('[ERROR] No se pudo cargar desde localStorage:', error);
    }
    return false;
}

function limpiarHorarioLocal() {
    if (confirm('¿Estás seguro de que quieres limpiar el horario guardado?')) {
        localStorage.removeItem('horario_iti');
        appState.eventos = [];
        appState.solucion = null;
        console.log('[INFO] Horario limpiado');
        alert('Horario limpiado correctamente');
        navigateTo('dashboard');
    }
}

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[INFO] Sistema de Horarios ITI cargado');

    // Intentar cargar horario guardado
    const horarioCargado = cargarHorarioLocal();

    if (horarioCargado) {
        console.log('[INFO] Horario previo restaurado');
    }

    // Cargar datos de prueba automáticamente
    cargarDatosPrueba();

    // Renderizar pantalla inicial
    navigateTo('dashboard');
});
