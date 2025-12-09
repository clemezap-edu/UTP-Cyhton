# Documentación Técnica - Sistema de Horarios ITI

## Arquitectura del Sistema

### Capas de la Aplicación

```
┌─────────────────────────────────────────────┐
│         Interfaz Web (HTML/JS)              │
│         - Visualización interactiva         │
│         - Gestión de datos                  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│      Capa de Lógica (Python)                │
│      - sistema_horarios.py                  │
│      - Gestión de eventos                   │
│      - E/S de datos                         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   Motor de Optimización (Cython)            │
│   - busqueda_tabu.pyx                       │
│   - Algoritmos optimizados                  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   Estructuras de Datos (C++)                │
│   - Grafos (lista de adyacencia)            │
│   - Listas enlazadas (Lista Tabú)           │
└─────────────────────────────────────────────┘
```

## Detalles de Implementación

### 1. Estructuras de Datos C++

#### Grafo de Conflictos
```cpp
class GrafoConflictos {
private:
    int num_vertices;
    Arista** lista_adyacencia;
    
public:
    void agregar_arista(int u, int v);
    bool existe_conflicto(int u, int v);
};
```

**Complejidad:**
- Agregar arista: O(1)
- Verificar conflicto: O(grado(v))
- Espacio: O(V + E)

#### Lista Tabú
```cpp
class ListaTabu {
private:
    NodoTabu* inicio;
    int capacidad_maxima;
    
public:
    void agregar(Movimiento mov);
    bool es_tabu(int evento_id, Slot slot, int iter);
};
```

**Características:**
- Estructura: Lista enlazada simple
- Inserción: O(1) al inicio
- Búsqueda: O(n) donde n = tamaño_lista_tabu (típicamente 10-20)
- Eliminación automática de movimientos expirados

### 2. Algoritmo de Búsqueda Tabú (Cython)

#### Pseudocódigo

```python
def busqueda_tabu(solucion_inicial, max_iter, tamano_tabu):
    mejor_solucion = solucion_inicial
    solucion_actual = solucion_inicial
    lista_tabu = []
    
    for iter in range(max_iter):
        vecindario = generar_vecindario(solucion_actual)
        
        # Filtrar movimientos tabú
        vecindario_valido = [v for v in vecindario 
                            if not es_tabu(v) or 
                            criterio_aspiracion(v, mejor_solucion)]
        
        # Seleccionar mejor vecino
        mejor_vecino = max(vecindario_valido, key=evaluar)
        
        # Aplicar movimiento
        solucion_actual = aplicar(mejor_vecino)
        agregar_a_tabu(mejor_vecino.movimiento_inverso)
        
        # Actualizar mejor solución
        if evaluar(solucion_actual) > evaluar(mejor_solucion):
            mejor_solucion = solucion_actual
    
    return mejor_solucion
```

#### Optimizaciones Cython

1. **Tipos Estáticos**
```cython
cdef int _calcular_conflictos_duros(self):
    cdef int conflictos = 0
    cdef int slot, recurso
    # ...
```

2. **Arrays NumPy Tipados**
```cython
cdef cnp.ndarray[cnp.int32_t, ndim=2] eventos = self.eventos_array
```

3. **Desactivación de Comprobaciones**
```cython
# cython: boundscheck=False
# cython: wraparound=False
```

### 3. Función Objetivo

```
f(S) = α * conflictos_duros(S) + penalizacion_blandas(S)

donde:
    α = 1000 (peso muy alto para forzar factibilidad)
    
penalizacion_blandas(S) = 
    10 * horas_libres(S) +
     8 * desbalance_distribucion(S) +
     5 * horarios_extremos(S) +
    15 * violacion_preferencias(S) +
     7 * dias_no_completos(S)
```

**Objetivo:** Minimizar f(S)

### 4. Generación de Vecindario

#### Operadores de Movimiento

1. **Cambio de Slot**
   - Selecciona un evento aleatorio
   - Prueba moverlo a un slot aleatorio
   - Complejidad: O(1)

