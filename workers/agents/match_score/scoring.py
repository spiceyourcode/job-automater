"""Deterministic multi-factor scoring (TRD FR-JM-01)."""

from __future__ import annotations

import re
from typing import Any

from agents.match_score.schema import DEFAULT_WEIGHTS

_WS = re.compile(r"\s+")


def _norm_skill(s: str) -> str:
    return _WS.sub(" ", s.lower().strip())


def _skills_from_profile(profile: dict[str, Any]) -> list[str]:
    raw = profile.get("technical_skills") or []
    out: list[str] = []
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, str):
                out.append(_norm_skill(item))
            elif isinstance(item, dict):
                name = item.get("name") or item.get("skill")
                if name:
                    out.append(_norm_skill(str(name)))
    return [s for s in out if s]


def _skills_from_job(job: dict[str, Any]) -> list[str]:
    tags = job.get("tags") or []
    keywords = job.get("keywords") or []
    tech = job.get("tech_stack") or []
    out: list[str] = []
    for t in list(tags) + list(keywords):
        if isinstance(t, str):
            out.append(_norm_skill(t))
    for t in tech:
        if isinstance(t, dict) and t.get("name"):
            out.append(_norm_skill(str(t["name"])))
        elif isinstance(t, str):
            out.append(_norm_skill(t))
    # Also mine description
    blob = " ".join(
        [
            str(job.get("title") or ""),
            str(job.get("description") or ""),
            str(job.get("requirements") or ""),
        ]
    ).lower()
    for s in (
        "python",
        "typescript",
        "javascript",
        "react",
        "fastapi",
        "django",
        "postgresql",
        "postgres",
        "aws",
        "kubernetes",
        "docker",
        "go",
        "rust",
        "java",
        "sql",
        "redis",
        "graphql",
        "node",
    ):
        if s in blob:
            out.append("postgresql" if s == "postgres" else s)
    # unique
    seen: set[str] = set()
    uniq: list[str] = []
    for s in out:
        if s not in seen:
            seen.add(s)
            uniq.append(s)
    return uniq


def score_skills(
    profile: dict[str, Any],
    job: dict[str, Any],
    *,
    vector_hits: list[str] | None = None,
) -> tuple[float, list[dict[str, Any]], list[dict[str, Any]]]:
    user_skills = set(_skills_from_profile(profile))
    if vector_hits:
        user_skills |= {_norm_skill(h) for h in vector_hits}
    job_skills = _skills_from_job(job)
    if not job_skills:
        # Sparse posting (no JD/tags) — do not pretend a strong skill match (~70).
        # Title-only overlap still helps when profile skills appear in the title.
        title = str(job.get("title") or "").lower()
        title_hits = [s for s in user_skills if s and s in title]
        if title_hits:
            return (
                round(min(65.0, 35.0 + len(title_hits) * 10), 2),
                [{"skill": s, "match": 0.6} for s in title_hits[:8]],
                [],
            )
        return 40.0, [], []
    matched = [s for s in job_skills if s in user_skills]
    missing = [s for s in job_skills if s not in user_skills]
    ratio = len(matched) / len(job_skills)
    score = round(ratio * 100, 2)
    return (
        score,
        [{"skill": s, "match": 1.0} for s in matched],
        [{"skill": s, "required": True} for s in missing],
    )


def score_experience(profile: dict[str, Any], job: dict[str, Any]) -> float:
    years = profile.get("years_experience")
    level = str(job.get("experience_level") or "").lower()
    title = str(job.get("title") or "").lower()
    # Infer required years from level/title
    need = 3
    if level in ("entry", "junior") or "junior" in title or "entry" in title:
        need = 1
    elif level in ("mid",) or "mid" in title:
        need = 3
    elif level in ("senior",) or "senior" in title:
        need = 5
    elif level in ("lead", "principal", "staff") or any(
        x in title for x in ("lead", "principal", "staff")
    ):
        need = 8
    elif level == "executive":
        need = 12
    if years is None:
        return 55.0
    y = int(years)
    if y >= need:
        return min(100.0, 80.0 + (y - need) * 4)
    if y >= need - 1:
        return 70.0
    return max(20.0, 50.0 - (need - y) * 10)


def score_location(profile: dict[str, Any], job: dict[str, Any]) -> float:
    prefs = profile.get("preferred_locations") or []
    pref_strs = []
    for p in prefs if isinstance(prefs, list) else []:
        if isinstance(p, str):
            pref_strs.append(p.lower())
        elif isinstance(p, dict) and p.get("name"):
            pref_strs.append(str(p["name"]).lower())
    job_loc = str(job.get("location") or "").lower()
    remote = bool(job.get("is_remote"))
    remote_type = str(job.get("remote_type") or "").lower()
    willing = bool(profile.get("willing_to_relocate"))

    if remote or remote_type in ("fully_remote", "remote_ok"):
        if any("remote" in p for p in pref_strs):
            return 95.0
        # Empty prefs: mild positive, not a near-perfect score for every remote job.
        if not pref_strs:
            return 70.0
        return 85.0
    if not job_loc:
        return 60.0
    for p in pref_strs:
        if p and (p in job_loc or job_loc in p):
            return 100.0
    if willing:
        return 55.0
    return 35.0


