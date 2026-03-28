export interface User {
  uid: string;
  email: string;
  displayName: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  school: string;
  degree: string;
  internshipStart: string;
  internshipEnd: string;
  company: string;
  tutorName: string;
}

export interface LogEntry {
  id: string;
  uid: string;
  date: string;
  rawContent: string;
  structuredContent: string;
  skills: string[];
  weekNumber: number;
  summary?: string;
  missions?: string[];
  technologies?: string[];
}

export interface Deadline {
  id: string;
  uid: string;
  title: string;
  date: string;
  type: "school" | "company";
  completed: boolean;
}
