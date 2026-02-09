<script setup>
// --- LOGIC SECTION ---
import { reactive, computed, ref, nextTick } from 'vue';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const isSaving = ref(false);
const viewMode = ref('power'); 
const flowDirection = ref('vertical'); 

const panel = reactive({
  manufacturer: 'ROE',
  model: 'Black Pearl 2',
  width_mm: 500,
  height_mm: 500,
  pitch: 2.8,
  weight_kg: 9.4,
  wall_width_tiles: 8,
  wall_height_tiles: 4,
  max_power_circuit: 6, 
  max_data_port: 16
});

const stats = computed(() => {
  const total_tiles = panel.wall_width_tiles * panel.wall_height_tiles;
  const width_m = (panel.wall_width_tiles * panel.width_mm / 1000).toFixed(2);
  const height_m = (panel.wall_height_tiles * panel.height_mm / 1000).toFixed(2);
  const tile_res_w = Math.round(panel.width_mm / panel.pitch);
  const tile_res_h = Math.round(panel.height_mm / panel.pitch);
  const res_w = tile_res_w * panel.wall_width_tiles;
  const res_h = tile_res_h * panel.wall_height_tiles;
  const total_power_circuits = Math.ceil(total_tiles / panel.max_power_circuit);
  const total_data_ports = Math.ceil(total_tiles / panel.max_data_port);
  const total_weight = (total_tiles * panel.weight_kg).toFixed(0);

  return { total_tiles, width_m, height_m, res_w, res_h, tile_res_w, tile_res_h, total_power_circuits, total_data_ports, total_weight };
});

const getTileInfo = (n) => {
  const w = panel.wall_width_tiles;
  const h = panel.wall_height_tiles;
  const row = Math.floor((n - 1) / w); 
  const col = (n - 1) % w;
  let order = 0;
  if (flowDirection.value === 'vertical') {
    if (col % 2 === 0) order = (col * h) + row + 1;
    else order = (col * h) + (h - 1 - row) + 1;
  } else {
    if (row % 2 === 0) order = (row * w) + col + 1;
    else order = (row * w) + (w - 1 - col) + 1;
  }
  const limit = viewMode.value === 'power' ? panel.max_power_circuit : panel.max_data_port;
  const prefix = viewMode.value === 'power' ? 'P' : 'D';
  const groupIndex = Math.ceil(order / limit);
  const label = `${prefix}${groupIndex}`;
  
  // LCARS Palette
  const p_colors = ['#FF9900', '#CC99CC', '#9999CC', '#CC6666']; 
  const d_colors = ['#CC6666', '#9999CC', '#FFCC99', '#FF9900']; 
  const palette = viewMode.value === 'power' ? p_colors : d_colors;
  const color = palette[(groupIndex - 1) % palette.length];
  let arrow = '';
  const isEndOfCircuit = order % limit === 0;
  const isLastTile = order === stats.value.total_tiles;

  if (!isEndOfCircuit && !isLastTile) {
      if (flowDirection.value === 'vertical') {
          if (col % 2 === 0) arrow = (row === h - 1) ? '→' : '↓'; 
          else arrow = (row === 0) ? '→' : '↑'; 
      } else {
          if (row % 2 === 0) arrow = (col === w - 1) ? '↓' : '→'; 
          else arrow = (col === 0) ? '↓' : '←'; 
      }
  }
  return { style: { backgroundColor: color, color: 'black' }, label, arrow };
};