def score_salary(profile: dict[str, Any], job: dict[str, Any]) -> float:
    """Both sides in integer cents (HG-3)."""
    u_min = profile.get("salary_min")
    u_max = profile.get("salary_max")
    j_min = job.get("salary_min")
    j_max = job.get("salary_max")
    if u_min is None and u_max is None:
        return 70.0
    if j_min is None and j_max is None:
        return 65.0
    # Overlap of ranges
    a0 = int(u_min or 0)
    a1 = int(u_max or u_min or 0)
    b0 = int(j_min or 0)
    b1 = int(j_max or j_min or 0)
    if a1 < a0:
        a0, a1 = a1, a0
    if b1 < b0:
        b0, b1 = b1, b0
    overlap = max(0, min(a1, b1) - max(a0, b0))
    span = max(a1 - a0, b1 - b0, 1)
    ratio = overlap / span
    if overlap > 0:
        return round(min(100.0, 70.0 + ratio * 30), 2)
    # Job pays above user min?
    if b1 >= a0:
        return 75.0
    if b1 >= a0 * 0.9:
        return 60.0
    return 30.0


def score_culture(profile: dict[str, Any], job: dict[str, Any]) -> float:
    """Light heuristic from employment type + soft preference overlap."""
    emp = profile.get("employment_types") or ["full-time"]
    job_emp = str(job.get("employment_type") or "").lower()
    emp_norm = [str(e).lower() for e in emp] if isinstance(emp, list) else ["full-time"]
    if not job_emp:
        base = 50.0  # unknown employment type — do not default to strong culture fit
    else:
        base = 80.0 if job_emp in emp_norm else 50.0
    # Soft skills mentioned in description
    soft = profile.get("soft_skills") or []
    blob = str(job.get("description") or "").lower()
    hits = 0
    for s in soft if isinstance(soft, list) else []:
        name = s if isinstance(s, str) else (s.get("name") if isinstance(s, dict) else None)
        if name and str(name).lower() in blob:
            hits += 1
    return min(100.0, base + hits * 5)


def build_reasoning(
    *,
    overall: float,
    skill: float,
    exp: float,
    loc: float,
    sal: float,
    cult: float,
    matched: list[dict[str, Any]],
    missing: list[dict[str, Any]],
) -> str:
    matched_names = ", ".join(m["skill"] for m in matched[:8]) or "none listed"
    missing_names = ", ".join(m["skill"] for m in missing[:5]) or "none critical"
    return (
        f"Overall match {overall:.0f}/100. Skills {skill:.0f} (matched: {matched_names}; "
        f"gaps: {missing_names}). Experience {exp:.0f}, location {loc:.0f}, "
        f"salary {sal:.0f}, culture {cult:.0f}. Weights: skills 40%, experience 25%, "
        f"location 15%, salary 10%, culture 10%."
    )


def compute_match_score(
    profile: dict[str, Any],
    job: dict[str, Any],
    *,
    vector_hits: list[str] | None = None,
    weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    w = dict(weights or DEFAULT_WEIGHTS)
    skill, matched, missing = score_skills(profile, job, vector_hits=vector_hits)
    exp = score_experience(profile, job)
    loc = score_location(profile, job)
    sal = score_salary(profile, job)
    cult = score_culture(profile, job)
    overall = round(
        skill * w["skills"]
        + exp * w["experience"]
        + loc * w["location"]
        + sal * w["salary"]
        + cult * w["culture"],
        2,
    )
    # Incomplete postings (no JD / requirements) cannot claim high confidence matches.
    desc = str(job.get("description") or "").strip()
    reqs = str(job.get("requirements") or "").strip()
    if len(desc) < 40 and len(reqs) < 40:
        overall = round(max(15.0, overall - 8.0), 2)
    reasoning = build_reasoning(
        overall=overall,
        skill=skill,
        exp=exp,
        loc=loc,
        sal=sal,
        cult=cult,
        matched=matched,
        missing=missing,
    )
    model_used = "heuristic-v1"
    try:
        from lib.llm import has_chat_provider

        if has_chat_provider():
            from agents.match_score.llm import rewrite_reasoning

            rewritten = rewrite_reasoning(
                reasoning=reasoning,
                overall=overall,
                matched_names=[m["skill"] for m in matched[:8]],
                missing_names=[m["skill"] for m in missing[:5]],
                job_title=str(job.get("title") or ""),
                company=str(job.get("company") or ""),
            )
            if rewritten:
                reasoning = rewritten
                model_used = "hybrid-match-v1"
    except Exception:  # noqa: BLE001
        pass
    return {
        "overall_score": overall,
        "skill_match": skill,
        "experience_match": exp,
        "location_match": loc,
        "salary_match": sal,
        "culture_match": cult,
        "weights": w,
        "matched_skills": matched,
        "missing_skills": missing,
        "nice_to_have_skills": [],
        "reasoning": reasoning,
        "confidence": 0.75,
        "model_used": model_used,
    }
