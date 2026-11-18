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
/**
 * Helper: Convert an SVG element to an Image via SVG blob
 * Supports forceAcademicWhite to guarantee publication-grade pure white background
 */
function svgToImage(svgElement: SVGSVGElement, forceAcademicWhite: boolean = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    let targetSvg = svgElement;

    if (forceAcademicWhite) {
      // Clone SVG and replace dark background, text and grid lines with academic publication style
      const clone = svgElement.cloneNode(true) as SVGSVGElement;

      // 1. Force background rectangles to pure white
      const rects = clone.querySelectorAll('rect');
      rects.forEach((r) => {
        const fill = r.getAttribute('fill');
        if (
          fill &&
          (fill === '#090d16' ||
            fill === '#070a13' ||
            fill === '#0b1120' ||
            fill === '#020617' ||
            fill.includes('090d16') ||
            fill.includes('070a13'))
        ) {
          r.setAttribute('fill', '#ffffff');
          r.setAttribute('stroke', '#cbd5e1');
          r.setAttribute('stroke-width', '1');
        }
      });

      // 2. Adjust grid lines to crisp light gray
      const lines = clone.querySelectorAll('line');
      lines.forEach((l) => {
        const stroke = l.getAttribute('stroke');
        if (stroke === '#1e293b' || stroke === '#334155') {
          l.setAttribute('stroke', stroke === '#1e293b' ? '#e2e8f0' : '#475569');
          if (stroke === '#1e293b') {
            l.setAttribute('stroke-dasharray', '2 2');
            l.setAttribute('stroke-width', '0.8');
          }
        }
      });

      // 3. Adjust text to dark slate/black with academic publication font
      const texts = clone.querySelectorAll('text');
      texts.forEach((txt) => {
        const fill = txt.getAttribute('fill');
        if (fill === '#64748b' || fill === '#94a3b8' || fill === '#a1a1aa' || fill === '#cbd5e1') {
          txt.setAttribute('fill', '#0f172a');
        }
        txt.setAttribute('font-family', "'Times New Roman', Times, 'Computer Modern', serif, 'Inter', sans-serif");
        txt.setAttribute('font-weight', '600');
      });

      targetSvg = clone;
    }

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(targetSvg);

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

export interface ExportSubplotsPNGOptions {
  dpi?: number;
  theme?: 'dark' | 'academic-white';
  robotName: string;
  category?: 'kinematics' | 'dynamics';
  titlePrefix?: string;
  subtitleInfo?: string;
  interpolationType?: string;
  controllerType?: string;
  totalDuration?: number;
}

/**
 * 2. Export Subplots to High-DPI PNG (96, 150, 300, 600 DPI)
 * Supports both Kinematics and Dynamics & Control scopes
 */
export async function exportSubplotsToPNG(
  svgElements: SVGSVGElement[],
  titles: string[],
  options: ExportSubplotsPNGOptions
): Promise<void> {
  if (svgElements.length === 0) return;

  const dpi = options.dpi || 300;
  const scale = dpi / 96; // Standard CSS resolution is 96 DPI
  const isDark = options.theme === 'dark';
  const isDynamics = options.category === 'dynamics';

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

  ctx.fillStyle = isDark ? '#0b1120' : '#ffffff';
  ctx.fillRect(0, 0, baseWidth, totalBaseHeight);

  // Document Title & Info Header with IEEE/Elsevier academic formatting
  ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
  ctx.font = isDark
    ? 'bold 15px "SF Pro Display", system-ui, -apple-system, sans-serif'
    : 'bold 15px "Times New Roman", Times, "Computer Modern", serif';

  const mainTitle = isDynamics
    ? `IEEE Transactions Publication Telemetry: ${options.robotName} (${(options.controllerType || 'CTC').toUpperCase()})`
    : `Motion Kinematics Profile: ${options.robotName} (${(options.interpolationType || 'Trajectory').toUpperCase()})`;

  ctx.fillText(mainTitle, padding, 28);

  ctx.fillStyle = isDark ? '#94a3b8' : '#334155';
  ctx.font = isDark
    ? '11px "SF Mono", monospace'
    : 'italic 11px "Times New Roman", Times, "Computer Modern", serif';

  const subInfo = isDynamics
    ? `Controller: ${(options.controllerType || 'Computed Torque').toUpperCase()} | Duration: ${(options.totalDuration || 0).toFixed(2)}s | Resolution: ${dpi} DPI (Publication Standard)`
    : `Total Duration: ${(options.totalDuration || 0).toFixed(2)}s | Resolution: ${dpi} DPI | Profile: ${(options.interpolationType || 'UDT').toUpperCase()}`;

  ctx.fillText(subInfo, padding, 48);

  // Divider line
  ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, 58);
  ctx.lineTo(baseWidth - padding, 58);
  ctx.stroke();

  // Render each subplot
  let currentY = headerHeight + 15;
  for (let i = 0; i < svgElements.length; i++) {
    const svg = svgElements[i];
    try {
      if (titles[i]) {
        ctx.fillStyle = isDark ? '#38bdf8' : '#0f172a';
        ctx.font = isDark
          ? 'bold 12px "SF Mono", monospace'
          : 'bold 12px "Times New Roman", Times, serif';
        ctx.fillText(titles[i], padding, currentY - 6);
      }
      const img = await svgToImage(svg, !isDark);
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
  const filename = isDynamics
    ? `${options.robotName}_joint_torques_${options.controllerType || 'dynamics'}_${dpi}dpi.png`.replace(/\s+/g, '_')
    : `${options.robotName}_motion_profile_${options.interpolationType || 'kinematics'}_${dpi}dpi.png`.replace(/\s+/g, '_');
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export interface ExportSubplotsPDFOptions {
  robotName: string;
  category?: 'kinematics' | 'dynamics';
  theme?: 'dark' | 'academic-white';
  interpolationType?: string;
  controllerType?: string;
  totalDuration?: number;
  waypointsCount?: number;
  samplesCount?: number;
}

/**
 * 3. Export Subplots & Telemetry Report to Vector PDF
 * Formatted to IEEE Transactions / Elsevier international publication layout
 */
export async function exportSubplotsToPDF(
  svgElements: SVGSVGElement[],
  titles: string[],
  options: ExportSubplotsPDFOptions
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
  const isDynamics = options.category === 'dynamics';
  const isWhite = options.theme === 'academic-white' || options.theme !== 'dark';

  // Title & Header Block (Clean academic bar)
  pdf.setFillColor(isWhite ? 248 : 15, isWhite ? 250 : 23, isWhite ? 252 : 42);
  pdf.setDrawColor(203, 213, 225);
  pdf.rect(0, 0, pageWidth, 28, 'FD');

  pdf.setTextColor(isWhite ? 15 : 255, isWhite ? 23 : 255, isWhite ? 42 : 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  const docTitle = isDynamics
    ? 'ROBOT DYNAMICS & CONTROL PERFORMANCE REPORT (IEEE T-RO / T-MECH FORMAT)'
    : 'ROBOT MOTION KINEMATICS TRAJECTORY REPORT (PUBLICATION EDITION)';
  pdf.text(docTitle, margin, 12);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(isWhite ? 71 : 148, isWhite ? 85 : 163, isWhite ? 105 : 184);

  const metaSubtitle = isDynamics
    ? `Robot Target: ${options.robotName} | Control Law: ${(options.controllerType || 'Computed Torque Control').toUpperCase()} | Total Time: ${(options.totalDuration || 0).toFixed(2)}s | Model: Full RNE / Lagrange`
    : `Robot Target: ${options.robotName} | Method: ${(options.interpolationType || 'UDT').toUpperCase()} | Waypoints: ${options.waypointsCount || 0} | Total Time: ${(options.totalDuration || 0).toFixed(2)}s`;

  pdf.text(metaSubtitle, margin, 20);

  // Section Heading
  let currentY = 36;
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);

  const sectionHeading = isDynamics
    ? 'Actuated Joint Torques & Dynamic Control Telemetry [τ_i(t), e_i(t)]'
    : 'Kinematic Subplots Analysis [q, dq/dt, d²q/dt²]';
  pdf.text(sectionHeading, margin, currentY);

  currentY += 4;

  // Convert SVG subplots to high-res images and insert into PDF
  const plotWidthMm = contentWidth;
  const plotHeightMm = svgElements.length > 2 ? 46 : 58;

  for (let i = 0; i < svgElements.length; i++) {
    const svg = svgElements[i];
    try {
      if (titles[i]) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(isWhite ? 15 : 14, isWhite ? 23 : 116, isWhite ? 42 : 144);
        pdf.text(titles[i], margin, currentY - 2);
      }
      const img = await svgToImage(svg, isWhite);
      // High-res canvas for crisp vector embedding
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 1600;
      tempCanvas.height = 450;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.fillStyle = '#ffffff';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        const imgData = tempCanvas.toDataURL('image/png', 0.98);
        pdf.addImage(imgData, 'PNG', margin, currentY, plotWidthMm, plotHeightMm);
      }
    } catch (err) {
      console.error('Error inserting plot into PDF:', err);
    }
    currentY += plotHeightMm + 6;
  }

  // Footer notes & Timestamp conforming to academic reporting
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `Generated by Robotics Visualizer CAE Platform • Date: ${new Date().toISOString()} • IEEE Transactions on Robotics Standard`,
    margin,
    pageHeight - 8
  );

  const filename = isDynamics
    ? `${options.robotName}_dynamics_report_${options.controllerType || 'ctc'}.pdf`.replace(/\s+/g, '_')
    : `${options.robotName}_trajectory_report_${options.interpolationType || 'udt'}.pdf`.replace(/\s+/g, '_');
  pdf.save(filename);
}
