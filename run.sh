#!/bin/bash

# ============================================
# Script para ejecutar Sistema de Horarios ITI
# ============================================

set -e  # Salir si hay algún error

VENV_DIR="venv"
PORT=5000

echo "========================================"
echo "Sistema de Horarios ITI - UPV"
echo "Script de Ejecución Completa"
echo "========================================"
echo ""

# 1. Borrar entorno virtual si existe
echo "[1/5] Verificando entorno virtual..."
if [ -d "$VENV_DIR" ]; then
    echo "   → Eliminando entorno virtual existente..."
    rm -rf "$VENV_DIR"
    echo "   ✓ Entorno virtual eliminado"
else
    echo "   → No existe entorno virtual previo"
fi
echo ""

# 2. Crear nuevo entorno virtual
echo "[2/5] Creando nuevo entorno virtual..."
python3 -m venv "$VENV_DIR"
echo "   ✓ Entorno virtual creado"
echo ""

# 3. Activar entorno virtual
echo "[3/5] Activando entorno virtual..."
source "$VENV_DIR/bin/activate"
echo "   ✓ Entorno virtual activado"
echo ""

# 4. Instalar dependencias
echo "[4/5] Instalando dependencias..."
pip install --upgrade pip
pip install -r requirements.txt
echo "   ✓ Dependencias instaladas"
echo ""

# 5. Compilar módulos Cython (si setup.py existe)
echo "[5/6] Compilando módulos Cython..."
if [ -f "setup.py" ]; then
    python setup.py build_ext --inplace
    echo "   ✓ Módulos Cython compilados"
else
    echo "   → No se encontró setup.py, saltando compilación"
fi
echo ""

# 6. Ejecutar el servidor web
echo "[6/6] Iniciando servidor web..."
echo "========================================"
echo "El servidor se iniciará en: http://localhost:$PORT"
echo "Presiona Ctrl+C para detener el servidor"
echo "========================================"
echo ""

python api_server.py
