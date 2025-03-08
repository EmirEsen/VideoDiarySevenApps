export interface TrimmedVideo {
    id: string;
    localUri: string;
    filename: string;
    duration: number;
    trimStart: number;
    trimEnd: number;
    thumbnailUri: string;
    createdAt: number;
    name: string;
    description: string;
}