const exportSpecificPDF = async (mode) => {
  viewMode.value = mode;
  await nextTick();
  const element = document.getElementById('preview-canvas');
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#000' });
  const imgData = canvas.toDataURL('image/png');
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFillColor(0, 0, 0); 
  doc.rect(0, 0, 297, 210, 'F');
  
  // Add LCARS Bar to PDF
  doc.setFillColor(255, 153, 0); // LCARS Orange
  doc.roundedRect(10, 10, 30, 190, 10, 10, 'F');
  doc.setFillColor(0, 0, 0); // Masking rect to make the curve
  doc.rect(25, 10, 15, 190, 'F');

  doc.setTextColor(255, 153, 0);
  doc.setFont("helvetica", "bold"); 
  doc.setFontSize(24);
  doc.text(mode === 'power' ? "POWER DISTRIBUTION" : "DATA SIGNAL PATH", 50, 25);
  doc.setFontSize(14);
  doc.text(`USS ENTERPRISE // ${new Date().toLocaleDateString()}`, 50, 35);

  const imgProps = doc.getImageProperties(imgData);
  const pdfWidth = 160;
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
  doc.addImage(imgData, 'PNG', 50, 50, pdfWidth, pdfHeight);
  doc.save(`LCARS_LOG_${mode.toUpperCase()}.pdf`);
};

// --- UPDATED PIXEL MAP GENERATOR (WITH BLACK BG) ---
const generatePixelMap = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // 1. Set dimensions
  canvas.width = stats.value.res_w;
  canvas.height = stats.value.res_h;
  
  // 2. FORCE BLACK BACKGROUND (Fixes transparency issues)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 3. Define LCARS Palette
  const colors = ['#FF9900', '#CC99CC', '#9999CC', '#CC6666', '#FFCC99', '#99CCFF'];
  
  const tileW = stats.value.tile_res_w;
  const tileH = stats.value.tile_res_h;
  const fontSize = Math.max(12, Math.floor(tileH / 5));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textBaseline = 'top';

  for (let row = 0; row < panel.wall_height_tiles; row++) {
    for (let col = 0; col < panel.wall_width_tiles; col++) {
      const xPos = col * tileW;
      const yPos = row * tileH;
      const colorIndex = (row + col) % colors.length;
      
      // Draw Tile
      ctx.fillStyle = colors[colorIndex];
      ctx.fillRect(xPos, yPos, tileW, tileH);
      
      // Draw Border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(xPos + 1, yPos + 1, tileW - 2, tileH - 2);
      
      // Draw Text
      ctx.fillStyle = '#000000';
      ctx.fillText(`${col + 1},${row + 1}`, xPos + (tileW * 0.05), yPos + (tileH * 0.05));
    }
  }

  const link = document.createElement('a');
  link.download = `LCARS_MAP_${stats.value.res_w}x${stats.value.res_h}.jpg`;
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
};
</script>

