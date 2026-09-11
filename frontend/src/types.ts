export type Role = 'student' | 'teacher';
export type ThemePreference = 'light' | 'dark' | 'system';

export type AccessibilitySettings = {
  fontSize: number;
  highContrast: boolean;
  reducedMotion: boolean;
};

export type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
  theme: ThemePreference;
  accessibilitySettings: AccessibilitySettings;
};

export type NotificationEventType =
  | 'NEW_ACTIVITY'
  | 'GRADE_PUBLISHED'
  | 'ACTIVITY_DUE_SOON'
  | 'SUBMISSION_STATUS_CHANGED';

export type NotificationChannel = 'EMAIL' | 'PUSH' | 'IN_APP';

export type NotificationPreference = {
  eventType: NotificationEventType;
  channels: NotificationChannel[];
};

export type AppNotification = {
  id: number;
  type: 'GRADE_PUBLISHED' | 'FORUM_REPLY';
  title: string;
  message: string;
  read: boolean;
  activityId: number | null;
  forumThreadId: number | null;
  classId: number | null;
  createdAt: string;
};

export type AcademicClass = {
  id: number;
  name: string;
  subject: string;
  code: string;
  period: string;
  studentCount: number;
  students: Array<{ id: number; name: string; email: string }>;
};

export type Activity = {
  id: number;
  title: string;
  subject: string;
  academicClass?: Pick<AcademicClass, 'id' | 'name' | 'code'> | null;
  dueDate?: string;
  activityType?: string;
  evaluationPhase?: 'baseline' | 'pilot';
  manualEvaluationRequired?: boolean;
  learningOutcomes?: string[];
  submissionStatus?: string;
  rubric?: Rubric | null;
  createdAt?: string;
  isNew?: boolean;
  logbookStatus?: 'not_started' | 'in_progress' | 'complete';
  completionPercentage?: number;
  missingSections?: string[];
};

export type ForumAuthor = {
  id: number;
  name: string;
  role: Role;
};

export type ForumPost = {
  id: number;
  body: string;
  parentPostId: number | null;
  author: ForumAuthor;
  createdAt: string;
  updatedAt: string;
};

export type ForumThreadSummary = {
  id: number;
  title: string;
  description: string;
  pinned: boolean;
  resolved: boolean;
  author: ForumAuthor;
  postCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ForumThread = Omit<ForumThreadSummary, 'postCount'> & {
  academicClass: Pick<AcademicClass, 'id' | 'name' | 'code' | 'subject'>;
  posts: ForumPost[];
};

export type ForumThreadPage = {
  academicClass: Pick<AcademicClass, 'id' | 'name' | 'code' | 'subject'>;
  items: ForumThreadSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Criterion = {
  name: string;
  dimension: string;
  descriptors: { level1: string; level2: string; level3: string; level4: string };
};

export type Rubric = {
  id: number;
  name: string;
  criteria: Criterion[];
  activityId?: number | null;
};

export type ActivityProjectionItem = {
  id: number;
  title: string;
  dueDate: string;
  weight: number;
  status: string;
  finalScore: number | null;
  percentage: number | null;
};

export type ProjectionData = {
  classId: number;
  totalActivities: number;
  completedActivities: number;
  pendingActivities: number;
  currentWeightedScore: number | null;
  projectedFinalScore: number | null;
  projectedPercentage: number | null;
  requiredAvgToPass: number | null;
  passingThreshold: number;
  activities: ActivityProjectionItem[];
};

export type PerformanceChartActivity = {
  id: number;
  title: string;
  dueDate: string;
};

export type PerformanceChart = {
  labels: string[];
  myGrades: (number | null)[];
  classAverage: (number | null)[];
  trendLine: (number | null)[];
  activities: PerformanceChartActivity[];
};
