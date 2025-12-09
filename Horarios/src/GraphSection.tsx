import { useEffect, useRef } from 'react';
import { Subject, Schedule } from './types';

interface GraphSectionProps {
  schedules: Schedule[];
  subjects: Subject[];
}

interface Node {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

interface Edge {
  source: string;
  target: string;
}

export function GraphSection({ schedules, subjects }: GraphSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const animationRef = useRef<number>();
  const draggedNodeRef = useRef<Node | null>(null);

  useEffect(() => {
    // Construir el grafo basado en los horarios
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeMap = new Map<string, Node>();

    // Crear nodos para cada materia que tiene horario
    schedules.forEach((schedule) => {
      const subject = subjects.find((s) => s.id === schedule.subjectId);
      if (subject && !nodeMap.has(subject.id)) {
        const node: Node = {
          id: subject.id,
          label: subject.name,
          color: subject.color,
          x: Math.random() * 600 + 100,
          y: Math.random() * 400 + 100,
          vx: 0,
          vy: 0,
        };
        nodes.push(node);
        nodeMap.set(subject.id, node);
      }
    });

    // Crear aristas basadas en materias que comparten el mismo día/hora
    const timeSlots = new Map<string, string[]>();
    schedules.forEach((schedule) => {
      const key = `${schedule.day}-${schedule.hour}`;
      if (!timeSlots.has(key)) {
        timeSlots.set(key, []);
      }
      timeSlots.get(key)!.push(schedule.subjectId);
    });

    // Conectar materias que están en el mismo slot
    timeSlots.forEach((subjectIds) => {
      for (let i = 0; i < subjectIds.length; i++) {
        for (let j = i + 1; j < subjectIds.length; j++) {
          edges.push({
            source: subjectIds[i],
            target: subjectIds[j],
          });
        }
      }
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;

    startSimulation();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [schedules, subjects]);

  const startSimulation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const animate = () => {
      applyForces(width, height);

      ctx.clearRect(0, 0, width, height);

      // Dibujar aristas
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
      ctx.lineWidth = 2;
      edgesRef.current.forEach((edge) => {
        const sourceNode = nodesRef.current.find((n) => n.id === edge.source);
        const targetNode = nodesRef.current.find((n) => n.id === edge.target);
        if (sourceNode && targetNode) {
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.stroke();
        }
      });

      // Dibujar nodos
      nodesRef.current.forEach((node) => {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 30, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 3;
        
        const maxWidth = 50;
        const words = node.label.split(' ');
        let lines: string[] = [];
        let currentLine = '';

        words.forEach((word) => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        lines.push(currentLine);

        const lineHeight = 14;
        const startY = node.y - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, i) => {
          ctx.fillText(line, node.x, startY + i * lineHeight);
        });

        ctx.shadowColor = 'transparent';
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  const applyForces = (width: number, height: number) => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    // Repulsión entre nodos
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 2000 / (distance * distance);

        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    // Atracción por aristas
    edges.forEach((edge) => {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (source && target) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (distance - 150) * 0.01;

        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }
    });

    // Actualizar posiciones
    nodes.forEach((node) => {
      if (node.fx === undefined) {
        node.vx *= 0.9;
        node.vy *= 0.9;

        node.x += node.vx;
        node.y += node.vy;

        const padding = 40;
        node.x = Math.max(padding, Math.min(width - padding, node.x));
        node.y = Math.max(padding, Math.min(height - padding, node.y));
      }
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = nodesRef.current.find((n) => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 30;
    });

    if (node) {
      draggedNodeRef.current = node;
      node.fx = x;
      node.fy = y;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = draggedNodeRef.current;
    if (!node) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    node.fx = e.clientX - rect.left;
    node.fy = e.clientY - rect.top;
    node.x = node.fx;
    node.y = node.fy;
    node.vx = 0;
    node.vy = 0;
  };

  const handleMouseUp = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = undefined;
      draggedNodeRef.current.fy = undefined;
      draggedNodeRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Grafo de Horarios</h2>
        <p className="text-gray-600">
          Visualización del grafo de materias. Las aristas conectan materias que comparten el mismo horario.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        {nodesRef.current.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay horarios para visualizar
            </h3>
            <p className="text-gray-500">
              Genera horarios en la sección "Horario" para ver el grafo
            </p>
          </div>
        ) : (
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full border-2 border-gray-200 rounded-lg cursor-move bg-gradient-to-br from-slate-50 to-gray-100"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-indigo-500"></div>
                  <span>Materias ({nodesRef.current.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-slate-400"></div>
                  <span>Conflictos ({edgesRef.current.length})</span>
                </div>
              </div>
              <div className="text-gray-500 italic">
                💡 Arrastra los nodos para reorganizar el grafo
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Información del Grafo</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Cada nodo representa una materia del horario</li>
          <li>• Las aristas conectan materias que están asignadas al mismo día y hora</li>
          <li>• Los nodos pueden ser arrastrados para reorganizar la visualización</li>
          <li>• El tamaño y color de los nodos se basa en las materias configuradas</li>
        </ul>
      </div>
    </div>
  );
}