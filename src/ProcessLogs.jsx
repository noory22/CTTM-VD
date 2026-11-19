import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Download,
  Camera,
  Power,
  ChevronDown,
  FileText,
  X,
  Trash2,
  Calendar,
  Clock,
  TrendingUp,
  Info,
  Thermometer,
  Ruler,
  AlertCircle,
  Gauge,
  RotateCcw,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { useNavigate } from "react-router-dom";

const ProcessLogs = () => {
  const navigate = useNavigate();
  const [logFiles, setLogFiles] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [forwardData, setForwardData] = useState([]);
  const [backwardData, setBackwardData] = useState([]);


  const [showCurvesDropdown, setShowCurvesDropdown] = useState(false);
  const [csvToast, setCsvToast] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingLogName, setDownloadingLogName] = useState(null);
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const chartContainerRef = useRef(null);

  useEffect(() => {
    if (csvToast) {
      const timer = setTimeout(() => setCsvToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [csvToast]);

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const getCurveLabelForDistance = (dist, curves) => {
    if (!curves || curves.length === 0) return "--";
    let matchedCurve = "Straight";
    for (const c of curves) {
      if (dist >= c.distance) {
        matchedCurve = c.label;
      } else {
        break;
      }
    }
    return matchedCurve;
  };

  const handleDownloadCsv = async (targetLog = null) => {
    const log = targetLog || selectedLog;
    if (!log) {
      setCsvToast({ type: "error", message: "Select a log first" });
      return;
    }

    try {
      setDownloadingLogName(log.filename);
      setIsDownloading(true);

      let configData = log.configData;
      let forwardPts = forwardData;
      let backwardPts = backwardData;

      // If downloading a log that is not currently selected, read it from disk
      if (!configData || log.filename !== selectedLog?.filename) {
        const result = await window.api.readLogFile(log.filePath);
        if (!result || !result.success) {
          throw new Error(result?.error || "Failed to read log file");
        }
        configData = result.configData || {};
        const pathLength = configData.pathlength || configData.pathLength;
        const motion = extractFullMotionData(result.data, pathLength);
        forwardPts = motion.forwardData;
        backwardPts = motion.backwardData;
      }

      const configName =
        configData.configName ||
        log.configName ||
        log.displayName ||
        "Unknown";
      const pathLength = configData.pathlength || configData.pathLength || "--";
      const thresholdForce = configData.thresholdForce || "--";
      const insertionLength = configData.insertionLength || "--";
      const retractionLength = configData.retractionLength || "--";

      let parsedCurves = [];
      if (configData.curveDistances) {
        try {
          const raw =
            typeof configData.curveDistances === "string"
              ? JSON.parse(configData.curveDistances)
              : configData.curveDistances;
          parsedCurves = Object.entries(raw)
            .map(([label, dist]) => ({
              label: String(label).startsWith("Curve") ? String(label) : `Curve ${label}`,
              distance: parseFloat(dist),
            }))
            .filter((c) => !isNaN(c.distance))
            .sort((a, b) => a.distance - b.distance);
        } catch (e) {
          console.error("Error parsing curve distances:", e);
        }
      }

      const numberOfCurves =
        configData.numberOfCurves && configData.numberOfCurves !== "--"
          ? configData.numberOfCurves
          : parsedCurves.length > 0
          ? parsedCurves.length
          : "--";

      const logDateTime = `${formatDate(log.date)} ${formatTime(log.date, log.time)}`;

      const metadata = [
        ["Configuration Name", configName],
        ["Path Length (mm)", pathLength],
        ["Threshold Force (mN)", thresholdForce],
        ["Insertion Stroke Length (mm)", insertionLength],
        ["Retraction Stroke Length (mm)", retractionLength],
        ["Number of Curves", numberOfCurves],
        ["Log date/time", logDateTime],
      ];

      const metadataLines = metadata
        .map((row) => row.map(escapeCsv).join(","))
        .join("\n");

      const headerRow = ["Curve", "Direction (Insertion/Retraction)", "Distance (mm)", "Force (mN)"]
        .map(escapeCsv)
        .join(",");

      const dataPoints = [
        ...forwardPts.map((p) => ({ ...p, direction: "Insertion" })),
        ...backwardPts.map((p) => ({ ...p, direction: "Retraction" })),
      ];

      const dataRows = dataPoints
        .map((p) => {
          const curve = p.curve || getCurveLabelForDistance(parseFloat(p.distance), parsedCurves);
          const direction = p.direction;
          const distVal = typeof p.distance === "number" ? p.distance.toFixed(2) : p.distance;
          const forceVal = typeof p.force === "number" ? p.force.toFixed(2) : p.force;
          return [curve, direction, distVal, forceVal].map(escapeCsv).join(",");
        })
        .join("\n");

      const csvContent = `${metadataLines}\n\n${headerRow}\n${dataRows}\n`;

      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const timeStampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      const baseLogName =
        configData.configName ||
        log.configName ||
        log.displayName ||
        (log.filename ? log.filename.replace(/\.csv$/i, "") : "Log");
      const fileName = `${baseLogName}_${timeStampStr}.csv`;

      const res = await window.api.saveCsv({ fileName, csvContent });

      if (res && res.success) {
        const savedFileName = res.filePath ? res.filePath.split(/[\\/]/).pop() : fileName;
        setCsvToast({
          type: "success",
          message: `Saved to Downloads: ${savedFileName}`,
        });
      } else {
        setCsvToast({
          type: "error",
          message: `Failed to save CSV: ${res?.error || "Unknown error"}`,
        });
      }
    } catch (err) {
      console.error("Error generating CSV:", err);
      setCsvToast({
        type: "error",
        message: `Error downloading CSV: ${err.message}`,
      });
    } finally {
      setIsDownloading(false);
      setDownloadingLogName(null);
    }
  };

  const handleTakeSnapshot = async () => {
    if (!selectedLog) {
      setCsvToast({ type: "error", message: "Select a log first" });
      return;
    }

    try {
      setIsSnapshotting(true);

      const container = chartContainerRef.current;
      if (!container) {
        throw new Error("Chart container not found");
      }

      const svgEl = container.querySelector("svg");
      if (!svgEl) {
        throw new Error("Chart SVG not found");
      }

      // Clone SVG and ensure it is self-contained
      const clonedSvg = svgEl.cloneNode(true);
      clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      const rect = svgEl.getBoundingClientRect();
      const svgW = rect.width || parseFloat(svgEl.getAttribute("width")) || 800;
      const svgH = rect.height || parseFloat(svgEl.getAttribute("height")) || 400;
      clonedSvg.setAttribute("width", svgW);
      clonedSvg.setAttribute("height", svgH);
      if (!clonedSvg.getAttribute("viewBox")) {
        clonedSvg.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);
      }

      // Ensure text elements have font family
      clonedSvg.querySelectorAll("text").forEach((txt) => {
        txt.setAttribute(
          "font-family",
          "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        );
      });

      // Serialize SVG to data blob
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clonedSvg);
      const svgBlob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
      });
      const blobUrl = URL.createObjectURL(svgBlob);

      const chartImg = new Image();
      await new Promise((resolve, reject) => {
        chartImg.onload = () => resolve();
        chartImg.onerror = () =>
          reject(new Error("Failed to render chart image"));
        chartImg.src = blobUrl;
      });
      URL.revokeObjectURL(blobUrl);

      // Create high-resolution Canvas (1600 x 1100)
      const canvas = document.createElement("canvas");
      const canvasW = 1600;
      const canvasH = 1100;
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize 2D canvas context");

      // Helper for rounded rectangles
      const drawRoundRect = (
        x,
        y,
        w,
        h,
        r,
        fillStyle = null,
        strokeStyle = null,
        strokeWidth = 1
      ) => {
        const radius = typeof r === "number" ? r : (r[0] || 0);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, h, r);
        } else {
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + w - radius, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
          ctx.lineTo(x + w, y + h - radius);
          ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
          ctx.lineTo(x + radius, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
        }
        if (fillStyle) {
          ctx.fillStyle = fillStyle;
          ctx.fill();
        }
        if (strokeStyle) {
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = strokeWidth;
          ctx.stroke();
        }
      };

      // Fill canvas background
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Main inner card container
      drawRoundRect(25, 25, canvasW - 50, canvasH - 50, 18, "#ffffff", "#e2e8f0", 2);

      // Parse metadata and config details
      const configData = selectedLog.configData || {};
      const configName =
        configData.configName ||
        selectedLog.configName ||
        selectedLog.displayName ||
        "Unknown";
      const pathLength = configData.pathlength || configData.pathLength || "--";
      const thresholdForce = configData.thresholdForce || "--";
      const insertionLength = configData.insertionLength || "--";
      const retractionLength = configData.retractionLength || "--";

      let parsedCurves = [];
      if (configData.curveDistances) {
        try {
          const raw =
            typeof configData.curveDistances === "string"
              ? JSON.parse(configData.curveDistances)
              : configData.curveDistances;
          parsedCurves = Object.entries(raw)
            .map(([label, dist]) => ({
              label: String(label).startsWith("Curve") ? String(label) : `Curve ${label}`,
              distance: parseFloat(dist),
            }))
            .filter((c) => !isNaN(c.distance))
            .sort((a, b) => a.distance - b.distance);
        } catch (e) {
          console.error("Error parsing curve distances:", e);
        }
      }

      const numberOfCurves =
        configData.numberOfCurves && configData.numberOfCurves !== "--"
          ? configData.numberOfCurves
          : parsedCurves.length > 0
          ? parsedCurves.length
          : "--";

      const curvesSummary =
        parsedCurves.length > 0
          ? parsedCurves.map((c) => `${c.label}: ${c.distance}mm`).join(", ")
          : "None";

      const logDateTime = `${formatDate(selectedLog.date)} ${formatTime(selectedLog.date, selectedLog.time)}`;

      // 1. Header Section
      // App badge
      drawRoundRect(55, 50, 75, 28, 6, "#2563eb", null);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.fillText("CTTM", 74, 69);

      // Title
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
      ctx.fillText("Force vs Distance Process Log Report", 145, 70);

      // Subtitle
      ctx.fillStyle = "#64748b";
      ctx.font = "14px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        `Log File: ${selectedLog.displayName || selectedLog.filename || "Log"}   •   Tested: ${logDateTime}`,
        55,
        106
      );

      // Export Date (right-aligned)
      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(
        `Snapshot Date: ${new Date().toLocaleString()}`,
        canvasW - 55,
        70
      );
      ctx.textAlign = "left";

      // Separator
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(55, 126);
      ctx.lineTo(canvasW - 55, 126);
      ctx.stroke();

      // 2. Configuration Parameters
      ctx.fillStyle = "#475569";
      ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
      ctx.fillText("TEST CONFIGURATION PARAMETERS", 55, 146);

      const paramCards = [
        {
          label: "CONFIG NAME",
          value: configName,
          accent: "#2563eb",
          bg: "#eff6ff",
          border: "#bfdbfe",
        },
        {
          label: "PATH LENGTH",
          value: `${pathLength} mm`,
          accent: "#059669",
          bg: "#ecfdf5",
          border: "#a7f3d0",
        },
        {
          label: "THRESHOLD FORCE",
          value: `${thresholdForce} mN`,
          accent: "#0284c7",
          bg: "#f0f9ff",
          border: "#bae6fd",
        },
        {
          label: "INSERTION STROKE",
          value: `${insertionLength} mm`,
          accent: "#7c3aed",
          bg: "#f5f3ff",
          border: "#ddd6fe",
        },
        {
          label: "RETRACTION STROKE",
          value: `${retractionLength} mm`,
          accent: "#4f46e5",
          bg: "#eef2ff",
          border: "#c7d2fe",
        },
        {
          label: `CURVES (${numberOfCurves})`,
          value: curvesSummary,
          accent: "#d97706",
          bg: "#fffbeb",
          border: "#fde68a",
        },
      ];

      const startX = 55;
      const cardW = 236;
      const cardH = 78;
      const gap = 14;

      paramCards.forEach((c, idx) => {
        const cx = startX + idx * (cardW + gap);
        drawRoundRect(cx, 156, cardW, cardH, 10, c.bg, c.border, 1.5);
        drawRoundRect(cx, 156, cardW, 4, 3, c.accent, null);

        // Label
        ctx.fillStyle = "#64748b";
        ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
        ctx.fillText(c.label, cx + 12, 178);

        // Value
        ctx.fillStyle = c.accent;
        ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
        let valText = String(c.value || "--");
        if (ctx.measureText(valText).width > cardW - 24) {
          while (valText.length > 3 && ctx.measureText(valText + "...").width > cardW - 24) {
            valText = valText.slice(0, -1);
          }
          valText += "...";
        }
        ctx.fillText(valText, cx + 12, 210);
      });

      // 3. Graph Analysis Section
      ctx.fillStyle = "#475569";
      ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
      ctx.fillText("FORCE VS DISTANCE ANALYSIS", 55, 272);

      // Legend in Header
      // Insertion legend
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(canvasW - 460, 264, 26, 4);
      ctx.fillStyle = "#334155";
      ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
      ctx.fillText("Insertion", canvasW - 425, 272);

      // Retraction legend
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(canvasW - 320, 264, 26, 4);
      ctx.fillStyle = "#334155";
      ctx.fillText("Retraction", canvasW - 285, 272);

      // Curves boundary legend
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(canvasW - 170, 266);
      ctx.lineTo(canvasW - 144, 266);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#334155";
      ctx.fillText("Curves", canvasW - 135, 272);

      // Chart background card
      drawRoundRect(55, 288, 1490, 700, 12, "#ffffff", "#e2e8f0", 1);

      // Draw SVG chart image
      ctx.drawImage(chartImg, 65, 298, 1470, 680);

      // 4. Footer Section
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(55, 1008);
      ctx.lineTo(canvasW - 55, 1008);
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        "CTTM Catheter Trackability Testing Machine • Revive Medical Technologies",
        55,
        1032
      );

      ctx.textAlign = "right";
      ctx.fillText(
        "Process Verification Record • Graph Snapshot",
        canvasW - 55,
        1032
      );
      ctx.textAlign = "left";

      // Export as PNG
      const dataUrl = canvas.toDataURL("image/png");

      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const timeStampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      const baseLogName =
        configData.configName ||
        selectedLog.configName ||
        selectedLog.displayName ||
        (selectedLog.filename ? selectedLog.filename.replace(/\.csv$/i, "") : "Log");
      const fileName = `${baseLogName}_Snapshot_${timeStampStr}.png`;

      const res = await window.api.saveSnapshot({ fileName, dataUrl });

      if (res && res.success) {
        const savedFileName = res.filePath ? res.filePath.split(/[\\/]/).pop() : fileName;
        setCsvToast({
          type: "success",
          message: `Saved to Downloads: ${savedFileName}`,
        });
      } else {
        setCsvToast({
          type: "error",
          message: `Failed to save snapshot: ${res?.error || "Unknown error"}`,
        });
      }
    } catch (err) {
      console.error("Error generating snapshot:", err);
      setCsvToast({
        type: "error",
        message: `Error taking snapshot: ${err.message}`,
      });
    } finally {
      setIsSnapshotting(false);
    }
  };

  useEffect(() => {
    loadLogFiles();
  }, []);

  const loadLogFiles = async () => {
    try {
      setIsLoading(true);
      const logFiles = await window.api.getLogFiles();
      setLogFiles(logFiles);
    } catch (error) {
      console.error("Error loading log files:", error);
      alert("Error loading log files: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const extractFullMotionData = (rawData, maxDistanceStr) => {
    if (!rawData || rawData.length === 0) return { forwardData: [], backwardData: [] };

    // Use provided maxDistance or default to finding the peak
    let maxDistance;
    if (maxDistanceStr && maxDistanceStr !== "--") {
      maxDistance = parseFloat(maxDistanceStr);
    } else {
      // Find the maximum distance in the data
      maxDistance = Math.max(...rawData.map(d => parseFloat(d.distance)));
    }

    // Sort by time order (assuming rawData is already in sequence)
    const sorted = [...rawData];
    let forward = [];
    let backward = [];
    let reachedMax = false;
    let lastDistance = -1;

    for (let i = 0; i < sorted.length; i++) {
      const d = parseFloat(sorted[i].distance);

      if (!reachedMax) {
        forward.push({
          ...sorted[i],
          distance: d,
          force: parseFloat(sorted[i].force)
        });
        // Check if we've reached near the maximum distance
        if (d >= maxDistance - 0.5) { // Small tolerance
          reachedMax = true;
        }
      } else {
        // Now in retraction phase
        if (d <= lastDistance) {
          backward.push({
            ...sorted[i],
            distance: d,
            force: parseFloat(sorted[i].force)
          });
        }
      }
      lastDistance = d;
    }

    console.log("Forward count:", forward.length);
    console.log("Backward count:", backward.length);
    console.log("Max distance:", maxDistance);
    return { forwardData: forward, backwardData: backward };
  };

  const handleLogSelection = async (log) => {
    try {
      setIsLoading(true);

      // Read the actual CSV file data
      const result = await window.api.readLogFile(log.filePath);

      if (result.success) {
        // Use the config data from CSV
        const configData = result.configData;
        const pathLength = configData.pathlength || configData.pathLength;

        // Extract forward and backward motion data
        const { forwardData, backwardData } = extractFullMotionData(result.data, pathLength);

        setForwardData(forwardData);
        setBackwardData(backwardData);

        setSelectedLog({
          ...log,
          forwardData,
          backwardData,
          configData: configData,
          rawData: result.rawData,
        });
      } else {
        alert("Error reading log file: " + result.error);
      }
    } catch (error) {
      console.error("Error selecting log:", error);
      alert("Error reading log file");
    } finally {
      setIsLoading(false);
      setShowDropdown(false);
    }
  };

  const handleDeleteLog = async (logToDelete = null) => {
    const targetLog = logToDelete || selectedLog;
    if (!targetLog) return;

    setIsLoading(true);

    try {
      const result = await window.api.deleteLogFile(targetLog.filePath);

      if (result.success) {
        // Remove from log files
        const updatedLogs = logFiles.filter(
          (log) => log.filename !== targetLog.filename
        );
        setLogFiles(updatedLogs);

        // Reset selection if deleted log was selected
        if (selectedLog && selectedLog.filename === targetLog.filename) {
          setSelectedLog(null);
          setForwardData([]);
          setBackwardData([]);
        }

        setShowDeleteConfirm(false);
        setShowSuccessMessage(true);

        // Auto hide success message after 2 seconds
        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 2000);
      } else {
        alert("Error deleting log file: " + result.error);
      }
    } catch (error) {
      console.error("Error deleting log file:", error);
      alert("Error deleting log file. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAllLogs = async () => {
    setIsLoading(true);

    try {
      // Delete all log files one by one
      const deletePromises = logFiles.map((log) =>
        window.api.deleteLogFile(log.filePath)
      );

      await Promise.all(deletePromises);

      setLogFiles([]);
      setSelectedLog(null);
      setForwardData([]);
      setBackwardData([]);
      setShowDeleteAllConfirm(false);
      setShowSuccessMessage(true);

      // Auto hide success message after 2 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 2000);
    } catch (error) {
      console.error("Error deleting all log files:", error);
      alert("Error deleting log files. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateStr, timeStr) => {
    try {
      if (!timeStr) return "--";

      // Convert filename timestamp to valid ISO
      const isoTime = timeStr.replace(
        /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
        "$1T$2:$3:$4.$5Z"
      );

      const date = new Date(isoTime);
      if (isNaN(date.getTime())) return "--";

      // JS automatically converts UTC → local timezone
      return date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "--";
    }
  };

  const renderCurveReferenceLines = () => {
    if (!selectedLog?.configData?.curveDistances) return null;

    const curveDistances = selectedLog.configData.curveDistances;

    return Object.entries(curveDistances).map(([curveName, distance]) => (
      <ReferenceLine
        key={curveName}
        x={parseFloat(distance)}
        stroke="#ef4444"
        strokeWidth={2}
        strokeDasharray="4 4"
        label={{
          value: `Curve ${curveName}`,
          position: "top",
          fill: "#ef4444",
          fontSize: 12,
        }}
      />
    ));
  };

  // Combine all data for statistics
  const getAllData = () => {
    return [...forwardData, ...backwardData];
  };

  return (
    <div
      // className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6 ${showDeleteConfirm || showDeleteAllConfirm || showSuccessMessage ? "backdrop-blur-sm" : ""}`}
      // className={`h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-2 sm:p-3 md:p-4 overflow-hidden ${showDeleteConfirm || showDeleteAllConfirm || showSuccessMessage ? "backdrop-blur-sm" : ""}`}
            className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-2 sm:p-3 md:p-4 overflow-y-auto ${showDeleteConfirm || showDeleteAllConfirm || showSuccessMessage ? "backdrop-blur-sm" : ""}`}

    >
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              Process Logs
            </h1>
          </div>
          <div className="flex items-center space-x-2 lg:space-x-3">
            {/* Snapshot Button */}
            <button
              onClick={handleTakeSnapshot}
              disabled={!selectedLog || isSnapshotting || isLoading}
              title={selectedLog ? "Take snapshot of graph and configuration" : "Select a log file to take snapshot"}
              className="group bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed disabled:shadow-none text-white rounded-xl lg:rounded-2xl w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 disabled:hover:translate-y-0 shadow-lg hover:shadow-xl border border-blue-400/30 flex-shrink-0"
            >
              {isSnapshotting ? (
                <div className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 group-hover:scale-110 transition-transform duration-300" />
              )}
            </button>

            {/* Help Button */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="group bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl lg:rounded-2xl w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-xl border border-blue-400/30"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 group-hover:scale-110 transition-transform duration-300" />
            </button>
            <button
              onClick={() => {
                const confirmed = window.confirm(
                  "Are you sure you want to exit?"
                );
                if (confirmed) {
                  window.close();
                }
              }}
              className="group bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl lg:rounded-2xl w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-xl border border-red-400/30 flex-shrink-0"
            >
              <Power className="w-3 h-3 sm:w-5 sm:h-5 lg:w-6 lg:h-6 group-hover:scale-110 transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        {/* <div className="grid grid-cols-1 xl:grid-cols-4 gap-6"> */}
        {/* <div className="grid grid-cols-1 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4 h-[calc(100vh-100px)]"> */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4 min-h-[calc(100vh-120px)]">
          {/* Left Panel - Log Selection & Config Info */}
          {/* <div className="xl:col-span-1 space-y-6"> */}
          {/* <div className="xl:col-span-1 space-y-2 sm:space-y-3 md:space-y-4 overflow-y-auto h-full pr-1"> */}
          {/* <div className="xl:col-span-1 space-y-2 sm:space-y-3 md:space-y-4 overflow-y-auto h-full pr-1 pb-4"> */}
          <div className="xl:col-span-1 space-y-2 sm:space-y-3 md:space-y-4 pr-1 pb-4">
            {/* Log File Selector */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4 text-left flex items-center justify-between hover:from-blue-100 hover:to-blue-150 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-800">
                      Select Log File
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-blue-600 transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Dropdown */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
                    {logFiles.length === 0 ? (
                      <div className="p-6 text-center text-slate-500">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No log files found</p>
                        <p className="text-sm mt-1">
                          Process logs will appear here after running tests
                        </p>
                      </div>
                    ) : (
                      logFiles.map((log) => (
                        <div
                          key={log.filename}
                          onClick={() => handleLogSelection(log)}
                          className={`w-full p-3.5 sm:p-4 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors duration-150 cursor-pointer flex items-center justify-between group ${
                            selectedLog?.filename === log.filename ? "bg-blue-50/70" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <p className="font-medium text-slate-800 truncate">
                              {log.displayName}
                            </p>
                            <div className="flex items-center space-x-4 mt-1 text-xs text-slate-500">
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{formatDate(log.date)}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatTime(log.date, log.time)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Simple Download Icon on the right side of list item */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadCsv(log);
                            }}
                            disabled={downloadingLogName === log.filename}
                            title="Download CSV"
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100/70 rounded-lg transition-all flex-shrink-0"
                          >
                            {downloadingLogName === log.filename ? (
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Log Info */}
              {selectedLog && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-green-800 font-medium text-xs">
                        Selected Log:
                      </span>
                    </div>
                    <p className="text-green-700 text-sm font-bold truncate">
                      {selectedLog.displayName}
                    </p>
                    <div className="flex items-center space-x-3 mt-1.5 text-xs text-green-600">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(selectedLog.date)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {formatTime(selectedLog.date, selectedLog.time)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Simple Download Icon on the right side of the selected log file name */}
                  <button
                    type="button"
                    onClick={() => handleDownloadCsv(selectedLog)}
                    disabled={downloadingLogName === selectedLog.filename || isDownloading}
                    title="Download CSV"
                    className="p-2.5 text-green-700 hover:text-white bg-green-200/70 hover:bg-green-600 rounded-xl transition-all shadow-sm hover:shadow flex-shrink-0"
                  >
                    {downloadingLogName === selectedLog.filename || isDownloading ? (
                      <div className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Configuration Details Panel */}
            {selectedLog && selectedLog.configData && (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>Configuration Details</span>
                </h3>

                <div className="space-y-4">
                  {/* Config Name */}
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <p className="text-slate-700 text-sm font-medium">
                        Configuration Name
                      </p>
                    </div>
                    <p className="text-blue-700 font-bold text-lg">
                      {selectedLog.configData.configName || "Unknown"}
                    </p>
                  </div>

                  {/* Main Parameters Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Path Length */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 border border-green-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <Ruler className="w-4 h-4 text-green-600" />
                        <p className="text-slate-600 text-xs font-medium">
                          Path Length
                        </p>
                      </div>
                      <p className="text-green-700 font-bold">
                        {selectedLog.configData.pathlength || selectedLog.configData.pathLength || "--"} mm
                      </p>
                    </div>

                    {/* Threshold Force */}
                    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-3 border border-cyan-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <Gauge className="w-4 h-4 text-blue-600" />
                        <p className="text-slate-600 text-xs font-medium">
                          Threshold Force
                        </p>
                      </div>
                      <p className="text-blue-700 font-bold">
                        {selectedLog.configData.thresholdForce || "--"} mN
                      </p>
                    </div>

                    {/* Temperature */}
                    {/*<div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-3 border border-orange-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <Thermometer className="w-4 h-4 text-orange-600" />
                        <p className="text-slate-600 text-xs font-medium">
                          Temperature
                        </p>
                      </div>
                      <p className="text-orange-700 font-bold">
                        {selectedLog.configData.temperature || "--"} °C
                      </p>
                    </div> */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-3 border border-purple-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <RotateCcw className="w-4 h-4 text-purple-600" />
                        <p className="text-slate-600 text-xs font-medium">
                          Insertion Stroke Length
                        </p>
                      </div>
                      <p className="text-purple-700 font-bold">
                        {selectedLog.configData.insertionLength || "--"} mm
                      </p>
                    </div>

                    {/* Retraction Length */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-3 border border-purple-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <RotateCcw className="w-4 h-4 text-purple-600" />
                        <p className="text-slate-600 text-xs font-medium">
                          Retraction Stroke Length
                        </p>
                      </div>
                      <p className="text-purple-700 font-bold">
                        {selectedLog.configData.retractionLength || "--"} mm
                      </p>
                    </div>
                  </div>

                  {/* Number of Curves */}
                  {/* {selectedLog.configData.numberOfCurves &&
                    selectedLog.configData.numberOfCurves !== "--" && (
                      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-4 border border-yellow-200">
                        <div className="flex items-center space-x-2 mb-1">
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                          <p className="text-slate-700 text-sm font-medium">
                            Number of Curves
                          </p>
                        </div>
                        <p className="text-yellow-700 font-bold text-lg">
                          {selectedLog.configData.numberOfCurves}
                        </p>
                      </div>
                    )} */}
                                    {/* Number of Curves with Dropdown */}
                  {selectedLog.configData.numberOfCurves &&
                    selectedLog.configData.numberOfCurves !== "--" && (
                      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl border border-yellow-200">
                        <button
                          onClick={() => setShowCurvesDropdown(!showCurvesDropdown)}
                          className="w-full p-4 flex items-center justify-between hover:bg-yellow-100/50 transition-colors rounded-xl"
                        >
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                            <p className="text-slate-700 text-sm font-medium">
                              Number of Curves
                            </p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-yellow-700 font-bold text-lg">
                              {selectedLog.configData.numberOfCurves}
                            </span>
                            <ChevronDown
                              className={`w-5 h-5 text-yellow-600 transition-transform duration-200 ${
                                showCurvesDropdown ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </button>

                        {/* Curves Dropdown Content */}
                        {showCurvesDropdown && selectedLog.configData.curveDistances && (
                          <div className="max-h-48 overflow-y-auto border-t border-yellow-200 p-3 space-y-2">
                            {Object.entries(selectedLog.configData.curveDistances).map(
                              ([curveName, distance]) => (
                                <div
                                  key={curveName}
                                  className="flex justify-between items-center bg-white rounded-lg p-2 hover:bg-yellow-50 transition-colors"
                                >
                                  <span className="text-slate-700 text-sm font-medium">
                                    Curve {curveName}
                                  </span>
                                  <span className="text-red-600 font-bold">
                                    {distance} mm
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}

                  {/* Curve Distances */}
                  {/* {selectedLog.configData.curveDistances &&
                    Object.keys(selectedLog.configData.curveDistances).length >
                    0 && (
                      <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-4 border border-red-200">
                        <div className="flex items-center space-x-2 mb-3">
                          <TrendingUp className="w-4 h-4 text-red-600" />
                          <p className="text-slate-700 text-sm font-medium">
                            Curve Distances
                          </p>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(
                            selectedLog.configData.curveDistances
                          ).map(([curveName, distance]) => (
                            <div
                              key={curveName}
                              className="flex justify-between items-center bg-white/50 rounded-lg p-2"
                            >
                              <span className="text-slate-700 text-sm font-medium">
                                Curve {curveName}
                              </span>
                              <span className="text-red-600 font-bold">
                                {distance} mm
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )} */}
                </div>
              </div>
            )}

            {/* Delete Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  if (selectedLog) {
                    setDeleteTarget(selectedLog);
                    setShowDeleteConfirm(true);
                  } else {
                    alert("Please select a log file to delete.");
                  }
                }}
                disabled={!selectedLog || isLoading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl disabled:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Selected</span>
              </button>

              <button
                onClick={() => {
                  if (logFiles.length > 0) {
                    setShowDeleteAllConfirm(true);
                  } else {
                    alert("No log files to delete.");
                  }
                }}
                disabled={logFiles.length === 0 || isLoading}
                className="w-full bg-red-700 hover:bg-red-800 disabled:bg-red-400 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl disabled:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete All Logs</span>
              </button>
            </div>
          </div>

          {/* Right Panel - Graph and Data */}
          {/* <div className="xl:col-span-3 space-y-6"> */}
          {/* <div className="xl:col-span-3 h-full flex flex-col"> */}
          <div className="xl:col-span-3 h-full flex flex-col min-h-[400px] md:min-h-0">
            {/* Force vs Distance Graph */}
            {/* <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6"> */}
            {/* <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-3 sm:p-4 md:p-5 flex-1 flex flex-col"> */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-3 sm:p-4 md:p-5 flex-1 flex flex-col min-h-[350px] md:min-h-0">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">
                      Force vs Distance Analysis
                    </h2>
                    <p className="text-slate-500 text-xs font-medium">Logged data analysis</p>
                    {/* <p className="text-slate-600 text-sm">
                      Insertion (0 → Max) and Retraction (Max → 0)
                    </p> */}
                  </div>
                </div>
                {selectedLog && (
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-6 bg-slate-50/50 px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-1 bg-blue-500 rounded-full shadow-sm shadow-blue-500/50" />
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Insertion</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-1 bg-red-500 rounded-full shadow-sm shadow-red-500/50" />
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Retraction</span>
                      </div>
                    </div>

                    <button
                      onClick={handleTakeSnapshot}
                      disabled={isSnapshotting || isLoading}
                      title="Take snapshot of graph with configuration"
                      className="p-2.5 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-600 rounded-xl border border-blue-200 shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
                    >
                      {isSnapshotting ? (
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {selectedLog ? (
                // <div className="h-96 relative">
                // <div className="h-[600px] relative">
                // <div className="h-full relative">
                <div ref={chartContainerRef} className="relative w-full" style={{ minHeight: '300px', height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="distance"
                        type="number"
                        domain={[0, 'dataMax']}
                        stroke="#64748b"
                        label={{
                          value: "Distance (mm)",
                          position: "insideBottom",
                          offset: -10,
                          style: { fill: "#64748b", fontWeight: "bold" },
                        }}
                      />
                      <YAxis
                        stroke="#64748b"
                        label={{
                          value: "Force (mN)",
                          angle: -90,
                          position: "insideLeft",
                          style: { fill: "#64748b", fontWeight: "bold" },
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "2px solid #e2e8f0",
                          borderRadius: "12px",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                          padding: "12px",
                        }}
                        formatter={(value) => [`${value.toFixed(3)} mN`, "Force"]}
                        labelFormatter={(label) => `Distance: ${label} mm`}
                      />


                      {renderCurveReferenceLines()}

                      {/* Insertion (Forward Motion) - Blue */}
                      <Line
                        data={forwardData}
                        type="monotone"
                        dataKey="force"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                        name="Insertion"
                        isAnimationActive={false}
                      />

                      {/* Retraction (Backward Motion) - Red */}
                      <Line
                        data={backwardData}
                        type="monotone"
                        dataKey="force"
                        stroke="#ef4444"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2 }}
                        name="Retraction"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                // <div className="h-96 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-dashed border-slate-200">
                // <div className="h-[600px] flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-dashed border-slate-200">
                // <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-dashed border-slate-200">
                <div className="w-full min-h-[300px] h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-dashed border-slate-200">
                  <div className="text-center text-slate-500">
                    <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium text-slate-600">
                      Select a log file to view analysis
                    </p>
                    <p className="text-sm mt-2 text-slate-500">
                      Force vs Distance graph will be displayed here
                    </p>
                  </div>
                </div>
              )}

              {/* Graph Statistics */}
              {/*  {selectedLog && (forwardData.length > 0 || backwardData.length > 0) && (
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                    <p className="text-blue-700 text-sm font-medium mb-1">
                      Insertion Points
                    </p>
                    <p className="text-blue-800 font-bold text-lg">
                      {forwardData.length}
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
                    <p className="text-red-700 text-sm font-medium mb-1">
                      Retraction Points
                    </p>
                    <p className="text-red-800 font-bold text-lg">
                      {backwardData.length}
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                    <p className="text-green-700 text-sm font-medium mb-1">
                      Max Force
                    </p>
                    <p className="text-green-800 font-bold text-lg">
                      {Math.max(
                        ...forwardData.map(d => d.force || 0),
                        ...backwardData.map(d => d.force || 0)
                      ).toFixed(3)} mN
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                    <p className="text-purple-700 text-sm font-medium mb-1">
                      Max Distance
                    </p>
                    <p className="text-purple-800 font-bold text-lg">
                      {Math.max(
                        ...forwardData.map(d => d.distance || 0),
                        ...backwardData.map(d => d.distance || 0)
                      ).toFixed(1)} mm
                    </p>
                  </div>
                </div>
              )} */}
            </div>

            {/* Raw Data Preview */}

          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                Confirm Deletion
              </h3>
            </div>

            <p className="text-slate-600 mb-2">
              Are you sure you want to delete this log file?
            </p>
            <p className="text-slate-800 font-medium mb-6">
              "{deleteTarget?.displayName}"
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLog(deleteTarget)}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                Delete All Logs
              </h3>
            </div>

            <p className="text-slate-600 mb-2">
              Are you sure you want to delete all log files?
            </p>
            <p className="text-red-600 font-medium mb-6">
              This action cannot be undone and will permanently remove all{" "}
              {logFiles.length} log files.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllLogs}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete All</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message Modal */}
      {showSuccessMessage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-green-100 rounded-full">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800">Success!</h3>
            </div>

            <p className="text-slate-600 mb-6">
              Log file deleted successfully!
            </p>

            <button
              onClick={() => setShowSuccessMessage(false)}
              className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* CSV Toast Notification */}
      {csvToast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-xl shadow-2xl transition-all border ${
            csvToast.type === "success"
              ? "bg-emerald-600 text-white border-emerald-500"
              : "bg-red-600 text-white border-red-500"
          }`}
        >
          <span className="text-sm font-semibold">{csvToast.message}</span>
          <button
            onClick={() => setCsvToast(null)}
            className="p-1 hover:bg-white/20 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-2xl max-w-md lg:max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Info className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg lg:text-xl font-bold text-blue-900">
                    Process Logs Guideline
                  </h3>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-blue-600" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-96">
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-blue-800 text-sm lg:text-base">
                      <span className="font-semibold">
                        Process Logs are automatically generated
                      </span>{" "}
                      after each test run and saved as CSV files.
                    </p>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-blue-800 text-sm lg:text-base">
                      The graph shows <span className="font-semibold">Force vs Distance</span> with two distinct phases:
                    </p>
                  </div>

                  <div className="ml-4 space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <p className="text-blue-800 text-sm lg:text-base">
                        <span className="font-semibold">Insertion (Blue):</span> 0 → Maximum Distance
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <p className="text-blue-800 text-sm lg:text-base">
                        <span className="font-semibold">Retraction (Red):</span> Maximum Distance → 0
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-blue-800 text-sm lg:text-base">
                      Each log contains complete test data including{" "}
                      <span className="font-semibold">
                        force, distance and configuration details
                      </span>
                      .
                    </p>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-blue-800 text-sm lg:text-base">
                      Configuration details shown are exactly what was used
                      during the test, including curve distances if configured.
                    </p>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-blue-800 text-sm lg:text-base">
                      <span className="font-semibold">Warning:</span> Deleted
                      logs cannot be recovered.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessLogs;