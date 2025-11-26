import React, { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import "./TeachingLoads.css";
import "./App.css";

// ──────────────────────────────────────────────────────────────
// SHARED CONSTANTS & HELPERS
// ──────────────────────────────────────────────────────────────
const dayMap = { M: 1, T: 2, W: 3, TH: 4, F: 5, SAT: 6, SUN: 0 };
const dayNumberToLabel = { 0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" };
const orderedDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

const formatMinutes = (minutes) => {
  const h24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mins).padStart(2, "0")} ${period}`;
};

const formatHourRange = (startMinutes, endMinutes) =>
  `${formatMinutes(startMinutes)} - ${formatMinutes(endMinutes)}`;

const expandDays = (days) => {
  if (!days) return [];
  const input = String(days).toUpperCase().replace(/\s+/g, "");
  const result = new Set(); // ← Use Set to prevent duplicates
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
        result.add(6); // Saturday
        result.add(0); // Sunday
        i += 2;
      } else {
        result.add(6); // Single S = Saturday
        i += 1;
      }
    } else if (dayMap[char] !== undefined) {
      result.add(dayMap[char]);
      i += 1;
    } else {
      i += 1; // skip invalid char
    }
  }
  return Array.from(result); // ← Convert back to array, no duplicates
};

const normalizeRoom = (room) => {
  const value = String(room || "").trim();
  if (!value) return "";
  const upper = value.toUpperCase();
  return upper === "NA" ? "" : upper;
};

const createSlot = (sh, sm, eh, em, extra = {}) => ({
  label: formatHourRange(sh * 60 + sm, eh * 60 + em),
  start: sh * 60 + sm,
  end: eh * 60 + em,
  ...extra
});

const thFriSlots = [
  createSlot(7, 0, 8, 30), createSlot(8, 30, 10, 0), createSlot(10, 0, 11, 30),
  createSlot(11, 30, 13, 0, { highlight: true }), createSlot(13, 0, 14, 30),
  createSlot(14, 30, 16, 0), createSlot(16, 0, 17, 30), createSlot(17, 30, 19, 0),
  createSlot(19, 0, 20, 30)
];

const weekendSlots = [
  createSlot(7, 30, 10, 30), createSlot(11, 0, 14, 0, { highlight: true }), createSlot(14, 0, 17, 0)
];

const monWedSlots = [
  createSlot(7, 0, 8, 0), createSlot(8, 0, 9, 0), createSlot(9, 0, 10, 0),
  createSlot(10, 0, 11, 0), createSlot(11, 0, 12, 0), createSlot(12, 0, 13, 0, { highlight: true }),
  createSlot(13, 0, 14, 0), createSlot(14, 0, 15, 0), createSlot(15, 0, 16, 0),
  createSlot(16, 0, 17, 0), createSlot(17, 0, 18, 0), createSlot(18, 0, 19, 0),
  createSlot(19, 0, 20, 0)
];

const specialSlotsByDay = {
  Monday: monWedSlots, Tuesday: monWedSlots, Wednesday: monWedSlots,
  Thursday: thFriSlots, Friday: thFriSlots, Saturday: weekendSlots, Sunday: weekendSlots
};

const getSlotsForDay = (dayLabel) => specialSlotsByDay[dayLabel] || monWedSlots;

// ──────────────────────────────────────────────────────────────
// SUMMARY TABLE COMPONENT (using React Table)
// ──────────────────────────────────────────────────────────────
function SummaryTable({ teachingData }) {
  const summaryData = useMemo(() => {
    if (!teachingData?.instructors) return [];
    
    return [
      {
        label: "Course Units",
        type: "courseUnits",
        isTotal: false,
      },
      {
        label: "OJT Units",
        type: "ojtUnits",
        isTotal: false,
      },
      {
        label: "Competency Appraisal Units",
        type: "competencyAppraisalUnits",
        isTotal: false,
      },
      {
        label: "Total Teaching Load",
        type: "total",
        isTotal: true,
      },
    ];
  }, [teachingData]);

  const columns = useMemo(() => {
    if (!teachingData?.instructors) return [];
    
    return [
      {
        id: "label",
        header: () => <span className="summary-header">Teaching Load Summary</span>,
        cell: ({ row }) => (
          <span className={`summary-label ${row.original.isTotal ? "summary-total-label" : ""}`}>
            {row.original.label}
          </span>
        ),
        size: 230,
      },
      ...teachingData.instructors.map((instructor) => ({
        id: instructor.name,
        header: () => (
          <span className="instructor-header summary-instructor-header">
            {instructor.name}
          </span>
        ),
        cell: ({ row }) => {
          const value = row.original.isTotal
            ? instructor.summary?.total || 0
            : instructor.summary?.[row.original.type] || 0;
          return (
            <span className={`summary-value ${row.original.isTotal ? "summary-total-value" : ""}`}>
              {Math.round(value * 100) / 100}
            </span>
          );
        },
        size: 150,
      })),
    ];
  }, [teachingData]);

  const table = useReactTable({
    data: summaryData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!teachingData?.instructors) return null;

  return (
    <table className="summary-table">
      <colgroup>
        <col style={{ width: "50px" }} />
        <col style={{ width: "180px" }} />
        {teachingData.instructors.map((instructor, idx) => (
          <col key={`summary-col-${instructor.name}-${idx}`} style={{ width: "150px" }} />
        ))}
      </colgroup>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header, index) => (
              <th
                key={header.id}
                className={index === 0 ? "day-time-header summary-header" : "instructor-header summary-instructor-header"}
                colSpan={index === 0 ? 2 : 1}
                style={{ width: header.getSize() }}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className={row.original.isTotal ? "summary-total-row" : ""}>
            {row.getVisibleCells().map((cell, index) => (
              <td
                key={cell.id}
                className={index === 0 ? "summary-label" : "summary-value"}
                colSpan={index === 0 ? 2 : 1}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ──────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────
function TeachingLoads({ onNavigate, initialData, onDataLoaded }) {
  const [teachingData, setTeachingData] = useState(null);
  const [viewMode, setViewMode] = useState("auto");
  const [modalCell, setModalCell] = useState(null);

  // Auto-populate from initialData if provided
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      buildDetailedData(initialData);
      setViewMode("detailed");
    }
  }, [initialData]);

  // ────── FILE UPLOAD & AUTO DETECT ──────

  // ────── MATRIX PARSER ──────

     // ────── DETAILED DATA BUILDER ──────
     const buildDetailedData = (rows) => {
      const instructorMap = new Map();
      const entries = [];
  
      // STEP 1: Collect all entries
      rows.forEach((row) => {
        if (!row.SCHEDULE || !row.DAYS || !row.INSTRUCTOR) return;
  
        const scheduleLabel = row.SCHEDULE.trim();
        const [rawStart, rawEnd] = scheduleLabel.split("-");
        const startMinutes = minutesFromTime(rawStart);
        const endMinutes = minutesFromTime(rawEnd);
        if (startMinutes === null || endMinutes === null) return;
  
        const days = expandDays(row.DAYS);
        if (days.length === 0) return;
  
        const instructorOriginal = (row.INSTRUCTOR || "").trim();
        if (!instructorOriginal) return;
  
        // Only exclude these — NEVER exclude just "CA"
const excluded = ["C/O CAS", "C/O NSTP", "C/O PE DEPARTMENT", "C/O PE DEPT", "C/O PE"];

if (excluded.some(p => instructorOriginal.toUpperCase().includes(p))) {
  return;
}
  
        const instructorKey = instructorOriginal
  .toUpperCase()
  .replace(/,/g, ", ")           // ← ADD SPACE AFTER COMMA
  .replace(/\s+/g, " ")
  .trim();
        const room = normalizeRoom(row.ROOM);
  
               const unitCandidates = [
                row["UNITS"],
                row["Units"],
                row["units"],
                row["UNITS "],
                row[" UNIT"],
                row["UNIT"],
                row["Unit"]
              ];
              let rawUnits = 0;
              for (const candidate of unitCandidates) {
                if (candidate !== undefined && candidate !== null && candidate !== "") {
                  const parsed = parseFloat(String(candidate).trim());
                  if (!isNaN(parsed)) {
                    rawUnits = parsed;
                    break;
                  }
                }
              }
      
                           // ────── FINAL OJT & CA DETECTION — GUARANTEED ──────
                           const fullTitle = String(row["DESCRIPTIVE TITLE"] || row.SUBJECT || "").trim();
                           const titleUpper = fullTitle.toUpperCase();
             
                           const isOJTLike = /ojt|practicum|internship|on[\s-]*the[\s-]*job|work\s*integrated|wil|immersion|capstone|office\s*internship|legal\s*medical|oac\s*14|aoc\s*15/i.test(titleUpper);
                           
const isCompetencyAppraisal = /competency\s*appraisal|cpale\s*review|cpa\s*board/i.test(titleUpper);
const courseUnits = (!isOJTLike && !isCompetencyAppraisal) ? rawUnits : 0;
const ojtUnits = isOJTLike ? rawUnits : 0;
const competencyAppraisalUnits = isCompetencyAppraisal ? rawUnits : 0;

// FINAL FIX: Allow both OJT and Competency Appraisal without room
if (!room && !isOJTLike && !isCompetencyAppraisal) return;
  
        if (!instructorMap.has(instructorKey)) {
          instructorMap.set(instructorKey, {
            name: instructorOriginal,
            schedule: {},
            summary: null,
          });
        }
  
        entries.push({
          instructorKey,
          days,
          startMinutes,
          endMinutes,
          title: fullTitle || "Untitled Class",  // ← original case for display
          subjectCode: (row.SUBJECT || "").toString().trim(),
          pyb: (row.PYB || "").toString().trim(),
          scheduleLabel,
          room,
          courseUnits,
          ojtUnits,
          competencyAppraisalUnits,
        });
      });
  
      if (entries.length === 0) {
        setTeachingData(null);
        return;
      }
  
      // STEP 2: Assign to schedule
      entries.forEach((entry) => {
        const instructorData = instructorMap.get(entry.instructorKey);
        if (!instructorData) return;
  
        entry.days.forEach((dayNumber) => {
          const dayLabel = dayNumberToLabel[dayNumber];
          if (!dayLabel) return;
  
          if (!instructorData.schedule[dayLabel]) {
            instructorData.schedule[dayLabel] = [];
          }
  
                // Only consider it a duplicate if same PYB + same SUBJECT
                const alreadyExists = instructorData.schedule[dayLabel].some(s =>
                  s.pyb === entry.pyb && s.subjectCode === entry.subjectCode
                );
        
                if (!alreadyExists) {
                  instructorData.schedule[dayLabel].push({
                    start: entry.startMinutes,
                    end: entry.endMinutes,
                    title: entry.title,
                    subjectCode: entry.subjectCode,
                    pyb: entry.pyb,
                    scheduleLabel: entry.scheduleLabel,
                    room: entry.room,
                    courseUnits: entry.courseUnits,
                    ojtUnits: entry.ojtUnits,
                    competencyAppraisalUnits: entry.competencyAppraisalUnits,
                  });
                }
        });
      });
  
      // STEP 3: Summary — PYB + SUBJECT + DESCRIPTIVE TITLE = Unique Load
            const instructors = Array.from(instructorMap.values()).sort((a, b) => a.name.localeCompare(b.name));

            instructors.forEach((instructor) => {
              const seen = new Set();
      
              let totalCourse = 0;
              let totalOJT = 0;
              let totalCA = 0;
      
              Object.values(instructor.schedule).forEach((daySchedules) => {
                daySchedules.forEach((sched) => {
                  // THE ULTIMATE UNIQUE KEY
                  const uniqueKey = `${sched.pyb || "NO-PYB"}|${sched.subjectCode || "NO-SUBJECT"}|${String(sched.title).trim().toUpperCase()}`;
      
                  if (!seen.has(uniqueKey)) {
                    seen.add(uniqueKey);
                    totalCourse += sched.courseUnits;
                    totalOJT += sched.ojtUnits;
                    totalCA += sched.competencyAppraisalUnits;
                  }
                });
              });
      
              instructor.summary = {
                courseUnits: totalCourse,
                ojtUnits: totalOJT,
                competencyAppraisalUnits: totalCA,
                total: totalCourse + totalOJT + totalCA,
              };
            });
  
      const activeDays = orderedDays.filter((day) =>
        instructors.some((inst) => inst.schedule[day]?.length > 0)
      );
  
      setTeachingData({ instructors, days: activeDays });
      setModalCell(null);
    };  

  // ────── CELL DATA & MODAL ──────
  const getCellData = (instructorObj, day, slot) => {
    if (!instructorObj?.schedule[day]) return { hasSchedule: false, rooms: [], details: [] };
  
    const matching = instructorObj.schedule[day].filter(s => 
      s.start < slot.end && s.end > slot.start
    );
  
    if (!matching.length) return { hasSchedule: false, rooms: [], details: [] };
  
    const rooms = matching.map(s => s.room).filter(Boolean);
  return { 
      hasSchedule: true, 
      rooms, 
      details: matching 
    };
  };

  const handleCellSelect = (instructorObj, day, slot, cellData) => {
    if (!cellData.hasSchedule) {
      setModalCell(null);
      return;
    }
    setModalCell({
      instructor: instructorObj.name,  // ← Original casing, guaranteed correct
      day,
      slot: slot.label,
      details: cellData.details
    });
  };

  // ────── RENDER ──────
  return (
    <div className="teaching-loads">
      <nav className="nav-bar">
        <button className="nav-button" onClick={() => onNavigate?.("allocation")}>
          Room Allocation
        </button>
        <button className="nav-button active">Teaching Loads</button>
      </nav>

     

      
    

      {/* DETAILED VIEW */}
      {viewMode === "detailed" && teachingData && (
        <div className="teaching-content">
          <div className="upload-bar">
            <h2 style={{ margin: 0 }}>Teaching Loads</h2>
            
          </div>

          <div className="table-wrapper" id="teaching-table-wrapper">
            <table className="teaching-table">
              <colgroup>
                <col style={{ width: "50px" }} />
                <col style={{ width: "180px" }} />
                {teachingData.instructors.map((instructor, idx) => (
                  <col key={`main-col-${instructor.name}-${idx}`} style={{ width: "150px" }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="day-time-header" colSpan="2"></th>
                  {teachingData.instructors.map((instructor) => (
                    <th key={instructor.name} className="instructor-header">
                      {instructor.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teachingData.days.map((day) => {
                  const slotsForDay = getSlotsForDay(day);
                  return slotsForDay.map((slot, slotIndex) => (
                    <tr key={`${day}-${slot.label}`}>
                      {slotIndex === 0 ? (
                        <td className="day-label" rowSpan={slotsForDay.length}>
                          {day}
                        </td>
                      ) : null}
                      <td className={`time-slot-cell ${slot.highlight ? "lunch-time" : ""}`}>
                        {slot.label}
                      </td>
                        {teachingData.instructors.map((instructor) => {
    const cellData = getCellData(instructor, day, slot); // pass object
    return (
        <td
        key={`${day}-${slot.label}-${instructor.name}`}
        onClick={() => handleCellSelect(instructor, day, slot, cellData)} // pass object
        // ...
        >
                                {cellData.hasSchedule && cellData.rooms.length > 0 && (
                                <div className="room-label">
                                    {cellData.rooms.map((room, i) => (
    <div key={i} className="room-item">{room}</div>
    ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ));
                })}
              </tbody>
            </table>

            {/* Summary Table using React Table */}
            <SummaryTable teachingData={teachingData} />
          </div>
        </div>
      )}

      {/* Modal */}
      {modalCell && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalCell(null)}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setModalCell(null)}>×</button>
            <h2>{modalCell.instructor} • {modalCell.day}</h2>
            <p className="modal-slot">{modalCell.slot}</p>
            <ul>
              {modalCell.details.map((detail, idx) => (
                <li key={`${detail.title}-${idx}`}>
                  <p className="detail-title">{detail.title}</p>
                  <p className="detail-meta">Room: {detail.room || "N/A"}</p>
                  <p className="detail-meta">Schedule: {detail.scheduleLabel}</p>
                  {detail.courseUnits > 0 && <p className="detail-meta">Course Units: {detail.courseUnits}</p>}
                  {detail.ojtUnits > 0 && <p className="detail-meta">OJT Units: {detail.ojtUnits}</p>}
                  {detail.competencyAppraisalUnits > 0 && <p className="detail-meta">Competency Appraisal Units: {detail.competencyAppraisalUnits}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeachingLoads;