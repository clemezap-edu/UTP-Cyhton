# Makefile para Sistema de Horarios ITI

.PHONY: all build clean run test install help

# Variables
PYTHON = python3
PIP = pip3
CYTHON = cython

# Colores para mensajes
COLOR_INFO = \033[0;36m
COLOR_SUCCESS = \033[0;32m
COLOR_ERROR = \033[0;31m
COLOR_RESET = \033[0m

all: build

help:
	@echo "$(COLOR_INFO)Sistema de Horarios ITI - UPV$(COLOR_RESET)"
	@echo ""
	@echo "Comandos disponibles:"
	@echo "  make install    - Instalar dependencias"
	@echo "  make build      - Compilar módulos Cython"
	@echo "  make run        - Ejecutar el sistema"
	@echo "  make clean      - Limpiar archivos compilados"
	@echo "  make test       - Ejecutar pruebas"
	@echo "  make web        - Abrir interfaz web"
	@echo "  make all        - Compilar todo"
	@echo ""

install:
	@echo "$(COLOR_INFO)Instalando dependencias...$(COLOR_RESET)"
	$(PIP) install cython numpy
	@echo "$(COLOR_SUCCESS)✓ Dependencias instaladas$(COLOR_RESET)"

build:
	@echo "$(COLOR_INFO)Compilando módulos Cython...$(COLOR_RESET)"
	$(PYTHON) setup.py build_ext --inplace
	@echo "$(COLOR_SUCCESS)✓ Compilación exitosa$(COLOR_RESET)"

run: build
	@echo "$(COLOR_INFO)Ejecutando sistema de horarios...$(COLOR_RESET)"
	$(PYTHON) sistema_horarios.py

web:
	@echo "$(COLOR_INFO)Abriendo interfaz web...$(COLOR_RESET)"
	@if command -v xdg-open > /dev/null; then \
		xdg-open web/index.html; \
	elif command -v open > /dev/null; then \
		open web/index.html; \
	else \
		echo "$(COLOR_INFO)Abre manualmente: web/index.html$(COLOR_RESET)"; \
	fi

clean:
	@echo "$(COLOR_INFO)Limpiando archivos compilados...$(COLOR_RESET)"
	rm -rf build/
	rm -rf cython_modules/*.c
	rm -rf cython_modules/*.so
	rm -rf cython_modules/*.pyd
	rm -rf cython_modules/__pycache__
	rm -rf __pycache__
	rm -f *.html
	rm -f solucion_final.json
	@echo "$(COLOR_SUCCESS)✓ Limpieza completada$(COLOR_RESET)"

test:
	@echo "$(COLOR_INFO)Ejecutando pruebas...$(COLOR_RESET)"
	$(PYTHON) -c "from cython_modules.busqueda_tabu import BusquedaTabu; print('✓ Módulo Cython OK')"
	@echo "$(COLOR_SUCCESS)✓ Pruebas exitosas$(COLOR_RESET)"

rebuild: clean build
	@echo "$(COLOR_SUCCESS)✓ Reconstrucción completada$(COLOR_RESET)"
