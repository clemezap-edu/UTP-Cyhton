# Interfaz Web - Sistema de Horarios ITI

## 🌐 Características

- **Interfaz 100% cliente** (HTML + JavaScript + Tailwind CSS)
- **Almacenamiento local** (localStorage del navegador)
- **Sin necesidad de servidor** (funciona offline)
- **Responsive design** (adaptable a móviles)

## 📋 Funcionalidades Implementadas

### 1. Gestión de Datos
- Importar datos desde JSON
- Visualizar profesores, materias, grupos y aulas
- Editar información básica

### 2. Generación de Horarios
- Generación automática de eventos
- Simulación de algoritmo de optimización
- Configuración de parámetros (iteraciones, lista tabú)
- Log en tiempo real del proceso

### 3. Visualización
- Horarios por grupo en formato de tabla semanal
- Código de colores por materia
- Información de profesor y aula

### 4. Análisis de Conflictos
- Detección de conflictos duros
- Visualización de violaciones de restricciones blandas

### 5. Exportación
- Exportar horario completo a JSON
- Guardado automático en navegador
- Descarga de archivos

## 🚀 Uso

### Opción 1: Abrir directamente
```bash
# Linux
xdg-open index.html

# Mac
open index.html

# Windows
start index.html
```

### Opción 2: Servidor local
```bash
# Python 3
python3 -m http.server 8000

# Luego abrir: http://localhost:8000
```

## 💾 Almacenamiento de Datos

Los horarios se guardan automáticamente en `localStorage` con la clave `horario_iti`.

### Estructura de datos guardados:
```javascript
{
  eventos: [...],
  solucion: {
    conflictos_duros: 0,
    penalizacion_blandas: 147,
    calidad: 92.5,
    fecha: "2025-12-04T..."
  },
  profesores: [...],
  materias: [...],
  grupos: [...],
  aulas: [...],
  timestamp: 1733356800000
}
```

### Limpiar datos guardados:
```javascript
// En la consola del navegador:
localStorage.removeItem('horario_iti');
```

O usar el botón "Limpiar Horario" en el dashboard.

## 📱 Flujo de Trabajo

1. **Cargar Datos**
   - La aplicación carga automáticamente `../data/datos_iti.json`
   - También puedes importar tu propio archivo JSON

2. **Generar Horario**
   - Ve a "Generación y Optimización"
   - Configura parámetros (opcional)
   - Haz clic en "Iniciar Generación"
   - Espera a que termine (visualización en tiempo real)

3. **Visualizar**
   - Ve a "Visualización de Horarios"
   - Selecciona un grupo
   - Explora el horario generado

4. **Exportar**
   - Usa "Exportar Horario" desde el dashboard
   - O descarga desde el botón en visualización

## 🎨 Personalización

### Colores de materias
En `data/datos_iti.json`:
```json
{
  "id": 0,
  "nombre": "Estructura de Datos",
  "color": "blue"  // blue, green, purple, orange
}
```

### Slots horarios
Configurados en `app.js`:
```javascript
const HORAS_INICIO = ['7:00', '7:55', '8:50', ...];
const DIAS_SEMANA = ['Lunes', 'Martes', ...];
```

## 🔧 Funciones JavaScript Principales

### Generación de eventos
```javascript
generarEventosIniciales()
// Crea eventos basados en profesores, materias y grupos
```

### Optimización
```javascript
optimizarEventos()
// Distribuye eventos uniformemente en la semana
```

### Guardado
```javascript
guardarHorarioLocal()
// Guarda en localStorage
```

### Carga
```javascript
cargarHorarioLocal()
// Restaura desde localStorage
```

## 📊 Estado de la Aplicación

La aplicación mantiene el estado en:
```javascript
appState = {
    currentScreen: 'dashboard',
    profesores: [],
    materias: [],
    grupos: [],
    aulas: [],
    eventos: [],        // ← Horario generado
    solucion: null,     // ← Métricas de calidad
    log: [],
    progreso: 0,
    optimizando: false
}
```

## ⚠️ Limitaciones Actuales

1. **Simulación de optimización**: La interfaz web simula el algoritmo de Búsqueda Tabú, no lo ejecuta realmente. Para optimización real, usa el backend Python.

2. **Conflictos**: La detección de conflictos es básica. Para análisis completo, usa el sistema Python.

3. **Exportación PDF**: Funcionalidad pendiente. Actualmente solo exporta a JSON.

## 🔮 Mejoras Futuras

- [ ] Integración con backend Python (API REST)
- [ ] Drag & drop para editar horarios manualmente
- [ ] Exportación a PDF real
- [ ] Visualización de gráfico de conflictos
- [ ] Comparación de múltiples soluciones
- [ ] Modo oscuro

## 🐛 Solución de Problemas

### No carga los datos
1. Verifica que existe `../data/datos_iti.json`
2. Abre la consola del navegador (F12) para ver errores
3. Verifica que el JSON tenga formato válido

### No se guardan los horarios
1. Verifica que localStorage esté habilitado en tu navegador
2. Algunas extensiones de privacidad pueden bloquear localStorage
3. Modo incógnito puede no persistir datos

### Horarios con conflictos
1. La optimización en la web es básica
2. Usa el sistema Python para resultados óptimos
3. Ajusta manualmente los slots si es necesario

## 📞 Soporte

Para problemas o sugerencias con la interfaz web, contactar a los autores del proyecto.

---

**Universidad Politécnica de Victoria - 2025**
