# cython: language_level=3
# cython: boundscheck=False
# cython: wraparound=False
# cython: cdivision=True

"""
Módulo de Búsqueda Tabú optimizado para generación de horarios universitarios.
Implementación basada en la lógica de JavaScript con optimizaciones Cython.

Autor: Sistema de Horarios ITI
"""

import numpy as np
cimport numpy as cnp
from libc.stdlib cimport rand, srand, RAND_MAX
from libc.time cimport time as ctime
import time as pytime

# ==================== CLASE BÚSQUEDA TABÚ ====================

cdef class BusquedaTabu:
    """
    Implementación de Búsqueda Tabú para optimización de horarios.
    
    Restricciones Duras (conflictos):
    - Un profesor no puede estar en dos lugares al mismo tiempo
    - Un grupo no puede estar en dos lugares al mismo tiempo
    
    Restricciones Blandas (penalizaciones):
    - Minimizar huecos entre clases
    - Respetar turnos (matutino/vespertino)
    - Distribución equilibrada de clases en la semana
    """
    
    cdef:
        int max_iteraciones
        int tamano_lista_tabu
        int num_eventos
        int num_profesores
        int num_grupos
        int num_aulas
        
        # Matriz de eventos: [id, materia_id, profesor_id, grupo_id, aula_id, dia, hora]
        cnp.ndarray eventos_array
        
        # Matrices de ocupación: ocupacion[slot_id, recurso_id] = count
        # slot_id = dia * 14 + hora (0-69 para 5 días x 14 horas)
        cnp.ndarray profesores_ocupados
        cnp.ndarray grupos_ocupados
        
        # Lista tabú y solución
        list lista_tabu
        dict mejor_solucion
        int iteracion_actual
        
        # Información de grupos (vespertino/matutino)
        list grupos_vespertinos  # IDs de grupos vespertinos
        
        # Callbacks
        object callback_progreso
        object callback_log
        
    def __init__(self, int max_iter=1000, int tamano_tabu=30):
        """
        Inicializa el optimizador de Búsqueda Tabú.
        
        Args:
            max_iter: Máximo de iteraciones
            tamano_tabu: Tamaño de la lista tabú
        """
        self.max_iteraciones = max_iter
        self.tamano_lista_tabu = tamano_tabu
        self.lista_tabu = []
        self.iteracion_actual = 0
        self.grupos_vespertinos = []
        
        # Seed aleatorio
        srand(ctime(NULL))
        
    def inicializar(self, list eventos, int num_profesores, int num_grupos, int num_aulas, 
                    list grupos_info=None):
        """
        Inicializa las estructuras de datos con los eventos.
        
        Args:
            eventos: Lista de diccionarios con eventos
            num_profesores: Número total de profesores
            num_grupos: Número total de grupos
            num_aulas: Número de aulas
            grupos_info: Lista con información de grupos (nombre, turno)
        """
        self.num_eventos = len(eventos)
        self.num_profesores = max(num_profesores, 50)
        self.num_grupos = max(num_grupos, 20)
        self.num_aulas = max(num_aulas, 10)
        
        # Determinar grupos vespertinos
        self.grupos_vespertinos = []
        if grupos_info:
            for g in grupos_info:
                nombre = g.get('nombre', '')
                # ITI 1-1, ITI 2-3, ITI 5-3, ITI 8-2 son vespertinos
                if nombre == 'ITI 1-1' or '-3' in nombre or nombre == 'ITI 8-2':
                    self.grupos_vespertinos.append(g.get('id', 0))
        
        # Inicializar matriz de eventos
        self.eventos_array = np.zeros((self.num_eventos, 7), dtype=np.int32)
        
        cdef int i
        for i in range(self.num_eventos):
            e = eventos[i]
            self.eventos_array[i, 0] = e.get('id', i)
            self.eventos_array[i, 1] = e.get('materia_id', 0)
            self.eventos_array[i, 2] = e.get('profesor_id', 0)
            self.eventos_array[i, 3] = e.get('grupo_id', 0)
            self.eventos_array[i, 4] = e.get('aula_id', 0)
            
            slot = e.get('slot', {})
            self.eventos_array[i, 5] = slot.get('dia', -1)
            self.eventos_array[i, 6] = slot.get('hora', -1)
        
        # Inicializar matrices de ocupación
        self.profesores_ocupados = np.zeros((70, self.num_profesores), dtype=np.int32)
        self.grupos_ocupados = np.zeros((70, self.num_grupos), dtype=np.int32)
        
        # Llenar ocupación inicial si hay slots asignados
        self._actualizar_matrices_ocupacion()
        
        # Inicializar lista tabú
        self.lista_tabu = []
        self.iteracion_actual = 0
        
    cdef void _actualizar_matrices_ocupacion(self):
        """Recalcula las matrices de ocupación basándose en eventos_array"""
        cdef int i, slot_id, profesor_id, grupo_id, dia, hora
        
        # Limpiar matrices
        self.profesores_ocupados.fill(0)
        self.grupos_ocupados.fill(0)
        
        for i in range(self.num_eventos):
            dia = self.eventos_array[i, 5]
            hora = self.eventos_array[i, 6]
            
            if dia >= 0 and hora >= 0:
                slot_id = dia * 14 + hora
                profesor_id = self.eventos_array[i, 2]
                grupo_id = self.eventos_array[i, 3]
                
                if profesor_id < self.num_profesores:
                    self.profesores_ocupados[slot_id, profesor_id] += 1
                if grupo_id < self.num_grupos:
                    self.grupos_ocupados[slot_id, grupo_id] += 1
    
    cdef int _calcular_conflictos_duros(self):
        """
        Calcula conflictos duros (restricciones violadas).
        Un conflicto = mismo profesor O mismo grupo en el mismo slot.
        """
        cdef int conflictos = 0
        cdef int slot_id, recurso
        cdef int val
        
        # Conflictos de profesores - usar memoria contigua
        cdef cnp.int32_t[:, :] prof_view = self.profesores_ocupados
        cdef cnp.int32_t[:, :] grupo_view = self.grupos_ocupados
        
        for slot_id in range(70):
            for recurso in range(self.num_profesores):
                val = prof_view[slot_id, recurso]
                if val > 1:
                    conflictos += val - 1
        
        for slot_id in range(70):
            for recurso in range(self.num_grupos):
                val = grupo_view[slot_id, recurso]
                if val > 1:
                    conflictos += val - 1
        
        return conflictos
    
    cdef int _calcular_conflicto_en_slot(self, int slot_id, int profesor_id, int grupo_id):
        """Calcula conflictos solo en un slot específico - O(1)"""
        cdef int conf = 0
        if profesor_id < self.num_profesores and self.profesores_ocupados[slot_id, profesor_id] > 1:
            conf += self.profesores_ocupados[slot_id, profesor_id] - 1
        if grupo_id < self.num_grupos and self.grupos_ocupados[slot_id, grupo_id] > 1:
            conf += self.grupos_ocupados[slot_id, grupo_id] - 1
        return conf
    
    cdef int _calcular_conflictos_blandos(self):
        """
        Calcula penalizaciones de restricciones blandas.
        - Huecos entre clases
        - Clases fuera de turno
        """
        cdef int penalizacion = 0
        cdef int grupo, dia, hora, slot_id
        cdef int primera_clase, ultima_clase, clases_dia, huecos
        
        # Para cada grupo, contar huecos
        for grupo in range(self.num_grupos):
            for dia in range(5):
                primera_clase = -1
                ultima_clase = -1
                clases_dia = 0
                
                for hora in range(14):
                    slot_id = dia * 14 + hora
                    if self.grupos_ocupados[slot_id, grupo] > 0:
                        if primera_clase < 0:
                            primera_clase = hora
                        ultima_clase = hora
                        clases_dia += 1
                
                # Huecos = diferencia entre primera y última clase menos clases
                if primera_clase >= 0 and clases_dia > 1:
                    huecos = (ultima_clase - primera_clase + 1) - clases_dia
                    penalizacion += huecos
        
        return penalizacion
    
    def asignar_slots_iniciales(self, list grupos_info=None):
        """
        Asigna slots iniciales a eventos sin asignar.
        Respeta turnos matutino/vespertino y evita conflictos iniciales.
        """
        cdef int i, dia, hora, slot_id
        cdef int grupo_id, profesor_id, materia_id
        cdef int hora_inicio, hora_fin
        cdef bint asignado, grupo_libre, prof_libre
        
        # Actualizar grupos vespertinos si se proporciona info
        if grupos_info:
            self.grupos_vespertinos = []
            for g in grupos_info:
                nombre = g.get('nombre', '')
                if nombre == 'ITI 1-1' or '-3' in nombre or nombre == 'ITI 8-2':
                    self.grupos_vespertinos.append(g.get('id', 0))
        
        # Matrices temporales para asignación
        cdef cnp.ndarray[cnp.int32_t, ndim=2] temp_prof = np.zeros((70, self.num_profesores), dtype=np.int32)
        cdef cnp.ndarray[cnp.int32_t, ndim=2] temp_grupo = np.zeros((70, self.num_grupos), dtype=np.int32)
        
        # Primero marcar los que ya tienen slot
        for i in range(self.num_eventos):
            dia = self.eventos_array[i, 5]
            hora = self.eventos_array[i, 6]
            if dia >= 0 and hora >= 0:
                slot_id = dia * 14 + hora
                profesor_id = self.eventos_array[i, 2]
                grupo_id = self.eventos_array[i, 3]
                if profesor_id < self.num_profesores:
                    temp_prof[slot_id, profesor_id] += 1
                if grupo_id < self.num_grupos:
                    temp_grupo[slot_id, grupo_id] += 1
        
        # Agrupar eventos sin asignar por grupo y materia
        eventos_sin_asignar = {}
        for i in range(self.num_eventos):
            if self.eventos_array[i, 5] < 0 or self.eventos_array[i, 6] < 0:
                grupo_id = self.eventos_array[i, 3]
                materia_id = self.eventos_array[i, 1]
                key = (grupo_id, materia_id)
                if key not in eventos_sin_asignar:
                    eventos_sin_asignar[key] = []
                eventos_sin_asignar[key].append(i)
        
        # Asignar por grupo/materia distribuyendo en 5 días
        for key_tuple in eventos_sin_asignar:
            grupo_id = key_tuple[0]
            materia_id = key_tuple[1]
            indices = eventos_sin_asignar[key_tuple]
            
            # Determinar turno
            es_vespertino = grupo_id in self.grupos_vespertinos
            hora_inicio = 7 if es_vespertino else 0
            hora_fin = 13 if es_vespertino else 7
            
            profesor_id = self.eventos_array[indices[0], 2]
            total_horas = len(indices)
            max_horas_dia = 2 if total_horas > 3 else 1
            
            idx_asignado = 0
            
            # Distribuir en los 5 días
            for ciclo in range(3):
                if idx_asignado >= total_horas:
                    break
                    
                for dia in range(5):
                    if idx_asignado >= total_horas:
                        break
                    
                    horas_este_dia = 0
                    
                    for hora in range(hora_inicio, hora_fin + 1):
                        if idx_asignado >= total_horas or horas_este_dia >= max_horas_dia:
                            break
                        
                        slot_id = dia * 14 + hora
                        
                        # Verificar disponibilidad
                        grupo_libre = grupo_id >= self.num_grupos or temp_grupo[slot_id, grupo_id] == 0
                        prof_libre = profesor_id >= self.num_profesores or temp_prof[slot_id, profesor_id] == 0
                        
                        if grupo_libre and prof_libre:
                            event_idx = indices[idx_asignado]
                            self.eventos_array[event_idx, 5] = dia
                            self.eventos_array[event_idx, 6] = hora
                            
                            if grupo_id < self.num_grupos:
                                temp_grupo[slot_id, grupo_id] += 1
                            if profesor_id < self.num_profesores:
                                temp_prof[slot_id, profesor_id] += 1
                            
                            idx_asignado += 1
                            horas_este_dia += 1
            
            # Si quedan sin asignar, expandir búsqueda
            while idx_asignado < total_horas:
                asignado = False
                for dia in range(5):
                    for hora in range(14):
                        slot_id = dia * 14 + hora
                        
                        grupo_libre = grupo_id >= self.num_grupos or temp_grupo[slot_id, grupo_id] == 0
                        prof_libre = profesor_id >= self.num_profesores or temp_prof[slot_id, profesor_id] == 0
                        
                        if grupo_libre and prof_libre:
                            event_idx = indices[idx_asignado]
                            self.eventos_array[event_idx, 5] = dia
                            self.eventos_array[event_idx, 6] = hora
                            
                            if grupo_id < self.num_grupos:
                                temp_grupo[slot_id, grupo_id] += 1
                            if profesor_id < self.num_profesores:
                                temp_prof[slot_id, profesor_id] += 1
                            
                            idx_asignado += 1
                            asignado = True
                            break
                    if asignado:
                        break
                
                if not asignado:
                    # Forzar asignación aunque cause conflicto de profesor
                    for dia in range(5):
                        for hora in range(14):
                            slot_id = dia * 14 + hora
                            if grupo_id >= self.num_grupos or temp_grupo[slot_id, grupo_id] == 0:
                                event_idx = indices[idx_asignado]
                                self.eventos_array[event_idx, 5] = dia
                                self.eventos_array[event_idx, 6] = hora
                                
                                if grupo_id < self.num_grupos:
                                    temp_grupo[slot_id, grupo_id] += 1
                                if profesor_id < self.num_profesores:
                                    temp_prof[slot_id, profesor_id] += 1
                                
                                idx_asignado += 1
                                asignado = True
                                break
                        if asignado:
                            break
                
                if not asignado:
                    break  # No se pudo asignar
        
        # Actualizar matrices de ocupación
        self._actualizar_matrices_ocupacion()
    
    def ejecutar(self, dict datos_adicionales=None, callback_progreso=None, callback_log=None):
        """
        Ejecuta el algoritmo de Búsqueda Tabú para minimizar conflictos.
        Siempre ejecuta TODAS las iteraciones configuradas.
        GUARDA LA MEJOR SOLUCIÓN Y LA RESTAURA AL FINAL.
        
        Returns:
            dict con la mejor solución encontrada
        """
        if datos_adicionales is None:
            datos_adicionales = {}
        
        self.callback_progreso = callback_progreso
        self.callback_log = callback_log
        
        cdef double tiempo_inicio = pytime.time()
        cdef int mejor_conflictos_historico = 999999
        cdef int mejor_blandos_historico = 999999
        
        # Evaluar solución inicial
        cdef int conflictos_inicial = self._calcular_conflictos_duros()
        cdef int blandos_inicial = self._calcular_conflictos_blandos()
        cdef double calidad_inicial = self._calcular_calidad(conflictos_inicial, blandos_inicial)
        
        # GUARDAR COPIA DE LA MEJOR SOLUCIÓN (array de slots: dia, hora por evento)
        cdef cnp.ndarray[cnp.int32_t, ndim=2] mejor_slots = np.zeros((self.num_eventos, 2), dtype=np.int32)
        cdef int i
        for i in range(self.num_eventos):
            mejor_slots[i, 0] = self.eventos_array[i, 5]  # dia
            mejor_slots[i, 1] = self.eventos_array[i, 6]  # hora
        
        self.mejor_solucion = {
            'conflictos_duros': conflictos_inicial,
            'penalizacion_blandas': blandos_inicial,
            'calidad': calidad_inicial
        }
        mejor_conflictos_historico = conflictos_inicial
        mejor_blandos_historico = blandos_inicial
        
        if self.callback_log:
            self.callback_log(f"[INICIO] Ejecutando {self.max_iteraciones} iteraciones...")
            self.callback_log(f"[INFO] Solución inicial - Conflictos: {conflictos_inicial}, Blandos: {blandos_inicial}, Calidad: {calidad_inicial:.1f}%")
        
        # Variables para la búsqueda
        cdef int conflictos_actual, blandos_actual
        cdef double calidad_actual
        cdef bint hubo_mejora
        
        # ===== BÚSQUEDA TABÚ - EJECUTAR TODAS LAS ITERACIONES =====
        for self.iteracion_actual in range(self.max_iteraciones):
            
            # En cada iteración, explorar vecindario y hacer el mejor movimiento
            hubo_mejora = self._explorar_y_mover()
            
            # Evaluar nueva solución
            conflictos_actual = self._calcular_conflictos_duros()
            blandos_actual = self._calcular_conflictos_blandos()
            calidad_actual = self._calcular_calidad(conflictos_actual, blandos_actual)
            
            # Actualizar mejor solución si mejora
            if conflictos_actual < mejor_conflictos_historico or \
               (conflictos_actual == mejor_conflictos_historico and blandos_actual < mejor_blandos_historico):
                
                mejor_conflictos_historico = conflictos_actual
                mejor_blandos_historico = blandos_actual
                
                # GUARDAR COPIA DE ESTA MEJOR SOLUCIÓN
                for i in range(self.num_eventos):
                    mejor_slots[i, 0] = self.eventos_array[i, 5]
                    mejor_slots[i, 1] = self.eventos_array[i, 6]
                
                self.mejor_solucion = {
                    'conflictos_duros': conflictos_actual,
                    'penalizacion_blandas': blandos_actual,
                    'calidad': calidad_actual
                }
                
                if self.callback_log:
                    self.callback_log(f"[MEJORA] Iter {self.iteracion_actual}: "
                                    f"Conflictos={conflictos_actual}, Blandos={blandos_actual}, "
                                    f"Calidad={calidad_actual:.1f}%")
            
            # Callback de progreso cada 10 iteraciones
            if self.callback_progreso and self.iteracion_actual % 10 == 0:
                progreso = ((self.iteracion_actual + 1) / self.max_iteraciones) * 100
                self.callback_progreso(progreso, self.mejor_solucion)
            
            # Log de progreso cada 100 iteraciones
            if self.callback_log and self.iteracion_actual % 100 == 0 and self.iteracion_actual > 0:
                self.callback_log(f"[PROGRESO] Iter {self.iteracion_actual}/{self.max_iteraciones} - "
                                f"Mejor: {mejor_conflictos_historico} conflictos, {self.mejor_solucion['calidad']:.1f}%")
            
            # Limpiar lista tabú
            self._limpiar_lista_tabu()
        
        # ===== RESTAURAR LA MEJOR SOLUCIÓN ENCONTRADA =====
        for i in range(self.num_eventos):
            self.eventos_array[i, 5] = mejor_slots[i, 0]
            self.eventos_array[i, 6] = mejor_slots[i, 1]
        
        # Actualizar matrices de ocupación con la mejor solución
        self._actualizar_matrices_ocupacion()
        
        tiempo_total = pytime.time() - tiempo_inicio
        
        if self.callback_log:
            self.callback_log(f"[FINALIZADO] {self.max_iteraciones} iteraciones en {tiempo_total:.2f}s")
            self.callback_log(f"[RESULTADO] Conflictos duros: {self.mejor_solucion['conflictos_duros']}")
            self.callback_log(f"[RESULTADO] Penalización blandas: {self.mejor_solucion['penalizacion_blandas']}")
            self.callback_log(f"[RESULTADO] Calidad final: {self.mejor_solucion['calidad']:.2f}%")
        
        return self.mejor_solucion
    
    cdef bint _explorar_y_mover(self):
        """
        Explora el vecindario completo y hace el mejor movimiento posible.
        USA CÁLCULO INCREMENTAL DE CONFLICTOS (O(1) por candidato)
        Retorna True si se hizo un movimiento.
        """
        cdef int i, dia, hora, slot_nuevo
        cdef int evento_id, profesor_id, grupo_id
        cdef int dia_orig, hora_orig, slot_orig
        cdef int delta_conflictos
        cdef int mejor_delta = 999999
        
        cdef int mejor_evento_idx = -1
        cdef int mejor_dia = -1
        cdef int mejor_hora = -1
        
        # Seleccionar un evento aleatorio para mover
        cdef int idx = rand() % self.num_eventos
        
        evento_id = self.eventos_array[idx, 0]
        profesor_id = self.eventos_array[idx, 2]
        grupo_id = self.eventos_array[idx, 3]
        dia_orig = self.eventos_array[idx, 5]
        hora_orig = self.eventos_array[idx, 6]
        
        if dia_orig < 0 or hora_orig < 0:
            return False
        
        slot_orig = dia_orig * 14 + hora_orig
        
        # Conflictos actuales en el slot original (ANTES de mover)
        cdef int conf_orig_antes = 0
        if profesor_id < self.num_profesores:
            if self.profesores_ocupados[slot_orig, profesor_id] > 1:
                conf_orig_antes += self.profesores_ocupados[slot_orig, profesor_id] - 1
        if grupo_id < self.num_grupos:
            if self.grupos_ocupados[slot_orig, grupo_id] > 1:
                conf_orig_antes += self.grupos_ocupados[slot_orig, grupo_id] - 1
        
        # Probar todos los slots posibles
        cdef int conf_orig_despues, conf_nuevo_despues, conf_nuevo_antes
        
        for dia in range(5):
            for hora in range(14):
                if dia == dia_orig and hora == hora_orig:
                    continue
                
                # Verificar lista tabú
                key = (evento_id, dia, hora)
                if key in self.lista_tabu:
                    continue
                
                slot_nuevo = dia * 14 + hora
                
                # Calcular delta de conflictos de forma INCREMENTAL (O(1))
                
                # Conflictos en slot original DESPUÉS de quitar evento
                conf_orig_despues = 0
                if profesor_id < self.num_profesores:
                    if self.profesores_ocupados[slot_orig, profesor_id] - 1 > 1:
                        conf_orig_despues += self.profesores_ocupados[slot_orig, profesor_id] - 2
                if grupo_id < self.num_grupos:
                    if self.grupos_ocupados[slot_orig, grupo_id] - 1 > 1:
                        conf_orig_despues += self.grupos_ocupados[slot_orig, grupo_id] - 2
                
                # Conflictos en slot nuevo ANTES de añadir evento
                conf_nuevo_antes = 0
                if profesor_id < self.num_profesores:
                    if self.profesores_ocupados[slot_nuevo, profesor_id] > 1:
                        conf_nuevo_antes += self.profesores_ocupados[slot_nuevo, profesor_id] - 1
                if grupo_id < self.num_grupos:
                    if self.grupos_ocupados[slot_nuevo, grupo_id] > 1:
                        conf_nuevo_antes += self.grupos_ocupados[slot_nuevo, grupo_id] - 1
                
                # Conflictos en slot nuevo DESPUÉS de añadir evento
                conf_nuevo_despues = 0
                if profesor_id < self.num_profesores:
                    if self.profesores_ocupados[slot_nuevo, profesor_id] + 1 > 1:
                        conf_nuevo_despues += self.profesores_ocupados[slot_nuevo, profesor_id]
                if grupo_id < self.num_grupos:
                    if self.grupos_ocupados[slot_nuevo, grupo_id] + 1 > 1:
                        conf_nuevo_despues += self.grupos_ocupados[slot_nuevo, grupo_id]
                
                # Delta = (conflictos después - conflictos antes)
                delta_conflictos = (conf_orig_despues + conf_nuevo_despues) - (conf_orig_antes + conf_nuevo_antes)
                
                if delta_conflictos < mejor_delta:
                    mejor_delta = delta_conflictos
                    mejor_evento_idx = idx
                    mejor_dia = dia
                    mejor_hora = hora
        
        # Aplicar mejor movimiento
        if mejor_evento_idx >= 0 and mejor_dia >= 0:
            slot_nuevo = mejor_dia * 14 + mejor_hora
            
            if profesor_id < self.num_profesores:
                self.profesores_ocupados[slot_orig, profesor_id] -= 1
                self.profesores_ocupados[slot_nuevo, profesor_id] += 1
            if grupo_id < self.num_grupos:
                self.grupos_ocupados[slot_orig, grupo_id] -= 1
                self.grupos_ocupados[slot_nuevo, grupo_id] += 1
            
            self.eventos_array[idx, 5] = mejor_dia
            self.eventos_array[idx, 6] = mejor_hora
            
            # Agregar a lista tabú
            self.lista_tabu.append((evento_id, dia_orig, hora_orig))
            if len(self.lista_tabu) > self.tamano_lista_tabu:
                self.lista_tabu.pop(0)
            
            return True
        
        return False
    
    cdef double _calcular_calidad(self, int conflictos, int blandos):
        """Calcula la calidad de la solución (0-100%)"""
        if conflictos > 0:
            # Con conflictos duros, calidad baja
            return max(0.0, 50.0 - conflictos * 5)
        else:
            # Sin conflictos duros, calidad depende de blandos
            return max(0.0, 100.0 - blandos * 2)
    
    cdef list _encontrar_eventos_con_conflicto(self):
        """Encuentra índices de eventos que tienen conflictos"""
        cdef list eventos_conflicto = []
        cdef int i, slot_id, profesor_id, grupo_id, dia, hora
        
        for i in range(self.num_eventos):
            dia = self.eventos_array[i, 5]
            hora = self.eventos_array[i, 6]
            
            if dia < 0 or hora < 0:
                continue
            
            slot_id = dia * 14 + hora
            profesor_id = self.eventos_array[i, 2]
            grupo_id = self.eventos_array[i, 3]
            
            # Verificar si hay conflicto
            tiene_conflicto = False
            
            if profesor_id < self.num_profesores and self.profesores_ocupados[slot_id, profesor_id] > 1:
                tiene_conflicto = True
            
            if grupo_id < self.num_grupos and self.grupos_ocupados[slot_id, grupo_id] > 1:
                tiene_conflicto = True
            
            if tiene_conflicto:
                eventos_conflicto.append(i)
        
        return eventos_conflicto
    
    cdef bint _intentar_mejora(self, list eventos_conflicto):
        """Intenta mover un evento conflictivo a un mejor slot"""
        if len(eventos_conflicto) == 0:
            return False
        
        # Seleccionar evento aleatorio
        cdef int idx = eventos_conflicto[rand() % len(eventos_conflicto)]
        cdef int evento_id = self.eventos_array[idx, 0]
        cdef int profesor_id = self.eventos_array[idx, 2]
        cdef int grupo_id = self.eventos_array[idx, 3]
        cdef int dia_orig = self.eventos_array[idx, 5]
        cdef int hora_orig = self.eventos_array[idx, 6]
        
        cdef int mejor_dia = -1
        cdef int mejor_hora = -1
        cdef int menor_conflictos = self._calcular_conflictos_duros()
        
        cdef int dia, hora, slot_id, slot_orig, slot_nuevo
        cdef int conflictos_temp
        
        # Probar todos los slots posibles
        for dia in range(5):
            for hora in range(14):
                # Verificar si está en lista tabú
                key = (evento_id, dia, hora)
                if key in self.lista_tabu:
                    continue
                
                # Simular movimiento
                slot_orig = dia_orig * 14 + hora_orig
                slot_nuevo = dia * 14 + hora
                
                # Actualizar ocupación temporalmente
                if profesor_id < self.num_profesores:
                    self.profesores_ocupados[slot_orig, profesor_id] -= 1
                    self.profesores_ocupados[slot_nuevo, profesor_id] += 1
                if grupo_id < self.num_grupos:
                    self.grupos_ocupados[slot_orig, grupo_id] -= 1
                    self.grupos_ocupados[slot_nuevo, grupo_id] += 1
                
                # Calcular conflictos con el movimiento
                conflictos_temp = self._calcular_conflictos_duros()
                
                if conflictos_temp < menor_conflictos:
                    menor_conflictos = conflictos_temp
                    mejor_dia = dia
                    mejor_hora = hora
                
                # Revertir
                if profesor_id < self.num_profesores:
                    self.profesores_ocupados[slot_orig, profesor_id] += 1
                    self.profesores_ocupados[slot_nuevo, profesor_id] -= 1
                if grupo_id < self.num_grupos:
                    self.grupos_ocupados[slot_orig, grupo_id] += 1
                    self.grupos_ocupados[slot_nuevo, grupo_id] -= 1
        
        # Aplicar mejor movimiento si es mejor
        if mejor_dia >= 0 and mejor_hora >= 0:
            slot_orig = dia_orig * 14 + hora_orig
            slot_nuevo = mejor_dia * 14 + mejor_hora
            
            # Actualizar ocupación
            if profesor_id < self.num_profesores:
                self.profesores_ocupados[slot_orig, profesor_id] -= 1
                self.profesores_ocupados[slot_nuevo, profesor_id] += 1
            if grupo_id < self.num_grupos:
                self.grupos_ocupados[slot_orig, grupo_id] -= 1
                self.grupos_ocupados[slot_nuevo, grupo_id] += 1
            
            # Actualizar evento
            self.eventos_array[idx, 5] = mejor_dia
            self.eventos_array[idx, 6] = mejor_hora
            
            # Agregar a lista tabú (movimiento inverso)
            self.lista_tabu.append((evento_id, dia_orig, hora_orig))
            if len(self.lista_tabu) > self.tamano_lista_tabu:
                self.lista_tabu.pop(0)
            
            return True
        
        return False
    
    cdef void _limpiar_lista_tabu(self):
        """Limpia movimientos antiguos de la lista tabú"""
        # Mantener solo los últimos N movimientos
        if len(self.lista_tabu) > self.tamano_lista_tabu:
            self.lista_tabu = self.lista_tabu[-self.tamano_lista_tabu:]
    
    cdef void _intentar_compactar(self):
        """
        Intenta compactar horarios moviendo eventos para reducir huecos.
        Solo se usa cuando no hay conflictos duros.
        """
        cdef int i, grupo, dia, hora, slot_id
        cdef int profesor_id, grupo_id
        cdef int mejor_hora, slot_orig, slot_nuevo
        cdef bint movido
        
        # Para cada grupo, intentar eliminar huecos
        for grupo in range(self.num_grupos):
            for dia in range(5):
                # Encontrar eventos de este grupo en este día
                eventos_dia = []
                for i in range(self.num_eventos):
                    if self.eventos_array[i, 3] == grupo and self.eventos_array[i, 5] == dia:
                        eventos_dia.append((i, self.eventos_array[i, 6]))  # (idx, hora)
                
                if len(eventos_dia) <= 1:
                    continue
                
                # Ordenar por hora
                eventos_dia.sort(key=lambda x: x[1])
                
                # Intentar mover para eliminar huecos
                for j in range(1, len(eventos_dia)):
                    idx_actual = eventos_dia[j][0]
                    hora_actual = eventos_dia[j][1]
                    hora_anterior = eventos_dia[j-1][1]
                    
                    # Si hay hueco
                    if hora_actual - hora_anterior > 1:
                        mejor_hora = hora_anterior + 1
                        profesor_id = self.eventos_array[idx_actual, 2]
                        grupo_id = self.eventos_array[idx_actual, 3]
                        
                        slot_nuevo = dia * 14 + mejor_hora
                        
                        # Verificar si el profesor está libre en ese slot
                        if profesor_id < self.num_profesores and self.profesores_ocupados[slot_nuevo, profesor_id] > 0:
                            continue
                        
                        # Mover evento
                        slot_orig = dia * 14 + hora_actual
                        
                        if profesor_id < self.num_profesores:
                            self.profesores_ocupados[slot_orig, profesor_id] -= 1
                            self.profesores_ocupados[slot_nuevo, profesor_id] += 1
                        if grupo_id < self.num_grupos:
                            self.grupos_ocupados[slot_orig, grupo_id] -= 1
                            self.grupos_ocupados[slot_nuevo, grupo_id] += 1
                        
                        self.eventos_array[idx_actual, 6] = mejor_hora
                        eventos_dia[j] = (idx_actual, mejor_hora)

    def obtener_eventos(self):
        """
        Retorna los eventos actuales como lista de diccionarios.
        Compatible con el formato esperado por la interfaz web.
        """
        eventos = []
        for i in range(self.num_eventos):
            eventos.append({
                'id': int(self.eventos_array[i, 0]),
                'materia_id': int(self.eventos_array[i, 1]),
                'profesor_id': int(self.eventos_array[i, 2]),
                'grupo_id': int(self.eventos_array[i, 3]),
                'aula_id': int(self.eventos_array[i, 4]),
                'slot': {
                    'dia': int(self.eventos_array[i, 5]),
                    'hora': int(self.eventos_array[i, 6])
                }
            })
        return eventos
    
    def optimizar(self, dict datos_adicionales=None, callback_progreso=None, callback_log=None,
                  list grupos_info=None):
        """
        Método wrapper para ejecutar la optimización completa.
        
        1. Asigna slots iniciales a eventos sin asignar
        2. Ejecuta Búsqueda Tabú para minimizar conflictos
        
        Args:
            datos_adicionales: Datos extra para la optimización
            callback_progreso: Función callback para progreso
            callback_log: Función callback para logs
            grupos_info: Información de grupos (turno, nombre)
        
        Returns:
            dict con resultado de la optimización
        """
        if datos_adicionales is None:
            datos_adicionales = {}
        
        tiempo_inicio = pytime.time()
        
        if callback_log:
            callback_log(f"[INICIO] Optimización Cython con {self.num_eventos} eventos...")
        
        # Paso 1: Asignar slots iniciales
        self.asignar_slots_iniciales(grupos_info)
        
        conflictos_inicial = self._calcular_conflictos_duros()
        if callback_log:
            callback_log(f"[INFO] Slots iniciales asignados. Conflictos iniciales: {conflictos_inicial}")
        
        # Paso 2: Ejecutar Búsqueda Tabú
        resultado = self.ejecutar(datos_adicionales, callback_progreso, callback_log)
        
        tiempo_total = pytime.time() - tiempo_inicio
        resultado['tiempo_ejecucion'] = tiempo_total
        resultado['iteraciones'] = self.iteracion_actual
        
        if callback_log:
            callback_log(f"[FINALIZADO] Optimización completada en {tiempo_total:.2f}s")
        
        return resultado
    
    def get_estadisticas(self):
        """Retorna estadísticas de la solución actual"""
        conflictos = self._calcular_conflictos_duros()
        blandos = self._calcular_conflictos_blandos()
        
        return {
            'num_eventos': self.num_eventos,
            'num_profesores': self.num_profesores,
            'num_grupos': self.num_grupos,
            'conflictos_duros': conflictos,
            'conflictos_blandos': blandos,
            'calidad': self._calcular_calidad(conflictos, blandos),
            'iteraciones': self.iteracion_actual
        }

