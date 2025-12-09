# Sistema de Generación de Horarios Universitarios - ITI UPV

## Descripción

Sistema automatizado para la generación de horarios universitarios usando el algoritmo de **Búsqueda Tabú** optimizado con **Cython**. Desarrollado para la carrera de Ingeniería en Tecnologías de la Información e Innovación Digital (ITI) de la Universidad Politécnica de Victoria.

### Características Principales

✅ **Algoritmo de Búsqueda Tabú** con optimización Cython para alto rendimiento  
✅ **Resolución de restricciones duras** (obligatorias)  
✅ **Optimización de restricciones blandas** (preferencias)  
✅ **Interfaz web interactiva** con Tailwind CSS  
✅ **Visualización de horarios** por grupo, profesor y aula  
✅ **Análisis de conflictos** en tiempo real  
✅ **Exportación** a JSON, HTML, PDF y Excel  

## Estructura del Proyecto

```
sistema-horarios-iti/
├── include/                    # Headers C++
│   └── estructuras.h          # Definiciones de estructuras
├── src/                       # Implementaciones C++
│   └── estructuras.cpp        # Grafos, listas enlazadas
├── cython_modules/            # Módulos Cython optimizados
│   └── busqueda_tabu.pyx     # Algoritmo principal
├── data/                      # Datos de entrada
│   └── datos_iti.json        # Profesores, materias, grupos
├── web/                       # Interfaz web
│   ├── index.html            # Página principal
│   └── app.js                # Lógica de la aplicación
├── docs/                      # Documentación
├── build/                     # Archivos compilados
├── sistema_horarios.py       # Script principal Python
└── setup.py                  # Configuración para compilar Cython
```

## Requisitos del Sistema

### Software Necesario

- **Python 3.8+**
- **GCC/G++** (compilador C++)
- **Cython** 0.29+
- **NumPy** 1.20+

### Instalación de Dependencias

```bash
# Instalar dependencias Python
pip install cython numpy

# En sistemas basados en Debian/Ubuntu
sudo apt-get install build-essential python3-dev
```

## Instalación

### 1. Clonar o copiar el proyecto

```bash
cd /ruta/al/proyecto/sistema-horarios-iti
```

### 2. Compilar módulos Cython

```bash
python setup.py build_ext --inplace
```

Este comando compilará el módulo `busqueda_tabu.pyx` a código C y luego a una extensión Python nativa (.so en Linux, .pyd en Windows).

### 3. Verificar la instalación

```bash
python -c "from cython_modules.busqueda_tabu import BusquedaTabu; print('✓ Módulo Cython cargado correctamente')"
```

## Uso

### Ejecución desde línea de comandos

```bash
python sistema_horarios.py
```

El sistema:
1. Cargará los datos desde `data/datos_iti.json`
2. Generará una solución inicial
3. Optimizará con Búsqueda Tabú
4. Generará reportes en HTML
5. Guardará la solución en `solucion_final.json`

### Uso de la interfaz web

1. Abrir `web/index.html` en un navegador web
2. La interfaz cargará automáticamente los datos
3. Navegar por las diferentes secciones:
   - **Dashboard**: Vista general del sistema
   - **Entrada de Datos**: Gestión de profesores, materias, grupos
   - **Generación**: Configurar y ejecutar el algoritmo
   - **Visualización**: Ver horarios generados
   - **Conflictos**: Analizar problemas en el horario

### Configuración de Parámetros

Editar el archivo `sistema_horarios.py` o usar la interfaz web:

```python
sistema.optimizar_con_tabu(
    max_iteraciones=1000,  # Número máximo de iteraciones
    tamano_tabu=20         # Tamaño de la lista tabú
)
```

## Formato de Datos de Entrada

### Archivo JSON (data/datos_iti.json)

```json
{
  "profesores": [
    {
      "id": 0,
      "nombre": "Dr. Said Polanco Martagón",
      "max_horas": 12,
      "preferencias_horarias": [0, 1, 13, 27, 41]
    }
  ],
  "materias": [
    {
      "id": 0,
      "nombre": "Estructura de Datos",
      "horas_semanales": 5,
      "requiere_laboratorio": true,
      "color": "blue"
    }
  ],
  "grupos": [
    {
      "id": 0,
      "nombre": "ITI 5-1",
      "num_estudiantes": 35,
      "turno_matutino": true
    }
  ],
  "aulas": [
    {
      "id": 0,
      "nombre": "Laboratorio Z3",
      "capacidad": 35,
      "es_laboratorio": true
    }
  ],
  "asignaciones": {
    "5": {
      "0": 0
    }
  }
}
```