<template>
  <div class="lcars-container">
    
    <div class="lcars-header">
      <div class="lcars-elbow"></div>
      <div class="lcars-bar-top">
        <span class="title-text">LIBRARY COMPUTER ACCESS AND RETRIEVAL SYSTEM</span>
        <span class="stardate">SD-{{ new Date().getFullYear() }}</span>
      </div>
    </div>

    <div class="lcars-body">
      <div class="lcars-sidebar">
        <div class="lcars-block spacer"></div>
        <div class="lcars-block btn-group">
          <button @click="viewMode = 'power'" :class="{active: viewMode === 'power'}">01 POWER</button>
          <button @click="viewMode = 'data'" :class="{active: viewMode === 'data'}">02 DATA</button>
        </div>
        <div class="lcars-block spacer-long"></div>
        <div class="lcars-block btn-group actions-group">
            <button @click="exportSpecificPDF('power')">PRINT PWR</button>
            <button @click="exportSpecificPDF('data')">PRINT DAT</button>
            <button class="alt" @click="generatePixelMap">GEN MAP</button>
        </div>
        <div class="lcars-block footer">NCC-1701-D</div>
      </div>

      <div class="lcars-main">
        
        <div class="data-row">
          <div class="lcars-readout">
            <span class="label">TILE COUNT</span>
            <span class="value">{{ stats.total_tiles }}</span>
          </div>
          <div class="lcars-readout alt">
            <span class="label">DIMENSIONS</span>
            <span class="value">{{ stats.width_m }}m x {{ stats.height_m }}m</span>
          </div>
          <div class="lcars-readout">
            <span class="label">RESOLUTION</span>
            <span class="value">{{ stats.res_w }} x {{ stats.res_h }}</span>
          </div>
          <div class="lcars-readout alert">
            <span class="label">WEIGHT</span>
            <span class="value">{{ stats.total_weight }} KG</span>
          </div>
        </div>

        <div class="interface-grid">
          
          <div class="lcars-panel">
            <div class="panel-label">CONFIGURATION INPUT</div>
            
            <div class="control-group">
              <label>GRID GEOMETRY</label>
              <div class="pill-inputs">
                <input type="number" v-model="panel.wall_width_tiles">
                <input type="number" v-model="panel.wall_height_tiles">
              </div>
            </div>

            <div class="control-group">
              <label>LIMITERS (PWR/DAT)</label>
              <div class="pill-inputs">
                <input type="number" v-model="panel.max_power_circuit">
                <input type="number" v-model="panel.max_data_port">
              </div>
            </div>
            
            <div class="control-group">
              <label>SIGNAL FLOW</label>
              <div class="lcars-toggles">
                <button :class="{active: flowDirection === 'vertical'}" @click="flowDirection = 'vertical'">VERTICAL</button>
                <button :class="{active: flowDirection === 'horizontal'}" @click="flowDirection = 'horizontal'">HORIZONTAL</button>
              </div>
            </div>

            <div class="control-group">
               <label>HARDWARE SPECS</label>
               <input v-model="panel.manufacturer" placeholder="MAKE">
               <input v-model="panel.model" placeholder="MODEL">
            </div>

          </div>

          <div class="vis-panel">
             <div class="vis-header">VISUAL SENSOR FEED</div>
             <div id="preview-canvas" class="scanner-bed">
                <div class="wall-grid" :style="{
                   gridTemplateColumns: `repeat(${panel.wall_width_tiles}, 1fr)`,
                   aspectRatio: `${panel.wall_width_tiles * panel.width_mm} / ${panel.wall_height_tiles * panel.height_mm}`
                }">
                  <div v-for="n in stats.total_tiles" :key="n" class="tile" :style="getTileInfo(n).style">
                    <span class="tile-id">{{ getTileInfo(n).label }}</span>
                    <span class="arrow">{{ getTileInfo(n).arrow }}</span>
                  </div>
                </div>
             </div>
          </div>

        </div>

      </div>
    </div>
  </div>
</template>

<style>
/* IMPORTS */
@import url('https://fonts.googleapis.com/css2?family=Antonio:wght@400;700&display=swap');

:root {
  --lcars-bg: #000000;
  --lcars-orange: #FF9900;
  --lcars-gold: #FFCC99;
  --lcars-purple: #CC99CC;
  --lcars-blue: #9999CC;
  --lcars-red: #CC6666;
  --gap: 5px;
}

body {
  background-color: var(--lcars-bg);
  color: var(--lcars-orange);
  font-family: 'Antonio', sans-serif;
  margin: 0;
  overflow-y: auto; /* ALLOW SCROLLING */
  overflow-x: hidden;
  text-transform: uppercase;
}

/* MAIN CONTAINER */
.lcars-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh; /* Allow growth */
  padding: 10px;
  box-sizing: border-box;
  padding-bottom: 50px; /* Space at bottom */
}

/* HEADER (Top Elbow) */
.lcars-header {
  display: flex;
  height: 60px;
  margin-bottom: var(--gap);
}
.lcars-elbow {
  width: 150px;
  background: var(--lcars-gold);
  border-bottom-left-radius: 30px;
  margin-right: var(--gap);
}
.lcars-bar-top {
  flex: 1;
  background: var(--lcars-gold);
  border-bottom-right-radius: 30px; 
  border-bottom-left-radius: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  color: black;
  font-weight: bold;
  font-size: 1.5rem;
}

