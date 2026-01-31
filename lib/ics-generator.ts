import type { Activity, ClassInfo } from "@/types";
import { getSubmissionStatus } from "./utils";

interface ICSEvent {
  title: string;
  description: string;
  start: Date;
  end: Date;
  location?: string;
  url?: string;
  uid?: string;
}

function formatICSDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function buildICSFile(events: ICSEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AssignWatch//Assignment Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:AssignWatch - Assignments",
    "X-WR-TIMEZONE:UTC",
  ];

  for (const event of events) {
    const uid = event.uid || `${event.start.getTime()}@assignwatch`;
    const now = new Date();

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${formatICSDate(now)}`);
    lines.push(`DTSTART:${formatICSDate(event.start)}`);
    lines.push(`DTEND:${formatICSDate(event.end)}`);
    lines.push(`SUMMARY:${escapeICSText(event.title)}`);
    lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);

    if (event.location) {
      lines.push(`LOCATION:${escapeICSText(event.location)}`);
    }

    if (event.url) {
      lines.push(`URL:${event.url}`);
    }

    // Add reminders
    lines.push("BEGIN:VALARM");
    lines.push("TRIGGER:-PT24H");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeICSText(event.title)} is due in 24 hours`);
    lines.push("END:VALARM");

    lines.push("BEGIN:VALARM");
    lines.push("TRIGGER:-PT1H");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeICSText(event.title)} is due in 1 hour`);
    lines.push("END:VALARM");

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function generateICS(
  assignments: Activity[],
  classInfo: ClassInfo[]
): string {
  const events: ICSEvent[] = assignments.map((assignment) => {
    const classData = classInfo.find((c) => c.id === assignment.class_id);
    const dueDate = new Date(assignment.due_date);
    const status = getSubmissionStatus(assignment);

    const statusLabels: Record<string, string> = {
      submitted: "✓ Submitted",
      submitted_late: "✓ Submitted (Late)",
      not_submitted: "✗ Not Submitted",
      quiz_not_submitted: "✗ Quiz Not Submitted",
      in_progress: "In Progress",
    };

    const description = [
      `Class: ${classData?.title || "Unknown"} - ${classData?.description || ""}`,
      `Type: ${assignment.type === "QUZ" ? "Quiz" : "Assignment"}`,
      `Group: ${assignment.group_type === "STU" ? "Group" : "Individual"}`,
      `Status: ${statusLabels[status] || status}`,
      assignment.description ? `\nDetails: ${assignment.description}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      title: `${assignment.title} (${classData?.title || ""})`,
      description,
      start: dueDate,
      end: dueDate,
      location: "LEB2",
      url: `https://app.leb2.org/class/${assignment.class_id}/activity/${assignment.id}`,
      uid: `assignment-${assignment.id}-class-${assignment.class_id}@assignwatch`,
    };
  });

  return buildICSFile(events);
}

export function downloadICS(icsContent: string, filename = "assignments.ics") {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
