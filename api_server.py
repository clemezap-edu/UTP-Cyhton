#!/usr/bin/env python3
"""
API Server para el Sistema de Horarios ITI
Conecta la interfaz web con el motor de optimización Cython
"""

from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
import json
import os
import sys
import time
import threading
import queue

# Agregar el directorio de módulos Cython al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Intentar importar el módulo Cython compilado
try:
    from cython_modules.busqueda_tabu import BusquedaTabu
    CYTHON_DISPONIBLE = True
    print("✓ Módulo Cython cargado correctamente")
except ImportError as e:
    CYTHON_DISPONIBLE = False
    print(f"⚠ Módulo Cython no disponible: {e}")
    print("  Ejecuta: python setup.py build_ext --inplace")

app = Flask(__name__, static_folder='web')
CORS(app)

# Estado global del sistema
estado = {
    'profesores': [],
    'materias': [],
    'grupos': [],
    'aulas': [],
    'asignaciones': {},
    'eventos': [],
    'solucion': None,
    'optimizando': False,
    'progreso': 0,
    'log_messages': []
}

# Cola para mensajes de progreso (para SSE)
progress_queue = queue.Queue()

# Instancia del optimizador Cython
optimizador = None


def cargar_datos():
    """Carga los datos desde el archivo JSON"""
    global estado
    ruta_json = os.path.join(os.path.dirname(__file__), 'data', 'datos_iti_usuario.json')
    
    try:
        with open(ruta_json, 'r', encoding='utf-8') as f:
            datos = json.load(f)
            estado['profesores'] = datos.get('profesores', [])
            estado['materias'] = datos.get('materias', [])
            estado['grupos'] = datos.get('grupos', [])
            estado['aulas'] = datos.get('aulas', [])
            estado['asignaciones'] = datos.get('asignaciones', {})
            print(f"✓ Datos cargados: {len(estado['profesores'])} profesores, "
                  f"{len(estado['materias'])} materias, {len(estado['grupos'])} grupos")
            return True
    except Exception as e:
        print(f"✗ Error cargando datos: {e}")
        return False


def generar_eventos_iniciales():
    """Genera los eventos basados en las asignaciones"""
    global estado
    eventos = []
    evento_id = 0
    
    for grupo_id_str, materias_grupo in estado['asignaciones'].items():
        grupo_id = int(grupo_id_str)
        
        for materia_id_str, profesor_id in materias_grupo.items():
            materia_id = int(materia_id_str)
            
            # Buscar horas semanales de la materia
            materia = next((m for m in estado['materias'] if m['id'] == materia_id), None)
            if not materia:
                continue
            
            horas_semanales = materia.get('horas_semanales', 4)
            
            # Crear un evento por cada hora semanal
            for h in range(horas_semanales):
                eventos.append({
                    'id': evento_id,
                    'materia_id': materia_id,
                    'profesor_id': profesor_id,
                    'grupo_id': grupo_id,
                    'aula_id': grupo_id % max(1, len(estado['aulas'])),
                    'slot': {'dia': -1, 'hora': -1}  # Sin asignar
                })
                evento_id += 1
    
    estado['eventos'] = eventos
    print(f"✓ Generados {len(eventos)} eventos")
    return eventos


# ==================== RUTAS API ====================

@app.route('/')
def index():
    """Sirve la página principal"""
    return send_from_directory('web', 'index.html')


@app.route('/<path:path>')
def static_files(path):
    """Sirve archivos estáticos"""
    return send_from_directory('web', path)


@app.route('/data/<path:path>')
def data_files(path):
    """Sirve archivos de datos"""
    return send_from_directory('data', path)


@app.route('/api/estado', methods=['GET'])
def obtener_estado():
    """Retorna el estado actual del sistema"""
    return jsonify({
        'profesores': estado['profesores'],
        'materias': estado['materias'],
        'grupos': estado['grupos'],
        'aulas': estado['aulas'],
        'asignaciones': estado['asignaciones'],
        'eventos': estado['eventos'],
        'solucion': estado['solucion'],
        'cython_disponible': CYTHON_DISPONIBLE
    })


@app.route('/api/cargar_datos', methods=['POST'])
def api_cargar_datos():
    """Recarga los datos desde el JSON"""
    if cargar_datos():
        return jsonify({'success': True, 'message': 'Datos cargados correctamente'})
    return jsonify({'success': False, 'message': 'Error al cargar datos'}), 500


@app.route('/api/generar_eventos', methods=['POST'])
def api_generar_eventos():
    """Genera los eventos iniciales"""
    eventos = generar_eventos_iniciales()
    return jsonify({
        'success': True,
        'num_eventos': len(eventos),
        'eventos': eventos
    })