/* BODY LAYOUT */
.lcars-body {
  display: flex;
  flex: 1;
  gap: var(--gap);
}

/* SIDEBAR COLUMN */
.lcars-sidebar {
  width: 150px;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}
.lcars-block {
  background: var(--lcars-purple);
  width: 100%;
}
.spacer { height: 60px; border-top-left-radius: 30px; background: var(--lcars-gold); }
.spacer-long { flex: 1; background: var(--lcars-gold); }
.footer { height: 60px; border-bottom-left-radius: 30px; background: var(--lcars-gold); display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; color: black; font-weight: bold;}

/* BUTTONS IN SIDEBAR */
.btn-group {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  background: transparent;
}
.btn-group button {
  background: var(--lcars-blue);
  border: none;
  height: 50px;
  text-align: right;
  padding-right: 15px;
  font-family: 'Antonio', sans-serif;
  font-size: 1.2rem;
  font-weight: bold;
  border-radius: 30px 0 0 30px; /* Pill start */
  margin-left: 20px; /* Indent */
  cursor: pointer;
}
.btn-group button.active { background: white; color: black; }

/* Action buttons in sidebar specific style */
.actions-group button {
    background: var(--lcars-orange);
    color: black;
}
.actions-group button.alt {
    background: var(--lcars-red);
    color: black;
}

/* MAIN CONTENT */
.lcars-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* DATA ROW */
.data-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap; /* Wrap on small screens */
}
.lcars-readout {
  flex: 1;
  min-width: 150px;
  background: var(--lcars-orange);
  color: black;
  padding: 10px 20px;
  border-radius: 30px; /* Pill shape */
  display: flex;
  flex-direction: column;
}
.lcars-readout.alt { background: var(--lcars-purple); }
.lcars-readout.alert { background: var(--lcars-red); }
.lcars-readout .label { font-size: 0.8rem; }
.lcars-readout .value { font-size: 1.8rem; font-weight: bold; line-height: 1; }

/* INTERFACE GRID */
.interface-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
  flex: 1;
}

/* PANELS */
.lcars-panel {
  border-top: 5px solid var(--lcars-purple);
  border-bottom: 5px solid var(--lcars-purple);
  padding: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.panel-label {
  font-size: 1.5rem;
  color: var(--lcars-purple);
  margin-bottom: 10px;
}

/* INPUTS */
.control-group label { display: block; color: var(--lcars-blue); margin-bottom: 5px; font-size: 1rem; }
.pill-inputs { display: flex; gap: 10px; }
input {
  background: black;
  border: 2px solid var(--lcars-orange);
  color: var(--lcars-orange);
  padding: 10px;
  border-radius: 20px;
  width: 100%;
  font-family: 'Antonio', sans-serif;
  font-size: 1.2rem;
  text-align: right;
}
input:focus { outline: none; background: #222; }

/* TOGGLES */
.lcars-toggles { display: flex; gap: 5px; }
.lcars-toggles button {
  flex: 1;
  background: var(--lcars-red);
  border: none;
  padding: 10px;
  border-radius: 20px;
  font-family: 'Antonio', sans-serif;
  font-weight: bold;
  cursor: pointer;
}
.lcars-toggles button.active { background: white; }

/* VISUALIZER */
.vis-panel {
  border: 2px solid var(--lcars-blue);
  border-radius: 30px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  background: #050505;
  min-height: 500px;
}
.vis-header { color: var(--lcars-blue); font-size: 1.5rem; margin-bottom: 10px; text-align: right; }

.scanner-bed {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.wall-grid {
  display: grid;
  gap: 2px;
  width: 90%;
  max-width: 800px;
}
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.8rem;
  border-radius: 4px; /* Slight rounded corners on tiles */
}
.arrow { font-size: 1.2rem; margin-top: -5px; color: black; opacity: 0.6; }

</style>