// Función para inicializar el grafo
function initGraph() {
    graphCanvas = document.getElementById('graphCanvas');
    if (!graphCanvas) return;
    
    graphCtx = graphCanvas.getContext('2d');
    
    // Construir el grafo basado en los horarios actuales
    buildGraph();
    
    // Iniciar la animación
    if (graphAnimationId) {
        cancelAnimationFrame(graphAnimationId);
    }
    animateGraph();
    
    // Agregar event listeners
    graphCanvas.addEventListener('mousedown', handleGraphMouseDown);
    graphCanvas.addEventListener('mousemove', handleGraphMouseMove);
    graphCanvas.addEventListener('mouseup', handleGraphMouseUp);
    graphCanvas.addEventListener('mouseleave', handleGraphMouseUp);
}

function buildGraph() {
    graphNodes = [];
    graphEdges = [];
    const nodeMap = new Map();
    
    // Obtener los horarios del localStorage o variable global
    const horarios = JSON.parse(localStorage.getItem('horarios') || '[]');
    
    if (horarios.length === 0) {
        // Si no hay horarios, mostrar mensaje
        graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
        graphCtx.fillStyle = '#6c757d';
        graphCtx.font = 'bold 20px Arial';
        graphCtx.textAlign = 'center';
        graphCtx.fillText('No hay horarios para visualizar', graphCanvas.width / 2, graphCanvas.height / 2);
        graphCtx.font = '16px Arial';
        graphCtx.fillText('Genera horarios primero', graphCanvas.width / 2, graphCanvas.height / 2 + 30);
        return;
    }
    
    // Colores para diferentes materias
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4'];
    let colorIndex = 0;
    
    // Crear nodos para cada materia
    horarios.forEach(horario => {
        const materia = horario.materia || horario.subject;
        if (materia && !nodeMap.has(materia)) {
            const node = {
                id: materia,
                label: materia,
                color: colors[colorIndex % colors.length],
                x: Math.random() * (graphCanvas.width - 200) + 100,
                y: Math.random() * (graphCanvas.height - 200) + 100,
                vx: 0,
                vy: 0
            };
            graphNodes.push(node);
            nodeMap.set(materia, node);
            colorIndex++;
        }
    });
    
    // Crear aristas basadas en conflictos (mismo día/hora)
    const timeSlots = new Map();
    horarios.forEach(horario => {
        const dia = horario.dia || horario.day;
        const hora = horario.hora || horario.hour;
        const materia = horario.materia || horario.subject;
        const key = `${dia}-${hora}`;
        
        if (!timeSlots.has(key)) {
            timeSlots.set(key, []);
        }
        timeSlots.get(key).push(materia);
    });
    
    // Conectar materias que están en el mismo slot
    timeSlots.forEach(materias => {
        for (let i = 0; i < materias.length; i++) {
            for (let j = i + 1; j < materias.length; j++) {
                graphEdges.push({
                    source: materias[i],
                    target: materias[j]
                });
            }
        }
    });
    
    // Actualizar contadores
    document.getElementById('nodeCount').textContent = graphNodes.length;
    document.getElementById('edgeCount').textContent = graphEdges.length;
}

function animateGraph() {
    applyGraphForces();
    drawGraph();
    graphAnimationId = requestAnimationFrame(animateGraph);
}

function applyGraphForces() {
    const width = graphCanvas.width;
    const height = graphCanvas.height;
    
    // Repulsión entre nodos
    for (let i = 0; i < graphNodes.length; i++) {
        for (let j = i + 1; j < graphNodes.length; j++) {
            const dx = graphNodes[j].x - graphNodes[i].x;
            const dy = graphNodes[j].y - graphNodes[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 3000 / (distance * distance);
            
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            graphNodes[i].vx -= fx;
            graphNodes[i].vy -= fy;
            graphNodes[j].vx += fx;
            graphNodes[j].vy += fy;
        }
    }
    
    // Atracción por aristas
    graphEdges.forEach(edge => {
        const source = graphNodes.find(n => n.id === edge.source);
        const target = graphNodes.find(n => n.id === edge.target);
        
        if (source && target) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (distance - 200) * 0.01;
            
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            source.vx += fx;
            source.vy += fy;
            target.vx -= fx;
            target.vy -= fy;
        }
    });
    
    // Actualizar posiciones
    graphNodes.forEach(node => {
        if (!node.fixed) {
            node.vx *= 0.85;
            node.vy *= 0.85;
            
            node.x += node.vx;
            node.y += node.vy;
            
            const padding = 50;
            node.x = Math.max(padding, Math.min(width - padding, node.x));
            node.y = Math.max(padding, Math.min(height - padding, node.y));
        }
    });
}

function drawGraph() {
    graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
    
    // Dibujar aristas
    graphCtx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
    graphCtx.lineWidth = 2;
    graphEdges.forEach(edge => {
        const source = graphNodes.find(n => n.id === edge.source);
        const target = graphNodes.find(n => n.id === edge.target);
        
        if (source && target) {
            graphCtx.beginPath();
            graphCtx.moveTo(source.x, source.y);
            graphCtx.lineTo(target.x, target.y);
            graphCtx.stroke();
        }
    });
    
    // Dibujar nodos
    graphNodes.forEach(node => {
        // Sombra
        graphCtx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        graphCtx.shadowBlur = 10;
        graphCtx.shadowOffsetX = 2;
        graphCtx.shadowOffsetY = 2;
        
        // Círculo
        graphCtx.fillStyle = node.color;
        graphCtx.beginPath();
        graphCtx.arc(node.x, node.y, 35, 0, Math.PI * 2);
        graphCtx.fill();
        
        // Borde
        graphCtx.shadowColor = 'transparent';
        graphCtx.strokeStyle = '#ffffff';
        graphCtx.lineWidth = 3;
        graphCtx.stroke();
        
        // Texto
        graphCtx.fillStyle = '#ffffff';
        graphCtx.font = 'bold 12px Arial';
        graphCtx.textAlign = 'center';
        graphCtx.textBaseline = 'middle';
        graphCtx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        graphCtx.shadowBlur = 3;
        
        // Dividir texto si es muy largo
        const maxWidth = 60;
        const words = node.label.split(' ');
        let lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = graphCtx.measureText(testLine);
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
            graphCtx.fillText(line, node.x, startY + i * lineHeight);
        });
        
        graphCtx.shadowColor = 'transparent';
    });
}

function handleGraphMouseDown(e) {
    const rect = graphCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    draggedNode = graphNodes.find(node => {
        const dx = node.x - x;
        const dy = node.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 35;
    });
    
    if (draggedNode) {
        draggedNode.fixed = true;
    }
}

function handleGraphMouseMove(e) {
    if (!draggedNode) return;
    
    const rect = graphCanvas.getBoundingClientRect();
    draggedNode.x = e.clientX - rect.left;
    draggedNode.y = e.clientY - rect.top;
    draggedNode.vx = 0;
    draggedNode.vy = 0;
}

function handleGraphMouseUp() {
    if (draggedNode) {
        draggedNode.fixed = false;
        draggedNode = null;
    }
}