@app.route('/api/optimizar', methods=['POST'])
def api_optimizar():
    """
    Ejecuta el algoritmo de Búsqueda Tabú con Cython
    """
    global optimizador, estado
    
    # Parámetros de la solicitud
    data = request.get_json() or {}
    max_iter = data.get('max_iteraciones', 1000)
    tamano_tabu = data.get('tamano_tabu', 20)
    
    print(f"[DEBUG] Parámetros recibidos: max_iter={max_iter}, tamano_tabu={tamano_tabu}")
    
    estado['optimizando'] = True
    estado['progreso'] = 0
    estado['log_messages'] = []
    
    # Verificar que hay eventos
    if not estado['eventos']:
        generar_eventos_iniciales()
    
    if not estado['eventos']:
        return jsonify({
            'success': False,
            'message': 'No hay eventos para optimizar'
        }), 400
    
    if CYTHON_DISPONIBLE:
        # ========== OPTIMIZACIÓN CON CYTHON ==========
        try:
            print(f"[INFO] Iniciando optimización Cython con {len(estado['eventos'])} eventos...")
            
            # Crear instancia del optimizador
            optimizador = BusquedaTabu(
                max_iter=max_iter,
                tamano_tabu=tamano_tabu
            )
            
            # Inicializar con los datos incluyendo info de grupos
            optimizador.inicializar(
                eventos=estado['eventos'],
                num_profesores=len(estado['profesores']),
                num_grupos=len(estado['grupos']),
                num_aulas=len(estado['aulas']),
                grupos_info=estado['grupos']  # Para determinar turno matutino/vespertino
            )
            
            # Callbacks para logging
            def callback_progreso(prog, sol):
                estado['progreso'] = prog
                estado['log_messages'].append(
                    f"[Iter {int(prog * max_iter / 100)}] Conflictos: {sol.get('conflictos_duros', 0)}, "
                    f"Calidad: {sol.get('calidad', 0):.1f}%"
                )
            
            def callback_log(msg):
                estado['log_messages'].append(msg)
                print(msg)
            
            # Ejecutar optimización con callbacks y grupos info
            resultado = optimizador.optimizar(
                datos_adicionales={},
                callback_progreso=callback_progreso,
                callback_log=callback_log,
                grupos_info=estado['grupos']
            )
            
            estado['optimizando'] = False
            estado['progreso'] = 100
            
            # Actualizar eventos con la solución
            eventos_optimizados = optimizador.obtener_eventos()
            estado['eventos'] = eventos_optimizados
            
            # Guardar solución
            estado['solucion'] = {
                'conflictos_duros': resultado['conflictos_duros'],
                'penalizacion_blandas': resultado['penalizacion_blandas'],
                'calidad': resultado['calidad'],
                'iteraciones': resultado.get('iteraciones', max_iter),
                'tiempo_ejecucion': resultado.get('tiempo_ejecucion', 0),
                'optimizado_con': 'Cython'
            }
            
            print(f"[INFO] Optimización completada: {resultado['conflictos_duros']} conflictos, "
                  f"{resultado['calidad']:.1f}% calidad")
            
            return jsonify({
                'success': True,
                'eventos': eventos_optimizados,
                'solucion': estado['solucion'],
                'motor': 'Cython'
            })
            
        except Exception as e:
            print(f"[ERROR] Error en optimización Cython: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False,
                'message': f'Error en Cython: {str(e)}'
            }), 500
    else:
        # ========== FALLBACK: OPTIMIZACIÓN PYTHON ==========
        print("[WARN] Usando optimización Python (Cython no disponible)")
        
        resultado = optimizar_python(
            estado['eventos'],
            estado['profesores'],
            estado['grupos'],
            max_iter,
            tamano_tabu
        )
        
        estado['eventos'] = resultado['eventos']
        estado['solucion'] = {
            'conflictos_duros': resultado['conflictos_duros'],
            'penalizacion_blandas': resultado['penalizacion_blandas'],
            'calidad': resultado['calidad'],
            'iteraciones': max_iter,
            'optimizado_con': 'Python (fallback)'
        }
        
        estado['optimizando'] = False
        estado['progreso'] = 100
        
        return jsonify({
            'success': True,
            'eventos': resultado['eventos'],
            'solucion': estado['solucion'],
            'motor': 'Python'
        })


@app.route('/api/progreso', methods=['GET'])
def api_progreso():
    """Retorna el estado actual del progreso de optimización"""
    return jsonify({
        'optimizando': estado['optimizando'],
        'progreso': estado['progreso'],
        'log': estado['log_messages'][-20:] if estado['log_messages'] else [],
        'solucion': estado['solucion']
    })


