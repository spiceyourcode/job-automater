export function csvCell(value: unknown): string {
    if (value == null)
        return "";
    const s = String(value);
    if (/[",\n\r]/.test(s))
        return `"${s.replace(/"/g, '""')}"`;
    return s;
}
export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
    const lines = [headers.map(csvCell).join(",")];
    for (const row of rows) {
        lines.push(row.map(csvCell).join(","));
    }
    return `${lines.join("\n")}\n`;
}
export function assertOwnerOnly<T extends {
    userId?: string | null;
}>(ownerId: string, rows: T[]): T[] {
    for (const row of rows) {
        if (row.userId != null && row.userId !== ownerId) {
            throw new Error("export_owner_mismatch");
        }
    }
    return rows;
}
