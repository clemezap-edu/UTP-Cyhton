#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sistema de Generación de Horarios Universitarios - ITI UPV
Algoritmo: Búsqueda Tabú optimizada con Cython
Autores: Carlos Adrian Vargas Saldierna, Eliezer Mores Oyervides,
         Mauricio Garcia Cervantes, Carlos Guillermo Moncada Ortiz
Catedrático: Dr. Said Polanco Martagón
"""

import json
import csv
import os
from datetime import datetime
from typing import List, Dict, Tuple
import numpy as np

# ==================== CONSTANTES ====================

DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
HORAS_INICIO = ['7:00', '7:55', '8:50', '9:45', '10:40', '11:35', '12:30', 
                '13:25', '14:20', '15:15', '16:10', '17:05', '18:00', '18:55', '19:50']

# Pesos de restricciones blandas
PESO_HORAS_LIBRES = 10
PESO_DISTRIBUCION = 8
PESO_HORARIOS_EXTREMOS = 5
PESO_PREFERENCIAS = 15
PESO_DIAS_COMPLETOS = 7

# ==================== CLASES DE DATOS ====================

class Profesor:
    def __init__(self, id: int, nombre: str, max_horas: int):
        self.id = id
        self.nombre = nombre
        self.max_horas = max_horas
        self.horas_asignadas = 0
        self.preferencias_horarias = []  # Slots que NO quiere
        self.materias = []
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'max_horas': self.max_horas,
            'horas_asignadas': self.horas_asignadas,
            'preferencias_horarias': self.preferencias_horarias
        }

class Materia:
    def __init__(self, id: int, nombre: str, horas_semanales: int):
        self.id = id
        self.nombre = nombre
        self.horas_semanales = horas_semanales
        self.requiere_laboratorio = False
        self.color = 'blue'  # Para visualización
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'horas_semanales': self.horas_semanales,
            'requiere_laboratorio': self.requiere_laboratorio,
            'color': self.color
        }

class Grupo:
    def __init__(self, id: int, nombre: str, num_estudiantes: int, turno_matutino: bool):
        self.id = id
        self.nombre = nombre
        self.num_estudiantes = num_estudiantes
        self.turno_matutino = turno_matutino
        self.materias = []
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'num_estudiantes': self.num_estudiantes,
            'turno_matutino': self.turno_matutino
        }

class Aula:
    def __init__(self, id: int, nombre: str, capacidad: int, es_laboratorio: bool = False):
        self.id = id
        self.nombre = nombre
        self.capacidad = capacidad
        self.es_laboratorio = es_laboratorio
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'capacidad': self.capacidad,
            'es_laboratorio': self.es_laboratorio
        }

class Evento:
    def __init__(self, id: int, materia_id: int, profesor_id: int, grupo_id: int):
        self.id = id
        self.materia_id = materia_id
        self.profesor_id = profesor_id
        self.grupo_id = grupo_id
        self.aula_id = -1
        self.slot = {'dia': 0, 'hora': 0}
    
    def to_dict(self):
        return {
            'id': self.id,
            'materia_id': self.materia_id,
            'profesor_id': self.profesor_id,
            'grupo_id': self.grupo_id,
            'aula_id': self.aula_id,
            'slot': self.slot
        }

# ==================== CLASE PRINCIPAL DEL SISTEMA ====================

class SistemaHorariosITI:
    def __init__(self):
        self.profesores: List[Profesor] = []
        self.materias: List[Materia] = []
        self.grupos: List[Grupo] = []
        self.aulas: List[Aula] = []
        self.eventos: List[Evento] = []
        self.asignaciones = {}  # {grupo_id: {materia_id: profesor_id}}
        
        self.mejor_solucion = None
        self.log_ejecucion = []
        
    # ==================== CARGA DE DATOS ====================
    
    def cargar_datos_csv(self, ruta_profesores: str, ruta_materias: str, 
                         ruta_grupos: str, ruta_aulas: str, ruta_asignaciones: str):
        """Carga datos desde archivos CSV"""
        
        print("[INFO] Cargando datos desde archivos CSV...")
        
        # Cargar profesores
        with open(ruta_profesores, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                prof = Profesor(int(row['id']), row['nombre'], int(row['max_horas']))
                if 'preferencias' in row and row['preferencias']:
                    prof.preferencias_horarias = [int(x) for x in row['preferencias'].split(';')]
                self.profesores.append(prof)
        
        print(f"  ✓ Cargados {len(self.profesores)} profesores")
        
        # Cargar materias
        with open(ruta_materias, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                mat = Materia(int(row['id']), row['nombre'], int(row['horas_semanales']))
                mat.requiere_laboratorio = row.get('laboratorio', '0') == '1'
                mat.color = row.get('color', 'blue')
                self.materias.append(mat)
        
        print(f"  ✓ Cargadas {len(self.materias)} materias")
        
        # Cargar grupos
        with open(ruta_grupos, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                grupo = Grupo(int(row['id']), row['nombre'], 
                             int(row['num_estudiantes']),
                             row['turno'] == 'matutino')
                self.grupos.append(grupo)
        
        print(f"  ✓ Cargados {len(self.grupos)} grupos")
        
        # Cargar aulas
        with open(ruta_aulas, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                aula = Aula(int(row['id']), row['nombre'], 
                           int(row['capacidad']),
                           row.get('laboratorio', '0') == '1')
                self.aulas.append(aula)
        
        print(f"  ✓ Cargadas {len(self.aulas)} aulas")
        
        # Cargar asignaciones (materia -> profesor por grupo)
        with open(ruta_asignaciones, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                grupo_id = int(row['grupo_id'])
                materia_id = int(row['materia_id'])
                profesor_id = int(row['profesor_id'])
                
                if grupo_id not in self.asignaciones:
                    self.asignaciones[grupo_id] = {}
                self.asignaciones[grupo_id][materia_id] = profesor_id
        
        print(f"  ✓ Cargadas {len(self.asignaciones)} asignaciones\n")
    
    def cargar_datos_json(self, ruta_json: str):
        """Carga datos desde un archivo JSON"""
        
        print(f"[INFO] Cargando datos desde {ruta_json}...")
        
        with open(ruta_json, 'r', encoding='utf-8') as f:
            datos = json.load(f)
        
        # Cargar profesores
        for p in datos.get('profesores', []):
            prof = Profesor(p['id'], p['nombre'], p['max_horas'])
            prof.preferencias_horarias = p.get('preferencias_horarias', [])
            self.profesores.append(prof)
        
        # Cargar materias
        for m in datos.get('materias', []):
            mat = Materia(m['id'], m['nombre'], m['horas_semanales'])
            mat.requiere_laboratorio = m.get('requiere_laboratorio', False)
            mat.color = m.get('color', 'blue')
            self.materias.append(mat)
        
        # Cargar grupos
        for g in datos.get('grupos', []):
            grupo = Grupo(g['id'], g['nombre'], g['num_estudiantes'], g['turno_matutino'])
            self.grupos.append(grupo)
        
        # Cargar aulas
        for a in datos.get('aulas', []):
            aula = Aula(a['id'], a['nombre'], a['capacidad'], a.get('es_laboratorio', False))
            self.aulas.append(aula)
        
        # Cargar asignaciones
        self.asignaciones = datos.get('asignaciones', {})
        # Convertir keys a int
        self.asignaciones = {int(k): {int(mk): v for mk, v in mv.items()} 
                            for k, mv in self.asignaciones.items()}
        
        print(f"  ✓ Datos cargados correctamente\n")
    
    # ==================== GENERACIÓN DE SOLUCIÓN INICIAL ====================
    
    def generar_solucion_inicial(self):
        """Genera una solución inicial factible (o lo más cercano posible)"""
        
        print("[INFO] Generando solución inicial...")
        
        self.eventos = []
        evento_id = 0
        
        # Para cada grupo y sus materias asignadas
        for grupo in self.grupos:
            grupo_id = grupo.id
            
            if grupo_id not in self.asignaciones:
                continue
            
            for materia_id, profesor_id in self.asignaciones[grupo_id].items():
                # Buscar la materia
                materia = next((m for m in self.materias if m.id == materia_id), None)
                if not materia:
                    continue
                
                # Crear tantos eventos como horas semanales tenga la materia
                for _ in range(materia.horas_semanales):
                    evento = Evento(evento_id, materia_id, profesor_id, grupo_id)
                    
                    # Asignar slot aleatorio inicial
                    dia = np.random.randint(0, 5)
                    hora = np.random.randint(0, 14)
                    evento.slot = {'dia': dia, 'hora': hora}
                    
                    # Asignar aula (primera disponible con capacidad suficiente)
                    for aula in self.aulas:
                        if aula.capacidad >= grupo.num_estudiantes:
                            if materia.requiere_laboratorio and not aula.es_laboratorio:
                                continue
                            evento.aula_id = aula.id
                            break
                    
                    self.eventos.append(evento)
                    evento_id += 1
        
        print(f"  ✓ Generados {len(self.eventos)} eventos\n")
    
    # ==================== OPTIMIZACIÓN CON BÚSQUEDA TABÚ ====================
    
    def optimizar_con_tabu(self, max_iteraciones=1000, tamano_tabu=20):
        """Ejecuta el algoritmo de Búsqueda Tabú para optimizar el horario"""
        
        print("[INFO] Iniciando optimización con Búsqueda Tabú...")
        print(f"  - Máximo de iteraciones: {max_iteraciones}")
        print(f"  - Tamaño lista tabú: {tamano_tabu}")
        print()
        
        try:
            # Importar módulo Cython
            from cython_modules.busqueda_tabu import BusquedaTabu
            
            # Crear instancia del algoritmo
            tabu = BusquedaTabu(max_iteraciones, tamano_tabu, mejoras=50)
            
            # Preparar datos
            eventos_dict = [e.to_dict() for e in self.eventos]
            
            datos_adicionales = {
                'preferencias_profesores': {
                    p.id: p.preferencias_horarias for p in self.profesores
                }
            }
            
            # Inicializar
            tabu.inicializar(eventos_dict, len(self.profesores), 
                           len(self.grupos), len(self.aulas))
            
            # Callbacks
            def callback_progreso(progreso, solucion):
                print(f"\r  Progreso: {progreso:.1f}% | Conflictos: {solucion['conflictos_duros']} | "
                      f"Calidad: {solucion['calidad']:.1f}%", end='', flush=True)
            
            def callback_log(mensaje):
                self.log_ejecucion.append(f"[{datetime.now().strftime('%H:%M:%S')}] {mensaje}")
                print(f"\n{mensaje}")
            
            # Ejecutar optimización
            self.mejor_solucion = tabu.ejecutar(datos_adicionales, 
                                                callback_progreso, 
                                                callback_log)
            
            # Actualizar eventos con la mejor solución
            eventos_optimizados = self.mejor_solucion['eventos']
            for i, evento in enumerate(self.eventos):
                if i < len(eventos_optimizados):
                    evento.slot = {
                        'dia': eventos_optimizados[i][5],
                        'hora': eventos_optimizados[i][6]
                    }
            
            print("\n\n[✓] Optimización completada!")
            print(f"  - Conflictos duros: {self.mejor_solucion['conflictos_duros']}")
            print(f"  - Penalización blandas: {self.mejor_solucion['penalizacion_blandas']}")
            print(f"  - Calidad final: {self.mejor_solucion['calidad']:.2f}%\n")
            
        except ImportError:
            print("[ERROR] No se pudo importar el módulo Cython.")
            print("        Ejecuta: python setup.py build_ext --inplace")
            return False
        
        return True
    
    # ==================== ANÁLISIS Y REPORTES ====================
    
    def detectar_conflictos(self) -> List[Dict]:
        """Detecta y retorna todos los conflictos del horario actual"""
        
        conflictos = []
        
        # Detectar conflictos duros
        
        # 1. Superposición de profesores
        ocupacion_prof = {}
        for evento in self.eventos:
            slot_id = evento.slot['dia'] * 14 + evento.slot['hora']
            key = (slot_id, evento.profesor_id)
            
            if key in ocupacion_prof:
                conflictos.append({
                    'tipo': 'duro',
                    'descripcion': f"Profesor duplicado: {self._get_profesor_nombre(evento.profesor_id)}",
                    'tiempo': f"{DIAS_SEMANA[evento.slot['dia']]} {HORAS_INICIO[evento.slot['hora']]}",
                    'eventos': [ocupacion_prof[key], evento.id]
                })
            else:
                ocupacion_prof[key] = evento.id
        
        # 2. Superposición de grupos
        ocupacion_grupo = {}
        for evento in self.eventos:
            slot_id = evento.slot['dia'] * 14 + evento.slot['hora']
            key = (slot_id, evento.grupo_id)
            
            if key in ocupacion_grupo:
                conflictos.append({
                    'tipo': 'duro',
                    'descripcion': f"Grupo duplicado: {self._get_grupo_nombre(evento.grupo_id)}",
                    'tiempo': f"{DIAS_SEMANA[evento.slot['dia']]} {HORAS_INICIO[evento.slot['hora']]}",
                    'eventos': [ocupacion_grupo[key], evento.id]
                })
            else:
                ocupacion_grupo[key] = evento.id
        
        # 3. Superposición de aulas
        ocupacion_aula = {}
        for evento in self.eventos:
            if evento.aula_id < 0:
                continue
            slot_id = evento.slot['dia'] * 14 + evento.slot['hora']
            key = (slot_id, evento.aula_id)
            
            if key in ocupacion_aula:
                conflictos.append({
                    'tipo': 'duro',
                    'descripcion': f"Aula duplicada: {self._get_aula_nombre(evento.aula_id)}",
                    'tiempo': f"{DIAS_SEMANA[evento.slot['dia']]} {HORAS_INICIO[evento.slot['hora']]}",
                    'eventos': [ocupacion_aula[key], evento.id]
                })
            else:
                ocupacion_aula[key] = evento.id
        
        # Detectar violaciones blandas (ejemplos)
        
        # Preferencias de profesores
        for evento in self.eventos:
            slot_id = evento.slot['dia'] * 14 + evento.slot['hora']
            profesor = next((p for p in self.profesores if p.id == evento.profesor_id), None)
            
            if profesor and slot_id in profesor.preferencias_horarias:
                conflictos.append({
                    'tipo': 'blando',
                    'descripcion': f"Profesor en horario no deseado: {profesor.nombre}",
                    'tiempo': f"{DIAS_SEMANA[evento.slot['dia']]} {HORAS_INICIO[evento.slot['hora']]}",
                    'penalizacion': PESO_PREFERENCIAS,
                    'eventos': [evento.id]
                })
        
        return conflictos
    
    def generar_reporte_html(self, ruta_salida: str):
        """Genera un reporte HTML completo del horario"""
        
        print(f"[INFO] Generando reporte HTML en {ruta_salida}...")
        
        # Leer plantilla
        template_path = os.path.join(os.path.dirname(__file__), 'web', 'template_reporte.html')
        
        if not os.path.exists(template_path):
            print("[ADVERTENCIA] Plantilla no encontrada, generando reporte básico...")
            html = self._generar_html_basico()
        else:
            with open(template_path, 'r', encoding='utf-8') as f:
                html = f.read()
            
            # Reemplazar datos dinámicos
            html = html.replace('{{NUM_PROFESORES}}', str(len(self.profesores)))
            html = html.replace('{{NUM_MATERIAS}}', str(len(self.materias)))
            html = html.replace('{{NUM_GRUPOS}}', str(len(self.grupos)))
            html = html.replace('{{CALIDAD}}', f"{self.mejor_solucion['calidad']:.1f}%" 
                              if self.mejor_solucion else "N/A")
        
        with open(ruta_salida, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"  ✓ Reporte generado exitosamente\n")
    
    def _generar_html_basico(self) -> str:
        """Genera un HTML básico si no hay plantilla"""
        
        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte de Horarios ITI - UPV</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }}
        .header {{ background: #1e40af; color: white; padding: 20px; border-radius: 10px; }}
        .stats {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }}
        .stat-card {{ background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .horario {{ background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ border: 1px solid #ddd; padding: 10px; text-align: left; }}
        th {{ background: #3b82f6; color: white; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Sistema de Horarios ITI - Universidad Politécnica de Victoria</h1>
        <p>Generado: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}</p>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <h3>Profesores</h3>
            <p style="font-size: 2em; font-weight: bold;">{len(self.profesores)}</p>
        </div>
        <div class="stat-card">
            <h3>Materias</h3>
            <p style="font-size: 2em; font-weight: bold;">{len(self.materias)}</p>
        </div>
        <div class="stat-card">
            <h3>Grupos</h3>
            <p style="font-size: 2em; font-weight: bold;">{len(self.grupos)}</p>
        </div>
        <div class="stat-card">
            <h3>Eventos</h3>
            <p style="font-size: 2em; font-weight: bold;">{len(self.eventos)}</p>
        </div>
    </div>
    
    <div class="horario">
        <h2>Horarios por Grupo</h2>
        {self._generar_tablas_horarios()}
    </div>
</body>
</html>"""
        return html
    
    def _generar_tablas_horarios(self) -> str:
        """Genera tablas HTML para cada grupo"""
        html = ""
        
        for grupo in self.grupos:
            html += f"<h3>{grupo.nombre}</h3><table><thead><tr><th>Hora</th>"
            for dia in DIAS_SEMANA:
                html += f"<th>{dia}</th>"
            html += "</tr></thead><tbody>"
            
            for hora in range(14):
                html += f"<tr><td>{HORAS_INICIO[hora]}-{HORAS_INICIO[hora+1] if hora < 14 else '20:45'}</td>"
                
                for dia in range(5):
                    evento = next((e for e in self.eventos 
                                 if e.grupo_id == grupo.id and 
                                 e.slot['dia'] == dia and 
                                 e.slot['hora'] == hora), None)
                    
                    if evento:
                        materia = next((m for m in self.materias if m.id == evento.materia_id), None)
                        profesor = next((p for p in self.profesores if p.id == evento.profesor_id), None)
                        html += f"<td style='background: #dbeafe;'><b>{materia.nombre if materia else 'N/A'}</b><br>"
                        html += f"<small>{profesor.nombre if profesor else 'N/A'}</small></td>"
                    else:
                        html += "<td></td>"
                
                html += "</tr>"
            
            html += "</tbody></table><br>"
        
        return html
    
    # ==================== UTILIDADES ====================
    
    def _get_profesor_nombre(self, profesor_id: int) -> str:
        prof = next((p for p in self.profesores if p.id == profesor_id), None)
        return prof.nombre if prof else f"Profesor {profesor_id}"
    
    def _get_grupo_nombre(self, grupo_id: int) -> str:
        grupo = next((g for g in self.grupos if g.id == grupo_id), None)
        return grupo.nombre if grupo else f"Grupo {grupo_id}"
    
    def _get_aula_nombre(self, aula_id: int) -> str:
        aula = next((a for a in self.aulas if a.id == aula_id), None)
        return aula.nombre if aula else f"Aula {aula_id}"
    
    def guardar_solucion_json(self, ruta: str):
        """Guarda la solución actual en formato JSON"""
        
        solucion = {
            'metadata': {
                'fecha_generacion': datetime.now().isoformat(),
                'num_eventos': len(self.eventos),
                'calidad': self.mejor_solucion['calidad'] if self.mejor_solucion else 0
            },
            'eventos': [e.to_dict() for e in self.eventos],
            'conflictos': self.detectar_conflictos(),
            'log': self.log_ejecucion
        }
        
        with open(ruta, 'w', encoding='utf-8') as f:
            json.dump(solucion, f, indent=2, ensure_ascii=False)
        
        print(f"[✓] Solución guardada en {ruta}")