def optimizar_python(eventos, profesores, grupos, max_iter, tamano_tabu):
    """
    Optimización de fallback en Python puro
    """
    import random
    
    # Matriz de ocupación
    ocupacion = [[{'grupos': set(), 'profesores': set()} for _ in range(14)] for _ in range(5)]
    
    # Determinar turno por grupo
    def es_vespertino(grupo_id):
        grupo = next((g for g in grupos if g['id'] == grupo_id), None)
        if not grupo:
            return False
        nombre = grupo.get('nombre', '')
        return nombre == 'ITI 1-1' or '-3' in nombre or nombre == 'ITI 8-2'
    
    # Asignar horarios iniciales
    for evento in eventos:
        grupo_id = evento['grupo_id']
        profesor_id = evento['profesor_id']
        vesp = es_vespertino(grupo_id)
        
        hora_min = 7 if vesp else 0
        hora_max = 13 if vesp else 7
        
        asignado = False
        for dia in range(5):
            for hora in range(hora_min, hora_max + 1):
                slot = ocupacion[dia][hora]
                if grupo_id not in slot['grupos'] and profesor_id not in slot['profesores']:
                    evento['slot']['dia'] = dia
                    evento['slot']['hora'] = hora
                    slot['grupos'].add(grupo_id)
                    slot['profesores'].add(profesor_id)
                    asignado = True
                    break
            if asignado:
                break
        
        # Fallback
        if not asignado:
            for dia in range(5):
                for hora in range(14):
                    slot = ocupacion[dia][hora]
                    if grupo_id not in slot['grupos']:
                        evento['slot']['dia'] = dia
                        evento['slot']['hora'] = hora
                        slot['grupos'].add(grupo_id)
                        slot['profesores'].add(profesor_id)
                        asignado = True
                        break
                if asignado:
                    break
    
    # Calcular conflictos
    conflictos_duros = 0
    por_slot = {}
    for e in eventos:
        key = f"{e['slot']['dia']}-{e['slot']['hora']}"
        if key not in por_slot:
            por_slot[key] = []
        por_slot[key].append(e)
    
    for slot_eventos in por_slot.values():
        profs = [e['profesor_id'] for e in slot_eventos]
        grupos_slot = [e['grupo_id'] for e in slot_eventos]
        conflictos_duros += len(profs) - len(set(profs))
        conflictos_duros += len(grupos_slot) - len(set(grupos_slot))
    
    calidad = 100.0 if conflictos_duros == 0 else max(0, 100.0 - conflictos_duros * 10)
    
    return {
        'eventos': eventos,
        'conflictos_duros': conflictos_duros,
        'penalizacion_blandas': 0,
        'calidad': calidad
    }


@app.route('/api/horario/<int:grupo_id>', methods=['GET'])
def obtener_horario_grupo(grupo_id):
    """Obtiene el horario de un grupo específico"""
    eventos_grupo = [e for e in estado['eventos'] if e['grupo_id'] == grupo_id and e['slot']['dia'] >= 0]
    
    # Organizar por día y hora
    horario = {}
    for e in eventos_grupo:
        key = f"{e['slot']['dia']}-{e['slot']['hora']}"
        horario[key] = {
            'materia_id': e['materia_id'],
            'profesor_id': e['profesor_id'],
            'aula_id': e['aula_id']
        }
    
    return jsonify({
        'grupo_id': grupo_id,
        'eventos': eventos_grupo,
        'horario': horario
    })


@app.route('/api/exportar', methods=['GET'])
def exportar_solucion():
    """Exporta la solución actual en JSON"""
    return jsonify({
        'profesores': estado['profesores'],
        'materias': estado['materias'],
        'grupos': estado['grupos'],
        'aulas': estado['aulas'],
        'eventos': estado['eventos'],
        'solucion': estado['solucion'],
        'metadata': {
            'version': '1.0',
            'generado_con': 'Sistema Horarios ITI - Cython'
        }
    })


# ==================== INICIALIZACIÓN ====================

if __name__ == '__main__':
    import sys
    
    # Puerto configurable (usar 5001 si 5000 está ocupado)
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
    
    print("=" * 60)
    print("  Sistema de Horarios ITI - API Server")
    print("=" * 60)
    
    # Cargar datos iniciales
    cargar_datos()
    
    # Iniciar servidor
    print(f"\n🚀 Servidor iniciado en http://localhost:{port}")
    print(f"   Interfaz web: http://localhost:{port}")
    print(f"   API: http://localhost:{port}/api/estado")
    print("\nPresiona Ctrl+C para detener\n")
    
    app.run(host='0.0.0.0', port=port, debug=True)
