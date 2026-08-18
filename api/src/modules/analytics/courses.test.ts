import { describe, expect, it } from "vitest";
import { suggestCourse } from "./courses.js";

describe("suggestCourse", () => {
  it("maps python to the catalog entry", () => {
    const course = suggestCourse("Python");
    expect(course.provider).toBe("Coursera");
    expect(course.url).toContain("coursera.org");
  });

  it("falls back to a search URL for unknown skills", () => {
    const course = suggestCourse("Fortran 77");
    expect(course.url).toContain("query=Fortran");
  });
});
