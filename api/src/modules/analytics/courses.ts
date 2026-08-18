/** Public catalog matches for skill gaps. Search URLs only — no invented certificates. */

export type CourseSuggestion = {
  title: string;
  provider: string;
  url: string;
};

type CatalogRow = {
  keys: string[];
  course: CourseSuggestion;
};

const CATALOG: CatalogRow[] = [
  {
    keys: ["python"],
    course: {
      title: "Python for Everybody",
      provider: "Coursera",
      url: "https://www.coursera.org/specializations/python",
    },
  },
  {
    keys: ["javascript", "typescript", "js", "ts"],
    course: {
      title: "JavaScript Algorithms and Data Structures",
      provider: "freeCodeCamp",
      url: "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures-v8/",
    },
  },
  {
    keys: ["react", "next.js", "nextjs"],
    course: {
      title: "React",
      provider: "freeCodeCamp",
      url: "https://www.freecodecamp.org/learn/front-end-development-libraries/",
    },
  },
  {
    keys: ["sql", "postgres", "postgresql"],
    course: {
      title: "Introduction to Databases",
      provider: "Coursera",
      url: "https://www.coursera.org/learn/intro-sql",
    },
  },
  {
    keys: ["java"],
    course: {
      title: "Java Programming",
      provider: "Coursera",
      url: "https://www.coursera.org/specializations/java-programming",
    },
  },
  {
    keys: ["aws", "cloud"],
    course: {
      title: "AWS Cloud Practitioner Essentials",
      provider: "Coursera",
      url: "https://www.coursera.org/learn/aws-cloud-practitioner-essentials",
    },
  },
  {
    keys: ["docker", "kubernetes", "k8s"],
    course: {
      title: "Introduction to Containers",
      provider: "edX",
      url: "https://www.edx.org/learn/docker",
    },
  },
  {
    keys: ["machine learning", "ml", "tensorflow", "pytorch"],
    course: {
      title: "Machine Learning",
      provider: "Coursera",
      url: "https://www.coursera.org/learn/machine-learning",
    },
  },
];

export function suggestCourse(skill: string): CourseSuggestion {
  const key = skill.trim().toLowerCase();
  for (const row of CATALOG) {
    if (row.keys.some((k) => key === k || key.includes(k))) {
      return row.course;
    }
  }
  const q = encodeURIComponent(skill.trim());
  return {
    title: `Courses matching ${skill.trim()}`,
    provider: "Coursera",
    url: `https://www.coursera.org/search?query=${q}`,
  };
}
