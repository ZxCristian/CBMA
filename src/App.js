import React, { useState, useEffect } from "react"; 
import * as XLSX from "xlsx";
import "./App.css";
import TeachingLoads from "./TeachingLoads";

const dayMap = {
  M: 1,
  T: 2,
  W: 3,
  TH: 4,
  F: 5,
  SAT: 6,
  SUN: 0
};

const dayNumberToLabel = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday"
};

const orderedDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

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

const floorToHour = (minutes) => Math.floor(minutes / 60) * 60;
const ceilToHour = (minutes) => Math.ceil(minutes / 60) * 60;

const formatMinutes = (minutes) => {
  const h24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mins).padStart(2, "0")} ${period}`;
};

const formatHourRange = (startMinutes, endMinutes) =>
  `${formatMinutes(startMinutes)} - ${formatMinutes(endMinutes)}`;

const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const buildCellStyle = (segments) => {
  if (!segments || !segments.length) return undefined;

  const gradients = segments
    .map(({ start, end }) => {
      const safeStart = clamp(start);
      const safeEnd = clamp(end);
      if (safeEnd <= safeStart) return null;
      const startPercent = (safeStart * 100).toFixed(2);
      const endPercent = (safeEnd * 100).toFixed(2);
      return `linear-gradient(to bottom, transparent 0%, transparent ${startPercent}%, #1faa59 ${startPercent}%, #1faa59 ${endPercent}%, transparent ${endPercent}%, transparent 100%)`;
    })
    .filter(Boolean);

  if (!gradients.length) return undefined;

  return {
    backgroundImage: gradients.join(","),
    backgroundColor: "#f0fdf4"
  };
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


// Updated splitRooms to handle more separators
const splitRooms = (roomRaw) => {
  const value = String(roomRaw || "").trim();
  if (!value || value === "NA" || value.toUpperCase() === "NA") return [];
  return value
    .toUpperCase()
    .split(/\s*(?:[&+,]|AND)\s*/i)
    .map(r => r.trim())
    .filter(r => r.length > 0)
    .map(r => r.replace(/[^A-Z0-9-]/gi, ''))
    .filter(r => r.length > 0);
};

const createSlot = (startHour, startMinute, endHour, endMinute, extra = {}) => {
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return {
    label: formatHourRange(start, end),
    start,
    end,
    ...extra
  };
};

const thFriSlots = [
  createSlot(7, 0, 8, 30),
  createSlot(8, 30, 10, 0),
  createSlot(10, 0, 11, 30),
  createSlot(11, 30, 13, 0, { highlight: true }),
  createSlot(13, 0, 14, 30),
  createSlot(14, 30, 16, 0),
  createSlot(16, 0, 17, 30),
  createSlot(17, 30, 19, 0),
  createSlot(19, 0, 20, 30)
];

const weekendSlots = [
  createSlot(7, 30, 10, 30),
  createSlot(11, 0, 14, 0, { highlight: true }),
  createSlot(14, 0, 17, 0)
];

const monWedSlots = [
  createSlot(7, 0, 8, 0),
  createSlot(8, 0, 9, 0),
  createSlot(9, 0, 10, 0),
  createSlot(10, 0, 11, 0),
  createSlot(11, 0, 12, 0),
  createSlot(12, 0, 13, 0, { highlight: true }),
  createSlot(13, 0, 14, 0),
  createSlot(14, 0, 15, 0),
  createSlot(15, 0, 16, 0),
  createSlot(16, 0, 17, 0),
  createSlot(17, 0, 18, 0),
  createSlot(18, 0, 19, 0),
  createSlot(19, 0, 20, 0)
];

const specialSlotsByDay = {
  Monday: monWedSlots,
  Tuesday: monWedSlots,
  Wednesday: monWedSlots,
  Thursday: thFriSlots,
  Friday: thFriSlots,
  Saturday: weekendSlots,
  Sunday: weekendSlots
};

const getSlotsForDay = (dayLabel, defaultSlots) =>
  specialSlotsByDay[dayLabel] || defaultSlots;

