export enum outputType {
    download = "download",
    dropbox = "dropbox",
}

export type optionDataType = {
    outputType: outputType;
    outputPath: string;
};
