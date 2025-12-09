#ifndef ESTRUCTURAS_H
#define ESTRUCTURAS_H

#include <string>
#include <vector>

using namespace std;

// ==================== ESTRUCTURAS BÁSICAS ====================

struct Profesor {
    int id;
    string nombre;
    int horas_asignadas;
    int max_horas;
    vector<int> preferencias_horarias;  // Slots que NO quiere
    vector<int> materias_que_imparte;   // IDs de materias
    
    Profesor() : id(0), horas_asignadas(0), max_horas(0) {}
};

struct Materia {
    int id;
    string nombre;
    int horas_semanales;
    int grupo_id;
    int profesor_id;
    bool requiere_laboratorio;
    
    Materia() : id(0), horas_semanales(0), grupo_id(0), profesor_id(0), requiere_laboratorio(false) {}
};

struct Grupo {
    int id;
    string nombre;              // Ej: "ITI 5-1"
    int num_estudiantes;
    bool turno_matutino;        // true = matutino, false = vespertino
    vector<int> materias_ids;
    
    Grupo() : id(0), num_estudiantes(0), turno_matutino(true) {}
};

struct Aula {
    int id;
    string nombre;
    int capacidad;
    bool es_laboratorio;
    
    Aula() : id(0), capacidad(0), es_laboratorio(false) {}
};

struct Slot {
    int dia;        // 0=Lunes, 1=Martes, ..., 4=Viernes
    int hora;       // 0-13 (14 franjas de 55 min)
    
    Slot() : dia(0), hora(0) {}
    Slot(int d, int h) : dia(d), hora(h) {}
    
    int get_id() const {
        return dia * 14 + hora;  // Convierte a ID único 0-69
    }
};

// ==================== EVENTO (CLASE A PROGRAMAR) ====================

struct Evento {
    int id;
    int materia_id;
    int profesor_id;
    int grupo_id;
    int aula_id;
    Slot slot;
    
    Evento() : id(0), materia_id(0), profesor_id(0), grupo_id(0), aula_id(-1) {}
};

// ==================== GRAFO DE CONFLICTOS ====================

struct Arista {
    int destino;
    Arista* siguiente;
    
    Arista(int dest) : destino(dest), siguiente(nullptr) {}
};

class GrafoConflictos {
private:
    int num_vertices;
    Arista** lista_adyacencia;
    
public:
    GrafoConflictos(int n);
    ~GrafoConflictos();
    
    void agregar_arista(int u, int v);
    bool existe_conflicto(int u, int v);
    vector<int> obtener_vecinos(int vertice);
    void mostrar_grafo();
};

// ==================== SOLUCIÓN ====================

struct Solucion {
    vector<Evento> eventos;
    int conflictos_duros;
    int penalizacion_blandas;
    double calidad;             // 0-100%
    
    Solucion() : conflictos_duros(0), penalizacion_blandas(0), calidad(0.0) {}
    
    void calcular_calidad() {
        if (conflictos_duros == 0) {
            // Calidad basada en penalizaciones blandas (escala invertida)
            calidad = 100.0 - (penalizacion_blandas / 10.0);
            if (calidad < 0) calidad = 0;
        } else {
            calidad = 0.0;  // Solución infactible
        }
    }
};

// ==================== MOVIMIENTO TABÚ ====================

struct Movimiento {
    int evento_id;
    Slot slot_origen;
    Slot slot_destino;
    int iteracion_tabu;  // Iteración hasta la cual está prohibido
    
    Movimiento() : evento_id(0), iteracion_tabu(0) {}
    Movimiento(int ev, Slot org, Slot dest, int iter) 
        : evento_id(ev), slot_origen(org), slot_destino(dest), iteracion_tabu(iter) {}
};

// ==================== LISTA ENLAZADA PARA LISTA TABÚ ====================

struct NodoTabu {
    Movimiento movimiento;
    NodoTabu* siguiente;
    
    NodoTabu(Movimiento m) : movimiento(m), siguiente(nullptr) {}
};

class ListaTabu {
private:
    NodoTabu* inicio;
    int tamano;
    int capacidad_maxima;
    
public:
    ListaTabu(int cap_max);
    ~ListaTabu();
    
    void agregar(Movimiento mov);
    bool es_tabu(int evento_id, Slot slot_dest, int iteracion_actual);
    void limpiar_expirados(int iteracion_actual);
    void mostrar();
    int get_tamano() const { return tamano; }
};

// ==================== RESTRICCIONES ====================

struct RestriccionDura {
    enum Tipo {
        NO_SUPERPOSICION_PROFESOR,
        NO_SUPERPOSICION_GRUPO,
        NO_SUPERPOSICION_AULA,
        CAPACIDAD_AULA,
        HORAS_SEMANALES
    };
    
    Tipo tipo;
    string descripcion;
    
    RestriccionDura(Tipo t, string desc) : tipo(t), descripcion(desc) {}
};

struct RestriccionBlanda {
    enum Tipo {
        MINIMIZAR_HORAS_LIBRES,
        DISTRIBUCION_EQUILIBRADA,
        EVITAR_HORARIOS_EXTREMOS,
        PREFERENCIAS_PROFESOR,
        DIAS_COMPLETOS_PROFESOR
    };
    
    Tipo tipo;
    int peso;
    string descripcion;
    
    RestriccionBlanda(Tipo t, int p, string desc) 
        : tipo(t), peso(p), descripcion(desc) {}
};

// ==================== CONFLICTO DETECTADO ====================

struct Conflicto {
    enum Severidad { DURO, BLANDO };
    
    Severidad severidad;
    string descripcion;
    string tiempo;
    int penalizacion;
    vector<int> eventos_involucrados;
    
    Conflicto() : severidad(BLANDO), penalizacion(0) {}
};

#endif // ESTRUCTURAS_H
