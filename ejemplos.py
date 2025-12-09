#!/usr/bin/env python3
"""
Ejemplo de uso del Sistema de Horarios ITI
Demuestra cómo usar la API programáticamente
"""

from sistema_horarios import SistemaHorariosITI, Profesor, Materia, Grupo, Aula
import os

def ejemplo_basico():
    """Ejemplo básico: crear datos manualmente y generar horario"""
    
    print("=" * 70)
    print("EJEMPLO: Generación de Horario con Datos Mínimos")
    print("=" * 70)
    print()
    
    # Crear instancia del sistema
    sistema = SistemaHorariosITI()
    
    # Agregar profesores
    print("[1/5] Agregando profesores...")
    sistema.profesores = [
        Profesor(0, "Dr. Said Polanco", 12),
        Profesor(1, "Dr. Jean-Michael", 15),
        Profesor(2, "M.C. Omar Jasso", 15),
    ]
    print(f"  ✓ {len(sistema.profesores)} profesores agregados")
    
    # Agregar materias
    print("[2/5] Agregando materias...")
    sistema.materias = [
        Materia(0, "Estructura de Datos", 5),
        Materia(1, "Ingeniería de Requerimientos", 4),
        Materia(2, "Diseño de Base de Datos", 5),
    ]
    sistema.materias[0].color = 'blue'
    sistema.materias[0].requiere_laboratorio = True
    sistema.materias[1].color = 'green'
    sistema.materias[2].color = 'orange'
    sistema.materias[2].requiere_laboratorio = True
    print(f"  ✓ {len(sistema.materias)} materias agregadas")
    
    # Agregar grupos
    print("[3/5] Agregando grupos...")
    sistema.grupos = [
        Grupo(0, "ITI 5-1", 35, True),
        Grupo(1, "ITI 5-2", 33, True),
    ]
    print(f"  ✓ {len(sistema.grupos)} grupos agregados")
    
    # Agregar aulas
    print("[4/5] Agregando aulas...")
    sistema.aulas = [
        Aula(0, "Laboratorio Z1", 35, True),
        Aula(1, "Laboratorio Z2", 35, True),
        Aula(2, "Aula A1", 40, False),
    ]
    print(f"  ✓ {len(sistema.aulas)} aulas agregadas")
    
    # Definir asignaciones (qué profesor da qué materia a qué grupo)
    print("[5/5] Configurando asignaciones...")
    sistema.asignaciones = {
        0: {  # Grupo ITI 5-1
            0: 0,  # Estructura de Datos -> Dr. Said Polanco
            1: 1,  # Ing. Requerimientos -> Dr. Jean-Michael
            2: 2,  # Diseño de BD -> M.C. Omar Jasso
        },
        1: {  # Grupo ITI 5-2
            0: 0,  # Estructura de Datos -> Dr. Said Polanco
            1: 1,  # Ing. Requerimientos -> Dr. Jean-Michael
            2: 2,  # Diseño de BD -> M.C. Omar Jasso
        }
    }
    print(f"  ✓ Asignaciones configuradas")
    print()
    
    # Generar solución inicial
    sistema.generar_solucion_inicial()
    
    # Optimizar
    print("\n[OPTIMIZACIÓN]")
    sistema.optimizar_con_tabu(max_iteraciones=500, tamano_tabu=15)
    
    # Detectar conflictos
    print("\n[ANÁLISIS]")
    conflictos = sistema.detectar_conflictos()
    duros = [c for c in conflictos if c['tipo'] == 'duro']
    blandos = [c for c in conflictos if c['tipo'] == 'blando']
    
    print(f"  Conflictos duros:   {len(duros)}")
    print(f"  Conflictos blandos: {len(blandos)}")
    
    # Generar reporte
    print("\n[EXPORTACIÓN]")
    ruta_reporte = os.path.join(os.path.dirname(__file__), 'ejemplo_horario.html')
    sistema.generar_reporte_html(ruta_reporte)
    
    # Guardar JSON
    ruta_json = os.path.join(os.path.dirname(__file__), 'ejemplo_solucion.json')
    sistema.guardar_solucion_json(ruta_json)
    
    print("\n" + "=" * 70)
    print("✓ EJEMPLO COMPLETADO")
    print("=" * 70)
    print(f"  Reporte HTML: {ruta_reporte}")
    print(f"  Solución JSON: {ruta_json}")
    print("=" * 70)