# ==================== FUNCIÓN PRINCIPAL ====================

def main():
    print("=" * 70)
    print("SISTEMA DE GENERACIÓN DE HORARIOS UNIVERSITARIOS - ITI UPV")
    print("Algoritmo: Búsqueda Tabú con optimización Cython")
    print("=" * 70)
    print()
    
    # Crear instancia del sistema
    sistema = SistemaHorariosITI()
    
    # Cargar datos
    ruta_datos = os.path.join(os.path.dirname(__file__), 'data', 'datos_iti.json')
    
    if os.path.exists(ruta_datos):
        sistema.cargar_datos_json(ruta_datos)
    else:
        print(f"[ERROR] No se encontró el archivo de datos: {ruta_datos}")
        print("[INFO] Por favor, crea el archivo con los datos de profesores, materias, etc.")
        return
    
    # Generar solución inicial
    sistema.generar_solucion_inicial()
    
    # Optimizar con Búsqueda Tabú
    if sistema.optimizar_con_tabu(max_iteraciones=1000, tamano_tabu=20):
        
        # Generar reportes
        ruta_reporte = os.path.join(os.path.dirname(__file__), 'horario_iti_final.html')
        sistema.generar_reporte_html(ruta_reporte)
        
        # Guardar solución en JSON
        ruta_json = os.path.join(os.path.dirname(__file__), 'solucion_final.json')
        sistema.guardar_solucion_json(ruta_json)
        
        # Mostrar estadísticas finales
        conflictos = sistema.detectar_conflictos()
        conflictos_duros = [c for c in conflictos if c['tipo'] == 'duro']
        conflictos_blandos = [c for c in conflictos if c['tipo'] == 'blando']
        
        print("\n" + "=" * 70)
        print("ESTADÍSTICAS FINALES")
        print("=" * 70)
        print(f"  Conflictos duros:   {len(conflictos_duros)}")
        print(f"  Conflictos blandos: {len(conflictos_blandos)}")
        print(f"  Calidad global:     {sistema.mejor_solucion['calidad']:.2f}%")
        print("=" * 70)
        print()

if __name__ == "__main__":
    main()