2. **Intercambio de Slots**
   - Selecciona dos eventos aleatorios
   - Intercambia sus slots
   - Complejidad: O(1)

3. **Cambio de Día**
   - Selecciona un evento
   - Lo mueve a la misma hora pero otro día
   - Complejidad: O(1)

**Tamaño del vecindario explorado por iteración:** 50 movimientos

### 5. Complejidad Computacional

#### Análisis Temporal

- **Inicialización:** O(E) donde E = número de eventos
- **Evaluar solución:** O(E + S*R) donde S = slots, R = recursos
- **Generar vecino:** O(1)
- **Actualizar matrices:** O(E)
- **Iteración completa:** O(N * E) donde N = vecindario explorado

**Total por iteración:** O(N * E + E + S*R) ≈ O(N * E)

Para E ≈ 200 eventos, N = 50, una iteración toma ~1-5ms en hardware moderno.

#### Análisis Espacial

- **Matrices de ocupación:** O(S * R) = O(70 * 30) = O(2100) → despreciable
- **Eventos:** O(E)
- **Lista Tabú:** O(T) donde T = tamaño_lista_tabu ≈ 20
- **Grafo:** O(V + E_grafo) (no usado en implementación Cython actual)

**Total:** O(E + T) ≈ O(E)

### 6. Formato de Datos

#### Slot ID
```
slot_id = dia * 14 + hora
donde:
    dia ∈ [0, 4]  (Lunes=0, ..., Viernes=4)
    hora ∈ [0, 13] (7:00=0, 7:55=1, ..., 19:50=13)
    
Total slots: 5 * 14 = 70
```

#### Representación de Eventos (NumPy)
```python
eventos_array[i] = [
    id,           # int
    materia_id,   # int
    profesor_id,  # int
    grupo_id,     # int
    aula_id,      # int
    dia,          # int [0-4]
    hora          # int [0-13]
]
```

### 7. Mejoras Futuras

#### Corto Plazo
- [ ] Implementar operador de intercambio múltiple
- [ ] Agregar restricción de colores en el grafo
- [ ] Mejorar criterio de aspiración
- [ ] Paralelización de evaluación de vecindario

#### Mediano Plazo
- [ ] Algoritmo genético híbrido
- [ ] Simulated Annealing complementario
- [ ] Machine Learning para ajuste de pesos
- [ ] Visualización 3D de convergencia

#### Largo Plazo
- [ ] Solver distribuido (múltiples nodos)
- [ ] Interfaz gráfica nativa (Qt/GTK)
- [ ] API REST para integración
- [ ] Aplicación móvil

## Benchmarks

### Rendimiento (Hardware de referencia: Intel i5-8250U, 8GB RAM)

| Eventos | Iteraciones | Tiempo Total | Memoria |
|---------|-------------|--------------|---------|
| 50      | 1000        | ~2s          | 50MB    |
| 100     | 1000        | ~5s          | 75MB    |
| 200     | 1000        | ~12s         | 120MB   |
| 500     | 1000        | ~45s         | 250MB   |

### Calidad de Soluciones

| Tamaño | Conflictos Duros | Calidad Promedio |
|--------|------------------|------------------|
| Pequeño (< 100 eventos) | 0 | 95% |
| Mediano (100-300) | 0-2 | 87% |
| Grande (> 300) | 2-5 | 78% |

## Referencias Técnicas

1. **Glover, F. (1989).** Tabu Search - Part I. *ORSA Journal on Computing*, 1(3), 190-206.

2. **Burke, E. K., et al. (2007).** A graph-based hyper-heuristic for educational timetabling problems. *European Journal of Operational Research*, 176(1), 177-192.

3. **Lewis, R. (2008).** A survey of metaheuristic-based techniques for University Timetabling problems. *OR Spectrum*, 30(1), 167-190.

4. **Python Software Foundation.** Cython Documentation. https://cython.readthedocs.io/

---

**Última actualización:** Diciembre 2025  
**Autores:** Carlos Vargas, Eliezer Mores, Mauricio Garcia, Carlos Moncada  
**Universidad Politécnica de Victoria**