def ejemplo_carga_json():
    """Ejemplo: cargar datos desde archivo JSON"""
    
    print("=" * 70)
    print("EJEMPLO: Carga de Datos desde JSON")
    print("=" * 70)
    print()
    
    sistema = SistemaHorariosITI()
    
    ruta_datos = os.path.join(os.path.dirname(__file__), 'data', 'datos_iti.json')
    
    if not os.path.exists(ruta_datos):
        print(f"[ERROR] No se encontró: {ruta_datos}")
        print("        Ejecuta primero el ejemplo básico o crea el archivo.")
        return
    
    sistema.cargar_datos_json(ruta_datos)
    sistema.generar_solucion_inicial()
    sistema.optimizar_con_tabu(max_iteraciones=1000, tamano_tabu=20)
    
    print("\n✓ Horario generado desde JSON")


def ejemplo_analisis_detallado():
    """Ejemplo: análisis detallado de conflictos"""
    
    print("=" * 70)
    print("EJEMPLO: Análisis Detallado de Conflictos")
    print("=" * 70)
    print()
    
    sistema = SistemaHorariosITI()
    ruta_datos = os.path.join(os.path.dirname(__file__), 'data', 'datos_iti.json')
    
    if not os.path.exists(ruta_datos):
        print("[ERROR] Ejecuta primero los ejemplos anteriores")
        return
    
    sistema.cargar_datos_json(ruta_datos)
    sistema.generar_solucion_inicial()
    
    print("[INFO] Analizando solución inicial (sin optimizar)...")
    conflictos_inicial = sistema.detectar_conflictos()
    
    sistema.optimizar_con_tabu(max_iteraciones=1000, tamano_tabu=20)
    
    print("\n[INFO] Analizando solución optimizada...")
    conflictos_final = sistema.detectar_conflictos()
    
    print("\n" + "=" * 70)
    print("COMPARACIÓN")
    print("=" * 70)
    print(f"Conflictos duros (inicial):    {len([c for c in conflictos_inicial if c['tipo'] == 'duro'])}")
    print(f"Conflictos duros (final):      {len([c for c in conflictos_final if c['tipo'] == 'duro'])}")
    print()
    print(f"Conflictos blandos (inicial):  {len([c for c in conflictos_inicial if c['tipo'] == 'blando'])}")
    print(f"Conflictos blandos (final):    {len([c for c in conflictos_final if c['tipo'] == 'blando'])}")
    print("=" * 70)


def menu_interactivo():
    """Menú interactivo para ejecutar ejemplos"""
    
    while True:
        print("\n" + "=" * 70)
        print("EJEMPLOS - Sistema de Horarios ITI")
        print("=" * 70)
        print("1. Ejemplo básico (datos mínimos)")
        print("2. Cargar desde JSON completo")
        print("3. Análisis detallado de conflictos")
        print("4. Salir")
        print("=" * 70)
        
        opcion = input("\nSelecciona una opción (1-4): ").strip()
        
        if opcion == '1':
            ejemplo_basico()
        elif opcion == '2':
            ejemplo_carga_json()
        elif opcion == '3':
            ejemplo_analisis_detallado()
        elif opcion == '4':
            print("\n¡Hasta luego!")
            break
        else:
            print("\n[ERROR] Opción inválida")
        
        input("\nPresiona ENTER para continuar...")


if __name__ == "__main__":
    print("\n")
    print("████████████████████████████████████████████████████████████████████")
    print("█                                                                  █")
    print("█       SISTEMA DE HORARIOS ITI - EJEMPLOS DE USO                 █")
    print("█       Universidad Politécnica de Victoria                       █")
    print("█                                                                  █")
    print("████████████████████████████████████████████████████████████████████")
    print("\n")
    
    menu_interactivo()
