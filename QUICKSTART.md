# INICIO RÁPIDO - Sistema de Horarios ITI

## 🚀 Instalación Express (Linux/Mac)

```bash
cd sistema-horarios-iti
./install.sh
```

## 📦 Instalación Manual

```bash
# 1. Instalar dependencias
pip3 install cython numpy

# 2. Compilar módulos
python3 setup.py build_ext --inplace

# 3. Verificar
python3 -c "from cython_modules.busqueda_tabu import BusquedaTabu; print('OK')"
```

## ▶️ Ejecución

### Opción 1: Script Principal
```bash
python3 sistema_horarios.py
```

### Opción 2: Ejemplos Interactivos
```bash
python3 ejemplos.py
```

### Opción 3: Interfaz Web
```bash
# Linux
xdg-open web/index.html

# Mac
open web/index.html

# Windows
start web/index.html
```

## 📝 Uso Básico

```python
from sistema_horarios import SistemaHorariosITI

# Crear sistema
sistema = SistemaHorariosITI()

# Cargar datos
sistema.cargar_datos_json('data/datos_iti.json')

# Generar solución inicial
sistema.generar_solucion_inicial()

# Optimizar
sistema.optimizar_con_tabu(max_iteraciones=1000, tamano_tabu=20)

# Exportar
sistema.generar_reporte_html('horario_final.html')
sistema.guardar_solucion_json('solucion.json')
```

## 🔧 Comandos Make

```bash
make install    # Instalar dependencias
make build      # Compilar módulos Cython
make run        # Ejecutar sistema
make web        # Abrir interfaz web
make clean      # Limpiar archivos compilados
make test       # Ejecutar pruebas
```

## 📂 Archivos Importantes

| Archivo | Descripción |
|---------|-------------|
| `sistema_horarios.py` | Script principal |
| `data/datos_iti.json` | Datos de entrada |
| `web/index.html` | Interfaz web |
| `cython_modules/busqueda_tabu.pyx` | Algoritmo optimizado |
| `README.md` | Documentación completa |

## ⚠️ Solución de Problemas

### Error: "gcc: command not found"
```bash
# Ubuntu/Debian
sudo apt-get install build-essential

# Fedora/RHEL
sudo yum install gcc gcc-c++
```

### Error: "No module named 'cython_modules.busqueda_tabu'"
```bash
python3 setup.py build_ext --inplace --force
```

### Horario con muchos conflictos
- Aumentar `max_iteraciones` (ej: 2000, 5000)
- Verificar coherencia de los datos de entrada
- Asegurar que hay suficientes aulas disponibles

## 📊 Parámetros Recomendados

| Tamaño del Problema | Max Iteraciones | Tamaño Tabú |
|---------------------|-----------------|-------------|
| Pequeño (< 100 eventos) | 500 | 10 |
| Mediano (100-300) | 1000 | 20 |
| Grande (> 300) | 2000+ | 30 |

## 🎯 Siguiente Paso

Lee el **README.md** completo para documentación detallada.

---

**Universidad Politécnica de Victoria - 2025**
