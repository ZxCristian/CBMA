import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Scheduler from "./RoomAllocation"; // your dhtmlx-scheduler component
import "./RoomAllocation.css";

// ────── SHARED HELPERS (same as TeachingLoads) ──────
const dayNumberToLabel = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday",
  4: "Thursday", 5: "Friday", 6: "Saturday"
};

const minutesFromTime = (timeStr) => {
  if (!timeStr) return null;
  timeStr = timeStr.trim().toUpperCase();
  let timePart, mod;
  const match = timeStr.match(/(\d{1,2}:\d{2})\s*(AM|PM)/i);
  if (match) {
    timePart = match[1];
    mod = match[2];
  } else {
    return null;
  }
  let [h, m] = timePart.split(":").map(Number);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 12 || m < 0 || m > 59) return null;
  if (mod === "PM" && h !== 12) h += 12;
  if (mod === "AM" && h === 12) h = 0;
  return h * 60 + m;
};

const expandDays = (days) => {
  if (!days) return [];
  const input = String(days).toUpperCase().replace(/\s+/g, "");
  const result = new Set();
  let i = 0;
  while (i < input.length) {
    const three = input.slice(i, i + 3);
    if (three === "SAT") { result.add(6); i += 3; continue; }
    if (three === "SUN") { result.add(0); i += 3; continue; }
    const two = input.slice(i, i + 2);
    if (two === "TH") { result.add(4); i += 2; continue; }
    const char = input[i];
    if (char === "S") {
      if (i + 1 < input.length && input[i + 1] === "S") {
        result.add(6); result.add(0); i += 2;
      } else {
        result.add(6); i += 1;
      }
    } else if (dayMap[char] !== undefined) {
      result.add(dayMap[char]);
      i += 1;
    } else {
      i += 1;
    }
  }
  return Array.from(result);
};

const dayMap = { M: 1, T: 2, W: 3, TH: 4, F: 5, SAT: 6, SUN: 0 };

// NEW: Parse "201 & 202", "101/102", etc.
const parseRooms = (roomRaw) => {
  const value = String(roomRaw || "").trim();
  if (!value || value === "NA" || value.toUpperCase() === "NA") return [];
  return value
    .toUpperCase()
    .split(/\s*(?:[&\/+,]|AND)\s*/i)
    .map(r => r.trim())
    .filter(r => r.length > 0)
    .map(r => r.replace(/[^A-Z0-9-]/gi, ''))
    .filter(r => r.length > 0);
};

function RoomAllocation({ onNavigate }) {
  const [events, setEvents] = useState([]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      // Find the sheet named "DATABASE" (case-insensitive), fallback to first sheet
const sheetName = workbook.SheetNames.find(
  name => name.toUpperCase() === "DATABASE"
) || workbook.SheetNames[0];

const ws = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws);

      const newEvents = [];

      rows.forEach((row) => {
        if (!row.SCHEDULE || !row.DAYS) return;

        const scheduleLabel = String(row.SCHEDULE || "").trim();
        const [rawStart, rawEnd] = scheduleLabel.split("-");
        const startMinutes = minutesFromTime(rawStart);
        const endMinutes = minutesFromTime(rawEnd);
        if (startMinutes === null || endMinutes === null) return;

        const days = expandDays(row.DAYS);
        if (days.length === 0) return;

        const instructor = String(row.INSTRUCTOR || "").trim();
        if (!instructor) return;

        // Skip c/o entries
        if (/c\/o|ca$/i.test(instructor)) return;

        const title = String(row["DESCRIPTIVE TITLE"] || row.SUBJECT || "").trim() || "Class";
        const fullTitle = `${row.PYB || ""} ${row.SUBJECT || ""} - ${title}`.trim();

        const titleUpper = title.toUpperCase();
        const isOJTLike = /ojt|practicum|internship|wil|immersion/i.test(titleUpper);
        const isCompetencyAppraisal = /competency\s*appraisal|ca[\s$]|cpa\s*board/i.test(titleUpper);

        const roomsList = parseRooms(row.ROOM);

        // Allow OJT and CA even without room
        if (roomsList.length === 0 && !isOJTLike && !isCompetencyAppraisal) return;

        const finalRooms = roomsList.length > 0 ? roomsList : ["NO ROOM"];

        // Create one event per room
        finalRooms.forEach((room) => {
          days.forEach((dayNum) => {
            const date = getNextDateForDay(dayNum); // next upcoming day
            const startDate = new Date(date);
            const endDate = new Date(date);

            startDate.setHours(0, Math.floor(startMinutes / 60), startMinutes % 60, 0);
            endDate.setHours(0, Math.floor(endMinutes / 60), endMinutes % 60, 0);

            newEvents.push({
              start_date: startDate,
              end_date: endDate,
              text: `${room} • ${instructor}<br>${fullTitle}`,
              section_id: room,
            });
          });
        });
      });

      setEvents(newEvents);
      e.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  // Helper: get next upcoming date for a given weekday (0=Sun, 6=Sat)
  const getNextDateForDay = (dayNum) => {
    const today = new Date();
    const result = new Date(today);
    const currentDay = today.getDay();
    let diff = dayNum - currentDay;
    if (diff <= 0) diff += 7;
    result.setDate(today.getDate() + diff);
    return result;
  };

  return (
    <div className="room-allocation">
      <nav className="nav-bar">
        <button className="nav-button active">Room Allocation</button>
        <button className="nav-button" onClick={() => onNavigate?.("loads")}>
          Teaching Loads
        </button>
      </nav>

      <header className="teaching-header">
        <h1>Room Allocation Scheduler</h1>
        <p>Upload your teaching load Excel file to see room schedules.</p>
        <label className="upload">
          <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
          <span>Upload File</span>
        </label>
      </header>

      <div style={{ height: "80vh", marginTop: "20px" }}>
        <Scheduler events={events} />
      </div>
    </div>
  );
}

export default RoomAllocation;