## Restricciones Implementadas

### Restricciones Duras (Obligatorias)

1. **RC1**: No superposición de profesores
2. **RC2**: No superposición de grupos
3. **RC3**: No superposición de aulas
4. **RC4**: Capacidad de aula suficiente
5. **RC5**: Cumplimiento de horas semanales

### Restricciones Blandas (Preferencias)

1. **RB1**: Minimizar horas libres (peso: 10)
2. **RB2**: Distribución equilibrada (peso: 8)
3. **RB3**: Evitar horarios extremos (peso: 5)
4. **RB4**: Preferencias de profesores (peso: 15)
5. **RB5**: Días completos para profesores (peso: 7)

## Algoritmo de Búsqueda Tabú

### Componentes Principales

- **Solución Inicial**: Asignación aleatoria de slots
- **Lista Tabú**: Cola circular con tenor de 7-10 iteraciones
- **Operadores de Movimiento**: 
  - Cambio de franja horaria
  - Intercambio de franjas
  - Cambio de día
- **Criterio de Aspiración**: Acepta movimientos tabú si mejoran la mejor solución global
- **Función Objetivo**: Minimizar conflictos duros primero, luego penalizaciones blandas

### Optimización con Cython

El algoritmo está implementado en Cython con:
- **Aritmética de punteros** para acceso rápido a memoria
- **Tipos estáticos** (cdef) para todas las variables críticas
- **Desactivación de comprobaciones** (boundscheck=False, wraparound=False)
- **División C nativa** (cdivision=True)

Esto proporciona un **speedup de 10-50x** comparado con Python puro.

## Salidas Generadas

1. **horario_iti_final.html**: Reporte visual completo
2. **solucion_final.json**: Datos de la solución en formato JSON
3. **Log de ejecución**: Registro detallado del proceso

## Métricas de Calidad

La calidad del horario se calcula como:

```
Si conflictos_duros == 0:
    calidad = 100% - (penalizacion_blandas / 10)
Sino:
    calidad = 0% (infactible)
```

**Interpretación**:
- **90-100%**: Excelente (listo para usar)
- **80-89%**: Bueno (revisar manualmente algunas preferencias)
- **70-79%**: Aceptable (requiere ajustes)
- **< 70%**: Requiere reoptimización

## Solución de Problemas

### Error: "No se pudo importar el módulo Cython"

```bash
# Recompilar los módulos
python setup.py build_ext --inplace --force
```

### Error: "gcc: command not found"

```bash
# Instalar compilador
sudo apt-get install build-essential  # Debian/Ubuntu
sudo yum install gcc gcc-c++          # RedHat/CentOS
```

### Horario con muchos conflictos

1. Aumentar `max_iteraciones` (ej: 2000, 5000)
2. Verificar que los datos de entrada sean coherentes
3. Revisar que haya suficientes aulas disponibles

## Autores

- **Carlos Adrian Vargas Saldierna**
- **Eliezer Mores Oyervides**
- **Mauricio Garcia Cervantes**
- **Carlos Guillermo Moncada Ortiz**

**Catedrático**: Dr. Said Polanco Martagón

**Institución**: Universidad Politécnica de Victoria  
**Carrera**: Ingeniería en Tecnologías de la Información e Innovación Digital  
**Materia**: Estructura de Datos

## Licencia

Proyecto académico - Universidad Politécnica de Victoria (2025)

## Referencias

- Schaerf, A. (1999). A Survey of Automated Timetabling. *Artificial Intelligence Review*, 13, 87-127.
- Burke, E. K., & Petrovic, S. (2002). Recent Research Directions in Automated Timetabling. *European Journal of Operational Research*, 140(2), 266-280.
- Glover, F. (1986). Future paths for integer programming and links to artificial intelligence. *Computers & Operations Research*, 13(5), 533-549.

## Soporte

Para reportar problemas o sugerencias, contactar a los autores o al catedrático.

---

**Universidad Politécnica de Victoria - 2025**
