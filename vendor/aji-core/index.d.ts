export function isBlankIssnPart(value: string): boolean;
export function normalizeIssnPart(value: unknown): string;
export function combineIssnParts(print: unknown, electronic: unknown): string;
export function splitIssnParts(issn: unknown): { print: string; electronic: string };
export function splitIssnDisplay(issn: string): { print: string; electronic: string };
export function getPrimaryIssn(issn: string): string;
export function getLegacyFavoriteId(issn: string): string;
export function formatIssnDisplay(issn: string): string;
export function getJcrReleaseYear(impactFactorYear: number): number;