function App() {
  const [currentView, setCurrentView] = useState("allocation"); // "allocation" or "teaching"
  const [allocation, setAllocation] = useState(null);
  const [modalCell, setModalCell] = useState(null);
  const [sharedExcelData, setSharedExcelData] = useState(null); // Store Excel data to share with Teaching Loads
  const [lastUpdated, setLastUpdated] = useState(null);

  // ——————————————————————————————
  // Live update indicator (bottom-right)
  // ——————————————————————————————
  const LiveIndicator = () => {
  if (!lastUpdated) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        background: "rgba(0, 0, 0, 0.75)",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: "8px",
        fontSize: "0.85rem",
        fontWeight: "500",
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
     
      Updated: {lastUpdated.toLocaleTimeString()}
      <span style={{ 
        color: isLiveMode ? "#34a853" : "#ff9800", 
        marginLeft: "4px",
        fontWeight: "600"
      }}>
        {isLiveMode ? "(auto-refresh every minute)" : "(offline / local file)"}
      </span>
    </div>
  );
};

  const [isLiveMode, setIsLiveMode] = useState(false); // Track if we're in live mode
  // Auto-refresh from Google Sheets every 60 seconds
  useEffect(() => {
   if (!isLiveMode) return;

    const loadFromGoogleSheets = async () => {
      try {
        const res = await fetch(
          "https://docs.google.com/spreadsheets/d/e/2PACX-1vRGV6JtLweFlL98nS4enQb8sVY9HYFQiUDck20NZGqv6d35sPbQxhuA10nfGz_Rdkp2Y6p2u_5rS-YB/pub?gid=37247211&single=true&output=csv"
        );
        if (!res.ok) throw new Error("Network error");
        const csv = await res.text();
        const wb = XLSX.read(csv, { type: "string" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        buildAllocation(rows);
        setSharedExcelData(rows);
        setLastUpdated(new Date());
        console.log("Live refreshed:", new Date().toLocaleTimeString());
      } catch (e) {
        console.warn("Live refresh failed:", e.message);
        setLastUpdated(new Date()); // Still update timestamp so UI doesn't freeze
      }
    };

    // Load immediately on mount
loadFromGoogleSheets();
    // Then set interval to refresh every 60 seconds
    const intervalId = setInterval(loadFromGoogleSheets, 60_000);

    // Cleanup on unmount or when live mode turns off
    return () => clearInterval(intervalId);
  }, [isLiveMode]); // Re-run only when isLiveMode changes

  

  const buildAllocation = (rows) => {
    const roomsSet = new Set();
    const summary = {};
    const entries = [];
    let minStart = Infinity;
    let maxEnd = -Infinity;

    rows.forEach((row) => {
      if (!row.SCHEDULE || !row.DAYS) return;

      const title = String(row["DESCRIPTIVE TITLE"] || row.SUBJECT || "").trim() || "Class";
      const titleUpper = title.toUpperCase();
      const isOJTLike = /ojt|practicum|internship|wil|immersion/i.test(titleUpper);
      const isCompetencyAppraisal = /competency\s*appraisal|ca[\s$]|cpa\s*board/i.test(titleUpper);

      const scheduleLabel = row.SCHEDULE.trim();
      const [rawStart, rawEnd] = scheduleLabel.split("-");
      const startMinutes = minutesFromTime(rawStart);
      const endMinutes = minutesFromTime(rawEnd);

      if (
        startMinutes === null ||
        endMinutes === null ||
        Number.isNaN(startMinutes) ||
        Number.isNaN(endMinutes)
      )
        return;

      const days = expandDays(row.DAYS);
      const rooms = splitRooms(row.ROOM);
      if (rooms.length === 0 && !isOJTLike && !isCompetencyAppraisal) return;
      
      // Add all rooms to the set
      rooms.forEach(r => roomsSet.add(r));

      minStart = Math.min(minStart, startMinutes);
      maxEnd = Math.max(maxEnd, endMinutes);

      // Create an entry for each room
      rooms.forEach(room => {
        entries.push({
          days,
          room,
          startMinutes,
          endMinutes,
          title: row["DESCRIPTIVE TITLE"] || "Untitled Class",
          instructor: row.INSTRUCTOR || "TBD",
          scheduleLabel,
          pyb: row.PYB || ""
        });
      });
    });

    if (!entries.length) {
      setAllocation(null);
      setModalCell(null);
      return;
    }

    const roundedStart = floorToHour(minStart);
    const roundedEnd = Math.max(roundedStart + 60, ceilToHour(maxEnd));
    const defaultSlots = [];
    for (let start = roundedStart; start < roundedEnd; start += 60) {
      defaultSlots.push({
        label: formatHourRange(start, start + 60),
        start,
        end: start + 60
      });
    }

    entries.forEach((entry) => {
      entry.days.forEach((dayNumber) => {
        const dayLabel = dayNumberToLabel[dayNumber];
        if (!dayLabel) return;
        summary[dayLabel] = summary[dayLabel] || {};
        const slotsForDay = getSlotsForDay(dayLabel, defaultSlots);

        slotsForDay.forEach((slot) => {
          const overlaps =
            entry.startMinutes < slot.end && entry.endMinutes > slot.start;
          if (!overlaps) return;

          summary[dayLabel][slot.label] = summary[dayLabel][slot.label] || {
            segmentsByRoom: {},
            detailsByRoom: {}
          };

          const slotData = summary[dayLabel][slot.label];
          const duration = slot.end - slot.start;
          const overlapStart = Math.max(entry.startMinutes, slot.start);
          const overlapEnd = Math.min(entry.endMinutes, slot.end);
          const segmentStart = (overlapStart - slot.start) / duration;
          const segmentEnd = (overlapEnd - slot.start) / duration;

          slotData.segmentsByRoom[entry.room] =
            slotData.segmentsByRoom[entry.room] || [];
          slotData.segmentsByRoom[entry.room].push({
            start: clamp(segmentStart),
            end: clamp(segmentEnd)
          });

          slotData.detailsByRoom[entry.room] =
            slotData.detailsByRoom[entry.room] || [];

          slotData.detailsByRoom[entry.room].push({
            title: entry.title,
            instructor: entry.instructor,
            schedule: entry.scheduleLabel,
            room: entry.room,
            pyb: entry.pyb
          });
        });
      });
    });

    const rooms = Array.from(roomsSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    const srIndex = rooms.indexOf("SR");
    if (srIndex !== -1) {
      rooms.splice(srIndex, 1);
      const irIndex = rooms.indexOf("IR");
      const insertIndex = irIndex === -1 ? rooms.length : irIndex + 1;
      rooms.splice(insertIndex, 0, "SR");
    }

    const days = orderedDays
      .filter((day) => summary[day])
      .map((day) => {
        const slotsForDay = getSlotsForDay(day, defaultSlots);
        const slots = slotsForDay.map((slotDef) => {
          const data =
            summary[day][slotDef.label] || {
              segmentsByRoom: {},
              detailsByRoom: {}
            };
          const occupiedCount = Object.keys(data.segmentsByRoom).length;

          return {
            slot: slotDef.label,
            highlight: Boolean(slotDef.highlight),
            occupiedCount,
            vacantCount: rooms.length - occupiedCount,
            rooms: rooms.map((room) => ({
              room,
              segments:
                (data.segmentsByRoom && data.segmentsByRoom[room]) || [],
              isOccupied:
                data.segmentsByRoom &&
                data.segmentsByRoom[room] &&
                data.segmentsByRoom[room].length > 0,
              details: data.detailsByRoom[room] || []
            }))
          };
        });

        return { day, slots };
      })
      .filter((day) => day.slots.some((slot) => slot.occupiedCount > 0));

    setAllocation({ rooms, days });
    setModalCell(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const inputElement = e.target;
    const reader = new FileReader();

   reader.onload = (evt) => {
    setIsLiveMode(false);
  const data = new Uint8Array(evt.target.result);
  const workbook = XLSX.read(data, { type: "array" });

  const sheetName = workbook.SheetNames.find(
    name => name.toUpperCase() === "DATABASE"
  ) || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);
  // ...

      buildAllocation(rows);
      
      // Store the Excel data to share with Teaching Loads
      setSharedExcelData(rows);
      
      // Reset the input value so the same file can be selected again after changes
      // This allows the table to update dynamically when Excel data changes
      inputElement.value = '';
    };

    reader.onerror = () => {
      console.error('Error reading file');
      inputElement.value = '';
    };

    reader.readAsArrayBuffer(file);
  };

  const handleCellSelect = (day, slot, cell) => {
    if (!cell.details.length) {
      setModalCell(null);
      return;
    }
    setModalCell({ day, slot, ...cell });
  };

if (currentView === "teaching") {
  return (
    <TeachingLoads
      onNavigate={setCurrentView}
      initialData={sharedExcelData}
      onDataLoaded={(rows) => {
        buildAllocation(rows); // This syncs the data to Room Allocation
         setCurrentView("allocation"); // Uncomment if you want to auto-switch tab
      }}
    />
  );
}

  return (
    <div className="app">
      <nav className="nav-bar">
        <button
          className={`nav-button ${currentView === "allocation" ? "active" : ""}`}
          onClick={() => setCurrentView("allocation")}
        >
          Room Allocation
        </button>
        <button
          className={`nav-button ${currentView === "teaching" ? "active" : ""}`}
          onClick={() => setCurrentView("teaching")}
        >
          Teaching Loads
        </button>
      </nav>
      {!allocation && (
        <>
          <header className="header">
            <div>
              <p className="eyebrow">Scheduler → Dashboard</p>
              <h1>Room Allocation Summary</h1>
              <p className="subtitle">
                Upload the official class schedule Excel file to generate a
                day-by-day view of occupied and available rooms.
              </p>
            </div>

          

            <div style={{display: "flex",gap: "12px",alignItems: "center",flexWrap: "wrap",height: "10px"}}>
  <label className="upload upload-small">
    <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
    <span>Upload Local File</span>
  </label>

 <button
  onClick={async () => {
    if (isLiveMode) {
      setIsLiveMode(false);
      return;
    }

    setIsLiveMode(true);

    try {
      setLastUpdated(null);
      const res = await fetch(
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vRGV6JtLweFlL98nS4enQb8sVY9HYFQiUDck20NZGqv6d35sPbQxhuA10nfGz_Rdkp2Y6p2u_5rS-YB/pub?gid=37247211&single=true&output=csv"
      );
      if (!res.ok) throw new Error("Failed");
      const csv = await res.text();
      const wb = XLSX.read(csv, { type: "string" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      buildAllocation(rows);
      setSharedExcelData(rows);
      setLastUpdated(new Date());
    } catch (e) {
      alert("Failed to connect to live data — staying offline");
      setIsLiveMode(false);
    }
  }}
  style={{
    padding: "10px 16px",
    background: isLiveMode ? "#34a853" : "#4285f4",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    position: "relative",
    minWidth: "240px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px"
  }}
>
  {isLiveMode ? (
    <>
      Live Mode Active
      <span style={{ fontSize: "1.2em" }}>Live</span>
      <span
        style={{
          position: "absolute",
          top: "6px",
          right: "10px",
          width: "10px",
          height: "10px",
          background: "#fff",
          borderRadius: "50%",
          animation: "pulse 2s infinite"
        }}
      />
    </>
  ) : (
    "Load Live from Google Sheets"
  )}
</button>
</div>
          </header>

          <div className="placeholder">
            <p>No schedule loaded yet.</p>
            <p>Choose an Excel file to begin.</p>
          </div>
        </>
      )}
{allocation && (
  <div className="allocation-content">
    <div className="upload-bar">
      <h2 style={{ margin: 0 }}>Room Allocation Summary</h2>
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <label className="upload upload-small">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
          />
          <span>Upload New File</span>
        </label>

       <button
  onClick={async () => {
    if (isLiveMode) {
      setIsLiveMode(false);
      return;
    }

    setIsLiveMode(true);

    try {
      setLastUpdated(null);
      const res = await fetch(
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vRGV6JtLweFlL98nS4enQb8sVY9HYFQiUDck20NZGqv6d35sPbQxhuA10nfGz_Rdkp2Y6p2u_5rS-YB/pub?gid=37247211&single=true&output=csv"
      );
      if (!res.ok) throw new Error("Failed");
      const csv = await res.text();
      const wb = XLSX.read(csv, { type: "string" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      buildAllocation(rows);
      setSharedExcelData(rows);
      setLastUpdated(new Date());
    } catch (e) {
      alert("Failed to connect to live data — staying offline");
      setIsLiveMode(false);
    }
  }}
  style={{
    padding: "10px 16px",
    background: isLiveMode ? "#34a853" : "#4285f4",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    position: "relative",
    minWidth: "240px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px"
  }}
>
  {isLiveMode ? (
    <>
      Live Mode Active
      <span style={{ fontSize: "1.2em" }}>Live</span>
      <span
        style={{
          position: "absolute",
          top: "6px",
          right: "10px",
          width: "10px",
          height: "10px",
          background: "#fff",
          borderRadius: "50%",
          animation: "pulse 2s infinite"
        }}
      />
    </>
  ) : (
    "Load Live from Google Sheets"
  )}
</button>

        
      </div>
    </div>
          <div className="table-wrapper">
            <table className="allocation-table">
              <thead>
                <tr>
                  <th className="day-column">Day</th>
                  <th>Schedule</th>
                  <th>Occupied</th>
                  <th>Vacant Rooms</th>
                  {allocation.rooms.map((room) => (
                    <th key={room}>{room}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocation.days.map((day) =>
                  day.slots.map((slot, index) => (
                    <tr key={`${day.day}-${slot.slot}`}>
                      {index === 0 && (
                        <td className="day-cell" rowSpan={day.slots.length}>
                          {day.day}
                        </td>
                      )}
                      <td
                        className={`schedule-cell ${
                          slot.highlight ? "schedule-highlight" : ""
                        }`}
                      >
                        {slot.slot}
                      </td>
                      <td className="occupied">{slot.occupiedCount}</td>
                      <td className="vacant">{slot.vacantCount}</td>
                      {slot.rooms.map((roomCell) => {
                        const instructorNames = Array.from(
                          new Set(
                            roomCell.details
                              .map((detail) => {
                                const name = detail.instructor?.trim();
                                if (!name) return null;
                                const parts = name.split(/\s+/);
                                return parts[0];
                              })
                              .filter(Boolean)
                          )
                        );

                        const namesToDisplay =
                          instructorNames.length > 0
                            ? instructorNames
                            : roomCell.isOccupied
                            ? ["TBD"]
                            : [];

                        return (
                          <td
                            key={`${day.day}-${slot.slot}-${roomCell.room}`}
                            className={`room-cell ${
                              roomCell.isOccupied ? "filled" : ""
                            } ${
                              instructorNames.length > 1 ? "multi-instructor" : ""
                            }`}
                            style={buildCellStyle(roomCell.segments)}
                            onClick={() =>
                              handleCellSelect(day.day, slot.slot, roomCell)
                            }
                            tabIndex={roomCell.isOccupied ? 0 : -1}
                            aria-label={`${roomCell.room} ${
                              roomCell.isOccupied ? "occupied" : "available"
                            }`}
                          >
                            {roomCell.isOccupied && (
                              <div className="instructor-stack">
                                {namesToDisplay.map((name, idx) => (
                                  <span
                                    key={`${roomCell.room}-${idx}`}
                                    className="instructor-name"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {modalCell && (
            <div
              className="modal-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) setModalCell(null);
              }}
            >
              <div className="modal-card" role="dialog" aria-modal="true">
                <button
                  className="modal-close"
                  onClick={() => setModalCell(null)}
                >
                  ×
                </button>
                <h2>
                  {modalCell.room} • {modalCell.day}
                </h2>
                <p className="modal-slot">{modalCell.slot}</p>
                <ul>
                  {modalCell.details.map((detail, idx) => (
                    <li key={`${detail.title}-${idx}`}>
                      <p className="detail-title">{detail.title}</p>
                      <p className="detail-meta">
                        Instructor: {detail.instructor}
                      </p>
                      {detail.pyb && (
                        <p className="detail-meta">
                          PYB: {detail.pyb}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
        </div>
      )}
      <LiveIndicator />
    </div>
  );
}


export default App;