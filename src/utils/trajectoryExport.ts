import { jsPDF } from 'jspdf';
import { TrajectoryPlan } from '../types/trajectory';
import { DynamicSample } from '../types/dynamics';

/**
 * Trajectory Export Utilities: CSV, High-DPI PNG, and Vector PDF
 */

export interface ExportPlotOptions {
  dpi?: number;
  format?: 'png' | 'pdf';
  theme?: 'dark' | 'academic-white';
  robotName?: string;
}

/**
 * 1. Export Trajectory Timeseries to CSV Format
 */
export function exportTrajectoryToCSV(plan: TrajectoryPlan, robotId: string): void {
  if (!plan || plan.samples.length === 0) return;

  const dof = plan.samples[0].jointAngles.length;

  // Build header
  const headers = ['time_s'];
  for (let i = 0; i < dof; i++) headers.push(`q${i + 1}_deg`);
  for (let i = 0; i < dof; i++) headers.push(`dq${i + 1}_deg_s`);
  for (let i = 0; i < dof; i++) headers.push(`ddq${i + 1}_deg_s2`);
  headers.push('tcp_x_mm', 'tcp_y_mm', 'tcp_z_mm', 'tcp_linear_vel_mm_s', 'segment_index');

  const rows: string[] = [headers.join(',')];

  plan.samples.forEach((sample) => {
    const row = [
      sample.time.toFixed(4),
      ...sample.jointAngles.map((q) => q.toFixed(4)),
      ...sample.jointVelocities.map((dq) => dq.toFixed(4)),
      ...sample.jointAccelerations.map((ddq) => ddq.toFixed(4)),
      sample.tcpPosition.x.toFixed(2),
      sample.tcpPosition.y.toFixed(2),
      sample.tcpPosition.z.toFixed(2),
      sample.tcpLinearVelocity.toFixed(2),
      sample.segmentIndex.toString(),
    ];
    rows.push(row.join(','));
  });

  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = `${robotId}_trajectory_${plan.interpolationType}_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1b. Export Dynamic Tracking Response & Torques to CSV Format
 */
export function exportDynamicsToCSV(
  samples: DynamicSample[],
  robotId: string,
  controllerType: string = 'computed-torque'
): void {
  if (!samples || samples.length === 0) return;

  const dof = samples[0].qDeg.length;
  const headers = ['time_s'];
  for (let i = 0; i < dof; i++) headers.push(`q_act_${i + 1}_deg`);
  for (let i = 0; i < dof; i++) headers.push(`qd_act_${i + 1}_deg_s`);
  for (let i = 0; i < dof; i++) headers.push(`q_des_${i + 1}_deg`);
  for (let i = 0; i < dof; i++) headers.push(`error_${i + 1}_deg`);
  for (let i = 0; i < dof; i++) headers.push(`tau_${i + 1}_Nm`);
  for (let i = 0; i < dof; i++) headers.push(`tau_grav_${i + 1}_Nm`);
  headers.push('kinetic_energy_J', 'potential_energy_J', 'total_energy_J');

  const rows: string[] = [headers.join(',')];

  samples.forEach((s) => {
    const row = [
      s.time.toFixed(4),
      ...s.qDeg.map((q) => q.toFixed(4)),
      ...s.qdDeg.map((qd) => qd.toFixed(4)),
      ...s.qDesiredDeg.map((qd) => qd.toFixed(4)),
      ...s.errorDeg.map((e) => e.toFixed(4)),
      ...s.tau.map((t) => t.toFixed(3)),
      ...s.tauGravity.map((tg) => tg.toFixed(3)),
      s.kineticEnergy.toFixed(3),
      s.potentialEnergy.toFixed(3),
      s.totalEnergy.toFixed(3),
    ];
    rows.push(row.join(','));
  });

  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = `${robotId}_dynamics_${controllerType}_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper: Convert an SVG element to an Image via SVG blob
 */
function svgToImage(svgElement: SVGSVGElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);

    // Ensure xml namespace is present
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * 2. Export Subplots to High-DPI PNG (96, 150, 300, 600 DPI)
 */
export async function exportSubplotsToPNG(
  svgElements: SVGSVGElement[],
  titles: string[],
  options: {
    dpi: number;
    theme: 'dark' | 'academic-white';
    robotName: string;
    interpolationType: string;
    totalDuration: number;
  }
): Promise<void> {
  if (svgElements.length === 0) return;

  const dpi = options.dpi || 300;
  const scale = dpi / 96; // Standard CSS resolution is 96 DPI

  const baseWidth = 840;
  const basePlotHeight = 180;
  const headerHeight = 70;
  const padding = 20;
  const totalBaseHeight = headerHeight + svgElements.length * (basePlotHeight + padding) + padding;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(baseWidth * scale);
  canvas.height = Math.round(totalBaseHeight * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Scale context for DPI
  ctx.scale(scale, scale);

  const isDark = options.theme === 'dark';
  ctx.fillStyle = isDark ? '#0b1120' : '#ffffff';
  ctx.fillRect(0, 0, baseWidth, totalBaseHeight);

  // Document Title & Info Header
  ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
  ctx.font = 'bold 16px "SF Pro Display", system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Motion Kinematics Profile: ${options.robotName} (${options.interpolationType.toUpperCase()})`,
    padding,
    30
  );

  ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
  ctx.font = '11px "SF Mono", monospace';
  ctx.fillText(
    `Total Duration: ${options.totalDuration.toFixed(2)}s | Resolution: ${dpi} DPI | Exported: ${new Date().toLocaleString()}`,
    padding,
    50
  );

  // Divider line
  ctx.strokeStyle = isDark ? '#1e293b' : '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, 60);
  ctx.lineTo(baseWidth - padding, 60);
  ctx.stroke();

  // Render each subplot
  let currentY = headerHeight + 15;
  for (let i = 0; i < svgElements.length; i++) {
    const svg = svgElements[i];
    try {
      if (titles[i]) {
        ctx.fillStyle = isDark ? '#38bdf8' : '#0369a1';
        ctx.font = 'bold 12px "SF Mono", monospace';
        ctx.fillText(titles[i], padding, currentY - 6);
      }
      const img = await svgToImage(svg);
      ctx.drawImage(img, padding, currentY, baseWidth - padding * 2, basePlotHeight);
    } catch (e) {
      console.error('Error drawing subplot to canvas:', e);
    }
    currentY += basePlotHeight + padding + 15;
  }

  // Trigger PNG download
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const a = document.createElement('a');
  a.href = dataUrl;
  const filename = `${options.robotName}_motion_profile_${options.dpi}dpi.png`.replace(/\s+/g, '_');
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * 3. Export Subplots & Kinematics Report to Vector PDF
 */
export async function exportSubplotsToPDF(
  svgElements: SVGSVGElement[],
  titles: string[],
  options: {
    robotName: string;
    interpolationType: string;
    totalDuration: number;
    waypointsCount: number;
  }
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Title & Header Block
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(0, 0, pageWidth, 28, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(`ROBOT MOTION TRAJECTORY REPORT`, margin, 12);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184); // slate-400
  pdf.text(
    `Robot: ${options.robotName} | Method: ${options.interpolationType.toUpperCase()} | Waypoints: ${options.waypointsCount} | Total Time: ${options.totalDuration.toFixed(2)}s`,
    margin,
    20
  );

  // Summary Metrics Table
  let currentY = 36;
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Kinematic Subplots Analysis [q, dq/dt, d²q/dt²]', margin, currentY);

  currentY += 4;

  // Convert SVG subplots to high-res images and insert into PDF
  const plotWidthMm = contentWidth;
  const plotHeightMm = 55;

  for (let i = 0; i < svgElements.length; i++) {
    const svg = svgElements[i];
    try {
      if (titles[i]) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(14, 116, 144);
        pdf.text(titles[i], margin, currentY - 2);
      }
      const img = await svgToImage(svg);
      // Create a temporary canvas for high-DPI rendering
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 1600;
      tempCanvas.height = 450;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.fillStyle = '#ffffff';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        const imgData = tempCanvas.toDataURL('image/png', 0.95);
        pdf.addImage(imgData, 'PNG', margin, currentY, plotWidthMm, plotHeightMm);
      }
    } catch (err) {
      console.error('Error inserting plot into PDF:', err);
    }
    currentY += plotHeightMm + 6;
  }

  // Footer notes & Timestamp
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `Generated by Robotics Visualizer CAE Suite • Date: ${new Date().toISOString()} • Vector Academic Edition`,
    margin,
    pageHeight - 10
  );

  const filename = `${options.robotName}_trajectory_report_${options.interpolationType}.pdf`.replace(/\s+/g, '_');
  pdf.save(filename);
}
