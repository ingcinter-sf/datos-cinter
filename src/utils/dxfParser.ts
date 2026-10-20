import { DxfEntity, DxfParsedDrawing, DxfPoint } from '../types';

/**
 * Parses ASCII DXF content into structured 2D geometric entities
 */
export function parseDxfContent(dxfText: string, filename: string = 'plano.dxf'): DxfParsedDrawing {
  const lines = dxfText.split(/\r?\n/);
  const entities: DxfEntity[] = [];
  const layerSet = new Set<string>();

  let inEntitiesSection = false;
  let currentEntityType = '';
  let currentGroupCode = -1;

  // Temporary entity building state
  let currentLayer = '0';
  let p10 = 0, p20 = 0, p30 = 0;
  let p11 = 0, p21 = 0, p31 = 0;
  let p40 = 0; // radius / height
  let p50 = 0, p51 = 0; // angles
  let textVal = '';
  let polyVertices: DxfPoint[] = [];
  let polyClosed = false;

  const pushCurrentEntity = () => {
    if (!currentEntityType) return;

    layerSet.add(currentLayer || '0');

    if (currentEntityType === 'CIRCLE') {
      const radius = Math.abs(p40);
      if (radius > 0.05) {
        entities.push({
          type: 'CIRCLE',
          center: { x: p10, y: p20, z: p30 },
          radius: radius,
          diameter: Math.round(radius * 2 * 10) / 10,
          layer: currentLayer,
        });
      }
    } else if (currentEntityType === 'LINE') {
      entities.push({
        type: 'LINE',
        start: { x: p10, y: p20, z: p30 },
        end: { x: p11, y: p21, z: p31 },
        layer: currentLayer,
      });
    } else if (currentEntityType === 'ARC') {
      entities.push({
        type: 'ARC',
        center: { x: p10, y: p20, z: p30 },
        radius: p40,
        startAngle: p50,
        endAngle: p51,
        layer: currentLayer,
      });
    } else if (currentEntityType === 'LWPOLYLINE') {
      if (polyVertices.length > 0) {
        entities.push({
          type: 'LWPOLYLINE',
          vertices: [...polyVertices],
          closed: polyClosed,
          layer: currentLayer,
        });
      }
    } else if (currentEntityType === 'TEXT' || currentEntityType === 'MTEXT') {
      if (textVal.trim()) {
        entities.push({
          type: currentEntityType,
          position: { x: p10, y: p20, z: p30 },
          text: textVal.trim(),
          height: p40 || 3.5,
          layer: currentLayer,
        });
      }
    }

    // Reset temporary entity state
    currentEntityType = '';
    currentLayer = '0';
    p10 = 0; p20 = 0; p30 = 0;
    p11 = 0; p21 = 0; p31 = 0;
    p40 = 0; p50 = 0; p51 = 0;
    textVal = '';
    polyVertices = [];
    polyClosed = false;
  };

  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    const value = lines[i + 1]?.trim() ?? '';

    if (isNaN(code)) continue;

    // Check section boundaries
    if (code === 0 && value === 'SECTION') {
      // peek next code
      continue;
    }
    if (code === 2 && value === 'ENTITIES') {
      inEntitiesSection = true;
      continue;
    }
    if (code === 0 && value === 'ENDSEC') {
      if (inEntitiesSection) {
        pushCurrentEntity();
        inEntitiesSection = false;
      }
      continue;
    }
    if (code === 0 && value === 'EOF') {
      pushCurrentEntity();
      break;
    }

    // If inside ENTITIES section (or if file lacks explicit section header and goes straight to entities)
    if (inEntitiesSection || (!inEntitiesSection && (value === 'CIRCLE' || value === 'LINE' || value === 'ARC' || value === 'LWPOLYLINE' || value === 'TEXT' || value === 'MTEXT'))) {
      if (code === 0) {
        pushCurrentEntity();
        if (['CIRCLE', 'LINE', 'ARC', 'LWPOLYLINE', 'TEXT', 'MTEXT'].includes(value)) {
          currentEntityType = value;
        }
        continue;
      }

      if (code === 8) {
        currentLayer = value;
      } else if (code === 10) {
        p10 = parseFloat(value) || 0;
        if (currentEntityType === 'LWPOLYLINE') {
          polyVertices.push({ x: p10, y: 0 });
        }
      } else if (code === 20) {
        p20 = parseFloat(value) || 0;
        if (currentEntityType === 'LWPOLYLINE' && polyVertices.length > 0) {
          polyVertices[polyVertices.length - 1].y = p20;
        }
      } else if (code === 30) {
        p30 = parseFloat(value) || 0;
      } else if (code === 11) {
        p11 = parseFloat(value) || 0;
      } else if (code === 21) {
        p21 = parseFloat(value) || 0;
      } else if (code === 31) {
        p31 = parseFloat(value) || 0;
      } else if (code === 40) {
        p40 = parseFloat(value) || 0;
      } else if (code === 50) {
        p50 = parseFloat(value) || 0;
      } else if (code === 51) {
        p51 = parseFloat(value) || 0;
      } else if (code === 1) {
        textVal = value;
      } else if (code === 70 && currentEntityType === 'LWPOLYLINE') {
        polyClosed = (parseInt(value, 10) & 1) === 1;
      }
    }
  }

  pushCurrentEntity();

  // Calculate bounding box
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  entities.forEach(ent => {
    if (ent.type === 'CIRCLE') {
      minX = Math.min(minX, ent.center.x - ent.radius);
      maxX = Math.max(maxX, ent.center.x + ent.radius);
      minY = Math.min(minY, ent.center.y - ent.radius);
      maxY = Math.max(maxY, ent.center.y + ent.radius);
    } else if (ent.type === 'LINE') {
      minX = Math.min(minX, ent.start.x, ent.end.x);
      maxX = Math.max(maxX, ent.start.x, ent.end.x);
      minY = Math.min(minY, ent.start.y, ent.end.y);
      maxY = Math.max(maxY, ent.start.y, ent.end.y);
    } else if (ent.type === 'ARC') {
      minX = Math.min(minX, ent.center.x - ent.radius);
      maxX = Math.max(maxX, ent.center.x + ent.radius);
      minY = Math.min(minY, ent.center.y - ent.radius);
      maxY = Math.max(maxY, ent.center.y + ent.radius);
    } else if (ent.type === 'LWPOLYLINE') {
      ent.vertices.forEach(v => {
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
      });
    } else if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
      minX = Math.min(minX, ent.position.x);
      maxX = Math.max(maxX, ent.position.x + 50);
      minY = Math.min(minY, ent.position.y);
      maxY = Math.max(maxY, ent.position.y + ent.height);
    }
  });

  if (!isFinite(minX)) {
    minX = 0; minY = 0; maxX = 500; maxY = 300;
  }

  // Extract detected holes (circles)
  const detectedHoles = entities
    .filter((e): e is import('../types').DxfCircle => e.type === 'CIRCLE')
    .map((c, idx) => ({
      id: `hole-${idx}-${c.center.x.toFixed(1)}-${c.center.y.toFixed(1)}`,
      center: c.center,
      diameter: c.diameter,
      layer: c.layer,
    }));

  // Group by diameter
  const diameterCountMap = new Map<number, number>();
  detectedHoles.forEach(h => {
    const d = h.diameter;
    diameterCountMap.set(d, (diameterCountMap.get(d) || 0) + 1);
  });

  const holeSummaryByDiameter = Array.from(diameterCountMap.entries())
    .map(([diameter, count]) => ({ diameter, count }))
    .sort((a, b) => a.diameter - b.diameter);

  return {
    filename,
    entities,
    layers: Array.from(layerSet),
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    },
    detectedHoles,
    holeSummaryByDiameter,
  };
}
